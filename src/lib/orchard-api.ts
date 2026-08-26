import Taro from '@tarojs/taro'
import { Network } from '@/network'

/* ================= 类型定义（与后端 orchard 模块一致） ================= */

export interface OrchardTree {
  growth: number
  stage: number
  stageName: string
  stageEmoji: string
  /** 当前阶段树图（TOS 签名 URL，芭芭农场风格） */
  stageImage: string
  /** 全部 6 阶段树图（里程碑轨道小图） */
  stageImages: string[]
  /** 各阶段成长阈值（与后端 STAGE_DEFS 换算一致，绝对值 g） */
  stageThresholds: number[]
  /** 下一阶段阈值（g），已成熟为 null */
  nextStageGrowth: number | null
  nextStageName: string | null
  fullGrowth: number
  progressPct: number
  isMature: boolean
  harvested: number
  availableTrees: number
  plantedAt: number
  cycleMakeupUsed: number
  cycleMakeupUseLimit: number
  history: Array<{ index: number; harvestedAt: number; days: number }>
  currentStreak: number
  maxStreak: number
  wateredToday: boolean
  makeupCards: number
}

export interface OrchardMeals {
  date: string
  currentSlot: 'morning' | 'noon' | 'evening' | null
  claimed: { morning: boolean; noon: boolean; evening: boolean }
  slots: Array<{ key: 'morning' | 'noon' | 'evening'; label: string; range: string; emoji: string; water: number }>
}

export interface OrchardTask {
  id: string
  title: string
  desc: string
  reward: number
  dailyLimit: number
  progress: number
  done: boolean
  completedAt?: number
}

export interface OrchardProfile {
  userId: string
  nickname: string
  avatarUrl: string
  hasPhone: boolean
  isAdmin: boolean
  points: number
  makeupCards: number
  wateredDates: string[]
  lastWaterDate?: string | null
  currentStreak: number
  maxStreak: number
  tree: OrchardTree
  meals: OrchardMeals
  tasks: { daily: OrchardTask[]; growth: OrchardTask[] }
  config: {
    dailyWater: number
    mealWater: number
    makeupCostPoints: number
    cycleMakeupUseLimit: number
    pointsExchangeRate: number
    pointsExchangeMin: number
    treeFullGrowth: number
    taskGroupBuyReward: number
    taskGroupBuyLimit: number
    taskShareReward: number
    taskShareLimit: number
    taskInviteLimit: number
    growthBindPhonePoints: number
    growthAddWecomPoints: number
    wecomQrCode: string
    couponTiers: Array<{ threshold: number; amount: number; treeCost: number }>
  }
}

export interface OrchardTasksData {
  tasks: { daily: OrchardTask[]; growth: OrchardTask[] }
  dailyTasks: OrchardTask[]
  growthTasks: OrchardTask[]
  makeupCards: number
  cycleMakeupUsed: number
  cycleMakeupUseLimit: number
  shareId: string
  hasPhone: boolean
}

export interface OrchardCoupon {
  code: string
  defId: string
  type: string
  title: string
  threshold: number
  amount: number
  status: 'unused' | 'locked' | 'used' | 'expired'
  claimedAt: number
  usedAt?: number | null
  expireAt?: number | null
  fromTree: number
}

export interface OrchardCouponDef {
  id: string
  type: string
  title: string
  threshold: number
  amount: number
  treeCost: number
  desc: string
}

export interface OrchardRecord {
  id: string
  amount: number
  reason: string
  remark?: string
  createdAt: number
}

export interface OrchardCalendarCell {
  date: string
  watered: boolean
  isToday: boolean
  isFuture: boolean
  missed: boolean
}

export interface OrchardShareInfo {
  shareId: string
  nickname: string
  helpedToday: number
}

export type OrchardConfig = OrchardProfile['config']

/* ================= 请求封装 ================= */

interface Envelope<T> {
  code: number
  msg: string
  data: T
  biz_code?: number
}

async function get<T>(url: string): Promise<Envelope<T>> {
  console.log('[OrchardAPI] GET', url)
  const res = await Network.request({ url })
  console.log('[OrchardAPI] GET', url, '→', res.data)
  return res.data as Envelope<T>
}

async function post<T>(url: string, data?: Record<string, unknown>): Promise<Envelope<T>> {
  console.log('[OrchardAPI] POST', url, data)
  const res = await Network.request({ url, method: 'POST', data })
  console.log('[OrchardAPI] POST', url, '→', res.data)
  return res.data as Envelope<T>
}

async function put<T>(url: string, data?: Record<string, unknown>): Promise<Envelope<T>> {
  console.log('[OrchardAPI] PUT', url, data)
  const res = await Network.request({ url, method: 'PUT', data })
  console.log('[OrchardAPI] PUT', url, '→', res.data)
  return res.data as Envelope<T>
}

/** 当前登录用户 ID（膨胀团账号体系） */
export function currentUserId(): string {
  return Taro.getStorageSync('user_id') || ''
}

/* ================= 业务接口 ================= */

export const orchardApi = {
  /** 用户完整档案：果树+任务+三餐+积分+头像昵称（首屏一次拉全） */
  profile: (userId: string) => get<OrchardProfile>(`/api/orchard/profile?user_id=${userId}`),

  /** 任务列表 */
  tasks: (userId: string) => get<OrchardTasksData>(`/api/orchard/tasks?user_id=${userId}`),

  /** 每日签到浇水 */
  dailyWater: (userId: string) =>
    post<{ already: boolean; gained: number; growth: number; stage: number; becameMature: boolean; streak: number }>(
      '/api/orchard/water/daily', { user_id: userId }),

  /** 三餐领水滴 */
  claimMeal: (userId: string, slot: 'morning' | 'noon' | 'evening') =>
    post<{ gained: number; growth: number; becameMature: boolean }>(
      '/api/orchard/water/meal', { user_id: userId, slot }),

  /** 浇水日历 */
  calendar: (userId: string, year: number, month: number) =>
    get<{ year: number; month: number; cells: (OrchardCalendarCell | null)[][] }>(
      `/api/orchard/calendar?user_id=${userId}&year=${year}&month=${month}`),

  /** 补浇水 */
  rewater: (userId: string, date: string, method: 'auto' | 'card' | 'points' = 'auto') =>
    post<{ growth: number; makeupCards: number; pointsLeft: number; wateredDates: string[] }>(
      '/api/orchard/rewater', { user_id: userId, date, method }),

  /** 完成日常任务（group_buy 手动兜底；支付成功也会自动触发） */
  completeTask: (userId: string, taskId: string) =>
    post<{ gained: number; progress: number; dailyLimit: number; alreadyDone: boolean; growth: number; becameMature: boolean }>(
      '/api/orchard/tasks/complete', { user_id: userId, task_id: taskId }),

  /** 完成成长任务（bind_phone / add_wecom） */
  completeGrowthTask: (userId: string, taskId: 'bind_phone' | 'add_wecom') =>
    post<{ points: number; reward: number }>(
      '/api/orchard/tasks/growth/complete', { user_id: userId, task_id: taskId }),

  /** 用 getPhoneNumber 的 phone_code 绑定手机号（复用登录手机号） */
  bindPhone: (userId: string, phoneCode: string) =>
    post<{ points: number; reward: number; phone: string }>(
      '/api/orchard/tasks/bind-phone', { user_id: userId, phone_code: phoneCode }),

  /** 分享信息 */
  shareInfo: (userId: string) => get<OrchardShareInfo>(`/api/orchard/share/info?user_id=${userId}`),

  /** 提交助力（好友视角） */
  submitHelp: (shareUserId: string, helperUserId: string, helperName: string) =>
    post<{ date: string; ownerName: string }>(
      '/api/orchard/help', { share_user_id: shareUserId, helper_user_id: helperUserId, helper_name: helperName }),

  /** 结算助力奖励（分享者进入果园时） */
  settleHelps: (userId: string) =>
    post<{ settled: number; droplets: number; cards: number; becameMature: boolean }>(
      '/api/orchard/help/settle', { user_id: userId }),

  /** 积分兑换水滴 */
  exchangePoints: (userId: string, points: number) =>
    post<{ exchangedPoints: number; gainedDroplets: number; growth: number; pointsLeft: number }>(
      '/api/orchard/points/exchange', { user_id: userId, points }),

  /** 水滴流水 */
  records: (userId: string) => get<OrchardRecord[]>(`/api/orchard/records?user_id=${userId}`),

  /** 收获果树 */
  harvest: (userId: string) =>
    post<{ treeIndex: number; availableTrees: number }>('/api/orchard/harvest', { user_id: userId }),

  /** 可兑换券档位 */
  couponDefs: () => get<OrchardCouponDef[]>('/api/orchard/coupons/defs'),

  /** 果树兑券 */
  claimCoupon: (userId: string, defId: string) =>
    post<OrchardCoupon>('/api/orchard/coupons/claim', { user_id: userId, def_id: defId }),

  /** 我的券 */
  myCoupons: (userId: string, status: 'all' | 'unused' | 'locked' | 'used' | 'expired' = 'all') =>
    get<OrchardCoupon[]>(`/api/orchard/coupons/mine?user_id=${userId}&status=${status}`),

  /** 下单可用券（按订单金额过滤门槛） */
  availableCoupons: (userId: string, amount: number) =>
    get<OrchardCoupon[]>(`/api/orchard/coupons/available?user_id=${userId}&amount=${amount}`),

  /* ---------- 设置后台（管理员） ---------- */
  adminGetConfig: (adminUserId: string) =>
    get<OrchardConfig>(`/api/orchard/admin/config?admin_user_id=${adminUserId}`),

  adminUpdateConfig: (adminUserId: string, patch: Partial<OrchardConfig>) =>
    put<OrchardConfig>('/api/orchard/admin/config', { admin_user_id: adminUserId, ...patch }),

  adminResetConfig: (adminUserId: string) =>
    post<OrchardConfig>('/api/orchard/admin/config/reset', { admin_user_id: adminUserId }),
}

/* ================= 常量（与 H5 视觉保持一致） ================= */

export const TREE_STAGE_EMOJIS = ['🌰', '🌱', '🪴', '🌸', '🍊', '🌟']
export const TREE_STAGE_NAMES = ['种子', '发芽', '小树', '开花', '结果', '成熟']

export const MEAL_SLOT_META: Record<string, { label: string; range: string; emoji: string }> = {
  morning: { label: '早餐浇水', range: '7:00 - 9:00', emoji: '🌅' },
  noon: { label: '午餐浇水', range: '11:00 - 13:00', emoji: '☀️' },
  evening: { label: '晚餐浇水', range: '17:00 - 19:00', emoji: '🌇' },
}
