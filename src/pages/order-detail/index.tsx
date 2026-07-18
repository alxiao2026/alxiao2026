import { useState, useEffect } from 'react'
import Taro, { useRouter } from '@tarojs/taro'
import { View, Text, ScrollView, Image } from '@tarojs/components'
import { Network } from '@/network'
import { Card, CardContent } from '@/components/ui/card'
import { ArrowLeft, Clock, CircleCheck, Info } from 'lucide-react-taro'

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
  created_at: string
}

const STATUS_MAP: Record<string, { label: string; color: string; bgColor: string }> = {
  pending: { label: '待使用', color: '#FF6B35', bgColor: '#FFF3ED' },
  used: { label: '已使用', color: '#52C41A', bgColor: '#F6FFED' },
  refunded: { label: '已退款', color: '#999999', bgColor: '#F5F5F5' },
}

export default function OrderDetail() {
  const router = useRouter()
  const { id } = router.params
  const [order, setOrder] = useState<Order | null>(null)
  const [qrcode, setQrcode] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (id) {
      loadOrder()
      loadQRCode()
    }
  }, [id])

  const loadOrder = async () => {
    try {
      console.log('[OrderDetail] 请求订单详情, id:', id)
      const res = await Network.request({ url: `/api/orders/${id}` })
      console.log('[OrderDetail] 订单详情响应:', res.data)
      const data = res.data?.data || res.data
      if (data) {
        setOrder(data)
      }
    } catch (err) {
      console.error('[OrderDetail] 加载订单失败:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadQRCode = async () => {
    try {
      console.log('[OrderDetail] 请求二维码, id:', id)
      const res = await Network.request({ url: `/api/orders/${id}/qrcode` })
      console.log('[OrderDetail] 二维码响应:', res.data)
      const data = res.data?.data || res.data
      if (data?.qrcode) {
        setQrcode(data.qrcode)
      }
    } catch (err) {
      console.error('[OrderDetail] 加载二维码失败:', err)
    }
  }

  const handleBack = () => {
    Taro.navigateBack()
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  const formatCode = (code: string) => {
    // 将12位核销码格式化为 xxx-xxxx-xxxx
    if (code.length === 12) {
      return `${code.slice(0, 3)}-${code.slice(3, 7)}-${code.slice(7)}`
    }
    return code
  }

  if (loading) {
    return (
      <View className="flex items-center justify-center h-screen bg-gray-50">
        <Text className="block text-gray-500">加载中...</Text>
      </View>
    )
  }

  if (!order) {
    return (
      <View className="flex items-center justify-center h-screen bg-gray-50">
        <Text className="block text-gray-500">订单不存在</Text>
      </View>
    )
  }

  const statusInfo = STATUS_MAP[order.status] || STATUS_MAP.pending

  return (
    <View className="flex flex-col h-screen bg-gray-50">
      {/* 顶部导航 */}
      <View className="flex flex-row items-center px-4 py-3 bg-white">
        <View onClick={handleBack} className="mr-3">
          <ArrowLeft size={24} color="#333" />
        </View>
        <Text className="block text-lg font-semibold text-gray-900">订单详情</Text>
      </View>

      <ScrollView scrollY className="flex-1">
        {/* 状态卡片 */}
        <View className="mx-4 mt-3 rounded-xl overflow-hidden" style={{ backgroundColor: statusInfo.bgColor }}>
          <View className="px-4 py-5 flex flex-col items-center">
            {order.status === 'used' ? (
              <CircleCheck size={48} color="#52C41A" />
            ) : (
              <Clock size={48} color={statusInfo.color} />
            )}
            <Text className="block text-lg font-bold mt-2" style={{ color: statusInfo.color }}>
              {statusInfo.label}
            </Text>
            {order.status === 'used' && order.verified_at && (
              <Text className="block text-xs text-gray-500 mt-1">
                核销时间：{formatDate(order.verified_at)}
              </Text>
            )}
          </View>
        </View>

        {/* 二维码区域 - 仅待使用状态显示 */}
        {order.status === 'pending' && (
          <Card className="mx-4 mt-3">
            <CardContent className="p-4 flex flex-col items-center">
              <Text className="block text-sm font-semibold text-gray-800 mb-3">核销码</Text>
              {qrcode ? (
                <View className="bg-white p-4 rounded-lg">
                  <Image
                    src={qrcode}
                    style={{ width: '200px', height: '200px' }}
                    mode="aspectFit"
                  />
                </View>
              ) : (
                <View className="w-48 h-48 bg-gray-100 rounded-lg flex items-center justify-center">
                  <Text className="block text-gray-400 text-sm">二维码加载中...</Text>
                </View>
              )}
              {order.verification_code && (
                <View className="mt-3 bg-gray-50 px-4 py-2 rounded-lg">
                  <Text className="block text-center text-lg font-mono font-bold text-gray-800 tracking-wider">
                    {formatCode(order.verification_code)}
                  </Text>
                </View>
              )}
              <Text className="block text-xs text-gray-400 mt-3 text-center">
                到店出示二维码或核销码，由商家扫码核销
              </Text>
            </CardContent>
          </Card>
        )}

        {/* 套餐信息 */}
        <Card className="mx-4 mt-3">
          <CardContent className="p-4">
            <Text className="block text-sm font-semibold text-gray-800 mb-3">套餐信息</Text>
            <View className="flex flex-row items-center justify-between">
              <View className="flex-1 mr-3">
                <Text className="block text-base font-medium text-gray-900 mb-1">
                  {order.package_name}
                </Text>
                <Text className="block text-xs text-gray-500">
                  {order.shop_name || '膨胀团'}
                </Text>
              </View>
              <View className="flex flex-col items-end">
                <Text className="block text-xl font-bold text-red-500">
                  ¥{parseFloat(String(order.price)).toFixed(0)}
                </Text>
                {order.original_price && parseFloat(String(order.original_price)) > parseFloat(String(order.price)) && (
                  <Text className="block text-xs text-gray-400 line-through">
                    ¥{parseFloat(String(order.original_price)).toFixed(0)}
                  </Text>
                )}
              </View>
            </View>
          </CardContent>
        </Card>

        {/* 订单信息 */}
        <Card className="mx-4 mt-3">
          <CardContent className="p-4">
            <Text className="block text-sm font-semibold text-gray-800 mb-3">订单信息</Text>
            <View className="flex flex-col gap-2">
              <View className="flex flex-row justify-between">
                <Text className="block text-sm text-gray-500">订单编号</Text>
                <Text className="block text-sm text-gray-800">{order.id.slice(0, 8)}...</Text>
              </View>
              <View className="flex flex-row justify-between">
                <Text className="block text-sm text-gray-500">下单时间</Text>
                <Text className="block text-sm text-gray-800">{formatDate(order.created_at)}</Text>
              </View>
              {order.verification_code && (
                <View className="flex flex-row justify-between">
                  <Text className="block text-sm text-gray-500">核销码</Text>
                  <Text className="block text-sm text-gray-800 font-mono">{formatCode(order.verification_code)}</Text>
                </View>
              )}
              {order.verified_at && (
                <View className="flex flex-row justify-between">
                  <Text className="block text-sm text-gray-500">核销时间</Text>
                  <Text className="block text-sm text-gray-800">{formatDate(order.verified_at)}</Text>
                </View>
              )}
              <View className="flex flex-row justify-between">
                <Text className="block text-sm text-gray-500">订单状态</Text>
                <View
                  className="px-2 py-1 rounded"
                  style={{ backgroundColor: statusInfo.bgColor }}
                >
                  <Text className="block text-xs" style={{ color: statusInfo.color }}>
                    {statusInfo.label}
                  </Text>
                </View>
              </View>
            </View>
          </CardContent>
        </Card>

        {/* 使用说明 */}
        <Card className="mx-4 mt-3">
          <CardContent className="p-4">
            <View className="flex flex-row items-center gap-2 mb-2">
              <Info size={16} color="#666" />
              <Text className="block text-sm font-semibold text-gray-800">使用说明</Text>
            </View>
            <View className="flex flex-col gap-1">
              <Text className="block text-xs text-gray-500 leading-5">
                1. 到店消费时请出示二维码或核销码
              </Text>
              <Text className="block text-xs text-gray-500 leading-5">
                2. 商家使用微信扫一扫扫描二维码即可完成核销
              </Text>
              <Text className="block text-xs text-gray-500 leading-5">
                3. 核销后订单状态变更为「已使用」，不可重复使用
              </Text>
            </View>
          </CardContent>
        </Card>

        <View className="h-6" />
      </ScrollView>
    </View>
  )
}
