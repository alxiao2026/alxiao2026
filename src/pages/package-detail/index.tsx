import { useState, useEffect } from 'react'
import Taro, { useRouter } from '@tarojs/taro'
import { View, Text, Image } from '@tarojs/components'
import { Network } from '@/network'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ArrowLeft,
  Share2,
  Heart,
  Check,
  CircleAlert,
  Zap,
  Gift,
  ShoppingCart,
} from 'lucide-react-taro'

interface Package {
  id: string
  name: string
  description: string
  price: string
  original_price: string
  badge: string
  features: string
  is_active: boolean
}

const LOGO_URL =
  'https://coze-coding-project.tos.coze.site/coze_storage_7662281810482692131/logo_new_pengtuan_2d6e000c.png?sign=1786611400-ab636b32a4-0-481e336cec57d85a4be349e1365bbc63d2a048d78e79de1c43bc7c0cc8dbdea9'

export default function PackageDetail() {
  const router = useRouter()
  const { id } = router.params
  const [pkg, setPkg] = useState<Package | null>(null)
  const [loading, setLoading] = useState(true)
  const [liked, setLiked] = useState(false)

  useEffect(() => {
    if (id) {
      fetchPackage(id)
    }
  }, [id])

  const fetchPackage = async (packageId: string) => {
    try {
      setLoading(true)
      const res = await Network.request({
        url: `/api/packages/${packageId}`,
      })
      console.log('Package detail response:', res.data)
      if (res.data?.data) {
        setPkg(res.data.data)
      }
    } catch (error) {
      console.error('Failed to fetch package:', error)
      Taro.showToast({ title: '加载失败', icon: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const parseFeatures = (features: string): string[] => {
    if (!features) return []
    try {
      const parsed = JSON.parse(features)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return features.split('\n').filter(Boolean)
    }
  }

  const handleShare = () => {
    Taro.showToast({ title: '分享功能开发中', icon: 'none' })
  }

  const handleBuy = () => {
    if (!pkg) return
    Taro.navigateTo({
      url: `/pages/index/index?packageId=${pkg.id}&action=buy`,
    })
  }

  const features = pkg ? parseFeatures(pkg.features) : []
  const discount = pkg?.original_price
    ? Math.round((1 - parseFloat(pkg.price) / parseFloat(pkg.original_price)) * 100)
    : 0

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

  return (
    <View className="min-h-screen bg-gray-50 pb-24">
      {/* 顶部导航栏 */}
      <View
        className="fixed top-0 left-0 right-0 z-50 flex flex-row items-center justify-between px-4 py-3 bg-white shadow-sm"
        style={{ display: 'flex' }}
      >
        <View
          className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100"
          onClick={() => Taro.navigateBack()}
        >
          <ArrowLeft size={20} color="#333" />
        </View>
        <View className="flex flex-row gap-3">
          <View
            className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100"
            onClick={handleShare}
          >
            <Share2 size={18} color="#333" />
          </View>
          <View
            className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100"
            onClick={() => setLiked(!liked)}
          >
            <Heart size={18} color={liked ? '#FF4757' : '#333'} />
          </View>
        </View>
      </View>

      {/* 套餐头图 */}
      <View className="relative w-full h-64 bg-gradient-to-br from-red-500 to-orange-500">
        <Image
          src={LOGO_URL}
          className="absolute inset-0 w-full h-full opacity-20"
          mode="aspectFill"
        />
        <View className="absolute inset-0 flex items-center justify-center">
          <View className="flex flex-col items-center gap-2">
            <Image src={LOGO_URL} className="w-24 h-24" mode="aspectFit" />
            <Text className="block text-2xl font-bold text-white">{pkg.name}</Text>
            {pkg.badge && (
              <Badge className="bg-white text-red-500">{pkg.badge}</Badge>
            )}
          </View>
        </View>
      </View>

      {/* 价格信息 */}
      <View className="bg-white px-4 py-4">
        <View className="flex flex-row items-baseline gap-2">
          <Text className="block text-4xl font-bold text-red-500">¥{pkg.price}</Text>
          {pkg.original_price && (
            <>
              <Text className="block text-sm text-gray-400 line-through">¥{pkg.original_price}</Text>
              <Badge className="bg-red-100 text-red-500 text-xs">{discount}折</Badge>
            </>
          )}
        </View>
        {pkg.description && (
          <Text className="block text-sm text-gray-600 mt-2">{pkg.description}</Text>
        )}
      </View>

      {/* 套餐亮点 */}
      {features.length > 0 && (
        <View className="bg-white mt-2 px-4 py-4">
          <View className="flex flex-row items-center gap-2 mb-3">
            <Zap size={18} color="#FFA502" />
            <Text className="block text-base font-bold text-gray-800">套餐亮点</Text>
          </View>
          <View className="flex flex-col gap-2">
            {features.map((feature, i) => (
              <View key={i} className="flex flex-row items-start gap-2">
                <Check size={16} color="#10B981" className="mt-1 flex-shrink-0" />
                <Text className="block text-sm text-gray-700 flex-1">{feature}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* 抽奖说明 */}
      <View className="bg-white mt-2 px-4 py-4">
        <View className="flex flex-row items-center gap-2 mb-3">
          <Gift size={18} color="#FF4757" />
          <Text className="block text-base font-bold text-gray-800">抽奖规则</Text>
        </View>
        <View className="flex flex-col gap-3">
          <View className="flex flex-row items-start gap-2">
            <View className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
              <Text className="block text-xs font-bold text-red-500">1</Text>
            </View>
            <Text className="block text-sm text-gray-700 flex-1">
              购买本套餐后获得抽奖资格
            </Text>
          </View>
          <View className="flex flex-row items-start gap-2">
            <View className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
              <Text className="block text-xs font-bold text-red-500">2</Text>
            </View>
            <Text className="block text-sm text-gray-700 flex-1">
              分享给好友后即可参与开奖
            </Text>
          </View>
          <View className="flex flex-row items-start gap-2">
            <View className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
              <Text className="block text-xs font-bold text-red-500">3</Text>
            </View>
            <Text className="block text-sm text-gray-700 flex-1">
              100%中奖，奖品库存有限先到先得
            </Text>
          </View>
        </View>
      </View>

      {/* 使用须知 */}
      <View className="bg-white mt-2 px-4 py-4">
        <View className="flex flex-row items-center gap-2 mb-3">
          <CircleAlert size={18} color="#6B7280" />
          <Text className="block text-base font-bold text-gray-800">使用须知</Text>
        </View>
        <View className="flex flex-col gap-2">
          <Text className="block text-xs text-gray-500">• 本套餐为虚拟商品，购买后不可退款</Text>
          <Text className="block text-xs text-gray-500">• 抽奖结果以实际开奖为准</Text>
          <Text className="block text-xs text-gray-500">• 奖品发放后请在7天内领取</Text>
          <Text className="block text-xs text-gray-500">• 如有疑问请联系客服</Text>
        </View>
      </View>

      {/* 底部购买栏 */}
      <View
        className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3"
        style={{ display: 'flex', flexDirection: 'row', gap: '12px' }}
      >
        <View className="flex flex-col items-center justify-center" style={{ flexShrink: 0 }}>
          <Heart size={20} color={liked ? '#FF4757' : '#666'} />
          <Text className="block text-xs text-gray-600 mt-1">收藏</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Button
            className="w-full bg-gradient-to-r from-red-500 to-orange-500 text-white font-bold py-3 rounded-full"
            onClick={handleBuy}
          >
            <View className="flex flex-row items-center justify-center gap-2">
              <ShoppingCart size={18} color="#fff" />
              <Text className="block text-base font-bold text-white">立即购买</Text>
            </View>
          </Button>
        </View>
      </View>
    </View>
  )
}
