import { useState, useEffect } from 'react'
import Taro, { useRouter } from '@tarojs/taro'
import { View, Text, Image, ScrollView } from '@tarojs/components'
import { Network } from '@/network'
import {
  ArrowLeft,
  Share2,
  Phone,
  Clock,
  Check,
  Info,
  Calendar,
  Gift,
  RefreshCw,
  FileText,
} from 'lucide-react-taro'

interface Package {
  id: string
  name: string
  description: string
  price: string
  original_price: string
  badge: string
  features: string[]
  category: string
  cover_image: string
  environment_images: string[]
  stock: number
  sale_start_date: string
  sale_end_date: string
  auto_renew: boolean
  status: string
  merchant_id?: string
  combinations?: any[]
  sales_count?: number
}

interface Merchant {
  id: string
  name: string
  address: string
  phone: string
  business_hours: string
  location?: string
  avg_price?: string
  has_private_room?: boolean
}

export default function PackageDetail() {
  const router = useRouter()
  const { id } = router.params
  const [pkg, setPkg] = useState<Package | null>(null)
  const [merchant, setMerchant] = useState<Merchant | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (id) {
      loadPackage()
    }
  }, [id])

  const loadPackage = async () => {
    try {
      const res = await Network.request({
        url: `/api/packages/${id}`,
      })
      console.log('套餐详情:', res.data)
      const data = res.data?.data || res.data
      if (data) {
        setPkg(data)
        if (data.merchant_id) {
          loadMerchant(data.merchant_id)
        }
      }
    } catch (err) {
      console.error('加载套餐失败:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadMerchant = async (merchantId: string) => {
    try {
      const res = await Network.request({
        url: `/api/merchants/${merchantId}`,
      })
      const data = res.data?.data || res.data
      if (data) {
        setMerchant(data)
      }
    } catch (err) {
      console.error('加载商家失败:', err)
    }
  }

  const handleBack = () => {
    Taro.navigateBack()
  }

  const handleShare = () => {
    Taro.showToast({ title: '分享功能开发中', icon: 'none' })
  }

  const handleBuy = () => {
    Taro.showToast({ title: '购买功能开发中', icon: 'none' })
  }

  if (loading) {
    return (
      <View className="flex items-center justify-center h-screen bg-gray-50">
        <Text className="block text-gray-500">加载中...</Text>
      </View>
    )
  }

  if (!pkg) {
    return (
      <View className="flex items-center justify-center h-screen bg-gray-50">
        <Text className="block text-gray-500">套餐不存在</Text>
      </View>
    )
  }

  const originalPrice = parseFloat(pkg.original_price || pkg.price)
  const currentPrice = parseFloat(pkg.price)
  const discount = originalPrice > 0 ? Math.round((currentPrice / originalPrice) * 10) / 10 : 0

  // 合并所有图片
  const allImages = [
    ...(pkg.cover_image ? [pkg.cover_image] : []),
    ...(Array.isArray(pkg.environment_images) ? pkg.environment_images : [])
  ]

  return (
    <View className="min-h-screen bg-gray-50 pb-24">
      {/* 顶部导航 */}
      <View className="fixed top-0 left-0 right-0 z-50 bg-transparent px-4 py-3 flex flex-row items-center justify-between">
        <View onClick={handleBack} className="p-2 bg-white rounded-full" style={{ opacity: 0.8 }}>
          <ArrowLeft size={20} color="#333" />
        </View>
        <View className="flex flex-row gap-2">
          <View onClick={handleShare} className="p-2 bg-white rounded-full" style={{ opacity: 0.8 }}>
            <Share2 size={20} color="#333" />
          </View>
        </View>
      </View>

      <ScrollView scrollY className="h-screen">
        {/* 头图轮播 */}
        <View className="w-full h-64 bg-gray-200 relative">
          {allImages.length > 0 ? (
            <Image 
              src={allImages[0]} 
              className="w-full h-full" 
              mode="aspectFill"
            />
          ) : (
            <View className="flex items-center justify-center h-full">
              <Text className="block text-gray-400">暂无图片</Text>
            </View>
          )}
          
          {/* 图片切换标签 */}
          <View className="absolute bottom-4 right-4 flex flex-row items-center gap-2 rounded-full px-3 py-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <Text className="block text-xs text-white">菜品</Text>
            <Text className="block text-xs text-white" style={{ opacity: 0.6 }}>|</Text>
            <Text className="block text-xs text-white">
              1/{allImages.length}
            </Text>
          </View>
        </View>

        {/* 价格区域 */}
        <View className="bg-white px-4 py-4">
          <View className="flex flex-row items-baseline gap-2">
            <Text className="block text-3xl font-bold text-red-500">¥{currentPrice.toFixed(0)}</Text>
            {originalPrice > currentPrice && (
              <>
                <Text className="block text-base text-gray-400 line-through">¥{originalPrice.toFixed(0)}</Text>
                <View className="bg-red-50 px-2 py-1 rounded">
                  <Text className="block text-xs text-red-500">{discount}折</Text>
                </View>
              </>
            )}
            {pkg.sales_count && (
              <Text className="block text-sm text-gray-500 ml-auto">已售{pkg.sales_count}+</Text>
            )}
          </View>
          <Text className="block text-lg font-bold text-gray-800 mt-2">{pkg.name}</Text>
        </View>

        {/* 服务标签 */}
        <View className="bg-white px-4 py-3 border-t border-gray-100">
          <View className="flex flex-row items-center gap-2">
            <Text className="block text-sm text-gray-500">服务</Text>
            <View className="flex flex-row items-center gap-3 flex-1">
              <Text className="block text-sm text-gray-700">随时退</Text>
              <Text className="block text-sm text-gray-700">过期自动退</Text>
              <Text className="block text-sm text-gray-700">可赠送好友</Text>
            </View>
          </View>
        </View>

        {/* 使用须知 */}
        <View className="bg-white px-4 py-3 border-t border-gray-100">
          <View className="flex flex-row items-center gap-2">
            <Text className="block text-sm text-gray-500">须知</Text>
            <View className="flex flex-row items-center gap-3 flex-1 flex-wrap">
              <Text className="block text-sm text-gray-700">全周可用</Text>
              <Text className="block text-sm text-gray-700">至少提前2小时预约</Text>
              <Text className="block text-sm text-gray-700">每桌限用1张券</Text>
              <Text className="block text-sm text-gray-700">仅堂食</Text>
            </View>
          </View>
        </View>

        {/* 门店信息 */}
        {merchant && (
          <View className="bg-white px-4 py-3 border-t border-gray-100">
            <View className="flex flex-row items-center gap-2">
              <Text className="block text-sm text-gray-500">门店</Text>
              <View className="flex flex-row items-center gap-2 flex-1">
                <Text className="block text-sm text-gray-700">最近9.4公里</Text>
                <Text className="block text-sm text-gray-700 font-medium">{merchant.name}</Text>
              </View>
            </View>
            {merchant.address && (
              <View className="mt-1 ml-12">
                <Text className="block text-xs text-gray-500">{merchant.address}</Text>
              </View>
            )}
          </View>
        )}

        {/* 团购详情 */}
        {pkg.combinations && Array.isArray(pkg.combinations) && pkg.combinations.length > 0 && (
          <View className="bg-white mt-2 px-4 py-4">
            <Text className="block text-base font-bold text-gray-800 mb-4">团购详情</Text>
            {pkg.combinations.map((combo: any, idx: number) => (
              <View key={idx} className="mb-6">
                <Text className="block text-base font-semibold text-gray-800 mb-3">{combo.name}</Text>
                {combo.items.map((item: any, itemIdx: number) => (
                  <View key={itemIdx} className="flex flex-row justify-between py-2 border-b border-gray-50">
                    <View className="flex flex-row items-center gap-2 flex-1">
                      <View className="w-2 h-2 rounded-full bg-gray-400" />
                      <Text className="block text-sm text-gray-700 flex-1">{item.name}</Text>
                    </View>
                    <Text className="block text-sm text-gray-500">
                      {item.quantity}{item.unit || '份'}
                    </Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        )}

        {/* 图片详情 */}
        {allImages.length > 1 && (
          <View className="bg-white mt-2 px-4 py-4">
            <Text className="block text-base font-bold text-gray-800 mb-4">图片详情</Text>
            <View className="flex flex-col gap-3">
              {allImages.map((img: string, idx: number) => (
                <Image key={idx} src={img} className="w-full h-48 rounded-lg" mode="aspectFill" />
              ))}
            </View>
          </View>
        )}

        {/* 购买须知 */}
        <View className="bg-white mt-2 px-4 py-4">
          <Text className="block text-base font-bold text-gray-800 mb-4">购买须知</Text>
          
          {/* 可用日期 */}
          <View className="mb-4">
            <View className="flex flex-row items-center gap-2 mb-2">
              <Calendar size={16} color="#666" />
              <Text className="block text-sm font-medium text-gray-800">可用日期</Text>
            </View>
            <View className="ml-6">
              <Text className="block text-sm text-gray-600">
                有效期: {pkg.sale_start_date && pkg.sale_end_date 
                  ? `${pkg.sale_start_date} 至 ${pkg.sale_end_date}`
                  : '购买后30天内有效'}
              </Text>
            </View>
          </View>

          {/* 可用时间 */}
          <View className="mb-4">
            <View className="flex flex-row items-center gap-2 mb-2">
              <Clock size={16} color="#666" />
              <Text className="block text-sm font-medium text-gray-800">可用时间</Text>
            </View>
            <View className="ml-6">
              <Text className="block text-sm text-gray-600">
                {merchant?.business_hours || '商家营业时间可用'}
              </Text>
            </View>
          </View>

          {/* 预约规则 */}
          <View className="mb-4">
            <View className="flex flex-row items-center gap-2 mb-2">
              <Info size={16} color="#666" />
              <Text className="block text-sm font-medium text-gray-800">预约规则</Text>
            </View>
            <View className="ml-6">
              <Text className="block text-sm text-gray-600">到店消费: 需提前2小时预约</Text>
            </View>
          </View>

          {/* 使用方式 */}
          <View className="mb-4">
            <View className="flex flex-row items-center gap-2 mb-2">
              <Check size={16} color="#666" />
              <Text className="block text-sm font-medium text-gray-800">使用方式</Text>
            </View>
            <View className="ml-6">
              <Text className="block text-sm text-gray-600">仅堂食</Text>
            </View>
          </View>

          {/* 使用规则 */}
          <View className="mb-4">
            <View className="flex flex-row items-center gap-2 mb-2">
              <FileText size={16} color="#666" />
              <Text className="block text-sm font-medium text-gray-800">使用规则</Text>
            </View>
            <View className="ml-6 flex flex-col gap-1">
              <Text className="block text-sm text-gray-600">· 不与店内优惠同享</Text>
              <Text className="block text-sm text-gray-600">· 可在包间消费时使用</Text>
              <Text className="block text-sm text-gray-600">· 当前商品每桌限用1张券</Text>
            </View>
          </View>

          {/* 可赠送好友 */}
          <View className="mb-4">
            <View className="flex flex-row items-center gap-2 mb-2">
              <Gift size={16} color="#666" />
              <Text className="block text-sm font-medium text-gray-800">可赠送好友</Text>
            </View>
            <View className="ml-6">
              <Text className="block text-sm text-gray-600">购买后支持赠送给好友使用</Text>
            </View>
          </View>

          {/* 退款规则 */}
          <View className="mb-4">
            <View className="flex flex-row items-center gap-2 mb-2">
              <RefreshCw size={16} color="#666" />
              <Text className="block text-sm font-medium text-gray-800">退款规则</Text>
            </View>
            <View className="ml-6">
              <Text className="block text-sm text-gray-600">到店核销: 随时可退, 过期未核销自动退</Text>
            </View>
          </View>

          {/* 其他规则 */}
          <View className="mb-4">
            <View className="flex flex-row items-center gap-2 mb-2">
              <FileText size={16} color="#666" />
              <Text className="block text-sm font-medium text-gray-800">其他规则</Text>
            </View>
            <View className="ml-6 flex flex-col gap-1">
              <Text className="block text-sm text-gray-600">· 发票问题请咨询商家</Text>
              <Text className="block text-sm text-gray-600">· 预约须知: 为保证最佳体验, 请务必至少提前2小时致电预约, 并告知使用抖音套餐。</Text>
              <Text className="block text-sm text-gray-600">· 使用方式: 本套餐仅限堂食, 不提供外卖服务。</Text>
              <Text className="block text-sm text-gray-600">· 打包规则: 套餐美味建议现做现吃。如未食用完需打包, 我们将提供打包盒, 需另付包装费1元/盒。</Text>
              <Text className="block text-sm text-gray-600">· 菜品说明: 套餐为固定搭配, 恕不提供菜品更换、退减或等价替换。</Text>
              <Text className="block text-sm text-gray-600">· 温馨提示: 节假日期间不可用, 菜品图片仅供参考, 请以实际出品为准。</Text>
              <Text className="block text-sm text-gray-600">· 我们期待您的光临!</Text>
              <Text className="block text-sm text-gray-600">· 如部分菜品因时令或其他不可抗因素导致无法提供, 请联系商家协商处理, 感谢您的理解</Text>
            </View>
          </View>
        </View>

        {/* 使用方式步骤 */}
        <View className="bg-white mt-2 px-4 py-4">
          <Text className="block text-base font-bold text-gray-800 mb-4">使用方式</Text>
          <View className="flex flex-row items-center justify-between">
            <View className="flex flex-col items-center gap-2">
              <View className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center">
                <Text className="block text-lg">🛒</Text>
              </View>
              <Text className="block text-xs text-gray-600">点击购买</Text>
            </View>
            <View className="flex-1 h-1 bg-gray-200 mx-2" />
            <View className="flex flex-col items-center gap-2">
              <View className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center">
                <Text className="block text-lg">💳</Text>
              </View>
              <Text className="block text-xs text-gray-600">支付订单</Text>
            </View>
            <View className="flex-1 h-1 bg-gray-200 mx-2" />
            <View className="flex flex-col items-center gap-2">
              <View className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center">
                <Text className="block text-lg"></Text>
              </View>
              <Text className="block text-xs text-gray-600">电话预约</Text>
            </View>
            <View className="flex-1 h-1 bg-gray-200 mx-2" />
            <View className="flex flex-col items-center gap-2">
              <View className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center">
                <Text className="block text-lg">🏪</Text>
              </View>
              <Text className="block text-xs text-gray-600">到店使用</Text>
            </View>
          </View>
        </View>

        {/* 适用门店 */}
        {merchant && (
          <View className="bg-white mt-2 px-4 py-4 mb-4">
            <Text className="block text-base font-bold text-gray-800 mb-4">适用门店</Text>
            <View className="flex flex-row items-start gap-3">
              <View className="w-16 h-16 bg-gray-200 rounded-lg overflow-hidden flex-shrink-0">
                <Image src={merchant.location || ''} className="w-full h-full" mode="aspectFill" />
              </View>
              <View className="flex-1">
                <Text className="block text-base font-semibold text-gray-800">{merchant.name}</Text>
                <View className="flex flex-row items-center gap-2 mt-1">
                  <Text className="block text-xs text-gray-500">人均¥{merchant.avg_price || '88'}</Text>
                  <Text className="block text-xs text-gray-500">{merchant.business_hours || '10:30-20:30营业'}</Text>
                  <Text className="block text-xs text-gray-500">{merchant.has_private_room ? '有包厢' : ''}</Text>
                </View>
              </View>
              <View className="flex flex-col items-center gap-1">
                <Phone size={16} color="#666" />
                <Text className="block text-xs text-gray-500">联系商家</Text>
              </View>
            </View>
          </View>
        )}

        {/* 底部留白 */}
        <View className="h-4" />
      </ScrollView>

      {/* 底部购买栏 */}
      <View className="fixed bottom-0 left-0 right-0 bg-white px-4 py-3 flex flex-row items-center justify-between border-t border-gray-200" style={{ zIndex: 100 }}>
        <View className="flex flex-col">
          <Text className="block text-xs text-gray-500">到手价</Text>
          <Text className="block text-xl font-bold text-red-500">¥{currentPrice.toFixed(0)}</Text>
        </View>
        <View
          onClick={handleBuy}
          className="bg-red-500 px-8 py-3 rounded-full"
        >
          <Text className="block text-base font-semibold text-white">立即购买</Text>
        </View>
      </View>
    </View>
  )
}
