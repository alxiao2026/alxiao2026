import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** 价格格式化：整数直接显示整数（50 → "50"），有小数时保留一位（0.6 → "0.6"） */
export function formatPrice(price: string | number): string {
  const num = typeof price === 'number' ? price : parseFloat(String(price))
  if (Number.isNaN(num)) return String(price)
  return num % 1 === 0 ? String(num) : num.toFixed(1)
}
