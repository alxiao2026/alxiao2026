import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { OrderService } from './order.service';

/**
 * 订单过期自动退款定时任务
 *
 * 规则：套餐类订单在有效期内未核销（按套餐 valid_days 自购买日推算 / valid_date_end 固定截止日），
 * 过期后自动全额退还实付金额（扣减折扣分摊后的差额口径与人工退款一致）。
 *
 * 触发链路（三层保障）：
 * 1. 本定时任务每小时主动扫描全量 paid 订单（不依赖任何用户行为）
 * 2. 订单列表查询时顺带补偿（用户/商家打开列表即触发，见 findAllForUser）
 * 3. 核销时二次拦截（商家扫过期码直接退款，见 verify 相关流程）
 *
 * 说明：退款为记账型退款（更新订单状态/退款金额/作废权益），与现有 autoRefundOrder
 * 人工退款同一条链路；项目未接入真实支付网关时即为账务状态回滚。
 */
@Injectable()
export class OrderExpireRefundService {
  private readonly logger = new Logger('OrderExpireRefund');

  constructor(private readonly orderService: OrderService) {}

  /** 每小时第 10 分钟扫描一次（避开整点高峰；过期按天判定，1 小时粒度足够及时） */
  @Cron('0 10 * * * *')
  async handleHourlySweep(): Promise<void> {
    await this.sweepOnce('cron');
  }

  /** 执行一轮扫描：幂等，重复执行无副作用（已退款订单直接跳过） */
  async sweepOnce(trigger: string): Promise<{ scanned: number; refunded: number }> {
    const start = Date.now();
    const result = await this.orderService.sweepExpiredPaidOrdersForRefund();
    if (result.refunded > 0) {
      this.logger.log(
        `[${trigger}] 过期自动退款完成：扫描 ${result.scanned} 笔已支付订单，退款 ${result.refunded} 笔，耗时 ${Date.now() - start}ms`,
      );
    }
    return result;
  }
}
