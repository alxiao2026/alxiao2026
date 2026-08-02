import { Injectable, Logger, BadRequestException, ForbiddenException } from '@nestjs/common';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getWechatCredentials } from '../user/wechat-config';
import { SupabaseClient } from '@supabase/supabase-js';
import { NotificationType, NOTIFICATION_TEMPLATES } from './notification.templates';

export interface WechatSubscribeParams {
  /** 接收用户的微信 openid（users.open_id） */
  openId: string;
  /** 通知类型（用于映射订阅消息模板） */
  type: NotificationType;
  /** 模板数据（业务字段，内部映射为微信模板关键字格式） */
  data: Record<string, any>;
  /** 点击模板消息后跳转的小程序页面路径 */
  page?: string;
}

/** 通知类型中文描述（管理后台配置页展示用） */
export const TEMPLATE_TYPE_LABELS: Record<NotificationType, string> = {
  withdraw_arrived: '提现到账通知（商家）',
  withdraw_submitted: '提现申请提交成功（商家）',
  withdraw_rejected: '提现申请被拒绝（商家）',
  order_created: '下单成功提醒（用户）',
  coupon_expiring: '优惠券到期提醒（用户）',
  order_paid: '付款成功通知（用户）',
  order_expiring: '订单到期提醒（用户）',
  order_verified: '核销成功通知（用户）',
  order_verify_revoked: '核销撤销通知（用户）',
  prize_won: '中奖通知（用户）',
  merchant_refund_success: '退款成功通知（商家）',
  prize_expiring: '奖品到期提醒（用户）',
  share_success: '分享成功提示（用户）',
  prize_redeemed: '奖品核销成功通知（用户）',
  customer_refund_success: '退款成功通知（用户）',
};

/** 微信模板关键字安全值：thing 类型限 20 字符，且不允许特殊符号 */
const thingVal = (v: any, maxLen = 20) => {
  const s = String(v ?? '').replace(/[|\\]/g, '').trim();
  return { value: s.slice(0, maxLen) || '查看详情' };
};
const amountVal = (v: any) => ({ value: Number(v ?? 0).toFixed(2) });
const timeVal = (v?: any) => {
  const d = v ? new Date(v) : new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return { value: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}` };
};

/**
 * 业务数据 → 微信订阅消息模板关键字映射
 *
 * 按微信公众平台公共模板库的常用关键字命名构造：
 *   thing1/thing2 文本、amount2 金额、character_string1 单号、time3 时间
 * 若实际申请的模板关键字不同导致 47003 报错，请在公众平台对照模板调整此处映射。
 */
export function buildWechatTemplateData(type: NotificationType, data: Record<string, any>): Record<string, any> {
  const title = NOTIFICATION_TEMPLATES[type]?.title || '业务通知';
  switch (type) {
    case 'order_paid':
      return {
        character_string1: { value: String(data.order_no || '').slice(0, 32) || '-' },
        amount2: amountVal(data.amount),
        time3: timeVal(),
        thing4: thingVal(data.package_name || title),
      };
    case 'order_verified':
      return {
        character_string1: { value: String(data.order_no || '').slice(0, 32) || '-' },
        thing2: thingVal(data.package_name || '套餐'),
        time3: timeVal(),
      };
    case 'customer_refund_success':
    case 'merchant_refund_success':
      return {
        character_string1: { value: String(data.order_no || '').slice(0, 32) || '-' },
        amount2: amountVal(data.amount),
        time3: timeVal(),
      };
    case 'withdraw_arrived':
    case 'withdraw_submitted':
    case 'withdraw_rejected':
      return {
        amount1: amountVal(data.amount),
        thing2: thingVal(data.reason || title),
        time3: timeVal(),
      };
    case 'prize_won':
      return {
        thing1: thingVal(data.prize_name || '奖品'),
        time2: timeVal(),
      };
    default:
      return {
        thing1: thingVal(data.prize_name || data.package_name || title),
        time2: timeVal(),
      };
  }
}

/**
 * 微信订阅消息发送服务
 *
 * 模板 ID 配置优先级：notification_template_configs 表（管理后台可配） > templates.ts 硬编码
 * 启用条件（未满足时自动降级为仅记录日志，不影响站内通知）：
 * 1. server/.env 配置 WECHAT_APPID / WECHAT_SECRET（用于获取 access_token）
 * 2. 对应通知类型的模板 ID 已配置（管理后台「消息模板配置」页或 templates.ts）
 * 3. 用户已授权订阅对应模板（前端 Taro.requestSubscribeMessage 引导）
 *
 * 发送接口：POST https://api.weixin.qq.com/cgi-bin/message/subscribe/send
 */
@Injectable()
export class WechatNotifyService {
  private readonly logger = new Logger(WechatNotifyService.name);
  private readonly supabase: SupabaseClient = getSupabaseClient();

  /** access_token 内存缓存（有效期 7200s，提前 5 分钟刷新） */
  private tokenCache: { token: string; expiresAt: number } | null = null;
  /** DB 模板配置缓存（60s） */
  private templateCache: { map: Record<string, string>; expiresAt: number } | null = null;

  /** 获取微信接口调用凭证 access_token；未配置 AppSecret 时返回 null */
  private async getAccessToken(): Promise<string | null> {
    const { appid, secret } = await getWechatCredentials();
    if (!appid || !secret) return null;

    if (this.tokenCache && Date.now() < this.tokenCache.expiresAt) {
      return this.tokenCache.token;
    }
    try {
      const url =
        `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential` +
        `&appid=${appid}&secret=${secret}`;
      const res = await fetch(url);
      const data: any = await res.json();
      if (!data?.access_token) {
        this.logger.warn(`获取微信 access_token 失败: ${JSON.stringify(data)}`);
        return null;
      }
      this.tokenCache = {
        token: data.access_token,
        expiresAt: Date.now() + ((data.expires_in || 7200) - 300) * 1000,
      };
      this.logger.log('微信 access_token 已刷新');
      return data.access_token;
    } catch (err: any) {
      this.logger.error(`获取微信 access_token 异常: ${err?.message}`);
      return null;
    }
  }

  /** 读取全部已配置模板 ID（DB > 硬编码），带 60s 缓存 */
  async getTemplateIdMap(): Promise<Record<string, string>> {
    if (this.templateCache && Date.now() < this.templateCache.expiresAt) {
      return this.templateCache.map;
    }
    const map: Record<string, string> = {};
    // 硬编码默认值
    (Object.keys(NOTIFICATION_TEMPLATES) as NotificationType[]).forEach((t) => {
      const id = NOTIFICATION_TEMPLATES[t]?.wechatTemplateId;
      if (id) map[t] = id;
    });
    // DB 覆盖
    try {
      const { data, error } = await this.supabase
        .from('notification_template_configs')
        .select('type, template_id');
      if (!error && data) {
        data.forEach((row: any) => {
          if (row.template_id) map[row.type] = row.template_id;
        });
      }
    } catch (e: any) {
      this.logger.warn(`读取模板配置失败，使用硬编码默认: ${e?.message}`);
    }
    this.templateCache = { map, expiresAt: Date.now() + 60 * 1000 };
    return map;
  }

  /** 前端订阅授权用：返回所有已配置模板（type + templateId + 说明） */
  async getEnabledTemplates() {
    const map = await this.getTemplateIdMap();
    return (Object.keys(map) as NotificationType[])
      .filter((t) => map[t])
      .map((t) => ({
        type: t,
        templateId: map[t],
        label: TEMPLATE_TYPE_LABELS[t] || t,
        title: NOTIFICATION_TEMPLATES[t]?.title || t,
      }));
  }

  /** 管理后台：全部类型的配置状态（含未配置） */
  async getTemplateConfigList() {
    const map = await this.getTemplateIdMap();
    return (Object.keys(NOTIFICATION_TEMPLATES) as NotificationType[]).map((t) => ({
      type: t,
      label: TEMPLATE_TYPE_LABELS[t] || t,
      title: NOTIFICATION_TEMPLATES[t]?.title || t,
      templateId: map[t] || '',
      configured: !!map[t],
    }));
  }

  /** 管理后台：保存模板 ID 配置 */
  async saveTemplateConfig(type: string, templateId: string, adminUserId: string) {
    if (!adminUserId) throw new ForbiddenException('缺少管理员身份');
    const { data: adminUser } = await this.supabase
      .from('users')
      .select('role')
      .eq('user_id', adminUserId)
      .maybeSingle();
    if (!adminUser || String((adminUser as any)?.role || '').toLowerCase() !== 'admin') {
      throw new ForbiddenException('仅平台管理员可配置消息模板');
    }
    if (!(type in NOTIFICATION_TEMPLATES)) {
      throw new BadRequestException(`未知通知类型: ${type}`);
    }
    const { error } = await this.supabase
      .from('notification_template_configs')
      .upsert(
        { type, template_id: templateId.trim(), updated_at: new Date().toISOString() },
        { onConflict: 'type' },
      );
    if (error) throw new BadRequestException(`保存失败: ${error.message}`);
    // 清缓存立即生效
    this.templateCache = null;
    return { type, templateId: templateId.trim() };
  }

  /**
   * 发送微信订阅消息
   * @returns 是否真正通过微信通道发出（未配置/失败均返回 false，不影响站内通知落库）
   */
  async sendSubscribeMessage(params: WechatSubscribeParams): Promise<boolean> {
    const map = await this.getTemplateIdMap();
    const templateId = map[params.type];

    if (!templateId) {
      this.logger.log(`[骨架] 微信订阅消息未启用（模板ID为空），type=${params.type}, openId=${params.openId || '无'}`);
      return false;
    }
    if (!params.openId) {
      this.logger.warn(`用户缺少 open_id，无法推送微信消息，type=${params.type}`);
      return false;
    }

    const token = await this.getAccessToken();
    if (!token) {
      this.logger.warn(`未配置 WECHAT_SECRET，跳过微信推送，type=${params.type}`);
      return false;
    }

    try {
      const res = await fetch(
        `https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=${token}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            touser: params.openId,
            template_id: templateId,
            page: params.page || 'pages/notification-center/index',
            data: buildWechatTemplateData(params.type, params.data),
            miniprogram_state: 'formal',
          }),
        },
      );
      const result: any = await res.json();
      if (result?.errcode === 0) {
        this.logger.log(`微信订阅消息发送成功: type=${params.type}, openId=${params.openId}`);
        return true;
      }
      // 常见失败：43004 用户未订阅/授权已用完、40037 模板ID无效、47003 模板参数不匹配
      this.logger.warn(`微信订阅消息发送失败: type=${params.type}, result=${JSON.stringify(result)}`);
      return false;
    } catch (err: any) {
      this.logger.error(`微信订阅消息发送异常: ${err?.message}`);
      return false;
    }
  }
}
