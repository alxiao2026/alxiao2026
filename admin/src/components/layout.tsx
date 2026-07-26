import { NavLink, Outlet, Navigate, useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Store,
  Package,
  Gift,
  ClipboardList,
  Trophy,
  Users,
  Settings,
  LogOut,
  PartyPopper,
} from 'lucide-react'
import { getAdminUser, setAdminUser } from '@/lib/auth'
import { cn } from '@/components/ui'

const menus = [
  { path: '/', label: '数据概览', icon: LayoutDashboard, end: true },
  { path: '/merchants', label: '商家管理', icon: Store },
  { path: '/packages', label: '套餐管理', icon: Package },
  { path: '/prizes', label: '奖品管理', icon: Gift },
  { path: '/orders', label: '订单管理', icon: ClipboardList },
  { path: '/lottery', label: '中奖记录', icon: Trophy },
  { path: '/users', label: '用户管理', icon: Users },
  { path: '/settings', label: '抽奖设置', icon: Settings },
]

const roleLabel: Record<string, string> = { admin: '系统管理员', merchant: '商家', consumer: '普通用户' }

export default function Layout() {
  const navigate = useNavigate()
  const location = useLocation()
  const user = getAdminUser()

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  const currentMenu = menus.find((m) => (m.end ? location.pathname === m.path : location.pathname.startsWith(m.path)))

  const handleLogout = () => {
    setAdminUser(null)
    navigate('/login', { replace: true })
  }

  return (
    <div className="h-full flex">
      {/* 侧边栏 */}
      <aside className="w-56 shrink-0 bg-white border-r border-gray-200 flex flex-col">
        <div className="flex items-center gap-2.5 px-5 h-16 border-b border-gray-100">
          <div className="w-9 h-9 rounded-xl bg-brand flex items-center justify-center text-white">
            <PartyPopper size={19} />
          </div>
          <div>
            <div className="text-sm font-bold text-gray-800">膨胀团</div>
            <div className="text-xs text-gray-400">管理后台</div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {menus.map((m) => (
            <NavLink
              key={m.path}
              to={m.path}
              end={m.end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-colors',
                  isActive ? 'bg-brand-light text-brand font-semibold' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'
                )
              }
            >
              <m.icon size={17} />
              {m.label}
            </NavLink>
          ))}
        </nav>
        <div className="px-4 py-4 border-t border-gray-100">
          <div className="text-sm font-medium text-gray-800 truncate">{user.nick_name || user.phone || user.user_id}</div>
          <div className="text-xs text-gray-400 mt-0.5">{roleLabel[user.role || ''] || user.role || '未知角色'}</div>
        </div>
      </aside>

      {/* 主区域 */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 shrink-0 bg-white border-b border-gray-200 flex items-center justify-between px-6">
          <h1 className="text-base font-semibold text-gray-800">{currentMenu?.label || '管理后台'}</h1>
          <button
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
            onClick={handleLogout}
          >
            <LogOut size={15} />
            退出登录
          </button>
        </header>
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
