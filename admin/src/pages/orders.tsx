import { useCallback, useEffect, useState } from 'react'
import { ShoppingCart } from 'lucide-react'
import { api } from '@/lib/api'
import { Badge, Card, Empty, Loading, Select, toast } from '@/components/ui'

interface OrderItem {
  id: string
  order_no?: string
  user_id?: string
  user_name?: string
  nick_name?: string
  package_id?: string
  package_name?: string
  merchant_id?: number
  total_amount?: number | string
  quantity?: number
  status?: string
  verification_status?: string
  verification_code?: string
  verified_count?: number
  created_at?: string
  users?: { nick_name?: string } | null
  packages?: { name?: string } | null
}

interface MerchantOption {
  id: number
  name: string
}

const statusMap: Record<string, { label: string; variant: 'green' | 'blue' | 'gray' | 'red' | 'orange' }> = {
  pending: { label: '待核销', variant: 'blue' },
  completed: { label: '已完成', variant: 'green' },
  verified: { label: '已核销', variant: 'green' },
  refunded: { label: '已退款', variant: 'red' },
  cancelled: { label: '已取消', variant: 'gray' },
}

function money(v: unknown): string {
  const n = Number(v)
  return Number.isFinite(n) ? n.toFixed(2) : '0.00'
}

function fmtTime(v?: string): string {
  if (!v) return '—'
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return v
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function OrdersPage() {
  const [list, setList] = useState<OrderItem[]>([])
  const [merchants, setMerchants] = useState<MerchantOption[]>([])
  const [loading, setLoading] = useState(true)
  const [merchantId, setMerchantId] = useState('')
  const [status, setStatus] = useState('')

  const fetchList = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (merchantId) params.set('merchant_id', merchantId)
      const data = await api.get<OrderItem[]>(`/orders${params.size ? `?${params.toString()}` : ''}`)
      setList(Array.isArray(data) ? data : [])
    } catch (err: any) {
      toast(err?.message || '订单列表加载失败', 'error')
    } finally {
      setLoading(false)
    }
  }, [merchantId])

  useEffect(() => {
    fetchList()
  }, [fetchList])

  useEffect(() => {
    api.get<MerchantOption[]>('/merchants')
      .then((ms) => setMerchants(Array.isArray(ms) ? ms : []))
      .catch(() => undefined)
  }, [])

  const filtered = list.filter((o) => {
    if (!status) return true
    const s = o.status || o.verification_status || ''
    return s === status
  })

  const totalAmount = filtered.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0)

  const userName = (o: OrderItem) => o.user_name || o.nick_name || o.users?.nick_name || '匿名用户'
  const packageName = (o: OrderItem) => o.package_name || o.packages?.name || '—'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-sm text-gray-500">
          共 {filtered.length} 笔订单，合计 <span className="text-brand font-semibold">¥{totalAmount.toFixed(2)}</span>
        </p>
        <div className="flex gap-3">
          <Select value={merchantId} onChange={(e) => setMerchantId(e.target.value)} className="w-44">
            <option value="">全部商家</option>
            {merchants.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </Select>
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-32">
            <option value="">全部状态</option>
            <option value="pending">待核销</option>
            <option value="completed">已完成</option>
            <option value="refunded">已退款</option>
          </Select>
        </div>
      </div>

      <Card>
        {loading ? (
          <Loading />
        ) : filtered.length === 0 ? (
          <Empty text="暂无订单" icon={<ShoppingCart size={26} />} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs text-gray-400">
                  <th className="px-5 py-3 font-medium">订单号</th>
                  <th className="px-5 py-3 font-medium">用户</th>
                  <th className="px-5 py-3 font-medium">套餐</th>
                  <th className="px-5 py-3 font-medium">金额</th>
                  <th className="px-5 py-3 font-medium">份数</th>
                  <th className="px-5 py-3 font-medium">状态</th>
                  <th className="px-5 py-3 font-medium">核销码</th>
                  <th className="px-5 py-3 font-medium">下单时间</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((o) => {
                  const s = statusMap[o.status || ''] || statusMap[o.verification_status || ''] || { label: o.status || '未知', variant: 'gray' as const }
                  return (
                    <tr key={o.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="px-5 py-3 font-mono text-xs text-gray-600">{o.order_no || o.id.slice(0, 8)}</td>
                      <td className="px-5 py-3 text-gray-700">{userName(o)}</td>
                      <td className="px-5 py-3 text-gray-500 max-w-44 truncate">{packageName(o)}</td>
                      <td className="px-5 py-3 text-brand font-semibold">¥{money(o.total_amount)}</td>
                      <td className="px-5 py-3 text-gray-500">×{o.quantity ?? 1}</td>
                      <td className="px-5 py-3"><Badge variant={s.variant}>{s.label}</Badge></td>
                      <td className="px-5 py-3 font-mono text-xs text-gray-400">{o.verification_code || '—'}</td>
                      <td className="px-5 py-3 text-xs text-gray-400">{fmtTime(o.created_at)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
