/**
 * ============================================================
 * 驿站快递查件 · 独立分包共享配置模块
 * ============================================================
 * 物理隔离约定（重要）：
 * - 本分包为独立「快递查件流量入口」，不与膨胀团主业务耦合
 * - 不使用主包 Network 请求层 / 账号体系 / 全局状态
 * - 数据全部走本地存储（Taro.getStorageSync / setStorageSync）
 * - 存储 key 统一以 `station:` 前缀命名，与主包存储完全隔离
 */

import Taro from '@tarojs/taro'

/* ==================== 部署配置清单（上线前必须替换/核对） ====================
 * 1. 官方小程序跳转 appId（查件方案 = navigateToMiniProgram 跳官方小程序，非 web-view）
 *    ① PDD_MINI_PROGRAM_APP_ID —— 拼多多官方小程序 appId
 *       当前值 wx32540bd863b27570，联网搜索自微信开放社区开发者帖
 *       （developers.weixin.qq.com，navigateToMiniProgram 实际传参）等多来源交叉验证；
 *       部署前建议真机实测复核（若跳转失败说明对方已更换 appId，需替换）
 *    ② CAINIAO_MINI_PROGRAM_APP_ID —— 菜鸟裹裹官方小程序 appId
 *       ⚠️ 联网搜索未找到可靠公开值，当前留空 → 运行时自动降级为「复制链接」兜底；
 *       部署时获取：手机微信搜「菜鸟裹裹」→ 右上角菜单 → 小程序资料页查看 appId 后替换
 *    ③ 对方小程序查件 path（可选；均查不到可靠公开值，空 = 跳对方小程序首页）
 *
 * 2. 微信流量主广告位（开通流量主后替换，空字符串 = 走模拟广告）
 *    ① BANNER_AD_UNIT_ID       —— 驿站首页 banner 广告位
 *    ② INTERSTITIAL_AD_UNIT_ID —— 跳转过渡页插屏广告位
 *
 * 3. GROUP_BUY_DETAIL_PATH —— 附近好店团购卡片跳转路径（主包真实路由）
 *    ▶ 当前已对接 /pages/package-detail/index（接收 ?id= 参数）
 *    ▶ 若主包路由变更只需改这里
 *
 * 4. ADMIN_PASSWORD —— 管理配置页口令（当前 '8888'，上线前务必修改）
 * ========================================================================== */
export const DEPLOY = {
  /** 拼多多官方小程序 appId（来源：微信开放社区开发者帖等多来源交叉验证，部署时真机复核） */
  PDD_MINI_PROGRAM_APP_ID: 'wx32540bd863b27570',
  /** 菜鸟裹裹官方小程序 appId（联网搜索未获可靠值，留空 → 降级复制链接；部署时替换） */
  CAINIAO_MINI_PROGRAM_APP_ID: '',
  /** 跳拼多多小程序目标 path（空 = 对方小程序首页；查件 path 未公开） */
  PDD_MINI_PROGRAM_PATH: '',
  /** 跳菜鸟裹裹小程序目标 path（空 = 对方小程序首页） */
  CAINIAO_MINI_PROGRAM_PATH: '',
  /** 流量主 banner 广告位 id（部署时替换，空 = 模拟广告） */
  BANNER_AD_UNIT_ID: '',
  /** 流量主插屏广告位 id（部署时替换，空 = 模拟广告） */
  INTERSTITIAL_AD_UNIT_ID: '',
  /** 团购详情页路径（主包膨胀团真实路由，?id=团购ID） */
  GROUP_BUY_DETAIL_PATH: '/pages/package-detail/index',
  /** 管理配置页口令（上线前务必修改） */
  ADMIN_PASSWORD: '8888',
}

/** 查件跳转目标（Taro.navigateToMiniProgram 参数） */
export interface MiniProgramTarget {
  /** 官方小程序 appId（空 = 未配置，页面层降级为复制链接兜底） */
  appId: string
  /** 目标小程序页面路径（空 = 对方小程序首页） */
  path: string
}

/** 按查件渠道取跳转目标（appId / path 集中在 DEPLOY 配置） */
export const getMiniProgramTarget = (type: QueryType): MiniProgramTarget =>
  type === 'cainiao'
    ? { appId: DEPLOY.CAINIAO_MINI_PROGRAM_APP_ID, path: DEPLOY.CAINIAO_MINI_PROGRAM_PATH }
    : { appId: DEPLOY.PDD_MINI_PROGRAM_APP_ID, path: DEPLOY.PDD_MINI_PROGRAM_PATH }

/* ==================== 预留 API 接口层（当前为本地存储 mock） ====================
 * 接入真实后端时按以下契约替换（建议独立网关/域名，与主包膨胀团后端隔离）：
 *   GET  /api/station/config?code={code}      → StationConfig
 *   PUT  /api/station/config                  → 保存驿站信息（body: StationConfig）
 *   GET  /api/station/group-buys?code={code}  → GroupBuyItem[]（≤ MAX_GROUP_BUYS 条）
 *   PUT  /api/station/group-buys              → 保存团购列表（body: { code, items }）
 *   POST /api/station/feedback                → 提交反馈（body: { content, station_code }）
 *   POST /api/station/query-log               → 上报查件行为（body: { type, station_code }）
 * 替换方式：将下方 load / save / record 系列函数改为请求实现，页面层无需改动。
 * ============================================================================== */

/** 查件渠道 */
export type QueryType = 'pdd' | 'cainiao'

export const QUERY_TYPE_LABEL: Record<QueryType, string> = {
  pdd: '拼多多',
  cainiao: '菜鸟',
}

/** 驿站配置 */
export interface StationConfig {
  /** 驿站编码（拼多多 station_code） */
  code: string
  /** 驿站名称 */
  name: string
  /** 菜鸟 stationId（空 = 未开通，首页「查菜鸟」按钮降级置灰） */
  cainiaoStationId: string
  /** 驿站地址 */
  address: string
  /** 营业时间 */
  businessHours: string
  /** 驿站介绍 */
  intro: string
}

/** 附近好店团购卡片（唯一对接主包业务的数据结构） */
export interface GroupBuyItem {
  /** 团购ID（跳转主包 /pages/package-detail/index?id= 使用；mock 数据需替换为真实套餐ID，可在管理页编辑） */
  id: string
  title: string
  description: string
  price: number
  originalPrice: number
  tag: string
}

/** 团购卡片上限 */
export const MAX_GROUP_BUYS = 5

/** 预设 3 个 mock 驿站（C 站未配置菜鸟 stationId，用于验证降级逻辑） */
export const PRESET_STATIONS: StationConfig[] = [
  {
    code: 'A032042625',
    name: 'A032 快递驿站（旗舰店）',
    cainiaoStationId: '642757',
    address: '幸福路 88 号 A032 驿站',
    businessHours: '09:00 - 21:00',
    intro: '社区旗舰店，拼多多/菜鸟双渠道取件，高峰期开放双窗口，取件更快。',
  },
  {
    code: 'B052042626',
    name: 'B052 快递驿站（社区店）',
    cainiaoStationId: '642758',
    address: '望江路 12 号 B052 驿站',
    businessHours: '08:30 - 20:30',
    intro: '社区便利店合营驿站，取件顺手购物，晚高峰延长营业。',
  },
  {
    code: 'C072042627',
    name: 'C072 快递驿站（校园店）',
    cainiaoStationId: '',
    address: '大学城创业街 6 号 C072 驿站',
    businessHours: '10:00 - 22:00',
    intro: '校园驿站，菜鸟渠道暂未开通，可使用拼多多渠道查件。',
  },
]

/** 默认团购列表（mock；团购ID需替换为主包真实套餐ID，可在管理配置页编辑） */
export const DEFAULT_GROUP_BUYS: GroupBuyItem[] = [
  { id: 'gb-001', title: '老王烧烤 · 双人套餐', description: '羊肉串 10 串 + 烤鱼 1 条 + 饮料 2 杯', price: 59.9, originalPrice: 128, tag: '爆款' },
  { id: 'gb-002', title: '鲜果时光 · 4 杯果茶', description: '招牌多肉葡萄 ×2 + 芝士芒芒 ×2', price: 39.9, originalPrice: 72, tag: '自提' },
  { id: 'gb-003', title: '小鹿便利 · 新客礼包', description: '零食饮料组合，满 15 立减 5', price: 9.9, originalPrice: 20, tag: '新客' },
  { id: 'gb-004', title: '轻食星球 · 3 日健身餐', description: '低卡主食 + 高蛋白套餐', price: 29.9, originalPrice: 60, tag: '低卡' },
  { id: 'gb-005', title: '邻里理发 · 精剪 1 次', description: '总监级剪发 + 肩颈放松', price: 25, originalPrice: 58, tag: '限时' },
]

/** 模拟广告（轮播）——开通流量主后由 <Ad> 组件替代（见 DEPLOY.BANNER_AD_UNIT_ID） */
export interface MockAd {
  id: string
  brand: string
  title: string
  subtitle: string
  emoji: string
  gradient: string
}

export const MOCK_ADS: MockAd[] = [
  { id: 'ad-1', brand: '鲜果时光', title: '夏日果茶第二杯半价', subtitle: '驿站旁 50 米 · 到店自提', emoji: '🧋', gradient: 'linear-gradient(120deg, #FFB347, #FF6B35)' },
  { id: 'ad-2', brand: '小鹿便利', title: '新客专享立减 5 元', subtitle: '全场满 15 可用 · 凭取件码核销', emoji: '🛒', gradient: 'linear-gradient(120deg, #F6D365, #FDA085)' },
  { id: 'ad-3', brand: '轻食星球', title: '健身轻食 3 日卡 29.9', subtitle: '低卡饱腹 · 取件顺路带走', emoji: '🥗', gradient: 'linear-gradient(120deg, #84E8A4, #2FB86B)' },
]

/** 拼多多查件 H5 链接（复制链接兜底出口：跳转小程序失败 / appId 未配置 / 用户偏好浏览器时使用） */
export const buildPddUrl = (stationCode: string): string =>
  `https://mdkd.pinduoduo.com/weixin/package?station_code=${encodeURIComponent(stationCode)}`

/** 菜鸟查件 H5 链接（复制链接兜底出口，station_code / cainiao_station_id 动态替换） */
export const buildCainiaoUrl = (cainiaoStationId: string): string =>
  `https://market.m.taobao.com/app/cn-yz/package-list/index.html#/?stationId=${encodeURIComponent(cainiaoStationId)}&source=scanPickup&activity=service&pickupType=SCAN_PICK_ALL`

/** 今日取件高峰提示（高峰时段 11:00-13:00 / 17:00-19:00） */
export interface PeakStatus {
  isPeak: boolean
  text: string
}

export const getPeakStatus = (): PeakStatus => {
  const hour = new Date().getHours()
  const isPeak = (hour >= 11 && hour < 13) || (hour >= 17 && hour < 19)
  return isPeak
    ? { isPeak: true, text: '当前取件人多，建议错峰再来' }
    : { isPeak: false, text: '当前人少，快来取' }
}

/* ==================== 本地存储（station: 前缀隔离） ==================== */

const CONFIG_KEY = 'station:config'
const STATS_KEY = 'station:stats'
const FEEDBACK_KEY = 'station:feedbacks'
const groupBuyKey = (code: string) => `station:group-buys:${code}`

export const loadStationConfig = (): StationConfig => {
  const saved = Taro.getStorageSync(CONFIG_KEY)
  if (saved && typeof (saved as StationConfig).code === 'string' && (saved as StationConfig).code) {
    return saved as StationConfig
  }
  return { ...PRESET_STATIONS[0] }
}

export const saveStationConfig = (config: StationConfig): void => {
  Taro.setStorageSync(CONFIG_KEY, config)
}

export const loadGroupBuys = (code: string): GroupBuyItem[] => {
  const saved = Taro.getStorageSync(groupBuyKey(code))
  if (Array.isArray(saved) && saved.length > 0) {
    return (saved as GroupBuyItem[]).slice(0, MAX_GROUP_BUYS)
  }
  return DEFAULT_GROUP_BUYS.map((g) => ({ ...g }))
}

export const saveGroupBuys = (code: string, items: GroupBuyItem[]): void => {
  Taro.setStorageSync(groupBuyKey(code), items.slice(0, MAX_GROUP_BUYS))
}

/** 扫码/查件统计（含模拟基数，接入后端后改为 query-log 上报） */
export interface StationStats {
  todayQueries: number
  totalQueries: number
  totalPackages: number
}

export const loadStats = (): StationStats => {
  const saved = Taro.getStorageSync(STATS_KEY)
  if (saved && typeof (saved as StationStats).totalQueries === 'number') {
    return saved as StationStats
  }
  // 模拟数据基数：累计查询 3682 次 / 累计服务包裹 12860 件
  return { todayQueries: 0, totalQueries: 3682, totalPackages: 12860 }
}

/** 记录一次查件行为（本地统计） */
export const recordQuery = (): StationStats => {
  const current = loadStats()
  const next: StationStats = {
    todayQueries: current.todayQueries + 1,
    totalQueries: current.totalQueries + 1,
    totalPackages: current.totalPackages + 1,
  }
  Taro.setStorageSync(STATS_KEY, next)
  return next
}

/** 意见反馈（本地存储，最多保留 50 条） */
export interface FeedbackItem {
  content: string
  createdAt: string
}

export const loadFeedbacks = (): FeedbackItem[] => {
  const saved = Taro.getStorageSync(FEEDBACK_KEY)
  return Array.isArray(saved) ? (saved as FeedbackItem[]) : []
}

export const saveFeedback = (content: string): void => {
  const list = loadFeedbacks()
  list.unshift({ content, createdAt: new Date().toISOString() })
  Taro.setStorageSync(FEEDBACK_KEY, list.slice(0, 50))
}
