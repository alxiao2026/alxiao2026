import { useCallback, useEffect, useState } from 'react'
import { Gift } from 'lucide-react'
import { api } from '@/lib/api'
import { Badge, Card, Empty, Loading, Select, toast } from '@/components/ui'

interface WinnerRecord {
  id: string
  user_id?: string
  nick_name?: string
  user_name?: string
  users?: { nick_name?: string } | null
  prize_id?: string
  prize_name?: string
  prizes?: { name?: string; prize_type?: string } | null
  prize_type?: string
  redemption_code?: string
  refund_status?: string
  is_winner?: boolean
  redeemed_at?: string | null
  created_at?: string
}

const typeLabels: Record<string, string> = {
  product: '实物奖品',
  coupon: '优惠券',
  free_meal: '霸王餐',
}

function fmtTime(v?: string | null): string {
  if (!v) return '—'
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return v
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function LotteryPage() {
  const [list, setList] = useState<WinnerRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')

  const fetchList = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.get<WinnerRecord[]>('/lottery/winners')
      setList(Array.isArray(data) ? data : [])
    } catch (err: any) {
      toast(err?.message || '中奖记录加载失败', 'error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchList()
  }, [fetchList])

  const filtered = list.filter((r) => {
    if (!status) return true
    if (status === 'redeemed') return r.refund_status === 'redeemed' || !!r.redeemed_at
    return (r.refund_status || 'pending') === status
  })

  const redeemedCount = list.filter((r) => r.refund_status === 'redeemed' || !!r.redeemed_at).length

  const userName = (r: WinnerRecord) => r.nick_name || r.user_name || r.users?.nick_name || '匿名用户'
  const prizeName = (r: WinnerRecord) => r.prize_name || r.prizes?.name || '—'
  const prizeType = (r: WinnerRecord) => r.prize_type || r.prizes?.prize_type || ''

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-sm text-gray-500">
          共 {list.length} 条中奖记录，已核销 <span className="text-green-600 font-semibold">{redeemedCount}</span> 条
        </p>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-36">
          <option value="">全部状态</option>
          <option value="pending">待核销</option>
          <option value="redeemed">已核销</option>
        </Select>
      </div>

      <Card>
        {loading ? (
          <Loading />
        ) : filtered.length === 0 ? (
          <Empty text="暂无中奖记录" icon={<Gift size={26} />} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs text-gray-400">
                  <th className="px-5 py-3 font-medium">用户</th>
                  <th className="px-5 py-3 font-medium">奖品</th>
                  <th className="px-5 py-3 font-medium">类型</th>
                  <th className="px-5 py-3 font-medium">兑换码</th>
                  <th className="px-5 py-3 font-medium">状态</th>
                  <th className="px-5 py-3 font-medium">中奖时间</th>
                  <th className="px-5 py-3 font-medium">核销时间</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const redeemed = r.refund_status === 'redeemed' || !!r.redeemed_at
                  return (
                    <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="px-5 py-3 text-gray-700">{userName(r)}</td>
                      <td className="px-5 py-3 font-medium text-gray-800">{prizeName(r)}</td>
                      <td className="px-5 py-3 text-gray-500">{typeLabels[prizeType(r)] || '—'}</td>
                      <td className="px-5 py-3 font-mono text-xs text-gray-500">{r.redemption_code || '—'}</td>
                      <td className="px-5 py-3">
                        <Badge variant={redeemed ? 'green' : 'orange'}>{redeemed ? '已核销' : '待核销'}</Badge>
                      </td>
                      <td className="px-5 py-3 text-xs text-gray-400">{fmtTime(r.created_at)}</td>
                      <td className="px-5 py-3 text-xs text-gray-400">{redeemed ? fmtTime(r.redeemed_at) : '—'}</td>
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
