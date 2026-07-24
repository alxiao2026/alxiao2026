import { useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { View, Text, Image } from '@tarojs/components'
import { Network } from '@/network'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Trophy, Package, Clock, Gift, QrCode } from 'lucide-react-taro'

interface LotteryRecord {
  id: string
  user_id: string
  order_id: string
  prize_id: string
  prize_name: string
  prize_type: string
  is_winner: boolean
  coupon_amount?: string | number | null
  coupon_condition?: string | number | null
  product_name?: string
  product_value?: string | number | null
  prize_image?: string
  redemption_code?: string
  refund_amount?: string | number | null
  refund_status?: string
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

  // 页面每次显示时刷新（首次进入 / 从盲盒抽奖页返回都会触发）
  useDidShow(() => {
    const uid = Taro.getStorageSync('user_id') || Taro.getStorageSync('userInfo')?.user_id || ''
    if (uid) {
      loadRecords(uid)
      loadUnparticipated(uid)
    }
  })

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
      coupon: 'bg-red-100 text-red-700',
      product: 'bg-purple-100 text-purple-700',
      free_meal: 'bg-green-100 text-green-700',
    }
    return map[type] || 'bg-gray-100 text-gray-700'
  }

  const getRecordBadge = (record: LotteryRecord) => {
    if (!record.is_winner || !record.prize_id) {
      return { label: '未中奖', className: 'bg-gray-100 text-gray-500' }
    }
    if (record.prize_type === 'free_meal') {
      return record.refund_status === 'completed'
        ? { label: '已返现', className: 'bg-green-100 text-green-700' }
        : { label: '返现中', className: 'bg-yellow-100 text-yellow-700' }
    }
    if (record.prize_type === 'product') {
      return record.refund_status === 'completed'
        ? { label: '已核销', className: 'bg-green-100 text-green-700' }
        : { label: '待核销', className: 'bg-yellow-100 text-yellow-700' }
    }
    return { label: '待使用', className: 'bg-yellow-100 text-yellow-700' }
  }

  // 跳转盲盒抽奖页（含分享引导与开奖动画，与支付成功后的抽奖体验一致）
  const handleParticipate = (order: Order) => {
    Taro.navigateTo({ url: `/pages/lottery/index?orderId=${order.id}` })
  }

  return (
    <View className="min-h-screen bg-gray-50">
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
                  const statusBadge = getRecordBadge(record)
                  return (
                    <Card key={record.id} className="bg-white rounded-xl border-0 shadow-sm">
                      <CardContent className="p-4">
                        <View className="flex items-start justify-between">
                          <View className="flex-1">
                            <View className="flex items-center gap-2 mb-2">
                              <Text className="text-base font-semibold text-gray-900">{record.prize_name}</Text>
                              {record.prize_type ? (
                                <Badge className={`${getPrizeTypeColor(record.prize_type)} text-xs`}>
                                  <Text>{getPrizeTypeLabel(record.prize_type)}</Text>
                                </Badge>
                              ) : null}
                            </View>
                            {record.prize_type === 'coupon' && record.coupon_amount && (
                              <Text className="block text-sm text-[#FF4757] font-medium">
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
                                  <Text className="block text-sm text-[#FF4757] font-mono mt-1">兑换码：{record.redemption_code}</Text>
                                )}
                                {record.refund_status !== 'completed' && (
                                  <Button
                                    className="mt-2 bg-[#FF4757] hover:bg-[#e63846] text-white rounded-lg"
                                    size="sm"
                                    onClick={() => Taro.navigateTo({ url: `/pages/lottery/index?orderId=${record.order_id}` })}
                                  >
                                    <QrCode size={14} color="#ffffff" />
                                    <Text className="ml-1 text-xs">查看核销码</Text>
                                  </Button>
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
                            <Text className="text-sm font-medium text-[#FF4757]">¥{order.total_amount}</Text>
                          </View>
                          <View className="flex items-center gap-1 mt-1">
                            <Clock size={12} color="#9ca3af" />
                            <Text className="text-xs text-gray-400">{new Date(order.created_at).toLocaleString('zh-CN')}</Text>
                          </View>
                        </View>
                      </View>
                      <View className="mt-3 pt-3 border-t border-gray-100">
                        <Button
                          className="w-full bg-[#FF4757] hover:bg-[#e63846] text-white rounded-lg"
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
