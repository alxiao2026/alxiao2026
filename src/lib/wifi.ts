import Taro from '@tarojs/taro'

/**
 * 微信 WiFi 能力封装：初始化 / 获取当前连接 / 连接指定热点 / 扫码解析。
 * 仅微信小程序、抖音小程序可用；H5 端全部降级返回。
 */

export interface WifiInfo {
  SSID: string
  BSSID?: string
  secure?: boolean
  /** Android 返回 RSSI（负值 dBm）；iOS 部分场景无此字段 */
  signalStrength?: number
}

export function isWifiSupported(): boolean {
  const env = Taro.getEnv()
  return env === Taro.ENV_TYPE.WEAPP || env === Taro.ENV_TYPE.TT
}

let wifiReady = false

/** 初始化 WiFi 模块（幂等） */
export async function initWifi(): Promise<boolean> {
  if (!isWifiSupported()) return false
  if (wifiReady) return true
  try {
    await Taro.startWifi()
    wifiReady = true
    console.log('[WiFi] startWifi 初始化成功')
    return true
  } catch (e) {
    console.error('[WiFi] startWifi 初始化失败:', e)
    return false
  }
}

/** 获取手机当前已连接的 WiFi（Android 需定位权限；未连接时返回 null） */
export async function getConnected(): Promise<WifiInfo | null> {
  if (!(await initWifi())) return null
  try {
    const res = (await Taro.getConnectedWifi()) as any
    return (res?.wifi as WifiInfo) || null
  } catch (e: any) {
    // errMsg: getConnectedWifi:fail not connected 属正常情况
    console.log('[WiFi] getConnectedWifi:', e?.errMsg || e)
    return null
  }
}

/** 扫描附近 WiFi（仅 Android 支持；iOS 调用会失败，调用方需降级） */
export async function scanNearby(): Promise<WifiInfo[]> {
  if (!(await initWifi())) return []
  try {
    const res = await (Taro as any).scanWifi()
    const list: WifiInfo[] = res?.wifiList || []
    console.log('[WiFi] scanWifi 结果数量:', list.length)
    return list
  } catch (e) {
    console.log('[WiFi] scanWifi 不可用（iOS 或系统限制）:', e)
    return []
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * 连接指定 WiFi 并轮询确认真正连上（connectWifi 成功回调不代表已完成切换）。
 * 连接失败/超时都会抛错，由调用方提示。
 */
export async function connectAndVerify(ssid: string, password: string): Promise<WifiInfo> {
  if (!(await initWifi())) {
    throw new Error('当前环境不支持 WiFi 功能，请在微信小程序中打开')
  }
  console.log('[WiFi] 发起连接:', ssid)
  try {
    await Taro.connectWifi({
      SSID: ssid,
      password: password || '',
      // 无密码热点用 maunal 让系统直接连接
      maunal: !password,
      // 不传 suggestion：该参数会在连接后触发系统级「要保存此网络吗」确认弹窗
      // （Android 11+ WiFi Suggestion 机制的强制安全确认，App 无法隐藏）。
      // 按需求改为微信默认直连：无任何确认界面，连接瞬间完成。
      // 代价：连接为小程序进程级临时连接，退出小程序后系统回落原网络。
    } as any)
  } catch (e: any) {
    const msg = String(e?.errMsg || e?.message || '')
    console.error('[WiFi] connectWifi 失败:', msg)
    if (msg.includes('password') || msg.includes('pswd')) throw new Error('WiFi 密码错误，请核对后重试')
    if (msg.includes('location') || msg.includes('auth') || msg.includes('permission')) throw new Error('请开启手机定位与位置权限后重试')
    if (msg.includes('wifi') && msg.includes('off')) throw new Error('手机 WiFi 开关未打开，请先开启 WiFi')
    if (msg.includes('cancel') || msg.includes('deny')) throw new Error('已取消连接')
    throw new Error('连接失败，请靠近店内路由器后重试')
  }

  // 轮询确认真正连上目标 WiFi（最多约 9 秒）
  for (let i = 0; i < 18; i++) {
    await sleep(500)
    const cur = await getConnected()
    if (cur && cur.SSID === ssid) {
      console.log('[WiFi] 已确认连接:', cur.SSID, '信号:', cur.signalStrength)
      return cur
    }
  }
  throw new Error('连接超时，请靠近店内路由器后重试')
}

/** 解析 WiFi 分享二维码（WIFI:T:WPA;S:ssid;P:pwd;; 标准格式） */
export function parseWifiQr(text: string): { ssid: string; password: string } | null {
  if (!text || !/^WIFI:/i.test(text)) return null
  const body = text.replace(/^WIFI:/i, '').replace(/;;\s*$/, '')
  const fields: Record<string, string> = {}
  body.split(/(?<!\\);/).forEach((kv) => {
    const idx = kv.indexOf(':')
    if (idx > 0) {
      fields[kv.slice(0, idx).toUpperCase()] = kv.slice(idx + 1).replace(/\\([\\;,:"'])/g, '$1')
    }
  })
  const ssid = fields.S || ''
  if (!ssid) return null
  return { ssid, password: fields.P || '' }
}

/** 信号强度 → 1-4 格（兼容 RSSI 负值与 0-100 两种返回） */
export function signalLevel(strength?: number): 1 | 2 | 3 | 4 {
  if (strength === undefined || strength === null || Number.isNaN(strength)) return 3
  if (strength <= 0) {
    if (strength >= -50) return 4
    if (strength >= -65) return 3
    if (strength >= -78) return 2
    return 1
  }
  if (strength >= 80) return 4
  if (strength >= 60) return 3
  if (strength >= 40) return 2
  return 1
}

/** 信号强度文案 */
export function signalText(strength?: number): string {
  const lv = signalLevel(strength)
  return ['信号较弱', '信号一般', '信号良好', '信号极好'][lv - 1]
}
