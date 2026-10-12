import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import * as crypto from 'crypto';
import { NotificationService } from '../notification/notification.service';
import { WechatPayService } from '../payment/wechat-pay.service';
import { PaymentService } from '../payment/payment.service';
import { CouponsService } from '../coupons/coupons.service';

export interface UpdateTeamLotteryConfigDto {
  enabled?: boolean;
  team_size?: number;
  duration_hours?: number;
  leader_prize_id?: string | null;
  member_prize_ids?: string[];
  leader_bonus_prize_ids?: string[];
  leader_bonus_rate?: number;
  share_title?: string;
  share_desc?: string;
  share_image_url?: string | null;
  logo_image_url?: string | null;
}

export interface CreateGroupDto {
  merchant_id: number;
  package_id: string;
  order_id: string;
  user_id: string;
}

export interface JoinGroupDto {
  user_id: string;
  order_id?: string;
}

export interface DrawPrizeDto {
  user_id: string;
}

@Injectable()
export class TeamLotteryService {
  private client = getSupabaseClient();
  private readonly logger = new Logger(TeamLotteryService.name);

  constructor(
    private readonly notificationService: NotificationService,
    private readonly paymentService: PaymentService,
    private readonly wechatPay: WechatPayService,
    private readonly couponsService: CouponsService,
  ) {}

  private now() {
    return new Date().toISOString();
  }

  private addHours(hours: number) {
    const d = new Date();
    d.setHours(d.getHours() + hours);
    return d.toISOString();
  }

  private randomCode(prefix: string, len = 5) {
    const rand = crypto.randomBytes(4).toString('hex').toUpperCase().slice(0, len);
    return `${prefix}${Date.now()}${rand}`;
  }

  private generateInviteCode() {
    return crypto.randomBytes(4).toString('hex').toUpperCase();
  }

  private async getMerchant(merchantId: number) {
    const { data, error } = await this.client
      .from('merchants')
      .select('id, name, marketing_features, wifi_enabled')
      .eq('id', merchantId)
      .maybeSingle();
    if (error) throw new Error(`查询商家失败: ${error.message}`);
    if (!data) throw new NotFoundException('商家不存在');
    return data as any;
  }

  private async getConfigRow(merchantId: number) {
    const { data, error } = await this.client
      .from('merchant_team_lottery_configs')
      .select('*')
      .eq('merchant_id', merchantId)
      .maybeSingle();
    if (error) throw new Error(`查询组队抽奖配置失败: ${error.message}`);
    return data as any;
  }

  /** 获取商家组队抽奖配置（管理端） */
  async getConfig(merchantId: number) {
    const merchant = await this.getMerchant(merchantId);
    const config = await this.getConfigRow(merchantId);
    const features = (merchant.marketing_features as Record<string, boolean>) || {};
    return {
      merchant_id: merchantId,
      marketing_feature_enabled: !!features.team_lottery,
      enabled: !!config?.enabled,
      team_size: config?.team_size || 3,
      duration_hours: config?.duration_hours || 24,
      leader_prize_id: config?.leader_prize_id || null,
      member_prize_ids: (config?.member_prize_ids as string[]) || [],
      leader_bonus_prize_ids: (config?.leader_bonus_prize_ids as string[]) || [],
      leader_bonus_rate: Number(config?.leader_bonus_rate ?? 0),
      share_title: config?.share_title || '组队抽大奖',
      share_desc: config?.share_desc || '我组了个队，快来一起免费抽奖',
      share_image_url: config?.share_image_url || null,
      logo_image_url: config?.logo_image_url || null,
    };
  }

  /** 更新商家组队抽奖配置（管理端） */
  async updateConfig(merchantId: number, dto: UpdateTeamLotteryConfigDto) {
    await this.getMerchant(merchantId);
    const existing = await this.getConfigRow(merchantId);
    const teamSize = Math.max(2, Math.min(20, Number(dto.team_size ?? existing?.team_size ?? 3)));
    const durationHours = Math.max(1, Math.min(168, Number(dto.duration_hours ?? existing?.duration_hours ?? 24)));
    const memberPrizeIds = Array.isArray(dto.member_prize_ids)
      ? dto.member_prize_ids.filter((id) => typeof id === 'string' && id.length > 0).slice(0, 10)
      : (existing?.member_prize_ids as string[]) || [];
    const leaderBonusPrizeIds = Array.isArray(dto.leader_bonus_prize_ids)
      ? dto.leader_bonus_prize_ids.filter((id) => typeof id === 'string' && id.length > 0).slice(0, 10)
      : (existing?.leader_bonus_prize_ids as string[]) || [];
    const leaderBonusRate = Math.max(0, Math.min(100, Number(dto.leader_bonus_rate ?? existing?.leader_bonus_rate ?? 0)));
    const payload = {
      merchant_id: merchantId,
      enabled: dto.enabled ?? existing?.enabled ?? false,
      team_size: teamSize,
      duration_hours: durationHours,
      leader_prize_id: dto.leader_prize_id ?? existing?.leader_prize_id ?? null,
      member_prize_ids: memberPrizeIds,
      leader_bonus_prize_ids: leaderBonusPrizeIds,
      leader_bonus_rate: leaderBonusRate,
      share_title: dto.share_title?.trim() || existing?.share_title || '组队抽大奖',
      share_desc: dto.share_desc?.trim() || existing?.share_desc || '我组了个队，快来一起免费抽奖',
      share_image_url: dto.share_image_url ?? existing?.share_image_url ?? null,
      logo_image_url: dto.logo_image_url ?? existing?.logo_image_url ?? null,
      updated_at: this.now(),
    };

    let data: any;
    if (existing) {
      const { data: updated, error } = await this.client
        .from('merchant_team_lottery_configs')
        .update(payload)
        .eq('id', existing.id)
        .select()
        .single();
      if (error) throw new Error(`更新配置失败: ${error.message}`);
      data = updated;
    } else {
      const { data: created, error } = await this.client
        .from('merchant_team_lottery_configs')
        .insert(payload)
        .select()
        .single();
      if (error) throw new Error(`创建配置失败: ${error.message}`);
      data = created;
    }

    return {
      id: data.id,
      merchant_id: data.merchant_id,
      enabled: data.enabled,
      team_size: data.team_size,
      duration_hours: data.duration_hours,
      leader_prize_id: data.leader_prize_id,
      member_prize_ids: data.member_prize_ids as string[],
      leader_bonus_prize_ids: (data.leader_bonus_prize_ids as string[]) || [],
      leader_bonus_rate: Number(data.leader_bonus_rate ?? 0),
      share_title: data.share_title,
      share_desc: data.share_desc,
      share_image_url: data.share_image_url,
      logo_image_url: data.logo_image_url,
    };
  }

  /** 获取商家可选奖品列表（管理端配置用） */
  async getPrizes(merchantId: number) {
    const { data, error } = await this.client
      .from('prizes')
      .select('id, name, prize_type, stock, coupon_amount, coupon_min_spend, product_name, product_value, is_active, image_url')
      .eq('merchant_id', merchantId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    if (error) throw new Error(`查询奖品失败: ${error.message}`);
    return (data || []).map((p: any) => ({
      id: p.id,
      name: p.name,
      prize_type: p.prize_type,
      stock: Number(p.stock || 0),
      coupon_amount: Number(p.coupon_amount || 0),
      coupon_min_spend: Number(p.coupon_min_spend || 0),
      product_name: p.product_name,
      product_value: Number(p.product_value || 0),
      image_url: p.image_url,
    }));
  }

  /** 查询奖品详情（返回百分比概率） */
  private async getPrizeDetails(prizeIds: string[]): Promise<any[]> {
    if (!prizeIds?.length) return [];
    const validIds = prizeIds.filter((id) => typeof id === 'string' && id.length > 0);
    if (!validIds.length) return [];
    const { data, error } = await this.client
      .from('prizes')
      .select('id, name, probability, image_url, prize_type')
      .in('id', validIds)
      .eq('is_active', true);
    if (error) throw new Error(`查询奖品详情失败: ${error.message}`);
    return (data || []).map((p: any) => ({
      id: p.id,
      name: p.name,
      // 数据库中 probability 已按百分比存储（如 30 表示 30%）
      probability: Number(p.probability || 0),
      image_url: p.image_url || null,
      prize_type: p.prize_type || 'coupon',
    }));
  }

  /** C端：查询商家组队抽奖是否可用 */
  async getMerchantStatus(merchantId: number, packageId?: string) {
    const merchant = await this.getMerchant(merchantId);
    const features = (merchant.marketing_features as Record<string, boolean>) || {};

    const merchantInfo = {
      id: merchant.id,
      name: merchant.name || '',
      address: merchant.address || null,
      phone: merchant.phone || null,
      logo: merchant.logo || null,
    };

    if (!features.team_lottery) {
      return {
        enabled: false,
        team_size: 3,
        duration_hours: 24,
        share_title: '',
        share_desc: '',
        share_image_url: null,
        logo_image_url: null,
        merchant: merchantInfo,
        package: null,
        leader_prize: null,
        member_prizes: [],
        leader_bonus_prizes: [],
        leader_bonus_rate: 0,
      };
    }
    const config = await this.getConfigRow(merchantId);
    if (!config || !config.enabled) {
      return {
        enabled: false,
        team_size: 3,
        duration_hours: 24,
        share_title: '',
        share_desc: '',
        share_image_url: null,
        logo_image_url: null,
        merchant: merchantInfo,
        package: null,
        leader_prize: null,
        member_prizes: [],
        leader_bonus_prizes: [],
        leader_bonus_rate: 0,
      };
    }

    // 查询套餐信息：优先使用传入的 package_id，否则取商家第一个有效套餐
    let packageInfo: any = null;
    if (packageId) {
      const { data: pkg } = await this.client.from('packages').select('*').eq('id', packageId).maybeSingle();
      if (pkg) {
        packageInfo = {
          id: pkg.id,
          name: pkg.name,
          description: pkg.description || null,
          price: Number(pkg.price || 0),
          original_price: pkg.original_price ? Number(pkg.original_price) : null,
          cover_image: pkg.cover_image || pkg.coverImage || null,
        };
      }
    }
    if (!packageInfo) {
      const { data: pkg } = await this.client
        .from('packages')
        .select('*')
        .eq('merchant_id', merchantId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (pkg) {
        packageInfo = {
          id: pkg.id,
          name: pkg.name,
          description: pkg.description || null,
          price: Number(pkg.price || 0),
          original_price: pkg.original_price ? Number(pkg.original_price) : null,
          cover_image: pkg.cover_image || pkg.coverImage || null,
        };
      }
    }

    const [leaderPrizeDetails, memberPrizeDetails, leaderBonusPrizeDetails] = await Promise.all([
      config.leader_prize_id ? this.getPrizeDetails([config.leader_prize_id as string]) : Promise.resolve([]),
      this.getPrizeDetails((config.member_prize_ids as string[]) || []),
      this.getPrizeDetails((config.leader_bonus_prize_ids as string[]) || []),
    ]);

    return {
      enabled: true,
      team_size: config.team_size || 3,
      duration_hours: config.duration_hours || 24,
      share_title: config.share_title || '',
      share_desc: config.share_desc || '',
      share_image_url: config.share_image_url || null,
      logo_image_url: config.logo_image_url || null,
      merchant: merchantInfo,
      package: packageInfo,
      leader_prize: leaderPrizeDetails[0] || null,
      member_prizes: memberPrizeDetails,
      leader_bonus_prizes: leaderBonusPrizeDetails,
      leader_bonus_rate: Number(config.leader_bonus_rate ?? 0),
    };
  }

  /** C端：查询用户在某商家的可开团订单 */
  async getUserOrders(userId: string, merchantId: number) {
    const { data: packages, error: pkgError } = await this.client
      .from('packages')
      .select('id')
      .eq('merchant_id', merchantId);
    if (pkgError) throw new Error(`查询商家套餐失败: ${pkgError.message}`);
    const packageIds = (packages || []).map((p: any) => p.id);
    if (packageIds.length === 0) return [];

    const { data: orders, error } = await this.client
      .from('orders')
      .select('id, package_id, package_name, status, paid_at, created_at')
      .eq('user_id', userId)
      .in('package_id', packageIds)
      .in('status', ['paid', 'used'])
      .order('created_at', { ascending: false });
    if (error) throw new Error(`查询订单失败: ${error.message}`);
    const orderIds = (orders || []).map((o: any) => o.id);
    if (orderIds.length === 0) return [];
    // 过滤已用于组队开团或已参与普通抽奖的订单，避免前端显示可用但后端拒绝
    const [usedTeam, usedNormal] = await Promise.all([
      this.client.from('team_lottery_groups').select('leader_order_id').in('leader_order_id', orderIds),
      this.client.from('lottery_records').select('order_id').in('order_id', orderIds),
    ]);
    const blocked = new Set<string>();
    for (const r of (usedTeam.data || []) as any[]) {
      if (r.leader_order_id) blocked.add(r.leader_order_id);
    }
    for (const r of (usedNormal.data || []) as any[]) {
      if (r.order_id) blocked.add(r.order_id);
    }
    return (orders || [])
      .filter((o: any) => !blocked.has(o.id))
      .map((o: any) => ({
        id: o.id,
        package_id: o.package_id,
        package_name: o.package_name,
        status: o.status,
        paid_at: o.paid_at,
      }));
  }

  /** 检查并解散过期队伍 */
  async expireGroups() {
    const now = this.now();
    const { data, error } = await this.client
      .from('team_lottery_groups')
      .update({ status: 'expired', updated_at: now })
      .lt('expires_at', now)
    // 仅过期"组队中"的队伍；满员(full)队伍保留抽奖资格，已开奖(drawed)不再处理
      .in('status', ['active'])
      .select('id');
    if (error) throw new Error(`解散过期队伍失败: ${error.message}`);
    return { expired_count: (data || []).length };
  }

  private async refreshGroupStatus(groupId: string) {
    const { data: group } = await this.client
      .from('team_lottery_groups')
      .select('*')
      .eq('id', groupId)
      .maybeSingle();
    if (!group) return null;
    const g = group as any;
    if (g.status === 'active' && g.expires_at < this.now()) {
      const { data: updated } = await this.client
        .from('team_lottery_groups')
        .update({ status: 'expired', updated_at: this.now() })
        .eq('id', groupId)
        .select()
        .single();
      return updated;
    }
    return g;
  }

  private async getPrizeById(prizeId: string) {
    const { data, error } = await this.client
      .from('prizes')
      .select('*')
      .eq('id', prizeId)
      .maybeSingle();
    if (error) throw new Error(`查询奖品失败: ${error.message}`);
    return data as any;
  }

  private async atomicDecrementStock(prizeId: string) {
    const { data: prize } = await this.client
      .from('prizes')
      .select('stock')
      .eq('id', prizeId)
      .single();
    const current = Number((prize as any)?.stock ?? 0);
    if (current <= 0) return -1;
    const { data: updated } = await this.client
      .from('prizes')
      .update({ stock: current - 1, updated_at: this.now() })
      .eq('id', prizeId)
      .eq('stock', current)
      .select('stock')
      .single();
    return updated ? Number((updated as any).stock) : -1;
  }

  /**
   * 组队抽奖奖品发放（与普通抽奖保持一致）：
   * - coupon（折扣券）：先付后返，按 discount_rate/discount_cap 计算返现金额，中奖即核销并自动原路退款
   * - free_meal（霸王餐）：本单免单，生成核销码，自动原路退款，到店核销
   * - product（实物）：生成核销码，到店核销
   */
  private async grantPrize(userId: string, prize: any, memberOrder: any, ctx?: { merchant_id: number; group_id: string }) {
    if (!prize) return null;
    const orderTotal = Math.round((parseFloat(memberOrder?.price || '0') * (Number(memberOrder?.quantity) || 1)) * 100) / 100;
    let redemptionCode = '';
    let refundAmount = 0;
    let refundStatus = 'pending';
    let discountCapped = false;
    let couponAmount = 0;
    let couponMinSpend = 0;
    const displayName = prize.prize_type === 'coupon'
      ? (() => {
          const rate = parseFloat(prize.discount_rate || '0');
          const cap = parseFloat(prize.discount_cap || '0');
          const raw = Math.round((orderTotal * (10 - rate) / 10) * 100) / 100;
          discountCapped = cap > 0 && raw > cap;
          refundAmount = discountCapped ? cap : raw;
          couponAmount = refundAmount;
          couponMinSpend = parseFloat(prize.coupon_min_spend || '0');
          refundStatus = 'redeemed';
          // 队员免费入队未下单时，不存在返现金额，改为发放对应门店折扣券到个人中心
          if (!memberOrder?.id) {
            refundAmount = 0;
            couponAmount = 0;
            return prize.discount_rate ? `${prize.discount_rate}折优惠券` : (prize.name || '折扣券');
          }
          return `${refundAmount}元消费券`;
        })()
      : prize.prize_type === 'free_meal'
        ? '霸王餐免单券'
        : prize.name;

    // 队员免费入队抽中折扣券：发放对应门店折扣券到个人中心（无订单=无返现）
    if (prize.prize_type === 'coupon' && !memberOrder?.id) {
      await this.grantDiscountCoupon(userId, prize, ctx);
    }

    if (prize.prize_type === 'free_meal') {
      redemptionCode = `BWC-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
      refundAmount = orderTotal;
      refundStatus = 'pending';
    } else if (prize.prize_type === 'product') {
      redemptionCode = `PRD-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
      refundStatus = 'pending';
    }

    const result = {
      is_winner: true,
      prize_id: prize.id,
      prize_name: displayName,
      prize_type: prize.prize_type,
      redemption_code: redemptionCode,
      refund_amount: refundAmount,
      refund_status: refundStatus,
      discount_rate: prize.prize_type === 'coupon' ? parseFloat(prize.discount_rate || '0') : 0,
      discount_cap: prize.prize_type === 'coupon' ? parseFloat(prize.discount_cap || '0') : 0,
      discount_capped: discountCapped,
      coupon_amount: couponAmount,
      coupon_min_spend: couponMinSpend,
      product_name: prize.product_name || prize.name,
      image_url: prize.image_url || null,
    };

    // 自动退款：折扣券 / 霸王餐
    if ((prize.prize_type === 'coupon' || prize.prize_type === 'free_meal') && refundAmount > 0 && memberOrder?.id) {
      const reason = prize.prize_type === 'coupon'
        ? `组队抽奖折扣券中奖返现（${prize.discount_rate}折）`
        : '组队抽奖霸王餐中奖免单退款';
      try {
        await this.autoRefund(memberOrder.id, refundAmount, reason);
      } catch (e: any) {
        this.logger.warn(`组队抽奖自动返现失败 order=${memberOrder.id}: ${e?.message}`);
      }
    }

    return result;
  }

  /** 组队抽奖：队员免费入队抽到折扣券时，发放对应门店折扣券到个人中心（仅组队模块，不影响系统其他模块） */
  private async grantDiscountCoupon(
    userId: string,
    prize: any,
    ctx?: { merchant_id: number; group_id: string },
  ) {
    if (!ctx?.merchant_id) return;
    try {
      const rate = parseFloat(prize.discount_rate || '0');
      const title = rate > 0 ? `${rate}折优惠券` : (prize.name || '折扣券');
      const code = `DSC${Date.now()}${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
      const validityHours = Number(prize.validity_hours) > 0 ? Number(prize.validity_hours) : 720; // 默认30天
      const expireAt = this.addHours(validityHours);
      const { error } = await this.client
        .from('discount_coupons')
        .insert({
          code,
          user_id: userId,
          merchant_id: ctx.merchant_id,
          package_id: null,
          title,
          discount_rate: prize.discount_rate || '0',
          discount_cap: String(parseFloat(prize.discount_cap || '0')),
          min_spend: String(parseFloat(prize.coupon_min_spend || '0')),
          status: 'unused',
          source: 'team_lottery',
          group_id: ctx.group_id || null,
          expire_at: expireAt,
        });
      if (error) {
        this.logger.warn(`组队折扣券发放失败 user=${userId}: ${error.message}`);
      } else {
        this.logger.log(`组队折扣券已发放 user=${userId} rate=${rate} code=${code}`);
      }
    } catch (e: any) {
      this.logger.warn(`组队折扣券发放异常 user=${userId}: ${e?.message}`);
    }
  }

  private async autoRefund(orderId: string, refundAmountYuan: number, reason: string) {
    // 通过 PaymentService 做退款（复用已有退款链路，含支付单/订单状态更新、回调通知）
    // 先查到订单 user_id
    const { data: order, error: orderErr } = await this.client
      .from('orders')
      .select('id')
      .eq('id', orderId)
      .maybeSingle();
    if (orderErr) throw new Error(`查询订单失败: ${orderErr.message}`);
    if (!order) throw new Error('订单不存在');
    // 直接通过 WechatPay 原路退款部分金额（不经过订单 refunded_quantity 记账，避免影响套餐使用份数）
    if (!this.wechatPay.isEnabled()) {
      this.logger.warn(`组队中奖返现跳过：微信支付未配置 (order=${orderId})`);
      return;
    }
    const { data: payment, error: payQueryError } = await this.client
      .from('payments')
      .select('*')
      .eq('order_id', orderId)
      .in('status', ['paid', 'partial_refunded'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (payQueryError) throw new Error(`查询支付单失败: ${payQueryError.message}`);
    if (!payment) {
      this.logger.warn(`组队中奖返现跳过：未找到已支付记录 (order=${orderId})`);
      return;
    }
    const paidFen = Math.round(Number(payment.amount || 0) * 100);
    const refundFen = Math.round(refundAmountYuan * 100);
    if (refundFen <= 0) return;
    const outRefundNo = `TML${payment.id.replace(/-/g, '')}${Date.now().toString(36)}`.slice(0, 64);
    const transactionNo = payment.transaction_no || payment.prepay_id;
    if (!transactionNo) {
      this.logger.warn(`组队中奖返现跳过：支付单缺失 transaction_no (payment=${payment.id})`);
      return;
    }
    await this.wechatPay.createRefund({
      outTradeNo: payment.out_trade_no || transactionNo,
      outRefundNo,
      totalFen: paidFen,
      refundFen,
      reason,
    });
    // 记录返现金额到 lottery_records 对应行的 refund_status='redeemed'（在 grantPrize 里已处理）；
    // 同时把返现金额累计写入 payments.refund_amount，方便后续退款链路对账
    const prevRefunded = parseFloat(payment.refund_amount || '0') || 0;
    await this.client
      .from('payments')
      .update({
        refund_amount: (Math.round((prevRefunded + refundAmountYuan) * 100) / 100).toFixed(2),
        updated_at: this.now(),
      })
      .eq('id', payment.id);
  }

  /**
   * 从角色奖池里按概率抽一个奖品（复刻盲盒概率轮盘：probability 存百分比数值 30.0000=30%）
   * 无可用奖品返回 null（由调用方处理）
   */
  private async pickPrizeByProbability(prizeIds: string[]): Promise<any | null> {
    if (!prizeIds?.length) return null;
    const { data: prizes, error } = await this.client
      .from('prizes')
      .select('*')
      .in('id', prizeIds)
      .eq('is_active', true);
    if (error) throw new Error(`查询奖品池失败: ${error.message}`);
    const pool = (prizes || []).filter((p: any) => Number(p.stock || 0) > 0);
    if (pool.length === 0) return null;
    // 归一化权重
    const weights = pool.map((p: any) => Math.max(0, Number(p.probability || 0)));
    const total = weights.reduce((a, b) => a + b, 0);
    if (total <= 0) return pool[crypto.randomInt(0, pool.length)];
    let r = Math.random() * total;
    for (let i = 0; i < pool.length; i++) {
      r -= weights[i];
      if (r <= 0) return pool[i] as any;
    }
    return pool[pool.length - 1];
  }

  /**
   * 根据成员角色获取对应的奖品池ID列表（团长走团长池+加码池，队员走队员池）
   */
  private async getMemberPrizePool(config: any, isLeader: boolean): Promise<string[]> {
    const memberIds = (config?.member_prize_ids as string[]) || [];
    if (isLeader) {
      const leaderIds: string[] = [];
      if (config?.leader_prize_id) leaderIds.push(config.leader_prize_id);
      const bonusRate = Number(config?.leader_bonus_rate ?? 0);
      const bonusIds = (config?.leader_bonus_prize_ids as string[]) || [];
      // 加码池按概率是否命中加入
      if (bonusRate > 0 && bonusIds.length > 0 && Math.random() * 100 < bonusRate) {
        return [...bonusIds, ...leaderIds];
      }
      return leaderIds.length ? leaderIds : memberIds;
    }
    return memberIds;
  }

  /** 创建队伍（团长） */
  async createGroup(dto: CreateGroupDto) {
    const merchant = await this.getMerchant(dto.merchant_id);
    const features = (merchant.marketing_features as Record<string, boolean>) || {};
    if (!features.team_lottery) {
      throw new BadRequestException('该商家未开启组队抽奖');
    }
    const config = await this.getConfigRow(dto.merchant_id);
    if (!config || !config.enabled) {
      throw new BadRequestException('该商家未开启组队抽奖');
    }

    // 校验订单
    const { data: order, error: orderError } = await this.client
      .from('orders')
      .select('*')
      .eq('id', dto.order_id)
      .maybeSingle();
    if (orderError) throw new Error(`查询订单失败: ${orderError.message}`);
    if (!order) throw new NotFoundException('订单不存在');
    const orderData = order as any;
    if (orderData.user_id !== dto.user_id) {
      throw new BadRequestException('无权操作该订单');
    }
    if (!['paid', 'used'].includes(orderData.status)) {
      throw new BadRequestException('订单支付成功后才能发起组队');
    }
    if (String(orderData.package_id || '') !== dto.package_id) {
      throw new BadRequestException('订单与套餐不匹配');
    }

    // 资格互斥：订单已用于普通抽奖，不能再发起组队
    const { data: usedLottery } = await this.client
      .from('lottery_records')
      .select('id')
      .eq('order_id', dto.order_id)
      .limit(1);
    if (usedLottery && usedLottery.length > 0) {
      throw new BadRequestException('该订单已参与普通抽奖，不能再发起组队');
    }

    // 校验是否已创建
    const { data: existingGroup } = await this.client
      .from('team_lottery_groups')
      .select('id')
      .eq('leader_order_id', dto.order_id)
      .maybeSingle();
    if (existingGroup) {
      throw new BadRequestException('该订单已发起组队');
    }

    const expiresAt = this.addHours(Number(config.duration_hours || 24));
    const teamSize = Number(config.team_size || 3);
    const inviteCode = this.generateInviteCode();

    const { data: group, error: groupError } = await this.client
      .from('team_lottery_groups')
      .insert({
        merchant_id: dto.merchant_id,
        package_id: dto.package_id,
        leader_order_id: dto.order_id,
        leader_user_id: dto.user_id,
        team_size: teamSize,
        current_count: 1,
        invite_code: inviteCode,
        status: 'active',
        expires_at: expiresAt,
      })
      .select()
      .single();
    if (groupError) throw new Error(`创建队伍失败: ${groupError.message}`);

    const { error: memberError } = await this.client
      .from('team_lottery_members')
      .insert({
        group_id: (group as any).id,
        user_id: dto.user_id,
        order_id: dto.order_id,
      });
    if (memberError) throw new Error(`创建团长记录失败: ${memberError.message}`);

    return this.getGroupDetail((group as any).id, dto.user_id);
  }

  private async buildMemberView(members: any[], leaderUserId: string, currentUserId?: string) {
    const userIds = members.map((m) => m.user_id);
    let users: any[] = [];
    if (userIds.length > 0) {
      // users 表业务账号 id 存在 user_id 列（id 列是 uuid），必须按 user_id 匹配，否则查不到头像昵称
      const { data } = await this.client.from('users').select('user_id, nick_name, avatar_url').in('user_id', userIds);
      users = data || [];
    }
    return members.map((m) => {
      const u = users.find((x) => x.user_id === m.user_id);
      const isLeader = m.user_id === leaderUserId;
      return {
        id: m.id,
        user_id: m.user_id,
        role: isLeader ? 'leader' : 'member',
        nick_name: u?.nick_name || '神秘好友',
        avatar_url: u?.avatar_url || '',
        is_self: currentUserId ? m.user_id === currentUserId : false,
        is_leader: isLeader,
        is_winner: m.is_winner,
        prize_name: m.prize_name,
        prize_type: m.prize_type,
        redemption_code: m.redemption_code,
        coupon_code: m.coupon_code,
        drew_at: m.drew_at,
        joined_at: m.created_at,
      };
    });
  }

  /** 获取队伍详情 */
  async getGroupDetail(groupId: string, currentUserId?: string) {
    let group = await this.refreshGroupStatus(groupId);
    if (!group) throw new NotFoundException('队伍不存在');
    const g = group as any;

    const { data: members, error: membersError } = await this.client
      .from('team_lottery_members')
      .select('*')
      .eq('group_id', groupId)
      .order('created_at', { ascending: true });
    if (membersError) throw new Error(`查询成员失败: ${membersError.message}`);

    const isLeader = currentUserId ? g.leader_user_id === currentUserId : false;
    const isMember = (members || []).some((m: any) => m.user_id === currentUserId);
    const leftCount = Math.max(0, g.team_size - g.current_count);

    let leaderPrizeName: string | null = null;
    const config = await this.getConfigRow(g.merchant_id);
    if (config?.leader_prize_id) {
      const prize = await this.getPrizeById(config.leader_prize_id);
      leaderPrizeName = prize?.name || null;
    }

    // 查询队伍关联的商家、套餐、奖品详情
    const [merchantRow, packageRow] = await Promise.all([
      this.client.from('merchants').select('id, name, address, phone, logo').eq('id', g.merchant_id).maybeSingle(),
      this.client.from('packages').select('*').eq('id', g.package_id).maybeSingle(),
    ]);

    const merchantInfo = merchantRow.data
      ? {
          id: merchantRow.data.id,
          name: merchantRow.data.name || '',
          address: merchantRow.data.address || null,
          phone: merchantRow.data.phone || null,
          logo: merchantRow.data.logo || null,
        }
      : null;

    const packageInfo = packageRow.data
      ? {
          id: packageRow.data.id,
          name: packageRow.data.name,
          description: packageRow.data.description || null,
          price: Number(packageRow.data.price || 0),
          original_price: packageRow.data.original_price ? Number(packageRow.data.original_price) : null,
          cover_image: packageRow.data.cover_image || packageRow.data.coverImage || null,
        }
      : null;

    const [leaderPrizeDetails, memberPrizeDetails, leaderBonusPrizeDetails] = await Promise.all([
      config?.leader_prize_id ? this.getPrizeDetails([config.leader_prize_id as string]) : Promise.resolve([]),
      this.getPrizeDetails((config?.member_prize_ids as string[]) || []),
      this.getPrizeDetails((config?.leader_bonus_prize_ids as string[]) || []),
    ]);

    return {
      id: g.id,
      merchant_id: g.merchant_id,
      package_id: g.package_id,
      leader_user_id: g.leader_user_id,
      invite_code: g.invite_code,
      team_size: g.team_size,
      current_count: g.current_count,
      left_count: leftCount,
      status: g.status,
      expires_at: g.expires_at,
      created_at: g.created_at,
      is_leader: isLeader,
      is_member: isMember,
      leader_prize_name: leaderPrizeName,
      members: await this.buildMemberView(members || [], g.leader_user_id, currentUserId),
      merchant: merchantInfo,
      package: packageInfo,
      leader_prize: leaderPrizeDetails[0] || null,
      member_prizes: memberPrizeDetails,
      leader_bonus_prizes: leaderBonusPrizeDetails,
      leader_bonus_rate: Number(config?.leader_bonus_rate ?? 0),
    };
  }

  /** 通过邀请码查询队伍 */
  async getGroupByInviteCode(inviteCode: string, currentUserId?: string) {
    const { data: group, error } = await this.client
      .from('team_lottery_groups')
      .select('*')
      .eq('invite_code', inviteCode)
      .maybeSingle();
    if (error) throw new Error(`查询队伍失败: ${error.message}`);
    if (!group) throw new NotFoundException('邀请码无效');
    return this.getGroupDetail((group as any).id, currentUserId);
  }

  /** 加入队伍（支持 groupId 或 invite_code） */
  async joinGroup(groupId: string, dto: JoinGroupDto) {
    let group = await this.refreshGroupStatus(groupId);
    if (!group) {
      // 尝试按邀请码查询
      const { data: g2, error } = await this.client
        .from('team_lottery_groups')
        .select('*')
        .eq('invite_code', groupId)
        .maybeSingle();
      if (error) throw new Error(`查询队伍失败: ${error.message}`);
      if (!g2) throw new NotFoundException('队伍不存在');
      group = await this.refreshGroupStatus((g2 as any).id);
      if (!group) throw new NotFoundException('队伍不存在');
    }
    const g = group as any;
    if (g.status !== 'active') {
      if (g.status === 'expired' && g.leader_refunded) {
        throw new BadRequestException('团长的订单已退款，该队伍已解散，无法加入');
      }
      throw new BadRequestException(g.status === 'expired' ? '队伍已过期解散' : '队伍已满');
    }
    if (g.leader_user_id === dto.user_id) {
      throw new BadRequestException('你是团长，不能加入自己的队伍');
    }

    // 后续操作统一使用真实队伍 id（入参可能是邀请码）
    const actualGroupId = (group as any).id as string;

    const { data: existing } = await this.client
      .from('team_lottery_members')
      .select('id')
      .eq('group_id', actualGroupId)
      .eq('user_id', dto.user_id)
      .maybeSingle();
    if (existing) {
      throw new BadRequestException('你已加入该队伍');
    }

    // 并发控制：再次检查并更新 current_count
    const { data: freshGroup } = await this.client
      .from('team_lottery_groups')
      .select('*')
      .eq('id', actualGroupId)
      .eq('status', 'active')
      .single();
    if (!freshGroup) throw new BadRequestException('队伍状态已变化，请重试');
    const fg = freshGroup as any;
    if (fg.current_count >= fg.team_size) {
      throw new BadRequestException('队伍已满');
    }

    // 队员加入队伍无需下单即可免费抽一次奖（order_id 允许为空）；
    // 仅当显式传入 order_id 时才校验该订单的归属、状态与互斥
    let memberOrderId: string | null = null;
    if (dto.order_id) {
      const { data: mo, error: moErr } = await this.client
        .from('orders')
        .select('*')
        .eq('id', dto.order_id)
        .maybeSingle();
      if (moErr) throw new Error(`查询订单失败: ${moErr.message}`);
      if (!mo) throw new BadRequestException('订单不存在');
      if ((mo as any).user_id !== dto.user_id) throw new BadRequestException('无权使用该订单');
      if (!['paid', 'used'].includes((mo as any).status)) throw new BadRequestException('订单支付成功后才能加入组队');
      if ((mo as any).package_id !== g.package_id) throw new BadRequestException('订单套餐与组队套餐不匹配');
      // 订单互斥：已用于组队/普通抽奖则拒绝
      const { data: usedMember } = await this.client
        .from('team_lottery_members')
        .select('id')
        .eq('user_id', dto.user_id)
        .eq('order_id', dto.order_id)
        .limit(1)
        .maybeSingle();
      if (usedMember) throw new BadRequestException('该订单已用于组队抽奖');
      const { data: usedRecord } = await this.client
        .from('lottery_records')
        .select('id')
        .eq('order_id', dto.order_id)
        .limit(1)
        .maybeSingle();
      if (usedRecord) throw new BadRequestException('该订单已参与普通抽奖');
      memberOrderId = dto.order_id;
    }

    const { data: member, error: memberError } = await this.client
      .from('team_lottery_members')
      .insert({ group_id: actualGroupId, user_id: dto.user_id, order_id: memberOrderId })
      .select()
      .single();
    if (memberError) throw new Error(`加入队伍失败: ${memberError.message}`);

    const newCount = fg.current_count + 1;
    const isFull = newCount >= fg.team_size;
    const { data: updatedGroup, error: updateError } = await this.client
      .from('team_lottery_groups')
      .update({
        current_count: newCount,
        status: isFull ? 'full' : 'active',
        updated_at: this.now(),
      })
      .eq('id', actualGroupId)
      .eq('current_count', fg.current_count)
      .select()
      .single();
    if (updateError) {
      // 回滚成员记录
      await this.client.from('team_lottery_members').delete().eq('id', (member as any).id);
      throw new BadRequestException('加入失败，请重试');
    }

    // 满员：自动给团长发团长奖，并发订阅消息通知所有成员去抽奖
    if (isFull) {
      // 团长奖：直接发放 leader_prize（不参与盲盒抽取）
      try {
        const config = await this.getConfigRow(g.merchant_id);
        const leaderPrizeId = config?.leader_prize_id as string | null;
        if (leaderPrizeId) {
          const { data: leaderOrder, error: loErr } = await this.client
            .from('orders')
            .select('*')
            .eq('id', g.leader_order_id)
            .maybeSingle();
          if (loErr) this.logger.warn(`查团长订单失败: ${loErr.message}`);
          if (leaderOrder) {
            // 查 leader prize 详情拿 stock/type
            const prizeRows = await this.getPrizeDetails([leaderPrizeId]);
            const leaderPrizeRow = prizeRows[0];
            if (leaderPrizeRow) {
              // 原子扣库存
              let stockOk = false;
              for (let i = 0; i < 3; i++) {
                const result = await this.atomicDecrementStock(leaderPrizeId);
                if (result !== -1) { stockOk = true; break; }
                await new Promise((r) => setTimeout(r, 150 * (i + 1)));
              }
              if (stockOk) {
                const grant = await this.grantPrize(g.leader_user_id, leaderPrizeRow as any, leaderOrder as any, { merchant_id: g.merchant_id, group_id: actualGroupId });
                if (grant) {
                  // 写入团长成员记录
                  await this.client
                    .from('team_lottery_members')
                    .update({
                      is_winner: grant.is_winner,
                      prize_id: leaderPrizeId,
                      prize_name: grant.prize_name,
                      prize_type: grant.prize_type,
                      redemption_code: grant.redemption_code || null,
                      refund_amount: grant.refund_amount || null,
                      drew_at: this.now(),
                    })
                    .eq('group_id', actualGroupId)
                    .eq('user_id', g.leader_user_id);
                  this.logger.log(`团长奖已自动发放 group=${actualGroupId} leader=${g.leader_user_id} prize=${grant.prize_name}`);
                  // 发中奖通知
                  try {
                    await this.notificationService.notify(g.leader_user_id, 'prize_won', {
                      prize_name: String(grant.prize_name || '奖品'),
                      expire_time: `组队成功，您作为团长已获得团长奖`,
                    });
                  } catch (e: any) {
                    this.logger.warn(`团长奖通知失败: ${e?.message}`);
                  }
                }
              } else {
                this.logger.warn(`团长奖库存不足 group=${actualGroupId} prize=${leaderPrizeId}`);
              }
            }
          }
        }
      } catch (e: any) {
        this.logger.warn(`团长奖自动发放失败 group=${actualGroupId}: ${e?.message}`);
      }

      // 给所有成员发"组队成功去抽奖"订阅消息（团长已发中奖通知，这里再补发一条组队成功）
      try {
        const { data: allMembers } = await this.client
          .from('team_lottery_members')
          .select('user_id')
          .eq('group_id', actualGroupId);
        const userIds = Array.from(new Set((allMembers || []).map((m: any) => m.user_id))).filter(
          (uid) => uid !== g.leader_user_id,
        );
        await Promise.allSettled(
          userIds.map((uid) =>
            this.notificationService.notify(uid, 'prize_won', {
              prize_name: '组队成功',
              expire_time: `队伍已满员，快去开盲盒抽奖吧！`,
            }),
          ),
        );
      } catch (e: any) {
        this.logger.warn(`组队满员通知失败 group=${actualGroupId}: ${e?.message}`);
      }
    }

    return this.getGroupDetail(actualGroupId, dto.user_id);
  }

  /** 队员抽奖 */
  async drawPrize(groupId: string, dto: DrawPrizeDto) {
    let group = await this.refreshGroupStatus(groupId);
    if (!group) throw new NotFoundException('队伍不存在');
    const g = group as any;
    if (g.status !== 'full') {
      if (g.status === 'expired' && g.leader_refunded) {
        throw new BadRequestException('团长的订单已退款，该队伍已结束，无法抽奖');
      }
      throw new BadRequestException('队伍未满，还不能抽奖');
    }

    const { data: member, error: memberError } = await this.client
      .from('team_lottery_members')
      .select('*')
      .eq('group_id', groupId)
      .eq('user_id', dto.user_id)
      .maybeSingle();
    if (memberError) throw new Error(`查询成员失败: ${memberError.message}`);
    if (!member) throw new BadRequestException('你不是队伍成员');
    const m = member as any;
    if (g.leader_user_id === dto.user_id) {
      throw new BadRequestException('团长奖励已在组队满员时自动发放，无需再抽');
    }
    if (m.drew_at || m.prize_id) {
      throw new BadRequestException('你已经抽过奖了');
    }

    // 队员可能未下单（免费入队抽奖），此时无订单可退款，仅发放奖品
    let memberOrder: any = null;
    if (m.order_id) {
      const { data: mo, error: orderErr } = await this.client
        .from('orders')
        .select('*')
        .eq('id', m.order_id)
        .maybeSingle();
      if (orderErr) throw new Error(`查询订单失败: ${orderErr.message}`);
      memberOrder = mo || null;
    }

    const config = await this.getConfigRow(g.merchant_id);
    if (!config) throw new BadRequestException('商家配置不存在');

    // 盲盒式概率抽奖（与普通抽奖一致）：从角色奖池按 probability 权重抽取
    const isLeader = g.leader_user_id === dto.user_id;
    const poolIds = await this.getMemberPrizePool(config, isLeader);
    let prize: any = null;
    // 并发扣库存重试：扣减失败则移出该奖品重试
    const triedIds = new Set<string>();
    while (!prize) {
      const candidate = await this.pickPrizeByProbability(poolIds.filter(id => !triedIds.has(id)));
      if (!candidate) break;
      triedIds.add(candidate.id);
      const newStock = await this.atomicDecrementStock(candidate.id);
      if (newStock >= 0) {
        candidate.stock = newStock;
        prize = candidate;
      }
    }
    if (!prize) {
      throw new BadRequestException('奖品已发完，请稍后再试');
    }

    const result = await this.grantPrize(dto.user_id, prize, memberOrder, { merchant_id: g.merchant_id, group_id: groupId });
    if (!result || !result.is_winner) {
      throw new BadRequestException('奖品发放失败');
    }

    const { error: updateError } = await this.client
      .from('team_lottery_members')
      .update({
        is_winner: true,
        prize_id: result.prize_id,
        prize_name: result.prize_name,
        prize_type: result.prize_type,
        redemption_code: result.redemption_code || null,
        refund_amount: String(result.refund_amount || 0),
        drew_at: this.now(),
      })
      .eq('id', m.id);
    if (updateError) throw new Error(`保存中奖记录失败: ${updateError.message}`);

    // 中奖通知
    try {
      await this.notificationService.notify(dto.user_id, 'prize_won', {
        prize_name: result.prize_name,
        expire_time: '中奖后7天内有效',
      });
    } catch (e: any) {
      this.logger.warn(`组队中奖通知失败 user=${dto.user_id}: ${e?.message}`);
    }

    // 全部成员都抽完奖后，将队伍标记为已开奖
    const { data: undrawn } = await this.client
      .from('team_lottery_members')
      .select('id')
      .eq('group_id', groupId)
      .is('drew_at', null);
    if ((undrawn || []).length === 0) {
      await this.client
        .from('team_lottery_groups')
        .update({ status: 'drawed', updated_at: this.now() })
        .eq('id', groupId);
    }

    return {
      ...result,
      record_id: m.id,
      prize_image: prize.image_url || null,
      expiry_hours: 168,
      expiry_date: this.addHours(168),
    };
  }

  /** 查询某笔订单对应的队伍（订单可能是团长订单或成员订单） */
  async getGroupByOrder(orderId: string, userId?: string) {
    // 优先匹配团长订单
    const { data: byLeader, error: e1 } = await this.client
      .from('team_lottery_groups')
      .select('id')
      .eq('leader_order_id', orderId)
      .maybeSingle();
    if (e1) throw new Error(`查询队伍失败: ${e1.message}`);
    if (byLeader) return this.getGroupDetail((byLeader as any).id, userId);
    // 再匹配成员订单
    const { data: byMember, error: e2 } = await this.client
      .from('team_lottery_members')
      .select('group_id')
      .eq('order_id', orderId)
      .maybeSingle();
    if (e2) throw new Error(`查询队伍失败: ${e2.message}`);
    if (byMember) return this.getGroupDetail((byMember as any).group_id, userId);
    return null;
  }

  /** 查询用户参与/创建的队伍列表（支持按 merchantId 过滤） */
  async listMyGroups(userId: string, merchantId?: number) {
    const { data: memberRows, error } = await this.client
      .from('team_lottery_members')
      .select('group_id, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw new Error(`查询队伍失败: ${error.message}`);
    let groupIds = (memberRows || []).map((d: any) => d.group_id);
    const details: any[] = [];
    for (const gid of groupIds) {
      try {
        const detail = await this.getGroupDetail(gid, userId);
        if (merchantId !== undefined && detail && detail.merchant_id !== merchantId) continue;
        details.push(detail);
      } catch {
        // ignore
      }
    }
    return details;
  }
}
