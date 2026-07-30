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
