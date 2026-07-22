import { useState, useEffect } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Image } from '@tarojs/components'
import { Network } from '@/network'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Trophy, Package, Clock, Gift } from 'lucide-react-taro'

interface LotteryRecord {
  id: string
  user_id: string
  order_id: string
  prize_id: string
  prize_name: string
  prize_type: string
  coupon_amount?: number
  coupon_condition?: number
  product_name?: string
  product_value?: number
  redemption_code?: string
  refund_amount?: number
  created_at: string
}

interface Order {
  id: string
  package_id: string
  user_id: string
  user_name: string
  user_phone: string
  quantity: number
  total_amount: number
  status: string
  shop_name: string
  package_name?: string
  package_cover?: string
  created_at: string
}

export default function LotteryRecordsPage() {
  const [activeTab, setActiveTab] = useState('records')
  const [records, setRecords] = useState<LotteryRecord[]>([])
  const [unparticipated, setUnparticipated] = useState<Order[]>([])
  const [loading, setLoading] = useState(false)
  const [userId, setUserId] = useState('')

  useEffect(() => {
    const info = Taro.getStorageSync('userInfo')
    const uid = info?.id || info?.userId || ''
    setUserId(uid)
    if (uid) {
      loadRecords(uid)
      loadUnparticipated(uid)
    }
  }, [])

  const loadRecords = async (uid: string) => {
    setLoading(true)
    try {
      const res = await Network.request({
        url: `/api/lottery/user/${uid}`,
      })
      console.log('中奖记录:', res.data)
      const envelope = res.data as any
      setRecords(Array.isArray(envelope?.data) ? envelope.data : [])
    } catch (err) {
      console.error('加载中奖记录失败:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadUnparticipated = async (uid: string) => {
    try {
      const res = await Network.request({
        url: `/api/orders/user/${uid}/unparticipated`,
      })
      console.log('未参与抽奖订单:', res.data)
      const envelope = res.data as any
      setUnparticipated(Array.isArray(envelope?.data) ? envelope.data : [])
    } catch (err) {
      console.error('加载未参与抽奖订单失败:', err)
    }
  }

  const getPrizeTypeLabel = (type: string) => {
    const map: Record<string, string> = {
      coupon: '优惠券',
      product: '商品',
      free_meal: '霸王餐',
    }
    return map[type] || type
  }

  const getPrizeTypeColor = (type: string) => {
    const map: Record<string, string> = {
      coupon: 'bg-blue-100 text-blue-700',
      product: 'bg-purple-100 text-purple-700',
      free_meal: 'bg-green-100 text-green-700',
    }
    return map[type] || 'bg-gray-100 text-gray-700'
  }

  const getStatusBadge = (status: string) => {
    const map: Record<string, { label: string; className: string }> = {
      pending: { label: '待使用', className: 'bg-yellow-100 text-yellow-700' },
      used: { label: '已使用', className: 'bg-green-100 text-green-700' },
      expired: { label: '已过期', className: 'bg-red-100 text-red-700' },
      refunded: { label: '已退款', className: 'bg-gray-100 text-gray-700' },
    }
    return map[status] || { label: status, className: 'bg-gray-100 text-gray-700' }
  }

  const handleParticipate = async (order: Order) => {
    if (!userId) return
    const res = await Taro.showModal({
      title: '参与抽奖',
      content: `确定使用订单「${order.package_name || order.shop_name}」参与抽奖吗？`,
    })
    if (!res.confirm) return

    Taro.showLoading({ title: '抽奖中...' })
    try {
      const drawRes = await Network.request({
        url: '/api/lottery/draw',
        method: 'POST',
        data: { user_id: userId, order_id: order.id },
      })
      Taro.hideLoading()
      console.log('抽奖结果:', drawRes.data)
      const envelope = drawRes.data as any
      if (envelope?.code === 200 && envelope?.data) {
        const result = envelope.data
        if (result.won) {
          Taro.showModal({
            title: '🎉 恭喜中奖！',
            content: `奖品：${result.prize_name}\n${result.prize_type === 'coupon' ? `优惠券金额：¥${result.coupon_amount}` : result.prize_type === 'product' ? `商品：${result.product_name}` : `返现：¥${result.refund_amount}`}`,
            showCancel: false,
          })
        } else {
          Taro.showToast({ title: result.message || '很遗憾，未中奖', icon: 'none' })
        }
        // 刷新数据
        loadRecords(userId)
        loadUnparticipated(userId)
      } else {
        Taro.showToast({ title: envelope?.msg || '抽奖失败', icon: 'none' })
      }
    } catch (err) {
      Taro.hideLoading()
      console.error('抽奖失败:', err)
      Taro.showToast({ title: '抽奖失败，请重试', icon: 'none' })
    }
  }

  return (
    <View className="min-h-screen bg-gray-50">
      {/* Header */}
      <View className="bg-red-500 px-4 pt-12 pb-6">
        <View className="flex items-center justify-between">
          <View onClick={() => Taro.navigateBack()} className="p-2 -ml-2">
            <Text className="text-white text-lg">{'<'}</Text>
          </View>
          <Text className="text-white text-lg font-semibold">中奖记录</Text>
          <View className="w-8" />
        </View>
      </View>

      {/* Tabs */}
      <View className="bg-white px-4 pt-4">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v)}>
          <TabsList className="w-full bg-gray-100 rounded-xl p-1">
            <TabsTrigger value="records" className="flex-1 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <Text className="block text-sm">中奖记录 ({records.length})</Text>
            </TabsTrigger>
            <TabsTrigger value="unparticipated" className="flex-1 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <Text className="block text-sm">未参与 ({unparticipated.length})</Text>
            </TabsTrigger>
          </TabsList>

          {/* 中奖记录 */}
          <TabsContent value="records" className="mt-4">
            {loading ? (
              <View className="flex items-center justify-center py-12">
                <Text className="text-gray-400 text-sm">加载中...</Text>
              </View>
            ) : records.length === 0 ? (
              <View className="flex flex-col items-center justify-center py-16">
                <Trophy size={48} color="#d1d5db" />
                <Text className="block text-gray-400 text-sm mt-4">暂无中奖记录</Text>
                <Text className="block text-gray-300 text-xs mt-2">参与抽奖后中奖记录将显示在这里</Text>
              </View>
            ) : (
              <View className="space-y-3 pb-4">
                {records.map((record) => {
                  const statusBadge = getStatusBadge(record.prize_type === 'coupon' ? 'pending' : 'used')
                  return (
                    <Card key={record.id} className="bg-white rounded-xl border-0 shadow-sm">
                      <CardContent className="p-4">
                        <View className="flex items-start justify-between">
                          <View className="flex-1">
                            <View className="flex items-center gap-2 mb-2">
                              <Text className="text-base font-semibold text-gray-900">{record.prize_name}</Text>
                              <Badge className={`${getPrizeTypeColor(record.prize_type)} text-xs`}>
                                <Text>{getPrizeTypeLabel(record.prize_type)}</Text>
                              </Badge>
                            </View>
                            {record.prize_type === 'coupon' && record.coupon_amount && (
                              <Text className="block text-sm text-red-500 font-medium">
                                优惠金额：¥{record.coupon_amount}
                                {record.coupon_condition ? `（满¥${record.coupon_condition}可用）` : ''}
                              </Text>
                            )}
                            {record.prize_type === 'product' && record.product_name && (
                              <View>
                                <Text className="block text-sm text-gray-600">商品：{record.product_name}</Text>
                                {record.product_value && (
                                  <Text className="block text-sm text-gray-500">价值：¥{record.product_value}</Text>
                                )}
                                {record.redemption_code && (
                                  <Text className="block text-sm text-blue-500 font-mono mt-1">兑换码：{record.redemption_code}</Text>
                                )}
                              </View>
                            )}
                            {record.prize_type === 'free_meal' && record.refund_amount && (
                              <Text className="block text-sm text-green-500 font-medium">返现金额：¥{record.refund_amount}</Text>
                            )}
                            <View className="flex items-center gap-1 mt-2">
                              <Clock size={12} color="#9ca3af" />
                              <Text className="text-xs text-gray-400">{new Date(record.created_at).toLocaleString('zh-CN')}</Text>
                            </View>
                          </View>
                          <Badge className={statusBadge.className}>
                            <Text className="text-xs">{statusBadge.label}</Text>
                          </Badge>
                        </View>
                      </CardContent>
                    </Card>
                  )
                })}
              </View>
            )}
          </TabsContent>

          {/* 未参与抽奖 */}
          <TabsContent value="unparticipated" className="mt-4">
            {unparticipated.length === 0 ? (
              <View className="flex flex-col items-center justify-center py-16">
                <Package size={48} color="#d1d5db" />
                <Text className="block text-gray-400 text-sm mt-4">暂无未参与抽奖的订单</Text>
                <Text className="block text-gray-300 text-xs mt-2">购买套餐后可参与抽奖</Text>
              </View>
            ) : (
              <View className="space-y-3 pb-4">
                {unparticipated.map((order) => (
                  <Card key={order.id} className="bg-white rounded-xl border-0 shadow-sm">
                    <CardContent className="p-4">
                      <View className="flex items-start gap-3">
                        {order.package_cover && (
                          <Image
                            src={order.package_cover}
                            className="w-16 h-16 rounded-lg flex-shrink-0"
                            mode="aspectFill"
                          />
                        )}
                        <View className="flex-1 min-w-0">
                          <Text className="text-base font-semibold text-gray-900 block truncate">
                            {order.package_name || order.shop_name}
                          </Text>
                          <View className="flex items-center gap-2 mt-1">
                            <Text className="text-sm text-gray-500">×{order.quantity}</Text>
                            <Text className="text-sm font-medium text-red-500">¥{order.total_amount}</Text>
                          </View>
                          <View className="flex items-center gap-1 mt-1">
                            <Clock size={12} color="#9ca3af" />
                            <Text className="text-xs text-gray-400">{new Date(order.created_at).toLocaleString('zh-CN')}</Text>
                          </View>
                        </View>
                      </View>
                      <View className="mt-3 pt-3 border-t border-gray-100">
                        <Button
                          className="w-full bg-red-500 hover:bg-red-600 text-white rounded-lg"
                          onClick={() => handleParticipate(order)}
                        >
                          <Gift size={16} color="#ffffff" />
                          <Text className="ml-2">参与抽奖</Text>
                        </Button>
                      </View>
                    </CardContent>
                  </Card>
                ))}
              </View>
            )}
          </TabsContent>
        </Tabs>
      </View>
    </View>
  )
}
