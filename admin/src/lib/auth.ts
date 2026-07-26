/** 管理后台登录态管理（localStorage 持久化） */
export interface AdminUser {
  user_id: string
  nick_name?: string
  phone?: string
  role?: string
  role_code?: number
  merchant_id?: number | null
  avatar_url?: string | null
}

const STORAGE_KEY = 'pc_admin_user'

export function getAdminUser(): AdminUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as AdminUser) : null
  } catch {
    return null
  }
}

export function setAdminUser(user: AdminUser | null) {
  if (user) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
  } else {
    localStorage.removeItem(STORAGE_KEY)
  }
}

/** 是否系统管理员（role_code: 2） */
export function isSystemAdmin(user: AdminUser | null): boolean {
  return !!user && (user.role_code === 2 || user.role === 'admin')
}
