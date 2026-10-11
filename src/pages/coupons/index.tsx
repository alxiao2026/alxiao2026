import { useCallback, useEffect, useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { Network } from '@/network'
import { ensureLogin } from '@/lib/silent-login'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDateTime } from '@/lib/utils'
import { Ticket } from 'lucide-react-taro'

interface DiscountCoupon {
  id: string
  code: string
  user_id: string
  merchant_id: number
  package_id: string | null
  title: string
  discount_rate: string
  discount_cap: string
  min_spend: string
  status: string
  source: string
  group_id: string | null
  used_order_id: string | null
  locked_at: string | null
  used_at: string | null
  expire_at: string | null
  created_at: string
  merchant_name?: string | null
}

type FilterKey = 'all' | 'unused' | 'used' | 'expired'

const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'unused', label: '可使用' },
  { key: 'used', label: '已使用' },
  { key: 'expired', label: '已过期' },
]

function statusMeta(status: string): { label: string; cls: string } {
  switch (status) {
    case 'unused':
      return { label: '可使用', cls: 'bg-emerald-50 text-emerald-600' }
    case 'locked':
      return { label: '使用中', cls: 'bg-amber-50 text-amber-600' }
    case 'used':
      return { label: '已使用', cls: 'bg-gray-100 text-gray-500' }
    default:
      return { label: '已过期', cls: 'bg-gray-100 text-gray-400' }
  }
}

export default function CouponsPage() {
  const [userId, setUserId] = useState('')
  const [list, setList] = useState<DiscountCoupon[]>([])
  const [filter, setFilter] = useState<FilterKey>('unused')
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    try {
      const res = await Network.request({ url: `/api/coupons/${userId}` })
      console.log('[Coupons] 优惠券列表响应:', res.data)
      const data = (res.data?.data || res.data) as DiscountCoupon[]
      if (Array.isArray(data)) setList(data)
    } catch (e) {
      console.error('[Coupons] 加载失败:', e)
    } finally {
      setLoading(false)
    }
  }, [userId])

  useDidShow(() => {
    if (!userId) {
      ensureLogin()
        .then((id) => setUserId(id))
        .catch((e) => {
          console.error('[Coupons] 静默登录失败:', e)
          Taro.showToast({ title: '登录失败，请稍后重试', icon: 'none' })
        })
      return
    }
    load()
  })

  useEffect(() => {
    if (userId) load()
  }, [userId, load])

  const filtered = list.filter((c) => {
    if (filter === 'all') return true
    if (filter === 'unused') return c.status === 'unused' || c.status === 'locked'
    if (filter === 'used') return c.status === 'used'
    return c.status === 'expired'
  })

  const goShopping = () => Taro.switchTab({ url: '/pages/index/index' })

  return (
    <View className="min-h-screen" style={{ backgroundColor: '#F9FAFB' }}>
      {/* 头部 */}
      <View
        className="px-4 pt-12 pb-6"
        style={{ background: 'linear-gradient(180deg, #FFE5EC 0%, #FFF1F2 60%, rgba(249,250,251,0) 100%)' }}
      >
        <Text className="block text-2xl font-black" style={{ color: '#1c1917' }}>我的优惠券</Text>
        <Text className="block text-xs mt-1" style={{ color: '#78716c' }}>组队抽奖折扣券 · 下单时自动抵扣</Text>
      </View>

      {/* 状态筛选 */}
      <View className="px-4">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterKey)}>
          <TabsList className="w-full">
            {FILTERS.map((f) => (
              <TabsTrigger key={f.key} value={f.key} className="flex-1">
                {f.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </View>

      {/* 券列表 */}
      <View className="px-4 mt-4 pb-8">
        {loading ? (
          <Text className="block text-center text-sm text-gray-400 py-16">加载中…</Text>
        ) : filtered.length === 0 ? (
          <View className="flex flex-col items-center py-16">
            <Ticket size={48} color="#D1D5DB" />
            <Text className="block text-sm text-gray-400 mt-3">暂无优惠券</Text>
            <Text className="block text-xs text-gray-300 mt-1">参与组队抽奖，有机会获得折扣券</Text>
            <Button className="mt-4" variant="secondary" size="sm" onClick={goShopping}>去逛逛</Button>
          </View>
        ) : (
          filtered.map((c) => <CouponCard key={c.id} coupon={c} />)
        )}
      </View>
    </View>
  )
}

function CouponCard({ coupon }: { coupon: DiscountCoupon }) {
  const meta = statusMeta(coupon.status)
  const disabled = coupon.status === 'used' || coupon.status === 'expired'
  const rate = coupon.discount_rate ? String(parseFloat(coupon.discount_rate)) : '0'
  const cap = parseFloat(coupon.discount_cap || '0')
  const min = parseFloat(coupon.min_spend || '0')
  return (
    <Card className="mb-3 overflow-hidden">
      <CardContent className="p-0">
        <View className="flex flex-row items-stretch">
          <View
            className="w-24 shrink-0 flex flex-col items-center justify-center py-4"
            style={{
              background: disabled
                ? 'linear-gradient(135deg,#cbd5e1,#94a3b8)'
                : 'linear-gradient(135deg,#FF4757,#FB7185)',
            }}
          >
            <Text className="block text-3xl font-black text-white">{rate}<Text className="text-base">折</Text></Text>
            <Text className="block text-xs mt-1" style={{ color: 'rgba(255,255,255,0.9)' }}>
              {cap > 0 ? `最高减¥${cap}` : '折扣券'}
            </Text>
          </View>
          <View className="flex-1 p-4">
            <View className="flex flex-row items-center">
              <Text className="block text-base font-bold text-gray-800">{coupon.title}</Text>
              <Badge variant="outline" className={`ml-2 ${meta.cls}`}>{meta.label}</Badge>
            </View>
            {coupon.merchant_name ? (
              <Text className="block text-xs text-gray-500 mt-1">{coupon.merchant_name}</Text>
            ) : null}
            <Text className="block text-xs text-gray-400 mt-1">
              {min > 0 ? `满${min}元可用` : '无门槛'} · 券码 {coupon.code}
            </Text>
            <Text className="block text-xs text-gray-400 mt-1">
              {coupon.expire_at ? `有效期至 ${formatDateTime(coupon.expire_at)}` : '长期有效'}
            </Text>
          </View>
        </View>
      </CardContent>
    </Card>
  )
}