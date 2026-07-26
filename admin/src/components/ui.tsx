import { ReactNode, ButtonHTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { X, Loader2, Inbox } from 'lucide-react'

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

/* ---------------- Button ---------------- */
type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
}

const buttonVariants: Record<ButtonVariant, string> = {
  primary: 'bg-brand text-white hover:bg-brand-dark shadow-sm',
  secondary: 'bg-gray-800 text-white hover:bg-gray-700',
  outline: 'border border-gray-300 text-gray-700 hover:bg-gray-50 bg-white',
  danger: 'bg-red-50 text-brand border border-red-200 hover:bg-red-100',
  ghost: 'text-gray-600 hover:bg-gray-100',
}

const buttonSizes: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-9 px-4 text-sm',
  lg: 'h-11 px-6 text-sm',
}

export function Button({ variant = 'primary', size = 'md', loading, className, children, disabled, ...rest }: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
        buttonVariants[variant],
        buttonSizes[size],
        className
      )}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <Loader2 size={14} className="animate-spin" />}
      {children}
    </button>
  )
}

/* ---------------- Card ---------------- */
export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('bg-white rounded-xl border border-gray-200 shadow-sm', className)}>{children}</div>
}

export function CardHeader({ title, extra, className }: { title: ReactNode; extra?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-center justify-between px-5 py-4 border-b border-gray-100', className)}>
      <h3 className="text-base font-semibold text-gray-800">{title}</h3>
      {extra}
    </div>
  )
}

/* ---------------- Badge ---------------- */
type BadgeVariant = 'green' | 'red' | 'gray' | 'orange' | 'blue' | 'purple'
const badgeVariants: Record<BadgeVariant, string> = {
  green: 'bg-green-50 text-green-600 border-green-200',
  red: 'bg-red-50 text-brand border-red-200',
  gray: 'bg-gray-100 text-gray-500 border-gray-200',
  orange: 'bg-orange-50 text-orange-500 border-orange-200',
  blue: 'bg-blue-50 text-blue-600 border-blue-200',
  purple: 'bg-purple-50 text-purple-600 border-purple-200',
}

export function Badge({ variant = 'gray', children, className }: { variant?: BadgeVariant; children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium', badgeVariants[variant], className)}>
      {children}
    </span>
  )
}

/* ---------------- Modal ---------------- */
export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
  width = 'max-w-lg',
}: {
  open: boolean
  title: ReactNode
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  width?: string
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className={cn('relative bg-white rounded-2xl shadow-xl w-full max-h-[85vh] flex flex-col', width)}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-800">{title}</h3>
          <button className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="px-5 py-4 overflow-y-auto flex-1">{children}</div>
        {footer && <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">{footer}</div>}
      </div>
    </div>
  )
}

/* ---------------- 表单控件 ---------------- */
export function Field({ label, required, children, hint }: { label: ReactNode; required?: boolean; children: ReactNode; hint?: string }) {
  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        {label}
        {required && <span className="text-brand ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
    </div>
  )
}

const inputBase =
  'w-full h-9 rounded-lg border border-gray-300 px-3 text-sm text-gray-800 outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-red-100 placeholder:text-gray-400 bg-white'

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(inputBase, className)} {...rest} />
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn('w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-red-100 placeholder:text-gray-400 bg-white', className)}
      rows={3}
      {...rest}
    />
  )
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(inputBase, 'pr-8', className)} {...rest}>
      {children}
    </select>
  )
}

/* ---------------- 状态展示 ---------------- */
export function Loading({ text = '加载中…' }: { text?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-gray-400">
      <Loader2 size={18} className="animate-spin" />
      <span className="text-sm">{text}</span>
    </div>
  )
}

export function Empty({ text = '暂无数据', children }: { text?: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-gray-400">
      <Inbox size={40} strokeWidth={1.5} className="mb-3 text-gray-300" />
      <span className="text-sm">{text}</span>
      {children && <div className="mt-4">{children}</div>}
    </div>
  )
}

/* ---------------- 统计卡 ---------------- */
export function StatCard({ icon, label, value, tone = 'brand' }: { icon: ReactNode; label: string; value: ReactNode; tone?: 'brand' | 'gold' | 'green' | 'blue' | 'purple' | 'gray' }) {
  const tones: Record<string, string> = {
    brand: 'bg-brand-light text-brand',
    gold: 'bg-orange-50 text-gold',
    green: 'bg-green-50 text-green-500',
    blue: 'bg-blue-50 text-blue-500',
    purple: 'bg-purple-50 text-purple-500',
    gray: 'bg-gray-100 text-gray-500',
  }
  return (
    <Card className="p-5">
      <div className="flex items-center gap-4">
        <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center shrink-0', tones[tone])}>{icon}</div>
        <div className="min-w-0">
          <div className="text-2xl font-bold text-gray-800 leading-tight">{value}</div>
          <div className="text-xs text-gray-400 mt-0.5">{label}</div>
        </div>
      </div>
    </Card>
  )
}

/* ---------------- 确认弹窗 ---------------- */
export function ConfirmModal({
  open,
  title = '操作确认',
  message,
  confirmText = '确认',
  danger,
  loading,
  onConfirm,
  onClose,
}: {
  open: boolean
  title?: string
  message: ReactNode
  confirmText?: string
  danger?: boolean
  loading?: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      width="max-w-sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button variant={danger ? 'primary' : 'secondary'} loading={loading} onClick={onConfirm}>{confirmText}</Button>
        </>
      }
    >
      <p className="text-sm text-gray-600">{message}</p>
    </Modal>
  )
}

/* ---------------- 简易提示 ---------------- */
export function toast(message: string, type: 'success' | 'error' = 'success') {
  const el = document.createElement('div')
  el.textContent = message
  el.className = `fixed top-6 left-1/2 z-[999] -translate-x-1/2 rounded-lg px-4 py-2.5 text-sm text-white shadow-lg transition-opacity ${
    type === 'success' ? 'bg-gray-800' : 'bg-brand'
  }`
  document.body.appendChild(el)
  setTimeout(() => {
    el.style.opacity = '0'
    setTimeout(() => el.remove(), 300)
  }, 2200)
}
