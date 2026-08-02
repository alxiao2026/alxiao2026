/**
 * 通知类型与消息模板定义
 *
 * 13 种通知场景：
 *  1. withdraw_arrived        商户资金提现到账通知
 *  2. withdraw_submitted      商户资金提交提现成功通知
 *  3. order_created           下单成功待抽奖通知
 *  4. coupon_expiring         抽到的优惠券到期通知（前7天/前1天）
 *  5. order_paid              订单付款成功通知
 *  6. order_expiring          订单快到期待核销通知（前7天/前1天）
 *  7. order_verified          订单核销成功通知
 *  8. prize_won               抽中奖品通知
 *  9. merchant_refund_success 商户退款成功通知
 * 10. prize_expiring          奖品兑换到期通知（前7天/前1天）
 * 11. share_success           分享成功提示
 * 12. prize_redeemed          奖品核销成功通知
 * 13. customer_refund_success 客户退款成功通知
 */

export type NotificationType =
  | 'withdraw_arrived'
  | 'withdraw_submitted'
  | 'withdraw_rejected'
  | 'order_created'
  | 'coupon_expiring'
  | 'order_paid'
  | 'order_expiring'
  | 'order_verified'
  | 'order_verify_revoked'
  | 'prize_won'
  | 'merchant_refund_success'
  | 'prize_expiring'
  | 'share_success'
  | 'prize_redeemed'
  | 'customer_refund_success';

export interface NotificationTemplate {
  /** 站内通知标题 */
  title: string;
  /** 站内通知正文渲染 */
  render: (data: Record<string, any>) => string;
  /**
   * 微信订阅消息模板 ID（公众平台申请）
   * TODO: 小程序备案、AppID 下发后，将此处替换为真实模板 ID 即可启用微信推送
   */
  wechatTemplateId: string;
}

const fmtAmount = (v: any) => Number(v ?? 0).toFixed(2);

export const NOTIFICATION_TEMPLATES: Record<NotificationType, NotificationTemplate> = {
  withdraw_arrived: {
    title: '提现到账通知',
    render: (d) => `您申请的提现 ¥${fmtAmount(d.amount)} 已打款到账，请注意查收。`,
    wechatTemplateId: '', // TODO: AppID 下发后填写
  },
  withdraw_submitted: {
    title: '提现申请提交成功',
    render: (d) => `您的提现申请 ¥${fmtAmount(d.amount)} 已提交成功，平台将在审核后打款，请耐心等待。`,
    wechatTemplateId: '',
  },
  withdraw_rejected: {
    title: '提现申请未通过审核',
    render: (d) => `您的提现申请 ¥${fmtAmount(d.amount)} 未通过审核${d.reason ? `，原因：${d.reason}` : ''}，提现金额已退回您的账户余额。`,
    wechatTemplateId: '',
  },
  order_created: {
    title: '下单成功，快来抽奖',
    render: (d) => `您已成功购买「${d.package_name ?? '套餐'}」，快去参与抽奖，霸王餐等你拿！`,
    wechatTemplateId: '',
  },
  coupon_expiring: {
    title: '优惠券到期提醒',
    render: (d) => `您抽中的「${d.prize_name ?? '优惠券'}」将于 ${d.expire_time ?? ''} 到期，请尽快使用。`,
    wechatTemplateId: '',
  },
  order_paid: {
    title: '付款成功通知',
    render: (d) => `您的订单 ${d.order_no ?? ''} 已付款成功，金额 ¥${fmtAmount(d.amount)}，感谢您的购买。`,
    wechatTemplateId: '',
  },
  order_expiring: {
    title: '订单到期提醒',
    render: (d) => `您购买的「${d.package_name ?? '套餐'}」将于 ${d.expire_time ?? ''} 到期，请尽快到店核销使用。`,
    wechatTemplateId: '',
  },
  order_verified: {
    title: '核销成功通知',
    render: (d) => `您的订单 ${d.order_no ?? ''} 已核销成功，感谢您的光临，欢迎下次再来。`,
    wechatTemplateId: '',
  },
  order_verify_revoked: {
    title: '核销撤销通知',
    render: (d) => `您的订单 ${d.order_no ?? ''} 核销已被商家撤销，订单已恢复待使用状态，如有疑问请联系商家。`,
    wechatTemplateId: '',
  },
  prize_won: {
    title: '恭喜中奖',
    render: (d) => `恭喜您抽中「${d.prize_name ?? '奖品'}」！请在有效期内及时兑换使用。`,
    wechatTemplateId: '',
  },
  merchant_refund_success: {
    title: '退款成功通知',
    render: (d) => `订单 ${d.order_no ?? ''} 的退款 ¥${fmtAmount(d.amount)} 已原路退回给用户，退款处理完成。`,
    wechatTemplateId: '',
  },
  prize_expiring: {
    title: '奖品兑换到期提醒',
    render: (d) => `您抽中的「${d.prize_name ?? '奖品'}」兑换资格将于 ${d.expire_time ?? ''} 到期，请尽快兑换。`,
    wechatTemplateId: '',
  },
  share_success: {
    title: '分享成功',
    render: (d) => `分享成功！您已获得 ${d.chances_added ?? 1} 次额外抽奖机会，快去抽奖吧。`,
    wechatTemplateId: '',
  },
  prize_redeemed: {
    title: '奖品核销成功通知',
    render: (d) => `您的奖品「${d.prize_name ?? '奖品'}」已核销成功，感谢您的参与。`,
    wechatTemplateId: '',
  },
  customer_refund_success: {
    title: '退款成功通知',
    render: (d) => `您的订单 ${d.order_no ?? ''} 退款 ¥${fmtAmount(d.amount)} 已原路退回，请注意查收。`,
    wechatTemplateId: '',
  },
};

/** 定时提醒类型（用于防重复提醒日志） */
export type RemindType = 'coupon_expiring' | 'order_expiring' | 'prize_expiring';

/** 提醒节点：到期前 7 天 / 前 1 天 */
export type RemindPoint = '7d' | '1d';
