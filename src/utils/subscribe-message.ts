import Taro from '@tarojs/taro'
import { Network } from '@/network'

/**
 * 微信订阅消息授权引导
 *
 * 微信规则：
 * - 一次性订阅：用户每授权一次，每个模板可推送 1 条
 * - 一次最多请求 3 个模板 ID
 * - 用户勾选"总是保持以上选择"后，后续 requestSubscribeMessage 直接静默返回上次选择
 *
 * 手势上下文约束：
 * - requestSubscribeMessage 必须发生在用户点击的同步调用链内，中间不能有 await 网络请求
 * - 因此采用「页面加载时 preload 预取 + 点击时用内存缓存同步弹窗」模式
 *
 * 使用方式：
 * 1. 页面 useEffect 中调用 preloadSubscribeTemplates()
 * 2. 按钮点击 handler 开头同步调用 requestSubscribeByScene('order')（不要 await 它之前的其他异步）
 */

/** 各业务场景关心的通知类型 */
export const SUBSCRIBE_SCENES = {
  /** 支付成功后：付款结果、核销结果、退款结果 */
  order: ['order_paid', 'order_verified', 'customer_refund_success'],
  /** 抽奖前：中奖通知、奖品核销 */
  lottery: ['prize_won', 'prize_redeemed', 'coupon_expiring'],
  /** 商家提现：申请提交、到账、被拒绝 */
  withdraw: ['withdraw_submitted', 'withdraw_arrived', 'withdraw_rejected'],
} as const

interface EnabledTemplate {
  type: string
  templateId: string
  label: string
  title: string
}

/** 模板列表内存缓存（5 分钟） */
let templateCache: { list: EnabledTemplate[]; expiresAt: number } | null = null

/** 拉取后端已配置的模板（未配置时返回空数组，表示微信推送未启用） */
export async function getEnabledSubscribeTemplates(force = false): Promise<EnabledTemplate[]> {
  if (!force && templateCache && Date.now() < templateCache.expiresAt) {
    return templateCache.list
  }
  try {
    const res = await Network.request({ url: '/api/notifications/subscribe-templates' })
    const data = (res.data as any)?.data
    const list: EnabledTemplate[] = Array.isArray(data) ? data : []
    templateCache = { list, expiresAt: Date.now() + 5 * 60 * 1000 }
    return list
  } catch (e) {
    console.warn('[subscribe] 拉取订阅模板失败:', e)
    return templateCache?.list || []
  }
}

/** 页面加载时预取模板列表（为点击时同步弹窗做准备） */
export function preloadSubscribeTemplates() {
  if (Taro.getEnv() !== Taro.ENV_TYPE.WEAPP) return
  getEnabledSubscribeTemplates().catch(() => undefined)
}

/**
 * 按场景请求订阅授权（同步发起，需在用户点击调用链内调用）
 * @param scene 场景 key（SUBSCRIBE_SCENES）
 */
export function requestSubscribeByScene(scene: keyof typeof SUBSCRIBE_SCENES) {
  // 仅微信小程序端支持订阅消息
  if (Taro.getEnv() !== Taro.ENV_TYPE.WEAPP) return

  const types = SUBSCRIBE_SCENES[scene] as unknown as string[]
  const enabled = templateCache?.list || []
  if (enabled.length === 0) return

  // 过滤出该场景已配置的模板 ID（保持场景声明的顺序，最多 3 个）
  const tmplIds = types
    .map((t) => enabled.find((e) => e.type === t)?.templateId)
    .filter((id): id is string => !!id)
    .slice(0, 3)

  if (tmplIds.length === 0) return

  // Taro 类型定义要求 tmplIds/entityIds 同传（类型缺陷），运行时微信小程序仅需 tmplIds
  Taro.requestSubscribeMessage({ tmplIds } as any)
    .then((res) => {
      const accepted = tmplIds.filter((id) => (res as any)?.[id] === 'accept').length
      console.log(`[subscribe] 场景=${scene} 请求=${tmplIds.length} 同意=${accepted}`)
    })
    .catch((e: any) => {
      // 用户拒绝或系统错误均静默，不阻断业务
      console.warn(`[subscribe] 场景=${scene} 授权未完成:`, e?.errMsg || e?.message || e)
    })
}
