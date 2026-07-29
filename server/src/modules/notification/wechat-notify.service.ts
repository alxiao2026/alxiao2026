import { Injectable, Logger } from '@nestjs/common';
import { NotificationType, NOTIFICATION_TEMPLATES } from './notification.templates';

export interface WechatSubscribeParams {
  /** 接收用户的微信 openid（users.open_id） */
  openId: string;
  /** 通知类型（用于映射订阅消息模板） */
  type: NotificationType;
  /** 模板数据（关键字值） */
  data: Record<string, any>;
  /** 点击模板消息后跳转的小程序页面路径 */
  page?: string;
}

/**
 * 微信订阅消息发送服务（骨架预留）
 *
 * ============================================================================
 * TODO: 小程序备案完成、AppID/AppSecret 下发后，按以下步骤完成对接：
 *
 * 1. 微信公众平台 → 功能 → 订阅消息，为本项目 13 类通知分别申请模板，
 *    并将模板 ID 回填到 notification.templates.ts 的 wechatTemplateId 字段。
 *
 * 2. 实现 getAccessToken()：
 *    GET https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential
 *      &appid=APPID&secret=APPSECRET
 *    注意：access_token 有效期 7200 秒，需做缓存（建议存内存 + 提前 5 分钟刷新）。
 *
 * 3. 实现发送调用：
 *    POST https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=TOKEN
 *    Body: {
 *      touser: openId,
 *      template_id: wechatTemplateId,
 *      page: 'pages/index/index',
 *      data: { thing1: { value: '...' }, amount2: { value: '...' } }
 *    }
 *    注意：data 的字段名/类型必须与公众平台模板定义的关键字严格一致。
 *
 * 4. 前端配合：在对应场景引导用户授权订阅：
 *    Taro.requestSubscribeMessage({ tmplIds: [模板ID] })
 *    建议时机：下单成功后、抽奖前、提现前等用户操作节点。
 *
 * 5. 用户 openid 来源：users.open_id（微信登录时已落库）。
 * ============================================================================
 */
@Injectable()
export class WechatNotifyService {
  private readonly logger = new Logger(WechatNotifyService.name);

  /**
   * 发送微信订阅消息（当前为骨架实现：模板 ID 未配置时仅记录日志并跳过）
   * @returns 是否真正通过微信通道发出
   */
  async sendSubscribeMessage(params: WechatSubscribeParams): Promise<boolean> {
    const templateId = NOTIFICATION_TEMPLATES[params.type]?.wechatTemplateId;

    // AppID / 模板 ID 未配置前：仅记录日志，不视为失败
    if (!templateId) {
      this.logger.log(`[骨架] 微信订阅消息未启用（模板ID为空），type=${params.type}, openId=${params.openId || '无'}`);
      return false;
    }
    if (!params.openId) {
      this.logger.warn(`[骨架] 用户缺少 open_id，无法推送微信消息，type=${params.type}`);
      return false;
    }

    // TODO: AppID 下发后在此实现真实发送逻辑（见文件头注释步骤 2、3）
    this.logger.log(`[骨架] 待实现微信推送: templateId=${templateId}, openId=${params.openId}, type=${params.type}`);
    return false;
  }
}
