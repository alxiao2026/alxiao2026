/**
 * 统一分享引擎：文案模板轮换 + 合规过滤 + 封面图自动搭配 + 轻量埋点
 *
 * 场景清单：
 * - package：团购详情页（名称 + 价格锚点/省钱钩子，约 20 字）
 * - assist：好友助力（口语化、互动感，不承诺必得）
 * - brand：首页/通用（品牌文案 + 主推团购钩子）
 * - station：驿站页（独立分包）
 * - merchant：商家详情页（商家名 + 抽霸王餐钩子，如实描述活动规则）
 * - win：中奖炫耀（喜悦感、不夸大不吹牛、不提中奖概率）
 * - boost：膨胀盲盒翻盒助力（如实描述规则：抽奖权重 +0.5，非必中）
 *
 * 合规红线（模板与拼接结果双重过滤）：
 * - 不出现「最高/第一/全网最低」等广告法极限词
 * - 不出现「分享得红包/转发领现金」等利益诱导话术
 * - 助力文案不承诺必得；价格与页面一致（直接取套餐真实字段）
 */
import Taro from '@tarojs/taro'
import { Network } from '@/network'

export type ShareScene = 'package' | 'assist' | 'brand' | 'station' | 'merchant' | 'win' | 'boost'
export type CoverCategory = 'food' | 'daily' | 'play' | 'assist' | 'win'
export type CoverRatio = 'share' | 'square'

/** 卡片标题长度上限（微信卡片过长会截断，控制在 20 字左右） */
const TITLE_MAX_LEN = 22

/** 分享文案模板库：同一用户重复分享按序轮换，避免千篇一律 */
const TEMPLATES: Record<ShareScene, string[]> = {
  // 团购详情页：{name} 套餐名 / {price} 现价 / {save} 省多少元
  package: [
    '{name}只要{price}，下班顺路炫一顿',
    '省{save}块的{name}，一杯奶茶钱拿下',
    '{name}来了，这个价格我先冲为敬',
    '挖到好店了！{name}低至{price}元',
    '今天这顿{name}，比点外卖还划算',
  ],
  // 好友助力：{name} 发起人昵称
  assist: [
    '帮{name}浇个水，TA的果树就能长一截',
    '动动手指，帮{name}把果树浇大一点',
    '{name}的果树缺一瓢水，就差你了',
    '来嘛，给{name}的小树苗搭把手',
    '点一下的事，{name}的果树谢谢你',
  ],
  // 驿站页（独立分包）：{station} 驿站名 / {name} 附近好店主推团购
  station: [
    '{station}查快递超方便，顺手逛逛好店',
    '取快递别干等，{station}里的好价淘一淘',
    '{station}上新的团购有点意思：{name}',
    '查完件看看{name}，{station}取件顺手薅',
  ],
  // 商家详情页：{merchant} 商家名（下单抽霸王餐为页面真实活动，如实描述不承诺结果）
  merchant: [
    '{merchant}下单抽霸王餐，我在这蹲到了',
    '安利{merchant}，吃完还能抽个霸王餐',
    '{merchant}安排上，说不定霸王餐就是你的',
    '这顿{merchant}吃得值，抽奖白送的机会',
    '{merchant}挺好吃的，抽霸王餐的活动也在这',
  ],
  // 中奖炫耀：{prize} 奖品名（只描述事实与喜悦，不提概率不夸张）
  win: [
    '我抽中了{prize}，运气爆棚的一天',
    '{prize}到手，膨胀团宠我',
    '随手一抽，{prize}就来了',
    '今天的快乐是{prize}给的',
    '在中{prize}这件事上，我是有点运气的',
  ],
  // 膨胀盲盒翻盒助力：{name} 发起人昵称（+0.5 为真实规则：抽奖权重加成，非必中）
  boost: [
    '帮我点一下，霸王餐概率+0.5',
    '动动手指帮{name}翻盒，抽奖权重+0.5',
    '{name}差你一个助力，翻盒权重马上加',
    '帮{name}翻个盒，中不中看他造化',
    '翻盒互助：{name}的霸王餐权重+0.5就靠你',
  ],
  // 首页/通用：{name} 主推套餐名
  brand: [
    '膨胀团：好店好价都在这，下单还能抽奖',
    '挖到个本地团购宝藏小程序，{name}有点香',
    '膨胀团上新啦，{name}值得一看',
    '周末不知道吃啥？来膨胀团转一圈',
  ],
}

/** 各场景兜底文案（模板占位信息缺失时使用） */
const FALLBACK_TITLE: Record<ShareScene, string> = {
  package: '超值团购套餐，下单还有抽奖彩蛋',
  assist: '来帮我浇浇水，一起种果树呀',
  brand: '膨胀团：好店好价，下单还能抽奖',
  station: '查快递顺手看团购，这个驿站有点东西',
  merchant: '这家店下单能抽奖，霸王餐等你来抽',
  win: '在膨胀团抽中了好东西，来沾沾运气',
  boost: '帮朋友翻个盒，他的霸王餐就差这一下',
}

/**
 * 合规黑名单：广告法极限词 + 微信明令禁止的利益诱导话术
 * 模板静态已规避；此列表对动态拼接结果（套餐名等外部输入）做运行时兜底
 */
const COMPLIANCE_BLOCKLIST = [
  // 广告法极限词
  '最高', '最好', '最低', '最便宜', '最强', '第一', '全网最低', '全网最低价', '史上', '国家级', '世界级', '顶级', '顶尖', '独家', '唯一', '首选', '王者', '冠军', '绝无仅有', '万分之一', '史无前例',
  // 微信禁止的利益诱导分享话术
  '分享得', '分享领', '分享送', '分享赚', '转发得', '转发领', '转发送', '转发赚', '转发有', '邀请得红包', '领现金', '得红包', '送红包', '现金奖励', '稳赚', '躺着赚', '必得', '必中', '百分百', '100%中奖',
]

/** 合规检查：命中黑名单词返回命中的词，否则返回 null */
export function findComplianceViolation(text: string): string | null {
  for (const word of COMPLIANCE_BLOCKLIST) {
    if (text.includes(word)) return word
  }
  return null
}

/** 文案清洗：命中黑名单/超长的动态内容，截断或整段回退兜底文案 */
function sanitizeShareText(raw: string, scene: ShareScene): string {
  let text = raw.replace(/\s+/g, ' ').trim()
  if (findComplianceViolation(text)) {
    // 动态内容（如套餐名）带入违规词：整段回退安全兜底
    text = FALLBACK_TITLE[scene]
  }
  if (text.length > TITLE_MAX_LEN) {
    text = text.slice(0, TITLE_MAX_LEN)
  }
  return text
}

/**
 * 模板轮换：同一用户对同一内容重复分享时，按序换下一条模板
 * 索引持久化在本地 storage（不依赖后端），自然轮换
 */
function rotateTemplate(scene: ShareScene, seedKey: string): number {
  const templates = TEMPLATES[scene]
  const storeKey = `share_tpl_idx:${scene}:${seedKey}`
  let idx = Number(Taro.getStorageSync(storeKey) || 0)
  if (!Number.isFinite(idx) || idx < 0 || idx >= templates.length) idx = 0
  Taro.setStorageSync(storeKey, (idx + 1) % templates.length)
  return idx
}

/** 价格格式化：'9.90' → '9块9'，'128.00' → '128元'，'0.5' → '5毛'（口语化价格表述，与页面价格一致） */
function formatPriceSlang(price: string | number | undefined | null): string {
  const n = Number(price)
  if (!Number.isFinite(n) || n <= 0) return ''
  if (n >= 100) return `${Math.round(n)}元`
  const cents = Math.round(n * 100)
  const yuan = Math.floor(cents / 100)
  const jiao = Math.floor((cents % 100) / 10)
  const fen = cents % 10
  if (yuan > 0) {
    if (fen > 0) return `${yuan}块${jiao}${fen}`
    if (jiao > 0) return `${yuan}块${jiao}`
    return `${yuan}元`
  }
  if (jiao > 0 && fen > 0) return `${jiao}毛${fen}`
  if (jiao > 0) return `${jiao}毛`
  return `${fen}分`
}

/** 省钱金额：原价-现价（四舍五入到角） */
function calcSave(price?: string | number | null, original?: string | number | null): string {
  const p = Number(price)
  const o = Number(original)
  if (!Number.isFinite(p) || !Number.isFinite(o) || o <= p || o <= 0) return ''
  const save = Math.round((o - p) * 10) / 10
  return String(save)
}

/** 套餐名截断：给价格钩子留空间 */
function clipName(name: string | undefined | null, maxLen: number): string {
  const n = (name || '').trim()
  if (!n) return ''
  return n.length > maxLen ? `${n.slice(0, maxLen)}…` : n
}

/** 拼接模板：替换占位符后合规清洗 */
function renderTemplate(scene: ShareScene, seedKey: string, vars: Record<string, string>): string {
  const idx = rotateTemplate(scene, seedKey)
  const tpl = TEMPLATES[scene][idx]
  let text = tpl
  for (const [k, v] of Object.entries(vars)) {
    if (!v) continue
    text = text.split(`{${k}}`).join(v)
  }
  // 占位符信息缺失导致残留 {} 的模板，换用兜底文案
  if (/\{[a-z]+\}/.test(text)) text = FALLBACK_TITLE[scene]
  return sanitizeShareText(text, scene)
}

/** 品类映射：套餐 category（如「餐饮美食 · 火锅烧烤」）→ 底图品类 */
export function mapCategoryToCover(category?: string | null): CoverCategory {
  const c = category || ''
  if (/餐饮|美食|火锅|烧烤|饮品|小吃|甜品|蛋糕|咖啡|奶茶|烘焙|自助|日料|烤肉|串串|川菜|湘菜|江浙|西餐|汉堡|披萨|面馆|饺子|炖汤/.test(c)) return 'food'
  if (/娱乐|游玩|玩乐|休闲|电影|演出|密室|KTV|ktv|健身|运动|景区|乐园|亲子|游乐|桌游|剧本|网吧|电竞|足疗|洗浴|采摘|农家/.test(c)) return 'play'
  return 'daily'
}

/**
 * 品牌底图 URL：后端代理输出（公网可访问，微信转存卡片封面）
 * ratio: share=好友卡片(5:4) / square=朋友圈(1:1)
 */
export function getBrandCoverUrl(cat: CoverCategory, ratio: CoverRatio): string {
  const domain = (typeof PROJECT_DOMAIN !== 'undefined' && PROJECT_DOMAIN) || ''
  return `${domain}/api/share/cover?category=${cat}&ratio=${ratio}`
}

export interface SharePackageInput {
  id?: string
  name?: string | null
  price?: string | number | null
  original_price?: string | number | null
  category?: string | null
  cover_image?: string | null
}

export interface ShareContent {
  title: string
  imageUrl?: string
}

/**
 * 团购详情页分享内容：文案 = 名称 + 价格锚点；封面 = 商品头图 || 品类底图
 * 好友卡片与朋友圈共用文案，封面规格分开
 */
export function buildPackageShare(pkg: SharePackageInput, ratio: CoverRatio): ShareContent {
  const seedKey = pkg.id || pkg.name || 'pkg'
  const price = formatPriceSlang(pkg.price)
  const save = calcSave(pkg.price, pkg.original_price)
  const nameLen = price ? 8 : 12
  const name = clipName(pkg.name, nameLen)
  const title = renderTemplate('package', seedKey, { name, price, save })
  const cover = (pkg.cover_image || '').trim()
  const cat = mapCategoryToCover(pkg.category)
  return { title, imageUrl: cover || getBrandCoverUrl(cat, ratio) }
}

/** 好友助力分享内容：突出「帮我助力 + 奖品吸引力（种果树），不承诺必得」 */
export function buildAssistShare(displayName: string, seedKey: string, ratio: CoverRatio): ShareContent {
  const name = clipName(displayName, 6) || '好友'
  const title = renderTemplate('assist', seedKey, { name })
  return { title, imageUrl: getBrandCoverUrl('assist', ratio) }
}

/** 驿站页分享：驿站名 + 附近好店主推钩子；封面统一用玩乐品类底图（不依赖主包商品图） */
export function buildStationShare(stationName: string, featuredName?: string, ratio: CoverRatio = 'share'): ShareContent {
  const seedKey = stationName || 'station'
  const name = clipName(featuredName, 8)
  const title = renderTemplate('station', seedKey, { station: clipName(stationName, 8), name })
  return { title, imageUrl: getBrandCoverUrl('play', ratio) }
}

/** 商家详情页分享：商家名 + 抽霸王餐钩子；封面 = 店铺/团购头图优先，无图按品类底图 */
export function buildMerchantShare(merchantName: string | null | undefined, featured?: SharePackageInput | null, ratio: CoverRatio = 'share'): ShareContent {
  const seedKey = featured?.id || merchantName || 'merchant'
  const merchant = clipName(merchantName, 8)
  const title = renderTemplate('merchant', seedKey, { merchant })
  const cover = (featured?.cover_image || '').trim()
  const cat = mapCategoryToCover(featured?.category)
  return { title, imageUrl: cover || getBrandCoverUrl(cat, ratio) }
}

/** 中奖炫耀分享：只描述事实与喜悦；封面 = 奖品图优先，无图用 win 主题庆祝底图 */
export function buildWinShare(prizeName: string, prizeImage?: string | null, ratio: CoverRatio = 'share'): ShareContent {
  const prize = clipName(prizeName, 8) || '好东西'
  const title = renderTemplate('win', prize, { prize })
  const cover = (prizeImage || '').trim()
  return { title, imageUrl: cover || getBrandCoverUrl('win', ratio) }
}

/** 盲盒翻盒助力分享：{name} 发起人 + 权重+0.5 真实规则钩子 */
export function buildBoostShare(displayName: string, seedKey: string, ratio: CoverRatio = 'share'): ShareContent {
  const name = clipName(displayName, 6) || '好友'
  const title = renderTemplate('boost', seedKey, { name })
  return { title, imageUrl: getBrandCoverUrl('play', ratio) }
}

/** 首页/通用分享：品牌文案 + 主推团购钩子；有主推套餐时封面用其头图 */
export function buildBrandShare(featured?: SharePackageInput | null, ratio: CoverRatio = 'share'): ShareContent {
  const seedKey = (featured?.id || featured?.name || 'home')
  const name = clipName(featured?.name, 8)
  const title = renderTemplate('brand', seedKey, { name })
  const cover = (featured?.cover_image || '').trim()
  if (cover) return { title, imageUrl: cover }
  return { title, imageUrl: getBrandCoverUrl('play', ratio) }
}

/**
 * 分享行为轻量埋点（fire-and-forget，失败静默）
 * 复用 orchard_records 表：reason='share_card'、amount=0（纯记录不产生数值，避免影响任何统计）
 */
export function trackShare(scene: ShareScene, contentId?: string, extra?: { page?: string; template?: string }): void {
  const isMiniApp = [Taro.ENV_TYPE.WEAPP as string, Taro.ENV_TYPE.TT as string].includes(Taro.getEnv())
  if (!isMiniApp) return
  const userId = Number(Taro.getStorageSync('user_id')) || 0
  Network.request({
    url: '/api/share/track',
    method: 'POST',
    data: {
      scene,
      item_id: contentId || '',
      page: extra?.page || '',
      template: extra?.template || '',
      user_id: userId,
    },
  }).then((res) => {
    console.log('[ShareTrack]', scene, contentId || '-', '→', res.statusCode)
  }).catch(() => undefined)
}
