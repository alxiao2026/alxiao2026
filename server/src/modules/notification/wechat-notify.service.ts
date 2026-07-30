import { Injectable, Logger } from '@nestjs/common';
import { NotificationType, NOTIFICATION_TEMPLATES } from './notification.templates';

export interface WechatSubscribeParams {
  /** 接收用户的微信 openid（users.open_id） */
  openId: string;
  /** 通知类型（用于映射订阅消息模板） */
  type: NotificationType;
  /** 模板数据（关键字值，须与公众平台模板关键字严格一致） */
  data: Record<string, any>;
  /** 点击模板消息后跳转的小程序页面路径 */
  page?: string;
}

/**
 * 微信订阅消息发送服务
 *
 * 启用条件（缺一不可，未满足时自动降级为仅记录日志，不影响站内通知）：
 * 1. server/.env 配置 WECHAT_APPID / WECHAT_SECRET（用于获取 access_token）
 * 2. notification.templates.ts 中对应通知类型的 wechatTemplateId 已回填
 *    （微信公众平台 → 功能 → 订阅消息 中申请模板）
 * 3. 用户已授权订阅对应模板（前端 Taro.requestSubscribeMessage 引导）
 *
 * 发送接口：POST https://api.weixin.qq.com/cgi-bin/message/subscribe/send
 */
@Injectable()
export class WechatNotifyService {
  private readonly logger = new Logger(WechatNotifyService.name);

  /** access_token 内存缓存（有效期 7200s，提前 5 分钟刷新） */
  private tokenCache: { token: string; expiresAt: number } | null = null;

  /** 获取微信接口调用凭证 access_token；未配置 AppSecret 时返回 null */
  private async getAccessToken(): Promise<string | null> {
    const appid = process.env.WECHAT_APPID || '';
    const secret = process.env.WECHAT_SECRET || '';
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

  /**
   * 发送微信订阅消息
   * @returns 是否真正通过微信通道发出（未配置/失败均返回 false，不影响站内通知落库）
   */
  async sendSubscribeMessage(params: WechatSubscribeParams): Promise<boolean> {
    const templateId = NOTIFICATION_TEMPLATES[params.type]?.wechatTemplateId;

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
            data: params.data,
          }),
        },
      );
      const result: any = await res.json();
      if (result?.errcode === 0) {
        this.logger.log(`微信订阅消息发送成功: type=${params.type}, openId=${params.openId}`);
        return true;
      }
      // 常见失败：43004 用户未订阅/授权已用完、40037 模板ID无效
      this.logger.warn(`微信订阅消息发送失败: type=${params.type}, result=${JSON.stringify(result)}`);
      return false;
    } catch (err: any) {
      this.logger.error(`微信订阅消息发送异常: ${err?.message}`);
      return false;
    }
  }
}
