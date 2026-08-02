import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { getSupabaseClient } from '../../storage/database/supabase-client';
import { NotificationService } from '../notification/notification.service';
import { WechatPayService } from './wechat-pay.service';

export interface PaymentRecord {
  id: string;
  order_id: string;
  user_id: string;
  prepay_id: string;
  transaction_id: string | null;
  channel: string;
  status: 'prepay' | 'paid' | 'failed' | 'refunding' | 'refunded';
  original_amount: number;
  discount_amount: number;
  pay_amount: number;
  refund_amount: number | null;
  lottery_record_id: string | null;
  notify_count: number;
  paid_at: string | null;
  refunded_at: string | null;
  created_at: string;
  updated_at: string;
}

const MIN_PAY_AMOUNT = 0.01; // 实付兜底：最低 0.01 元

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  private client = getSupabaseClient();

  constructor(
    private readonly notificationService: NotificationService,
    private readonly wechatPay: WechatPayService,
  ) {}

  /**
   * 金额计算引擎（后端权威计算，前端只展示）
   * 实付 = max(原始金额 - 折扣券/霸王餐抵扣, 0.01)
   */
  private async calculatePayAmount(order: any): Promise<{
    originalAmount: number;
    discountAmount: number;
    payAmount: number;
    discountRecord: any | null;
    discountName: string | null;
  }> {
    const originalAmount =
      parseFloat(order.original_amount || '0') ||
      parseFloat(order.price || '0') * (order.quantity || 1);

    // 查询本订单中奖待抵扣的折扣券/霸王餐（抽奖所得，本单即时抵扣）
    const { data: discountRecords, error: discountErr } = await this.client
      .from('lottery_records')
      .select('id, refund_amount, prizes:prize_id(prize_type, name)')
      .eq('order_id', order.id)
      .eq('is_winner', true)
      .eq('refund_status', 'locked')
      .order('created_at', { ascending: true })
      .limit(1);

    const discountRecord = discountRecords?.[0] || null;
    let discountAmount = 0;
    let discountName: string | null = null;

    if (discountRecord) {
      const prizeInfo = (discountRecord as any).prizes || {};
      const prizeType = prizeInfo.prize_type || '';
      const prizeName = prizeInfo.name || '';
      if (prizeType === 'free_meal') {
        // 霸王餐：本单免单，实付 0.01 兜底
        discountAmount = Math.max(
          Math.round((originalAmount - MIN_PAY_AMOUNT) * 100) / 100,
          0,
        );
        discountName = prizeName || '霸王餐免单';
      } else if (prizeType === 'coupon') {
        // 折扣券：抵扣中奖时算出的优惠金额
        discountAmount = Math.min(
          parseFloat(discountRecord.refund_amount || '0') || 0,
          Math.max(originalAmount - MIN_PAY_AMOUNT, 0),
        );
        discountAmount = Math.round(discountAmount * 100) / 100;
        discountName = prizeName || '折扣券';
      }
    }

    const payAmount = Math.max(
      Math.round((originalAmount - discountAmount) * 100) / 100,
      MIN_PAY_AMOUNT,
    );

    return {
      originalAmount: Math.round(originalAmount * 100) / 100,
      discountAmount,
      payAmount,
      discountRecord,
      discountName,
    };
  }

  /**
   * 发起支付预下单（Mock 通道；接入微信后此处生成真实 prepay_id）
   */
  async prepay(body: { order_id: string; user_id: string }) {
    if (!body.order_id || !body.user_id) {
      throw new BadRequestException('缺少 order_id 或 user_id');
    }

    const { data: order } = await this.client
      .from('orders')
      .select('*')
      .eq('id', body.order_id)
      .maybeSingle();
    if (!order) throw new NotFoundException('订单不存在');
    if (order.user_id !== body.user_id) {
      throw new BadRequestException('无权操作该订单');
    }
    if (order.status === 'paid' || order.status === 'used') {
      throw new BadRequestException('订单已支付，请勿重复支付');
    }
    if (order.status !== 'created') {
      throw new BadRequestException('订单状态不允许支付');
    }
    // 支付截止校验（懒关闭由订单查询侧兜底，这里再防御一次）
    if (order.pay_expire_at && new Date() > new Date(order.pay_expire_at)) {
      throw new BadRequestException('订单已超时关闭，请重新下单');
    }

    const calc = await this.calculatePayAmount(order);

    // 幂等：复用本订单未完成的支付单；若金额因券状态变化而不同则更新金额
    const { data: existing } = await this.client
      .from('payments')
      .select('*')
      .eq('order_id', order.id)
      .eq('status', 'prepay')
      .order('created_at', { ascending: false })
      .limit(1);

    let payment = existing?.[0] as PaymentRecord | undefined;
    let amountChanged = false;
    if (payment) {
      if (
        Number(payment.pay_amount) !== calc.payAmount ||
        Number(payment.discount_amount) !== calc.discountAmount
      ) {
        const { data: updated, error } = await this.client
          .from('payments')
          .update({
            original_amount: calc.originalAmount,
            discount_amount: calc.discountAmount,
            pay_amount: calc.payAmount,
            lottery_record_id: calc.discountRecord?.id || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', payment.id)
          .select()
          .single();
        if (error) {
          throw new InternalServerErrorException(`更新支付单失败: ${error.message}`);
        }
        payment = updated as PaymentRecord;
        amountChanged = true;
      }
    } else {
      const prepayId = `mock_prepay_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      const { data: created, error } = await this.client
        .from('payments')
        .insert({
          order_id: order.id,
          user_id: body.user_id,
          prepay_id: prepayId,
          channel: 'mock',
          status: 'prepay',
          original_amount: calc.originalAmount,
          discount_amount: calc.discountAmount,
          pay_amount: calc.payAmount,
          lottery_record_id: calc.discountRecord?.id || null,
        })
        .select()
        .single();
      if (error) {
        throw new InternalServerErrorException(`创建支付单失败: ${error.message}`);
      }
      payment = created as PaymentRecord;
    }

    // ===== 微信通道：支付配置齐全且用户已微信授权（有 open_id）时走真实下单 =====
    if (this.wechatPay.isEnabled()) {
      try {
        const { data: userRow } = await this.client
          .from('users')
          .select('open_id')
          .eq('user_id', body.user_id)
          .maybeSingle();
        const openId = (userRow as any)?.open_id;
        if (openId) {
          const outTradeNo = payment.id.replace(/-/g, '');
          let prepayId = payment.prepay_id;
          const needNewOrder =
            amountChanged ||
            payment.channel !== 'wechat' ||
            !prepayId ||
            prepayId.startsWith('mock_');
          if (needNewOrder) {
            // 金额变更需先关闭旧微信订单再重新下单
            if (payment.channel === 'wechat' && prepayId && !prepayId.startsWith('mock_')) {
              await this.wechatPay.closeOrder(outTradeNo);
            }
            const { data: orderRow } = await this.client
              .from('orders')
              .select('packages:package_id(name)')
              .eq('id', order.id)
              .maybeSingle();
            const description = (orderRow?.packages as any)?.name || '团购套餐';
            prepayId = await this.wechatPay.createJsapiOrder({
              outTradeNo,
              description,
              totalFen: Math.round(calc.payAmount * 100),
              openId,
            });
            const { data: wxUpdated, error: wxErr } = await this.client
              .from('payments')
              .update({
                prepay_id: prepayId,
                channel: 'wechat',
                updated_at: new Date().toISOString(),
              })
              .eq('id', payment.id)
              .select()
              .single();
            if (wxErr) {
              throw new InternalServerErrorException(`更新支付单失败: ${wxErr.message}`);
            }
            payment = wxUpdated as PaymentRecord;
          }
          return {
            prepay_id: prepayId,
            channel: 'wechat',
            wechat_pay: this.wechatPay.buildMiniProgramPayParams(prepayId),
            original_amount: calc.originalAmount,
            discount_amount: calc.discountAmount,
            pay_amount: calc.payAmount,
            discount_name: calc.discountName,
            pay_expire_at: order.pay_expire_at,
          };
        }
        this.logger.log(`用户 ${body.user_id} 未绑定微信 open_id，回退 Mock 支付通道`);
      } catch (err: any) {
        this.logger.error(`微信下单失败，回退 Mock 通道: ${err?.message}`);
      }
    }

    return {
      prepay_id: payment.prepay_id,
      channel: payment.channel,
      original_amount: calc.originalAmount,
      discount_amount: calc.discountAmount,
      pay_amount: calc.payAmount,
      discount_name: calc.discountName,
      pay_expire_at: order.pay_expire_at,
    };
  }

  /**
   * 支付结果回调（Mock 版：模拟微信异步通知；接入微信后由 /payment/notify 承担）
   * 原则：以回调为准变更订单状态，前端不参与状态判断
   */
  async mockNotify(body: { prepay_id: string; result?: 'success' | 'fail' }) {
    if (!body.prepay_id) throw new BadRequestException('缺少 prepay_id');
    return this.handlePaidNotify(body.prepay_id, body.result || 'success');
  }

  /**
   * 微信支付结果回调（V3）：验签 + 解密 → 复用统一状态流转
   * 响应由 Controller 按微信约定返回 { code, message }；抛错即触发微信重试（幂等已保证）
   */
  async handleWechatNotify(
    headers: Record<string, string | string[] | undefined>,
    rawBody: string,
  ) {
    if (!this.wechatPay.isEnabled()) {
      throw new BadRequestException('微信支付未配置');
    }
    const result = await this.wechatPay.verifyAndDecryptNotify(headers, rawBody);
    this.logger.log(
      `微信支付回调: out_trade_no=${result?.out_trade_no}, trade_state=${result?.trade_state}, transaction_id=${result?.transaction_id}`,
    );
    if (result?.trade_state !== 'SUCCESS') {
      return { handled: false, trade_state: result?.trade_state };
    }
    // out_trade_no = payment.id 去连字符（32 位 hex）→ 还原为 uuid 查支付单
    const raw = String(result.out_trade_no || '');
    const paymentId =
      raw.length === 32
        ? `${raw.slice(0, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}-${raw.slice(16, 20)}-${raw.slice(20)}`
        : raw;
    const { data: payment } = await this.client
      .from('payments')
      .select('prepay_id')
      .eq('id', paymentId)
      .maybeSingle();
    if (!payment) throw new NotFoundException('支付单不存在');
    const handled = await this.handlePaidNotify(payment.prepay_id, 'success', {
      transactionId: result.transaction_id,
    });
    return { handled: true, ...handled };
  }

  /**
   * 支付回调统一处理（幂等：transaction_id 唯一约束 + 状态机守卫）
   */
  private async handlePaidNotify(
    prepayId: string,
    result: 'success' | 'fail',
    opts?: { transactionId?: string },
  ) {
    const { data: payment } = await this.client
      .from('payments')
      .select('*')
      .eq('prepay_id', prepayId)
      .maybeSingle();
    if (!payment) throw new NotFoundException('支付单不存在');

    // 幂等：重复回调直接返回成功，不重复发放权益
    if (payment.status === 'paid') {
      await this.client
        .from('payments')
        .update({
          notify_count: (payment.notify_count || 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', payment.id);
      return {
        status: 'paid',
        order_id: payment.order_id,
        idempotent: true,
        message: '重复回调，已幂等处理',
      };
    }

    if (result === 'fail') {
      await this.client
        .from('payments')
        .update({ status: 'failed', updated_at: new Date().toISOString() })
        .eq('id', payment.id);
      return { status: 'failed', order_id: payment.order_id };
    }

    if (payment.status !== 'prepay') {
      throw new BadRequestException('支付单状态异常，无法完成支付');
    }

    const now = new Date().toISOString();
    const transactionId =
      opts?.transactionId ||
      `mock_tx_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

    // 1. 支付单 → paid
    const { error: payErr } = await this.client
      .from('payments')
      .update({
        status: 'paid',
        transaction_id: transactionId,
        paid_at: now,
        updated_at: now,
      })
      .eq('id', payment.id)
      .eq('status', 'prepay'); // 状态机守卫，防并发重复
    if (payErr) {
      throw new InternalServerErrorException(`更新支付单失败: ${payErr.message}`);
    }

    // 2. 订单 → paid（待核销）
    const { error: orderErr } = await this.client
      .from('orders')
      .update({
        status: 'paid',
        pay_amount: payment.pay_amount,
        discount_amount: payment.discount_amount,
        paid_at: now,
        updated_at: now,
      })
      .eq('id', payment.order_id)
      .eq('status', 'created');
    if (orderErr) {
      throw new InternalServerErrorException(`更新订单失败: ${orderErr.message}`);
    }

    // 3. 本单抵扣的折扣券/霸王餐：locked → redeemed（抵扣生效，直接核销）
    if (payment.lottery_record_id) {
      await this.client
        .from('lottery_records')
        .update({ refund_status: 'redeemed', redeemed_at: now })
        .eq('id', payment.lottery_record_id)
        .eq('refund_status', 'locked');
    }

    // 通知5：订单付款成功通知
    const { data: paidOrder } = await this.client
      .from('orders')
      .select('order_no, packages:package_id(name)')
      .eq('id', payment.order_id)
      .maybeSingle();
    await this.notificationService.notify(payment.user_id, 'order_paid', {
      package_name: (paidOrder?.packages as any)?.name || '团购套餐',
      amount: payment.pay_amount,
      order_no: paidOrder?.order_no || '',
    });

    return {
      status: 'paid',
      order_id: payment.order_id,
      transaction_id: transactionId,
      pay_amount: payment.pay_amount,
    };
  }

  /**
   * 用户主动退款（Mock 版；未核销团购券可退，支持按份部分退款）
   * 金额引擎：
   * - 单份实付价 = 实付金额 ÷ 购买份数
   * - 部分退款：退款金额 = 单份实付价 × 退款份数（四舍五入2位，封顶剩余可退金额）
   * - 全额退款（退完全部剩余份数）：退款金额 = 实付 − 已返还折扣 − 累计已退（中奖返还已到账，全退须扣除）
   * 营销权益联动：一旦发生退款，本单折扣权益即作废(voided)，不可恢复
   */
  async refund(body: { order_id: string; user_id: string; reason?: string; note?: string; refund_quantity?: number }) {
    if (!body.order_id || !body.user_id) {
      throw new BadRequestException('缺少 order_id 或 user_id');
    }

    const { data: order } = await this.client
      .from('orders')
      .select('*')
      .eq('id', body.order_id)
      .maybeSingle();
    if (!order) throw new NotFoundException('订单不存在');
    if (order.user_id !== body.user_id) {
      throw new BadRequestException('无权操作该订单');
    }
    if (order.status === 'used') {
      throw new BadRequestException('订单已核销，不可退款');
    }
    if (order.status === 'refunded') {
      throw new BadRequestException('订单已退款');
    }
    if (order.status !== 'paid') {
      throw new BadRequestException('仅已支付订单可申请退款');
    }

    const quantity = order.quantity || 1;
    const verifiedCount = order.verified_count || 0;
    const refundedQty = order.refunded_quantity || 0;
    const refundableQty = quantity - verifiedCount - refundedQty;
    if (refundableQty <= 0) {
      throw new BadRequestException('该订单已无可退款份数');
    }

    const refundQty = body.refund_quantity ? Math.floor(Number(body.refund_quantity)) : refundableQty;
    if (!Number.isFinite(refundQty) || refundQty < 1) {
      throw new BadRequestException('退款份数无效');
    }
    if (refundQty > refundableQty) {
      throw new BadRequestException(`最多可退 ${refundableQty} 份`);
    }

    const { data: payment } = await this.client
      .from('payments')
      .select('*')
      .eq('order_id', order.id)
      .in('status', ['paid', 'refunded'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const paidAmount =
      parseFloat(order.pay_amount || '0') ||
      parseFloat(order.original_amount || '0') ||
      parseFloat(order.price || '0') * quantity;

    // 已返还金额：中奖的折扣券/霸王餐已即时返还原账户，全退须扣除
    // 以 redeemed_at 判定"返还已发生"（券后续被作废 voided 时返还也已到账，仍须扣除）
    const { data: rebateRecords } = await this.client
      .from('lottery_records')
      .select('refund_amount')
      .eq('order_id', order.id)
      .not('redeemed_at', 'is', null)
      .gt('refund_amount', 0);
    const rebateAmount = (rebateRecords || []).reduce(
      (sum, r: any) => sum + (parseFloat(r.refund_amount || '0') || 0),
      0,
    );

    // 累计已退金额（此前部分退款）
    const alreadyRefunded = parseFloat(payment?.refund_amount || '0') || 0;

    // 全额退款判定：仅在无任何已核销份数时，才允许"退剩余全部金额"（扣除已返还折扣）；
    // 存在已核销份数时一律按实付均价退，确保已消费部分的金额不会被退掉
    const isFullRefund = verifiedCount === 0 && refundQty === refundableQty;
    const unitPay = Math.round((paidAmount / quantity) * 100) / 100;
    let refundAmount: number;
    if (isFullRefund) {
      // 全退：退剩余全部（扣除已返还折扣与累计已退）
      refundAmount = Math.round(Math.max(paidAmount - rebateAmount - alreadyRefunded, 0) * 100) / 100;
    } else {
      // 部分退：按实付均价退
      refundAmount = Math.round(unitPay * refundQty * 100) / 100;
      const remainRefundable = Math.round((paidAmount - alreadyRefunded) * 100) / 100;
      refundAmount = Math.min(refundAmount, remainRefundable);
    }

    const now = new Date().toISOString();
    const newRefundedQty = refundedQty + refundQty;
    const fullyRefunded = verifiedCount + newRefundedQty >= quantity;
    const totalRefundedAmount = Math.round((alreadyRefunded + refundAmount) * 100) / 100;

    // ===== 微信通道：真实支付单先发起微信退款，受理成功后才落库 =====
    if (payment?.channel === 'wechat' && this.wechatPay.isEnabled() && refundAmount > 0) {
      const outRefundNo = `R${payment.id.replace(/-/g, '')}${refundQty}${Date.now().toString(36)}`.slice(0, 64);
      try {
        await this.wechatPay.createRefund({
          transactionId: payment.transaction_id || undefined,
          outTradeNo: payment.id.replace(/-/g, ''),
          outRefundNo,
          refundFen: Math.round(refundAmount * 100),
          totalFen: Math.round(paidAmount * 100),
          reason: body.reason || '用户申请退款',
        });
        this.logger.log(`微信退款受理成功: payment=${payment.id}, refund=¥${refundAmount}`);
      } catch (err: any) {
        this.logger.error(`微信退款失败: ${err?.message}`);
        throw new InternalServerErrorException(`微信退款失败: ${err?.message}`);
      }
    }

    // 1. 支付单：累计退款金额；全退时 → refunded
    if (payment) {
      const { error: payErr } = await this.client
        .from('payments')
        .update({
          status: fullyRefunded ? 'refunded' : 'paid',
          refund_amount: totalRefundedAmount,
          refunded_at: now,
          updated_at: now,
        })
        .eq('id', payment.id);
      if (payErr) {
        throw new InternalServerErrorException(`退款失败: ${payErr.message}`);
      }
    }

    // 2. 订单：累计退款份数/金额；全退 → refunded
    const orderUpdate: Record<string, any> = {
      refunded_quantity: newRefundedQty,
      refund_amount: totalRefundedAmount,
      updated_at: now,
    };
    if (fullyRefunded) {
      orderUpdate.status = 'refunded';
    }
    const { error: orderErr } = await this.client
      .from('orders')
      .update(orderUpdate)
      .eq('id', order.id)
      .eq('status', 'paid');
    if (orderErr) {
      throw new InternalServerErrorException(`更新订单失败: ${orderErr.message}`);
    }

    // 3. 营销权益联动：一旦发生退款，本单折扣权益作废，不可恢复
    // 注意：lottery_records 无 prize_type 列，locked/redeemed 状态仅存在于折扣券/霸王餐
    await this.client
      .from('lottery_records')
      .update({ refund_status: 'voided' })
      .eq('order_id', order.id)
      .in('refund_status', ['locked', 'redeemed', 'pending']);

    // 4. 按退款份数回补团购库存
    if (order.package_id) {
      const { data: pkg } = await this.client
        .from('packages')
        .select('stock')
        .eq('id', order.package_id)
        .single();
      if (pkg) {
        await this.client
          .from('packages')
          .update({ stock: (pkg.stock || 0) + refundQty })
          .eq('id', order.package_id);
      }
    }

    const reasonText = body.reason ? `（${body.reason}${body.note ? `：${body.note}` : ''}）` : '';
    let message: string;
    if (isFullRefund && rebateAmount > 0) {
      message = `已退款 ¥${refundAmount}（实付 ¥${paidAmount.toFixed(2)} − 已返还 ¥${rebateAmount.toFixed(2)}），折扣权益已作废`;
    } else if (!fullyRefunded) {
      message = `已退款 ¥${refundAmount}（¥${unitPay.toFixed(2)} × ${refundQty}份），剩余 ${quantity - verifiedCount - newRefundedQty} 份仍可使用`;
    } else {
      message = `已退款 ¥${refundAmount}`;
    }

    // 通知13：客户退款成功通知
    const { data: refundOrder } = await this.client
      .from('orders')
      .select('order_no, packages:package_id(name, merchant_id)')
      .eq('id', order.id)
      .maybeSingle();
    const refundPkgName = (refundOrder?.packages as any)?.name || '团购套餐';
    await this.notificationService.notify(body.user_id, 'customer_refund_success', {
      package_name: refundPkgName,
      refund_amount: refundAmount,
    });

    // 通知9：商户退款成功通知
    const refundMerchantId = (refundOrder?.packages as any)?.merchant_id;
    if (refundMerchantId) {
      await this.notificationService.notifyMerchant(refundMerchantId, 'merchant_refund_success', {
        package_name: refundPkgName,
        refund_amount: refundAmount,
        order_no: refundOrder?.order_no || '',
      });
    }

    return {
      status: fullyRefunded ? 'refunded' : 'partial_refunded',
      order_id: order.id,
      refund_amount: refundAmount,
      refund_quantity: refundQty,
      total_refunded: totalRefundedAmount,
      rebate_amount: rebateAmount,
      reason: reasonText || undefined,
      message,
    };
  }

  /** 查询订单可退款信息（退款申请页金额引擎预览） */
  async getRefundable(orderId: string) {
    const { data: order } = await this.client
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .maybeSingle();
    if (!order) throw new NotFoundException('订单不存在');

    const quantity = order.quantity || 1;
    const verifiedCount = order.verified_count || 0;
    const refundedQty = order.refunded_quantity || 0;
    const paidAmount =
      parseFloat(order.pay_amount || '0') ||
      parseFloat(order.original_amount || '0') ||
      parseFloat(order.price || '0') * quantity;

    // 以 redeemed_at 判定"返还已发生"（含 redeemed→voided 的券）
    const { data: rebateRecords } = await this.client
      .from('lottery_records')
      .select('refund_amount')
      .eq('order_id', order.id)
      .not('redeemed_at', 'is', null)
      .gt('refund_amount', 0);
    const rebateAmount = (rebateRecords || []).reduce(
      (sum, r: any) => sum + (parseFloat(r.refund_amount || '0') || 0),
      0,
    );

    const { data: payment } = await this.client
      .from('payments')
      .select('refund_amount')
      .eq('order_id', order.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const alreadyRefunded = parseFloat(payment?.refund_amount || '0') || 0;

    return {
      order_status: order.status,
      quantity,
      verified_count: verifiedCount,
      refunded_quantity: refundedQty,
      refundable_quantity: Math.max(quantity - verifiedCount - refundedQty, 0),
      pay_amount: paidAmount,
      unit_pay: Math.round((paidAmount / quantity) * 100) / 100,
      rebate_amount: rebateAmount,
      already_refunded: alreadyRefunded,
    };
  }

  /** 查询订单的支付信息（金额明细） */
  async getByOrder(orderId: string) {
    const { data: payment } = await this.client
      .from('payments')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return payment || null;
  }
}
