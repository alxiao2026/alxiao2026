import Taro from '@tarojs/taro'
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 自定义导航（navigationStyle: custom）下的顶部安全高度。
 * 小程序端取胶囊按钮底部 + 8px 间距；H5 等非小程序端返回 fallback。
 * 渲染期同步调用，避免首帧布局跳动。
 */
export function getNavSafeAreaTop(fallback = 24): number {
  try {
    const env = Taro.getEnv()
    if (env === Taro.ENV_TYPE.WEAPP || env === Taro.ENV_TYPE.TT) {
      const menu = Taro.getMenuButtonBoundingClientRect?.()
      if (menu && menu.bottom) {
        return menu.bottom + 8
      }
      const info = Taro.getSystemInfoSync()
      return (info.statusBarHeight || 20) + 44
    }
  } catch (err) {
    console.warn('[utils] getNavSafeAreaTop 失败，使用默认值:', err)
  }
  return fallback
}

/** 价格格式化：整数直接显示整数（50 → "50"），有小数时保留一位（0.6 → "0.6"） */
export function formatPrice(price: string | number): string {
  const num = typeof price === 'number' ? price : parseFloat(String(price))
  if (Number.isNaN(num)) return String(price)
  return num % 1 === 0 ? String(num) : num.toFixed(1)
}

/** Haversine 公式：计算两个经纬度坐标（gcj02）之间的直线距离，单位米 */
export function calcDistanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const rad = (d: number) => (d * Math.PI) / 180
  const R = 6371000
  const dLat = rad(lat2 - lat1)
  const dLng = rad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

/** 距离文案格式化：<1km 显示 "距您约 XXm"，否则 "距您约 X.Xkm" */
export function formatDistanceText(meters: number): string {
  return meters < 1000 ? `距您约 ${Math.round(meters)}m` : `距您约 ${(meters / 1000).toFixed(1)}km`
}

/**
 * 日期时间格式化（跨端安全）：小程序端 toLocaleString(locale) 不可用会输出原始格式，
 * 这里手动拼接，输出 "YYYY-MM-DD HH:mm"。
 */
export function formatDateTime(value?: string | number | Date): string {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

/** 短日期时间格式化（跨端安全）：输出 "MM-DD HH:mm"，用于有效期等紧凑展示 */
export function formatShortDateTime(value?: string | number | Date): string {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}
