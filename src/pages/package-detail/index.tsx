import { useState, useEffect } from 'react'
import Taro, { useRouter } from '@tarojs/taro'
import { View, Text, Image, ScrollView } from '@tarojs/components'
import { Network } from '@/network'
import {
  ArrowLeft,
  Share2,
  MapPin,
  Phone,
  Clock,
  Check,
  Info,
  Star,
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
}

interface Merchant {
  id: string
  name: string
  address: string
  phone: string
  business_hours: string
  location?: string
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
      if (res.data) {
        setPkg(res.data)
        if (res.data.merchant_id) {
          loadMerchant(res.data.merchant_id)
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
      if (res.data) {
        setMerchant(res.data)
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

  return (
    <View className="min-h-screen bg-gray-50 pb-20">
      {/* 顶部导航 */}
      <View className="fixed top-0 left-0 right-0 z-50 bg-white px-4 py-3 flex flex-row items-center justify-between">
        <View onClick={handleBack} className="p-2">
          <ArrowLeft size={24} color="#333" />
        </View>
        <View onClick={handleShare} className="p-2">
          <Share2 size={24} color="#333" />
        </View>
      </View>

      <ScrollView scrollY className="h-screen">
        {/* 头图轮播 */}
        <View className="w-full h-64 bg-gray-200 relative">
          {pkg.cover_image ? (
            <Image src={pkg.cover_image} className="w-full h-full" mode="aspectFill" />
          ) : (
            <View className="flex items-center justify-center h-full">
              <Text className="block text-gray-400">暂无图片</Text>
            </View>
          )}
          {pkg.badge && (
            <View className="absolute top-4 left-4 bg-red-500 text-white px-3 py-1 rounded-full">
              <Text className="block text-sm">{pkg.badge}</Text>
            </View>
          )}
        </View>

        {/* 价格区域 */}
        <View className="bg-white px-4 py-4">
          <View className="flex flex-row items-baseline gap-2">
            <Text className="block text-3xl font-bold text-red-500">¥{currentPrice.toFixed(2)}</Text>
            {originalPrice > currentPrice && (
              <>
                <Text className="block text-base text-gray-400 line-through">¥{originalPrice.toFixed(2)}</Text>
                <View className="bg-red-50 px-2 py-1 rounded">
                  <Text className="block text-xs text-red-500">{discount}折</Text>
                </View>
              </>
            )}
          </View>
          <Text className="block text-base font-bold text-gray-800 mt-2">{pkg.name}</Text>
          {pkg.description && (
            <Text className="block text-sm text-gray-500 mt-1">{pkg.description}</Text>
          )}
        </View>

        {/* 套餐详情 */}
        {pkg.combinations && pkg.combinations.length > 0 && (
          <View className="bg-white mt-2 px-4 py-4">
            <View className="flex flex-row items-center gap-2 mb-3">
              <Star size={18} color="#F59E0B" />
              <Text className="block text-base font-bold text-gray-800">套餐详情</Text>
            </View>
            {pkg.combinations.map((combo: any, idx: number) => (
              <View key={idx} className="mb-4">
                <View className="flex flex-row items-center justify-between mb-2">
                  <Text className="block text-sm font-semibold text-gray-700">{combo.name}</Text>
                  {combo.select_count < combo.items.length && (
                    <Text className="block text-xs text-orange-500">
                      {combo.items.length}选{combo.select_count}
                    </Text>
                  )}
                </View>
                {combo.items.map((item: any, itemIdx: number) => (
                  <View key={itemIdx} className="flex flex-row justify-between py-2 border-b border-gray-100">
                    <View className="flex flex-row items-center gap-2 flex-1">
                      <View className="w-1 h-1 rounded-full bg-gray-400" />
                      <Text className="block text-sm text-gray-700 flex-1">{item.name}</Text>
                    </View>
                    <Text className="block text-sm text-gray-500">
                      {item.quantity}{item.unit || '份'}
                    </Text>
                    <Text className="block text-sm text-gray-700 ml-4">
                      ¥{parseFloat(item.price || '0').toFixed(2)}
                    </Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        )}

        {/* 商家信息 */}
        {merchant && (
          <View className="bg-white mt-2 px-4 py-4">
            <View className="flex flex-row items-center gap-2 mb-3">
              <MapPin size={18} color="#10B981" />
              <Text className="block text-base font-bold text-gray-800">商家信息</Text>
            </View>
            <Text className="block text-base font-semibold text-gray-800">{merchant.name}</Text>
            {merchant.address && (
              <View className="flex flex-row items-center gap-2 mt-2">
                <MapPin size={14} color="#9CA3AF" />
                <Text className="block text-sm text-gray-600">{merchant.address}</Text>
              </View>
            )}
            {merchant.phone && (
              <View className="flex flex-row items-center gap-2 mt-2">
                <Phone size={14} color="#9CA3AF" />
                <Text className="block text-sm text-gray-600">{merchant.phone}</Text>
              </View>
            )}
            {merchant.business_hours && (
              <View className="flex flex-row items-center gap-2 mt-2">
                <Clock size={14} color="#9CA3AF" />
                <Text className="block text-sm text-gray-600">{merchant.business_hours}</Text>
              </View>
            )}
          </View>
        )}

        {/* 使用须知 */}
        <View className="bg-white mt-2 px-4 py-4">
          <View className="flex flex-row items-center gap-2 mb-3">
            <Info size={18} color="#6B7280" />
            <Text className="block text-base font-bold text-gray-800">使用须知</Text>
          </View>
          <View className="flex flex-col gap-2">
            <View className="flex flex-row items-start gap-2">
              <Check size={16} color="#10B981" />
              <Text className="block text-sm text-gray-600 flex-1">
                {pkg.sale_start_date && pkg.sale_end_date
                  ? `售卖时间：${pkg.sale_start_date} 至 ${pkg.sale_end_date}`
                  : '售卖时间：长期有效'}
              </Text>
            </View>
            <View className="flex flex-row items-start gap-2">
              <Check size={16} color="#10B981" />
              <Text className="block text-sm text-gray-600 flex-1">库存：{pkg.stock}份</Text>
            </View>
            <View className="flex flex-row items-start gap-2">
              <Check size={16} color="#10B981" />
              <Text className="block text-sm text-gray-600 flex-1">
                购买后请到店出示核销码使用
              </Text>
            </View>
            <View className="flex flex-row items-start gap-2">
              <Check size={16} color="#10B981" />
              <Text className="block text-sm text-gray-600 flex-1">
                未使用可随时退款，过期自动退款
              </Text>
            </View>
          </View>
        </View>

        {/* 底部留白 */}
        <View className="h-4" />
      </ScrollView>

      {/* 底部购买栏 */}
      <View className="fixed bottom-0 left-0 right-0 bg-white px-4 py-3 flex flex-row items-center justify-between border-t border-gray-200">
        <View className="flex flex-col">
          <Text className="block text-xs text-gray-500">到手价</Text>
          <Text className="block text-xl font-bold text-red-500">¥{currentPrice.toFixed(2)}</Text>
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
