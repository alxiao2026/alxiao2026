import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Users, UserRound, Store, Package, Gift, Building2, ArrowRight, CalendarDays } from 'lucide-react'
import { api } from '@/lib/api'
import { getAdminUser } from '@/lib/auth'
import { Card, CardHeader, Input, Loading, StatCard, toast } from '@/components/ui'

interface OverviewStats {
  total_users: number
  consumers: number
  merchants: number
  packages_count: number
  prizes_count: number
  merchants_count: number
}

type RangeKey = 'all' | 'today' | 'week' | 'month' | 'custom'

function fmt(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function rangeOf(key: RangeKey): { start?: string; end?: string } {
  const now = new Date()
  if (key === 'today') return { start: fmt(now), end: fmt(now) }
  if (key === 'week') {
    const day = now.getDay() || 7
    const start = new Date(now)
    start.setDate(now.getDate() - day + 1)
    return { start: fmt(start), end: fmt(now) }
  }
  if (key === 'month') {
    return { start: fmt(new Date(now.getFullYear(), now.getMonth(), 1)), end: fmt(now) }
  }
  return {}
}

const rangeTabs: Array<{ key: RangeKey; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'today', label: '今日' },
  { key: 'week', label: '本周' },
  { key: 'month', label: '本月' },
  { key: 'custom', label: '自定义' },
]

const quickLinks = [
  { to: '/merchants', label: '新建商家', desc: '搭建商家门店与管理员账号' },
  { to: '/packages', label: '发布套餐', desc: '创建团购套餐并上架售卖' },
  { to: '/prizes', label: '配置奖品', desc: '设置抽奖奖品与中奖概率' },
  { to: '/orders', label: '订单核销', desc: '查询订单并执行线下核销' },
]

export default function DashboardPage() {
  const user = getAdminUser()
  const [stats, setStats] = useState<OverviewStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [range, setRange] = useState<RangeKey>('all')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

  const fetchStats = useCallback(async () => {
    if (!user?.user_id) return
    setLoading(true)
    try {
      const { start, end } = range === 'custom' ? { start: customStart, end: customEnd } : rangeOf(range)
      const qs = new URLSearchParams({ user_id: user.user_id })
      if (start) qs.set('start_date', start)
      if (end) qs.set('end_date', end)
      const data = await api.get<OverviewStats>(`/users/stats/overview?${qs.toString()}`)
      setStats(data)
    } catch (err: any) {
      toast(err?.message || '统计数据加载失败', 'error')
    } finally {
      setLoading(false)
    }
  }, [user?.user_id, range, customStart, customEnd])

  useEffect(() => {
    if (range === 'custom' && (!customStart || !customEnd)) return
    fetchStats()
  }, [fetchStats, range, customStart, customEnd])

  const cards = stats
    ? [
        { icon: <Users size={20} />, label: '注册用户', value: stats.total_users, tone: 'brand' as const },
        { icon: <UserRound size={20} />, label: '普通用户', value: stats.consumers, tone: 'blue' as const },
        { icon: <Store size={20} />, label: '商家用户', value: stats.merchants, tone: 'gold' as const },
        { icon: <Package size={20} />, label: '新建套餐', value: stats.packages_count, tone: 'purple' as const },
        { icon: <Gift size={20} />, label: '新建奖品', value: stats.prizes_count, tone: 'green' as const },
        { icon: <Building2 size={20} />, label: '新建门店', value: stats.merchants_count, tone: 'gray' as const },
      ]
    : []

  return (
    <div className="space-y-6">
      {/* 时间筛选 */}
      <Card className="px-5 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <CalendarDays size={16} className="text-gray-400" />
          <span className="text-sm text-gray-500 mr-2">统计周期</span>
          {rangeTabs.map((t) => (
            <button
              key={t.key}
              className={`h-8 rounded-lg px-3.5 text-sm transition-colors ${
                range === t.key ? 'bg-brand text-white font-medium' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              onClick={() => setRange(t.key)}
            >
              {t.label}
            </button>
          ))}
          {range === 'custom' && (
            <div className="flex items-center gap-2 ml-2">
              <Input type="date" className="w-40" value={customStart} max={customEnd} onChange={(e) => setCustomStart(e.target.value)} />
              <span className="text-gray-400 text-sm">至</span>
              <Input type="date" className="w-40" value={customEnd} min={customStart} onChange={(e) => setCustomEnd(e.target.value)} />
            </div>
          )}
        </div>
      </Card>

      {/* 统计卡片 */}
      {loading ? (
        <Loading text="统计数据加载中…" />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {cards.map((c) => (
            <StatCard key={c.label} icon={c.icon} label={c.label} value={c.value} tone={c.tone} />
          ))}
        </div>
      )}

      {/* 快捷入口 */}
      <Card>
        <CardHeader title="快捷操作" />
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 p-5">
          {quickLinks.map((q) => (
            <Link
              key={q.to}
              to={q.to}
              className="group rounded-xl border border-gray-200 p-4 hover:border-brand hover:shadow-md transition-all"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-800 group-hover:text-brand">{q.label}</span>
                <ArrowRight size={15} className="text-gray-300 group-hover:text-brand transition-colors" />
              </div>
              <p className="text-xs text-gray-400 mt-1.5">{q.desc}</p>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  )
}
