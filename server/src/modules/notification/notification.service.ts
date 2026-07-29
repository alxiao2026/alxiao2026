import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { WechatNotifyService } from './wechat-notify.service';
import {
  NotificationType,
  NOTIFICATION_TEMPLATES,
  RemindType,
  RemindPoint,
} from './notification.templates';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private supabase = getSupabaseClient();

  constructor(private readonly wechatNotify: WechatNotifyService) {}

  /**
   * 发送通知（站内信落库 + 微信订阅消息骨架预留）
   */
  async notify(userId: string, type: NotificationType, data: Record<string, any> = {}): Promise<void> {
    try {
      const tpl = NOTIFICATION_TEMPLATES[type];
      if (!tpl) {
        this.logger.warn(`未知通知类型: ${type}`);
        return;
      }
      const content = tpl.render(data);

      // 1. 站内通知落库
      const { error } = await this.supabase.from('notifications').insert({
        user_id: userId,
        type,
        title: tpl.title,
        content,
        data,
      });
      if (error) {
        this.logger.error(`通知落库失败: ${error.message}`);
      }

      // 2. 微信订阅消息（骨架：AppID/模板ID配置后启用）
      const openId = await this.getUserOpenId(userId);
      const wechatSent = await this.wechatNotify.sendSubscribeMessage({ openId, type, data });
      if (wechatSent) {
        await this.supabase
          .from('notifications')
          .update({ wechat_sent: true })
          .eq('user_id', userId)
          .eq('type', type)
          .order('created_at', { ascending: false })
          .limit(1);
      }
    } catch (e: any) {
      // 通知失败不阻断主业务流程
      this.logger.error(`发送通知异常 type=${type} user=${userId}: ${e?.message}`);
    }
  }

  /**
   * 发送通知给商家的所有管理员账号
   */
  async notifyMerchant(merchantId: string | number, type: NotificationType, data: Record<string, any> = {}): Promise<void> {
    const adminIds = await this.getMerchantAdminIds(merchantId);
    if (adminIds.length === 0) {
      this.logger.warn(`商家 ${merchantId} 无管理员账号，跳过通知 ${type}`);
      return;
    }
    await Promise.all(adminIds.map((uid) => this.notify(uid, type, data)));
  }

  private async getUserOpenId(userId: string): Promise<string> {
    const { data } = await this.supabase
      .from('users')
      .select('open_id')
      .eq('user_id', userId)
      .single();
    return data?.open_id || '';
  }

  private async getMerchantAdminIds(merchantId: string | number): Promise<string[]> {
    const { data } = await this.supabase
      .from('users')
      .select('user_id')
      .eq('merchant_id', merchantId)
      .eq('role', 'merchant');
    return (data || []).map((u: any) => u.user_id);
  }

  // ==================== 用户侧查询接口 ====================

  async getMyNotifications(userId: string, page = 1, pageSize = 20) {
    const from = (page - 1) * pageSize;
    const { data, count, error } = await this.supabase
      .from('notifications')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`查询通知失败: ${error.message}`);
    return { list: data || [], total: count || 0, page, pageSize };
  }

  async getUnreadCount(userId: string): Promise<number> {
    const { count, error } = await this.supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false);
    if (error) return 0;
    return count || 0;
  }

  async markRead(id: string, userId: string) {
    const { error } = await this.supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)
      .eq('user_id', userId);
    if (error) throw new Error(`标记已读失败: ${error.message}`);
    return { success: true };
  }

  async markAllRead(userId: string) {
    const { error } = await this.supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false);
    if (error) throw new Error(`全部已读失败: ${error.message}`);
    return { success: true };
  }

  // ==================== 到期提醒定时任务 ====================

  /**
   * 每天 09:00 扫描到期数据并发送提醒：
   *  - 优惠券到期（前7天/前1天）
   *  - 订单待核销到期（前7天/前1天）
   *  - 奖品兑换到期（前7天/前1天）
   * 通过 notification_remind_logs 防重复发送。
   */
  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async scanExpiringReminders(): Promise<{ orders: number; prizes: number }> {
    this.logger.log('开始扫描到期提醒...');
    const [orders, prizes] = await Promise.all([
      this.scanOrderExpiring(),
      this.scanPrizeExpiring(),
    ]);
    this.logger.log(`到期提醒扫描完成: 订单${orders}条, 奖品${prizes}条`);
    return { orders, prizes };
  }

  /** 订单到期未核销提醒（类型6） */
  private async scanOrderExpiring(): Promise<number> {
    const { data: orders, error } = await this.supabase
      .from('orders')
      .select('id, user_id, expire_at, packages:package_id (name)')
      .eq('status', 'paid')
      .not('expire_at', 'is', null);
    if (error) {
      this.logger.error(`扫描到期订单失败: ${error.message}`);
      return 0;
    }
    let sent = 0;
    for (const order of orders || []) {
      const point = this.matchRemindPoint(order.expire_at);
      if (!point) continue;
      const ok = await this.sendRemindOnce('order_expiring', order.id, point, order.user_id, {
        package_name: (order as any).packages?.name,
        expire_time: this.formatDateTime(order.expire_at),
      });
      if (ok) sent++;
    }
    return sent;
  }

  /**
   * 中奖奖品到期提醒（类型4 优惠券 / 类型10 奖品兑换）
   * 到期时间 = 中奖时间 + 奖品有效期（prizes.validity_hours）
   */
  private async scanPrizeExpiring(): Promise<number> {
    const { data: records, error } = await this.supabase
      .from('lottery_records')
      .select('id, user_id, prize_name, created_at, prizes:prize_id (validity_hours, prize_type)')
      .eq('is_winner', true)
      .eq('refund_status', 'pending');
    if (error) {
      this.logger.error(`扫描到期奖品失败: ${error.message}`);
      return 0;
    }
    let sent = 0;
    const now = Date.now();
    for (const record of records || []) {
      const validityHours = (record as any).prizes?.validity_hours;
      if (!validityHours) continue;
      const expireAt = new Date(record.created_at).getTime() + validityHours * 3600 * 1000;
      if (expireAt <= now) continue; // 已过期不提醒
      const point = this.matchRemindPoint(new Date(expireAt).toISOString());
      if (!point) continue;
      // 优惠券类走 coupon_expiring，其余走 prize_expiring
      const prizeType = (record as any).prizes?.prize_type || '';
      const remindType: RemindType = prizeType === 'coupon' ? 'coupon_expiring' : 'prize_expiring';
      const ok = await this.sendRemindOnce(remindType, record.id, point, record.user_id, {
        prize_name: record.prize_name,
        expire_time: this.formatDateTime(new Date(expireAt).toISOString()),
      });
      if (ok) sent++;
    }
    return sent;
  }

  /**
   * 判断到期时间是否命中提醒节点：
   *  - 7d：剩余时间 ∈ (6天, 7天]
   *  - 1d：剩余时间 ∈ (0, 1天]
   */
  private matchRemindPoint(expireAt: string): RemindPoint | null {
    const diffMs = new Date(expireAt).getTime() - Date.now();
    const diffDays = diffMs / (24 * 3600 * 1000);
    if (diffDays > 6 && diffDays <= 7) return '7d';
    if (diffDays > 0 && diffDays <= 1) return '1d';
    return null;
  }

  /** 防重复发送：同一提醒类型+目标+节点只发一次 */
  private async sendRemindOnce(
    remindType: RemindType,
    targetId: string,
    point: RemindPoint,
    userId: string,
    data: Record<string, any>,
  ): Promise<boolean> {
    const { data: existing } = await this.supabase
      .from('notification_remind_logs')
      .select('id')
      .eq('remind_type', remindType)
      .eq('target_id', targetId)
      .eq('remind_point', point)
      .single();
    if (existing) return false;

    const { error } = await this.supabase.from('notification_remind_logs').insert({
      remind_type: remindType,
      target_id: targetId,
      remind_point: point,
    });
    if (error) {
      // 唯一约束冲突说明其他实例已发，忽略
      if (!error.message.includes('duplicate')) {
        this.logger.error(`提醒日志写入失败: ${error.message}`);
      }
      return false;
    }
    await this.notify(userId, remindType, data);
    return true;
  }

  private formatDateTime(iso: string): string {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
}
