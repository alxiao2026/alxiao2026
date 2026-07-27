import { useRef, useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { View, Text, Picker } from '@tarojs/components'
import { Network } from '@/network'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Store, UserCheck, ChevronDown, Calendar, ClipboardList, Search, X } from 'lucide-react-taro'
import { formatPrice } from '@/lib/utils'

interface OrderItem {
  id: string
  order_no: string
  package_name: string
  merchant_name?: string | null
  nick_name?: string | null
  buyer_phone?: string | null
  price: string
  quantity: number
  status: string
  verification_code?: string | null
  verified_count?: number
  verified_at?: string | null
  verified_by?: string | null
  verifier_name?: string | null
  created_at: string
}

interface MerchantOption {
  id: number
  name: string
}

interface VerifierOption {
  user_id: string
  name: string
  phone?: string | null
}

type TimeRange = 'all' | 'today' | 'yesterday' | '7d' | '30d' | 'custom'

const TIME_OPTIONS: { key: TimeRange; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'today', label: '今日' },
  { key: 'yesterday', label: '昨日' },
  { key: '7d', label: '近7天' },
  { key: '30d', label: '近30天' },
  { key: 'custom', label: '自定义' },
]

const pad = (n: number) => String(n).padStart(2, '0')

const toDateStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

const formatTime = (iso?: string | null) => {
  if (!iso) return '-'
  const d = new Date(iso)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function AdminOrders() {
  const [authorized, setAuthorized] = useState<boolean | null>(null)
  const [orders, setOrders] = useState<OrderItem[]>([])
  const [merchants, setMerchants] = useState<MerchantOption[]>([])
  const [verifiers, setVerifiers] = useState<VerifierOption[]>([])
  const [loading, setLoading] = useState(false)

  const [timeRange, setTimeRange] = useState<TimeRange>('all')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [merchantIndex, setMerchantIndex] = useState(0) // 0 = 全部门店
  const [verifierIndex, setVerifierIndex] = useState(0) // 0 = 全部账号
  const [searchInput, setSearchInput] = useState('') // 搜索框受控值
  const [keyword, setKeyword] = useState('') // 实际生效的搜索关键词
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useDidShow(() => {
    void initPage()
  })

  const initPage = async () => {
    const userId =
      Taro.getStorageSync('user_id') ||
      Taro.getStorageSync('userInfo')?.user_id ||
      ''
    if (!userId) {
      Taro.showToast({ title: '请先登录', icon: 'none' })
      setAuthorized(false)
      return
    }
    try {
      const res = await Network.request({
        url: `/api/users/${encodeURIComponent(userId)}/permissions`,
      })
      const body: any = res.data
      const roleCode = body?.data?.role_code ?? body?.role_code ?? body?.data?.roleCode ?? body?.roleCode
      if (roleCode !== 2) {
        Taro.showToast({ title: '仅超级管理员可查看', icon: 'none' })
        setAuthorized(false)
        return
      }
      setAuthorized(true)
      void fetchMerchants()
      void fetchVerifiers()
      void fetchOrders()
    } catch (e) {
      console.error('[AdminOrders] 权限校验失败', e)
      Taro.showToast({ title: '权限校验失败', icon: 'none' })
      setAuthorized(false)
    }
  }

  const fetchMerchants = async () => {
    try {
      const res = await Network.request({ url: '/api/merchants' })
      console.log('[AdminOrders] 门店列表响应:', res.data)
      const body: any = res.data
      const list = Array.isArray(body) ? body : (body?.data ?? [])
      setMerchants(
        (list || []).map((m: any) => ({ id: Number(m.id), name: m.name || `门店${m.id}` })),
      )
    } catch (e) {
      console.error('[AdminOrders] 门店列表加载失败', e)
    }
  }

  const fetchVerifiers = async (merchantIdx?: number) => {
    const mi = merchantIdx ?? merchantIndex
    try {
      // 选中具体门店时，只拉取该门店的核销账号，避免混入其他门店
      const query = mi > 0 && merchants[mi - 1] ? `?merchant_id=${merchants[mi - 1].id}` : ''
      const res = await Network.request({ url: `/api/orders/verifiers${query}` })
      console.log('[AdminOrders] 核销账号响应:', res.data)
      const body: any = res.data
      const list = Array.isArray(body) ? body : (body?.data ?? [])
      setVerifiers(list || [])
    } catch (e) {
      console.error('[AdminOrders] 核销账号加载失败', e)
    }
  }

  const resolveDateRange = (): { start?: string; end?: string } => {
    const today = new Date()
    if (timeRange === 'today') {
      return { start: toDateStr(today), end: toDateStr(today) }
    }
    if (timeRange === 'yesterday') {
      const y = new Date(today)
      y.setDate(y.getDate() - 1)
      return { start: toDateStr(y), end: toDateStr(y) }
    }
    if (timeRange === '7d') {
      const s = new Date(today)
      s.setDate(s.getDate() - 6)
      return { start: toDateStr(s), end: toDateStr(today) }
    }
    if (timeRange === '30d') {
      const s = new Date(today)
      s.setDate(s.getDate() - 29)
      return { start: toDateStr(s), end: toDateStr(today) }
    }
    if (timeRange === 'custom') {
      return {
        start: customStart || undefined,
        end: customEnd || undefined,
      }
    }
    return {}
  }

  const fetchOrders = async (override?: {
    timeRange?: TimeRange
    merchantIndex?: number
    verifierIndex?: number
    customStart?: string
    customEnd?: string
    keyword?: string
  }) => {
    const tr = override?.timeRange ?? timeRange
    const mi = override?.merchantIndex ?? merchantIndex
    const vi = override?.verifierIndex ?? verifierIndex
    const cs = override?.customStart ?? customStart
    const ce = override?.customEnd ?? customEnd
    const kw = override?.keyword ?? keyword

    const today = new Date()
    let start: string | undefined
    let end: string | undefined
    if (tr === 'today') {
      start = toDateStr(today)
      end = start
    } else if (tr === 'yesterday') {
      const y = new Date(today)
      y.setDate(y.getDate() - 1)
      start = toDateStr(y)
      end = start
    } else if (tr === '7d') {
      const s = new Date(today)
      s.setDate(s.getDate() - 6)
      start = toDateStr(s)
      end = toDateStr(today)
    } else if (tr === '30d') {
      const s = new Date(today)
      s.setDate(s.getDate() - 29)
      start = toDateStr(s)
      end = toDateStr(today)
    } else if (tr === 'custom') {
      start = cs || undefined
      end = ce || undefined
    }

    const params: string[] = []
    if (mi > 0 && merchants[mi - 1]) params.push(`merchant_id=${merchants[mi - 1].id}`)
    if (vi > 0 && verifiers[vi - 1]) params.push(`verified_by=${encodeURIComponent(verifiers[vi - 1].user_id)}`)
    if (start) params.push(`start_date=${start}`)
    if (end) params.push(`end_date=${end}`)
    if (kw.trim()) params.push(`keyword=${encodeURIComponent(kw.trim())}`)
    const query = params.length ? `?${params.join('&')}` : ''

    setLoading(true)
    try {
      console.log('[AdminOrders] 请求订单:', `/api/orders${query}`)
      const res = await Network.request({ url: `/api/orders${query}` })
      console.log('[AdminOrders] 订单响应:', res.data)
      const body: any = res.data
      const list = Array.isArray(body) ? body : (body?.data ?? [])
      setOrders(list || [])
    } catch (e) {
      console.error('[AdminOrders] 订单加载失败', e)
      Taro.showToast({ title: '订单加载失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  const handleTimeChange = (key: TimeRange) => {
    setTimeRange(key)
    if (key !== 'custom') {
      void fetchOrders({ timeRange: key })
    }
  }

  // 搜索输入防抖：500ms 后生效并重新查询
  const handleSearchChange = (value: string) => {
    setSearchInput(value)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => {
      setKeyword(value)
      void fetchOrders({ keyword: value })
    }, 500)
  }

  const clearSearch = () => {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    setSearchInput('')
    setKeyword('')
    void fetchOrders({ keyword: '' })
  }

  const getStatusBadge = (status: string): { text: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' } => {
    switch (status) {
      case 'pending':
      case 'paid':
        return { text: '待核销', variant: 'secondary' }
      case 'used':
      case 'completed':
        return { text: '已核销', variant: 'default' }
      case 'refunded':
        return { text: '已退款', variant: 'destructive' }
      case 'expired':
        return { text: '已过期', variant: 'outline' }
      default:
        return { text: status || '未知', variant: 'outline' }
    }
  }

  if (authorized === false) {
    return (
      <View className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-8">
        <ClipboardList size={40} color="#d1d5db" />
        <Text className="block text-sm text-gray-400 mt-4 text-center">仅超级管理员可查看平台订单明细</Text>
        <Button variant="outline" className="mt-6" onClick={() => Taro.navigateBack()}>
          <Text className="text-sm">返回</Text>
        </Button>
      </View>
    )
  }

  const merchantNames = ['全部门店', ...merchants.map((m) => m.name)]
  const verifierNames = ['全部核销账号', ...verifiers.map((v) => v.name)]
  const dateRange = resolveDateRange()

  return (
    <View className="min-h-screen bg-gray-50 pb-8">
      {/* 筛选区 */}
      <View className="bg-white px-4 pt-3 pb-4 shadow-sm">
        {/* 搜索栏：订单号/店名/套餐名/核销人/买家手机号 */}
        <View className="bg-gray-50 rounded-lg px-3 py-2 flex flex-row items-center gap-2 mb-3">
          <Search size={15} color="#9ca3af" />
          <View className="flex-1">
            <Input
              className="w-full bg-transparent text-sm"
              placeholder="搜索订单号 / 店名 / 核销人 / 手机号"
              value={searchInput}
              onInput={(e) => handleSearchChange(String(e.detail.value))}
            />
          </View>
          {searchInput.length > 0 && (
            <View onClick={clearSearch}>
              <X size={15} color="#9ca3af" />
            </View>
          )}
        </View>

        {/* 时间段快捷选择 */}
        <View className="flex flex-row flex-wrap gap-2">
          {TIME_OPTIONS.map((t) => (
            <View
              key={t.key}
              className={`rounded-lg px-3 py-2 ${timeRange === t.key ? 'bg-[#FF4757]' : 'bg-gray-100'}`}
              onClick={() => handleTimeChange(t.key)}
            >
              <Text className={`text-xs ${timeRange === t.key ? 'text-white' : 'text-gray-600'}`}>{t.label}</Text>
            </View>
          ))}
        </View>

        {/* 自定义日期 */}
        {timeRange === 'custom' && (
          <View className="flex flex-row items-center gap-2 mt-3">
            <Picker
              mode="date"
              value={customStart || toDateStr(new Date())}
              onChange={(e) => {
                const v = String(e.detail.value)
                setCustomStart(v)
                void fetchOrders({ customStart: v })
              }}
            >
              <View className="flex-1 bg-gray-50 rounded-lg px-3 py-2 flex flex-row items-center justify-between">
                <Text className="text-sm text-gray-700">{customStart || '开始日期'}</Text>
                <Calendar size={14} color="#9ca3af" />
              </View>
            </Picker>
            <Text className="text-xs text-gray-400">至</Text>
            <Picker
              mode="date"
              value={customEnd || toDateStr(new Date())}
              onChange={(e) => {
                const v = String(e.detail.value)
                setCustomEnd(v)
                void fetchOrders({ customEnd: v })
              }}
            >
              <View className="flex-1 bg-gray-50 rounded-lg px-3 py-2 flex flex-row items-center justify-between">
                <Text className="text-sm text-gray-700">{customEnd || '结束日期'}</Text>
                <Calendar size={14} color="#9ca3af" />
              </View>
            </Picker>
          </View>
        )}

        {/* 门店 + 核销账号 */}
        <View className="flex flex-row gap-2 mt-3">
          <Picker
            mode="selector"
            range={merchantNames}
            value={merchantIndex}
            onChange={(e) => {
              const idx = Number(e.detail.value)
              setMerchantIndex(idx)
              // 门店变化后核销账号列表联动刷新，且重置为"全部核销账号"
              setVerifierIndex(0)
              void fetchVerifiers(idx)
              void fetchOrders({ merchantIndex: idx, verifierIndex: 0 })
            }}
          >
            <View className="flex-1 bg-gray-50 rounded-lg px-3 py-2 flex flex-row items-center gap-2">
              <Store size={14} color="#9ca3af" />
              <Text className="flex-1 text-sm text-gray-700 truncate">{merchantNames[merchantIndex] || '全部门店'}</Text>
              <ChevronDown size={14} color="#9ca3af" />
            </View>
          </Picker>
          <Picker
            mode="selector"
            range={verifierNames}
            value={verifierIndex}
            onChange={(e) => {
              const idx = Number(e.detail.value)
              setVerifierIndex(idx)
              void fetchOrders({ verifierIndex: idx })
            }}
          >
            <View className="flex-1 bg-gray-50 rounded-lg px-3 py-2 flex flex-row items-center gap-2">
              <UserCheck size={14} color="#9ca3af" />
              <Text className="flex-1 text-sm text-gray-700 truncate">{verifierNames[verifierIndex] || '全部核销账号'}</Text>
              <ChevronDown size={14} color="#9ca3af" />
            </View>
          </Picker>
        </View>

        {/* 当前条件摘要 */}
        <Text className="block text-xs text-gray-400 mt-3">
          {merchantNames[merchantIndex]}
          {verifierIndex > 0 ? ` · ${verifierNames[verifierIndex]}` : ''}
          {dateRange.start ? ` · ${dateRange.start} ~ ${dateRange.end || dateRange.start}` : ' · 全部时间'}
          {keyword.trim() ? ` · 搜索"${keyword.trim()}"` : ''}
          {` · 共${orders.length}单`}
        </Text>
      </View>

      {/* 订单列表 */}
      <View className="px-4 mt-3">
        {loading ? (
          <View className="flex flex-col items-center justify-center py-12">
            <Text className="block text-sm text-gray-400">加载中...</Text>
          </View>
        ) : orders.length === 0 ? (
          <View className="flex flex-col items-center justify-center py-12">
            <ClipboardList size={36} color="#d1d5db" />
            <Text className="block text-sm text-gray-400 mt-3">当前条件下暂无订单</Text>
          </View>
        ) : (
          orders.map((order) => {
            const badge = getStatusBadge(order.status)
            return (
              <Card key={order.id} className="mb-3">
                <CardContent className="p-4">
                  <View className="flex flex-row items-center justify-between mb-2">
                    <Text className="block text-xs text-gray-400">{formatTime(order.created_at)}</Text>
                    <Badge variant={badge.variant}>{badge.text}</Badge>
                  </View>
                  <Text className="block text-base font-semibold text-gray-800">{order.package_name}</Text>
                  <Text className="block text-xs text-gray-500 mt-1">
                    {order.merchant_name || '未知门店'} · {order.nick_name || '匿名用户'}
                    {order.buyer_phone ? ` · ${order.buyer_phone}` : ''}
                  </Text>
                  <View className="flex flex-row items-center justify-between mt-2">
                    <Text className="block text-xs text-gray-400">订单号 {order.order_no}</Text>
                    <Text className="block text-base font-bold text-gray-800">
                      ¥{formatPrice(order.price)} × {order.quantity || 1}
                    </Text>
                  </View>
                  {(order.verified_count || 0) > 0 && (
                    <View className="mt-2 bg-gray-50 rounded-lg px-3 py-2">
                      <Text className="block text-xs text-gray-600">
                        已核销 {order.verified_count}/{order.quantity || 1} 份
                        {order.verified_at ? ` · ${formatTime(order.verified_at)}` : ''}
                      </Text>
                      <Text className="block text-xs text-gray-500 mt-1">
                        核销账号：{order.verifier_name || order.verified_by || '未知（历史订单未记录）'}
                      </Text>
                    </View>
                  )}
                </CardContent>
              </Card>
            )
          })
        )}
      </View>
    </View>
  )
}
