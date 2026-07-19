import { useState, useEffect } from 'react'
import Taro, { useRouter } from '@tarojs/taro'
import { View, Text, ScrollView, Image } from '@tarojs/components'
import { Network } from '@/network'
import { Separator } from '@/components/ui/separator'
import { ArrowLeft, Clock, CircleCheck, Info, ChevronRight, Store, Phone, MapPin, RefreshCw } from 'lucide-react-taro'

interface Order {
  id: string
  user_id: string
  nick_name: string | null
  package_id: string | null
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

interface PackageInfo {
  id: string
  title: string
  cover_image: string | null
  shop_name: string | null
  shop_address: string | null
  shop_phone: string | null
  price: string
  original_price: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bgGradient: string; icon: string }> = {
  pending: {
    label: '待使用',
    color: '#FFFFFF',
    bgGradient: 'linear-gradient(135deg, #FF8C42 0%, #FF6B35 100%)',
    icon: 'clock',
  },
  used: {
    label: '已使用',
    color: '#FFFFFF',
    bgGradient: 'linear-gradient(135deg, #52C41A 0%, #389E0D 100%)',
    icon: 'check',
  },
  refunded: {
    label: '已退款',
    color: '#FFFFFF',
    bgGradient: 'linear-gradient(135deg, #999999 0%, #666666 100%)',
    icon: 'info',
  },
}

export default function OrderDetail() {
  const router = useRouter()
  const { id } = router.params
  const [order, setOrder] = useState<Order | null>(null)
  const [packageInfo, setPackageInfo] = useState<PackageInfo | null>(null)
  const [qrcode, setQrcode] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [refreshingQR, setRefreshingQR] = useState(false)

  useEffect(() => {
    if (id) {
      loadOrder()
      loadQRCode()
    }
  }, [id])

  useEffect(() => {
    if (order?.package_id) {
      loadPackageInfo(order.package_id)
    }
  }, [order?.package_id])

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

  const loadPackageInfo = async (packageId: string) => {
    try {
      console.log('[OrderDetail] 请求套餐详情, package_id:', packageId)
      const res = await Network.request({ url: `/api/packages/${packageId}` })
      console.log('[OrderDetail] 套餐详情响应:', res.data)
      const data = res.data?.data || res.data
      if (data) {
        setPackageInfo(data)
      }
    } catch (err) {
      console.error('[OrderDetail] 加载套餐详情失败:', err)
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

  const handleRefreshQR = async () => {
    setRefreshingQR(true)
    await loadQRCode()
    setRefreshingQR(false)
  }

  const handleBack = () => {
    Taro.navigateBack()
  }

  const handleGoPackage = () => {
    if (order?.package_id) {
      Taro.navigateTo({ url: `/pages/package-detail/index?id=${order.package_id}` })
    }
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  const formatDateShort = (dateStr: string) => {
    const d = new Date(dateStr)
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
  }

  const formatCode = (code: string) => {
    if (code.length === 12) {
      return `${code.slice(0, 4)} ${code.slice(4, 8)} ${code.slice(8)}`
    }
    return code
  }

  if (loading) {
    return (
      <View className="flex items-center justify-center h-screen bg-gray-100">
        <Text className="block text-gray-400 text-sm">加载中...</Text>
      </View>
    )
  }

  if (!order) {
    return (
      <View className="flex items-center justify-center h-screen bg-gray-100">
        <Text className="block text-gray-400 text-sm">订单不存在</Text>
      </View>
    )
  }

  const statusCfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending
  const isPending = order.status === 'pending'

  return (
    <View className="flex flex-col h-screen bg-gray-100">
      {/* 状态横幅 */}
      <View style={{ background: statusCfg.bgGradient }} className="px-5 pt-4 pb-6">
        <View className="flex flex-row items-center mb-4">
          <View onClick={handleBack} className="mr-3 p-1">
            <ArrowLeft size={22} color="#FFFFFF" />
          </View>
          <Text className="block text-base font-medium text-white">订单详情</Text>
        </View>
        <View className="flex flex-col items-center mt-2">
          <View className="flex flex-row items-center gap-2 mb-1">
            {order.status === 'used' ? (
              <CircleCheck size={28} color="#FFFFFF" />
            ) : (
              <Clock size={28} color="#FFFFFF" />
            )}
            <Text className="block text-2xl font-bold text-white">{statusCfg.label}</Text>
          </View>
          {isPending && (
            <Text className="block text-xs text-white opacity-80 mt-1">
              请在有效期内到店使用
            </Text>
          )}
          {order.status === 'used' && order.verified_at && (
            <Text className="block text-xs text-white opacity-80 mt-1">
              {formatDate(order.verified_at)} 已核销
            </Text>
          )}
          {order.status === 'refunded' && (
            <Text className="block text-xs text-white opacity-80 mt-1">
              退款已原路返回
            </Text>
          )}
        </View>
      </View>

      <ScrollView scrollY className="flex-1 -mt-3">
        {/* 二维码卡片 */}
        {isPending && (
          <View className="mx-4 rounded-2xl bg-white overflow-hidden">
            <View className="flex flex-col items-center px-6 pt-6 pb-2">
              {qrcode ? (
                <View className="p-4 rounded-2xl" style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
                  <Image
                    src={qrcode}
                    style={{ width: '170px', height: '170px' }}
                    mode="aspectFit"
                  />
                </View>
              ) : (
                <View className="w-44 h-44 bg-gray-50 rounded-2xl flex items-center justify-center">
                  <Text className="block text-gray-300 text-sm">加载中...</Text>
                </View>
              )}

              <View className="flex flex-row items-center gap-1 mt-4" onClick={handleRefreshQR}>
                <RefreshCw size={13} color="#BBB" />
                <Text className="block text-xs text-gray-400">
                  {refreshingQR ? '刷新中...' : '刷新二维码'}
                </Text>
              </View>
            </View>

            {/* 票券撕裂线 */}
            <View className="flex flex-row items-center px-4 my-3">
              <View className="w-3 h-3 rounded-full bg-gray-100 -ml-7 flex-shrink-0" />
              <View className="flex-1 border-t border-dashed border-gray-200 mx-1" />
              <View className="w-3 h-3 rounded-full bg-gray-100 -mr-7 flex-shrink-0" />
            </View>

            {order.verification_code && (
              <View className="flex flex-col items-center pb-5 px-6">
                <Text className="block text-xs text-gray-400 mb-1">核销码</Text>
                <Text className="block text-xl font-bold text-gray-900 tracking-widest font-mono">
                  {formatCode(order.verification_code)}
                </Text>
                <Text className="block text-xs text-gray-400 mt-3">
                  到店出示二维码或核销码，由商家扫码完成核销
                </Text>
              </View>
            )}
          </View>
        )}

        {/* 已使用状态 - 显示核销信息 */}
        {order.status === 'used' && (
          <View className="mx-4 rounded-2xl bg-white overflow-hidden">
            <View className="flex flex-col items-center px-6 py-6">
              <CircleCheck size={56} color="#52C41A" />
              <Text className="block text-lg font-bold text-gray-900 mt-3">已完成核销</Text>
              {order.verified_at && (
                <Text className="block text-sm text-gray-400 mt-1">
                  核销时间：{formatDate(order.verified_at)}
                </Text>
              )}
              {order.verification_code && (
                <View className="mt-3 bg-gray-50 px-4 py-2 rounded-lg">
                  <Text className="block text-sm text-gray-500 font-mono">
                    核销码：{formatCode(order.verification_code)}
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* 套餐信息卡片 */}
        <View className="mx-4 mt-3 rounded-2xl bg-white overflow-hidden" onClick={handleGoPackage}>
          <View className="flex flex-row items-center px-4 pt-4 pb-1">
            <Text className="block text-sm font-semibold text-gray-900">套餐信息</Text>
          </View>
          <View className="flex flex-row items-center px-4 py-3">
            {/* 封面图 */}
            <View className="w-20 h-20 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0 mr-3">
              {packageInfo?.cover_image ? (
                <Image
                  src={packageInfo.cover_image}
                  style={{ width: '100%', height: '100%' }}
                  mode="aspectFill"
                />
              ) : (
                <View className="w-full h-full flex items-center justify-center">
                  <Text className="block text-gray-300 text-xs">暂无图片</Text>
                </View>
              )}
            </View>
            {/* 套餐信息 */}
            <View className="flex-1 flex flex-col justify-between min-h-20">
              <Text className="block text-sm font-medium text-gray-900 leading-5" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {order.package_name}
              </Text>
              <View className="flex flex-row items-baseline gap-2 mt-1">
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
            <ChevronRight size={18} color="#CCC" />
          </View>
        </View>

        {/* 商家信息卡片 */}
        {(order.shop_name || packageInfo?.shop_name) && (
          <View className="mx-4 mt-3 rounded-2xl bg-white overflow-hidden">
            <View className="flex flex-row items-center px-4 pt-4 pb-1">
              <Text className="block text-sm font-semibold text-gray-900">商家信息</Text>
            </View>
            <View className="px-4 py-3">
              <View className="flex flex-row items-center gap-2 mb-2">
                <Store size={16} color="#666" />
                <Text className="block text-sm text-gray-800 font-medium">
                  {order.shop_name || packageInfo?.shop_name}
                </Text>
              </View>
              {packageInfo?.shop_address && (
                <View className="flex flex-row items-start gap-2 mb-2">
                  <MapPin size={16} color="#999" className="mt-1 flex-shrink-0" />
                  <Text className="block text-xs text-gray-500 leading-5 flex-1">
                    {packageInfo.shop_address}
                  </Text>
                </View>
              )}
              {packageInfo?.shop_phone && (
                <View className="flex flex-row items-center gap-2">
                  <Phone size={16} color="#999" />
                  <Text className="block text-xs text-gray-500">
                    {packageInfo.shop_phone}
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* 订单信息卡片 */}
        <View className="mx-4 mt-3 rounded-2xl bg-white overflow-hidden">
          <View className="flex flex-row items-center px-4 pt-4 pb-1">
            <Text className="block text-sm font-semibold text-gray-900">订单信息</Text>
          </View>
          <View className="px-4 py-3">
            <View className="flex flex-row justify-between items-center py-2">
              <Text className="block text-sm text-gray-400">订单编号</Text>
              <Text className="block text-sm text-gray-800 font-mono">{order.id.slice(0, 18).toUpperCase()}</Text>
            </View>
            <Separator />
            <View className="flex flex-row justify-between items-center py-2">
              <Text className="block text-sm text-gray-400">下单时间</Text>
              <Text className="block text-sm text-gray-800">{formatDate(order.created_at)}</Text>
            </View>
            <Separator />
            <View className="flex flex-row justify-between items-center py-2">
              <Text className="block text-sm text-gray-400">购买日期</Text>
              <Text className="block text-sm text-gray-800">{formatDateShort(order.created_at)}</Text>
            </View>
            <Separator />
            <View className="flex flex-row justify-between items-center py-2">
              <Text className="block text-sm text-gray-400">购买份数</Text>
              <Text className="block text-sm text-gray-800">{order.quantity || 1} 份</Text>
            </View>
            {order.verification_code && (
              <>
                <Separator />
                <View className="flex flex-row justify-between items-center py-2">
                  <Text className="block text-sm text-gray-400">核销码</Text>
                  <Text className="block text-sm text-gray-800 font-mono">{formatCode(order.verification_code)}</Text>
                </View>
              </>
            )}
            {order.verified_at && (
              <>
                <Separator />
                <View className="flex flex-row justify-between items-center py-2">
                  <Text className="block text-sm text-gray-400">核销时间</Text>
                  <Text className="block text-sm text-gray-800">{formatDate(order.verified_at)}</Text>
                </View>
              </>
            )}
            <Separator />
            <View className="flex flex-row justify-between items-center py-2">
              <Text className="block text-sm text-gray-400">订单状态</Text>
              <View
                className="px-3 py-1 rounded-full"
                style={{ backgroundColor: isPending ? '#FFF3ED' : order.status === 'used' ? '#F6FFED' : '#F5F5F5' }}
              >
                <Text
                  className="block text-xs font-medium"
                  style={{ color: isPending ? '#FF6B35' : order.status === 'used' ? '#52C41A' : '#999' }}
                >
                  {statusCfg.label}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* 使用说明卡片 */}
        <View className="mx-4 mt-3 rounded-2xl bg-white overflow-hidden">
          <View className="flex flex-row items-center gap-2 px-4 pt-4 pb-1">
            <Info size={16} color="#666" />
            <Text className="block text-sm font-semibold text-gray-900">使用说明</Text>
          </View>
          <View className="px-4 py-3">
            <View className="flex flex-col gap-2">
              <View className="flex flex-row items-start gap-2">
                <View className="w-4 h-4 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0 mt-1">
                  <Text className="block text-orange-500" style={{ fontSize: '10px', lineHeight: '16px' }}>1</Text>
                </View>
                <Text className="block text-xs text-gray-500 leading-5 flex-1">
                  到店消费时请出示本页面的二维码或核销码
                </Text>
              </View>
              <View className="flex flex-row items-start gap-2">
                <View className="w-4 h-4 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0 mt-1">
                  <Text className="block text-orange-500" style={{ fontSize: '10px', lineHeight: '16px' }}>2</Text>
                </View>
                <Text className="block text-xs text-gray-500 leading-5 flex-1">
                  商家使用微信扫一扫扫描二维码即可完成核销
                </Text>
              </View>
              <View className="flex flex-row items-start gap-2">
                <View className="w-4 h-4 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0 mt-1">
                  <Text className="block text-orange-500" style={{ fontSize: '10px', lineHeight: '16px' }}>3</Text>
                </View>
                <Text className="block text-xs text-gray-500 leading-5 flex-1">
                  核销后订单状态变更为已使用，不可重复使用
                </Text>
              </View>
              <View className="flex flex-row items-start gap-2">
                <View className="w-4 h-4 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0 mt-1">
                  <Text className="block text-orange-500" style={{ fontSize: '10px', lineHeight: '16px' }}>4</Text>
                </View>
                <Text className="block text-xs text-gray-500 leading-5 flex-1">
                  如有疑问请联系商家或平台客服
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* 底部安全区 */}
        <View className="h-8" />
      </ScrollView>
    </View>
  )
}
