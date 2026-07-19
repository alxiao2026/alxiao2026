import { useState, useEffect, useCallback } from 'react'
import Taro, { useRouter } from '@tarojs/taro'
import { View, Text, ScrollView } from '@tarojs/components'
import { Network } from '@/network'
import { Card, CardContent } from '@/components/ui/card'
import { Package, Clock, CircleCheck, CircleX, ChevronRight } from 'lucide-react-taro'

interface Order {
  id: string
  user_id: string
  nick_name: string | null
  package_name: string
  price: string
  original_price: string | null
  status: string
  verification_code: string | null
  verified_at: string | null
  shop_name: string | null
  quantity: number
  created_at: string
}

const STATUS_MAP: Record<string, { label: string; color: string; bgColor: string }> = {
  pending: { label: '待使用', color: '#FF6B35', bgColor: '#FFF3ED' },
  used: { label: '已使用', color: '#52C41A', bgColor: '#F6FFED' },
  refunded: { label: '已退款', color: '#999999', bgColor: '#F5F5F5' },
  expired: { label: '已过期', color: '#999999', bgColor: '#F5F5F5' },
}

export default function OrderList() {
  const router = useRouter()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<string>(router.params?.status || 'all')

  const loadOrders = useCallback(async () => {
    try {
      setLoading(true)
      const userId = Taro.getStorageSync('user_id')
      if (!userId) {
        setOrders([])
        return
      }
      console.log('[OrderList] 请求用户订单, userId:', userId)
      const res = await Network.request({ url: `/api/orders/user/${userId}` })
      console.log('[OrderList] 响应:', res.data)
      const data = res.data?.data || res.data
      if (Array.isArray(data)) {
        setOrders(data)
      }
    } catch (err) {
      console.error('[OrderList] 加载订单失败:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadOrders()
  }, [loadOrders])

  const filteredOrders = activeTab === 'all'
    ? orders
    : orders.filter(o => o.status === activeTab)

  const handleOrderClick = (order: Order) => {
    Taro.navigateTo({ url: `/pages/order-detail/index?id=${order.id}` })
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  const tabs = [
    { key: 'all', label: '全部' },
    { key: 'pending', label: '待使用' },
    { key: 'used', label: '已使用' },
    { key: 'refunded', label: '已退款' },
  ]

  return (
    <View className="flex flex-col h-screen bg-gray-50">
      {/* Tab 栏 */}
      <View className="flex flex-row bg-white border-b border-gray-100">
        {tabs.map(tab => (
          <View
            key={tab.key}
            className="flex-1 flex items-center justify-center py-3"
            onClick={() => setActiveTab(tab.key)}
          >
            <Text className={`block text-sm ${activeTab === tab.key ? 'text-red-500 font-semibold' : 'text-gray-600'}`}>
              {tab.label}
            </Text>
            {activeTab === tab.key && (
              <View className="absolute bottom-0 w-8 h-1 bg-red-500 rounded-full" />
            )}
          </View>
        ))}
      </View>

      <ScrollView scrollY className="flex-1 px-4 py-3">
        {loading ? (
          <View className="flex items-center justify-center py-20">
            <Text className="block text-gray-400">加载中...</Text>
          </View>
        ) : filteredOrders.length === 0 ? (
          <View className="flex flex-col items-center justify-center py-20">
            <Package size={64} color="#d1d5db" />
            <Text className="block text-gray-400 mt-4 text-sm">暂无订单</Text>
          </View>
        ) : (
          filteredOrders.map(order => {
            const statusInfo = STATUS_MAP[order.status] || STATUS_MAP.pending
            return (
              <Card key={order.id} className="mb-3 overflow-hidden" onClick={() => handleOrderClick(order)}>
                <CardContent className="p-4">
                  {/* 店铺名 + 状态 */}
                  <View className="flex flex-row items-center justify-between mb-3">
                    <Text className="block text-sm font-semibold text-gray-800">
                      {order.shop_name || '膨胀团'}
                    </Text>
                    <View
                      className="px-2 py-1 rounded"
                      style={{ backgroundColor: statusInfo.bgColor }}
                    >
                      <Text className="block text-xs" style={{ color: statusInfo.color }}>
                        {statusInfo.label}
                      </Text>
                    </View>
                  </View>

                  {/* 套餐信息 */}
                  <View className="flex flex-row items-center justify-between">
                    <View className="flex-1 mr-3">
                      <Text className="block text-base font-medium text-gray-900 mb-1">
                        {order.package_name}
                      </Text>
                      <Text className="block text-xs text-gray-500">
                        下单时间：{formatDate(order.created_at)}
                      </Text>
                      {(order.quantity || 1) > 1 && (
                        <Text className="block text-xs text-gray-400 mt-1">x{order.quantity} 份</Text>
                      )}
                    </View>
                    <View className="flex flex-col items-end">
                      <Text className="block text-lg font-bold text-red-500">
                        ¥{parseFloat(String(order.price)).toFixed(0)}
                      </Text>
                      {order.original_price && parseFloat(String(order.original_price)) > parseFloat(String(order.price)) && (
                        <Text className="block text-xs text-gray-400 line-through">
                          ¥{parseFloat(String(order.original_price)).toFixed(0)}
                        </Text>
                      )}
                    </View>
                  </View>

                  {/* 底部操作区 */}
                  <View className="flex flex-row items-center justify-between mt-3 pt-3 border-t border-gray-100">
                    <View className="flex flex-row items-center gap-1">
                      {order.status === 'pending' && (
                        <>
                          <Clock size={14} color="#FF6B35" />
                          <Text className="block text-xs text-orange-500">待核销</Text>
                        </>
                      )}
                      {order.status === 'used' && (
                        <>
                          <CircleCheck size={14} color="#52C41A" />
                          <Text className="block text-xs text-green-500">
                            {order.verified_at ? `已于${formatDate(order.verified_at)}核销` : '已核销'}
                          </Text>
                        </>
                      )}
                      {order.status === 'refunded' && (
                        <>
                          <CircleX size={14} color="#999" />
                          <Text className="block text-xs text-gray-400">已退款</Text>
                        </>
                      )}
                    </View>
                    <View className="flex flex-row items-center gap-1">
                      <Text className="block text-xs text-gray-400">查看详情</Text>
                      <ChevronRight size={14} color="#9ca3af" />
                    </View>
                  </View>
                </CardContent>
              </Card>
            )
          })
        )}
        <View className="h-4" />
      </ScrollView>
    </View>
  )
}
