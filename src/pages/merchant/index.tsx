import { useState, useEffect, useCallback } from 'react'
import Taro, { useRouter, useShareAppMessage } from '@tarojs/taro'
import { View, Text, Image, Swiper, SwiperItem, ScrollView } from '@tarojs/components'
import { Network } from '@/network'
import { formatPrice } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Share2,
  MapPin,
  Phone,
  Navigation,
  Clock,
  Store,
  Gift,
  Images,
  Sparkles,
  Ticket,
  ChevronRight,
} from 'lucide-react-taro'

interface Merchant {
  id: number
  name: string
  logo?: string
  images?: string[]
  address?: string
  phone?: string
  business_hours?: string
  category?: string
  latitude?: string | number
  longitude?: string | number
}

interface Prize {
  id: string
  name: string
  prize_type: string
  image_url?: string
  coupon_amount?: string
  product_name?: string
  stock?: number
  validity_hours?: number
}

interface Package {
  id: string
  name: string
  price: string
  original_price?: string
  cover_image?: string
  badge?: string
  category?: string
  package_type?: string
}

const PRIZE_TYPE_MAP: Record<string, { label: string; cls: string }> = {
  free_meal: { label: '霸王餐', cls: 'bg-amber-50 text-amber-600 border-amber-200' },
  product: { label: '实物奖品', cls: 'bg-red-50 text-[#FF4757] border-red-200' },
  coupon: { label: '消费券', cls: 'bg-orange-50 text-orange-500 border-orange-200' },
}

/** 根据营业时间（如 06:00-13:00）计算当前营业状态 */
function getBusinessStatus(hours?: string): { open: boolean; text: string } {
  if (!hours) return { open: true, text: '营业时间请咨询商家' }
  const match = hours.match(/(\d{1,2}):(\d{2})\s*[-~—]\s*(\d{1,2}):(\d{2})/)
  if (!match) return { open: true, text: hours }
  const now = new Date()
  const cur = now.getHours() * 60 + now.getMinutes()
  const start = parseInt(match[1], 10) * 60 + parseInt(match[2], 10)
  const end = parseInt(match[3], 10) * 60 + parseInt(match[4], 10)
  const open = cur >= start && cur < end
  return {
    open,
    text: open ? `营业中 · ${match[3]}:${match[4]}打烊` : `休息中 · ${match[1]}:${match[2]}开始营业`,
  }
}

export default function MerchantPage() {
  const router = useRouter()
  const merchantId = Number(router.params.id || 2)
  const [merchant, setMerchant] = useState<Merchant | null>(null)
  const [prizes, setPrizes] = useState<Prize[]>([])
  const [packages, setPackages] = useState<Package[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [swiperIndex, setSwiperIndex] = useState(0)

  const env = Taro.getEnv()
  const isMiniApp = env === Taro.ENV_TYPE.WEAPP || env === Taro.ENV_TYPE.TT

  const fetchDetail = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      console.log('[Merchant] 请求商家详情', { url: `/api/merchants/${merchantId}/detail`, method: 'GET' })
      const res = await Network.request({ url: `/api/merchants/${merchantId}/detail`, method: 'GET' })
      console.log('[Merchant] 商家详情响应', res.data)
      const data = (res.data as any)?.data
      if (!data?.merchant) {
        setError('商家不存在或已下架')
        return
      }
      setMerchant(data.merchant)
      setPrizes(Array.isArray(data.prizes) ? data.prizes : [])
      setPackages(Array.isArray(data.packages) ? data.packages : [])
    } catch (e) {
      console.error('[Merchant] 商家详情请求失败', e)
      setError('加载失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }, [merchantId])

  useEffect(() => {
    fetchDetail()
  }, [fetchDetail])

  useEffect(() => {
    if (merchant?.name) {
      Taro.setNavigationBarTitle({ title: merchant.name }).catch(() => {})
    }
  }, [merchant?.name])

  // 分享：小程序端触发原生分享面板（Button openType="share"），H5 端复制链接
  useShareAppMessage(() => ({
    title: merchant ? `${merchant.name} 邀你来抽霸王餐！` : '膨胀团幸运盲盒，快来抽霸王餐！',
    path: `/pages/merchant/index?id=${merchantId}`,
    imageUrl: merchant?.images?.[0] || '',
  }))

  const handleH5Share = () => {
    if (isMiniApp) return
    const shareUrl = `${window.location.origin}${window.location.pathname}#/pages/merchant/index?id=${merchantId}`
    console.log('[Merchant] H5 分享链接', shareUrl)
    const done = () => Taro.showToast({ title: '链接已复制，快去分享吧', icon: 'success' })
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(shareUrl).then(done).catch(() => Taro.showToast({ title: shareUrl, icon: 'none', duration: 3000 }))
    } else {
      Taro.showToast({ title: shareUrl, icon: 'none', duration: 3000 })
    }
  }

  const handleNavigate = () => {
    if (!merchant?.latitude || !merchant?.longitude) {
      Taro.showToast({ title: '商家暂未提供位置', icon: 'none' })
      return
    }
    console.log('[Merchant] 打开导航', { latitude: merchant.latitude, longitude: merchant.longitude })
    Taro.openLocation({
      latitude: Number(merchant.latitude),
      longitude: Number(merchant.longitude),
      name: merchant.name,
      address: merchant.address || '',
      scale: 16,
    }).catch((e) => console.error('[Merchant] 导航打开失败', e))
  }

  const handleCall = () => {
    if (!merchant?.phone) {
      Taro.showToast({ title: '商家暂未提供电话', icon: 'none' })
      return
    }
    console.log('[Merchant] 拨打商家电话', merchant.phone)
    Taro.makePhoneCall({ phoneNumber: String(merchant.phone) }).catch((e) => console.error('[Merchant] 拨打电话失败', e))
  }

  const handleGoPackage = (pkgId: string) => {
    console.log('[Merchant] 跳转套餐详情', pkgId)
    Taro.navigateTo({ url: `/pages/package-detail/index?id=${pkgId}` }).catch((e) => console.error('[Merchant] 跳转套餐详情失败', e))
  }

  const status = getBusinessStatus(merchant?.business_hours)
  const gallery = merchant?.images?.length ? merchant.images : merchant?.logo ? [merchant.logo] : []

  return (
    <View className="min-h-screen bg-gray-50 pb-8">
      {loading ? (
        <View>
          <Skeleton className="w-full h-64 rounded-none" />
          <View className="px-4 -mt-8">
            <Skeleton className="w-full h-40 rounded-2xl" />
            <Skeleton className="w-full h-16 rounded-2xl mt-3" />
            <Skeleton className="w-full h-64 rounded-2xl mt-3" />
          </View>
        </View>
      ) : error || !merchant ? (
        <View className="flex flex-col items-center pt-32 px-8">
          <Store size={56} color="#d1d5db" />
          <Text className="block text-base text-gray-500 mt-4 text-center">{error || '商家不存在'}</Text>
          <Button className="mt-6 bg-[#FF4757] text-white rounded-full px-8" onClick={fetchDetail}>
            <Text className="text-sm">重新加载</Text>
          </Button>
        </View>
      ) : (
        <View>
          {/* 顶部图集轮播 */}
          <View className="relative w-full h-64 bg-gray-200">
            {gallery.length > 0 ? (
              <Swiper
                className="w-full h-64"
                autoplay
                circular
                interval={4000}
                onChange={(e) => setSwiperIndex(e.detail.current)}
              >
                {gallery.map((url, i) => (
                  <SwiperItem key={i}>
                    <Image src={url} className="w-full h-64" mode="aspectFill" />
                  </SwiperItem>
                ))}
              </Swiper>
            ) : (
              <View className="w-full h-64 bg-gradient-to-br from-[#FF6B81] to-[#FF4757] flex items-center justify-center">
                <Text className="text-white text-2xl font-bold tracking-widest">{merchant.name}</Text>
              </View>
            )}
            {gallery.length > 1 && (
              <View className="absolute bottom-4 right-4 bg-black bg-opacity-50 rounded-full px-3 py-1 flex flex-row items-center gap-1">
                <Images size={13} color="#ffffff" />
                <Text className="text-white text-xs">{swiperIndex + 1}/{gallery.length}</Text>
              </View>
            )}
          </View>

          {/* 商家信息卡 */}
          <View className="px-4 -mt-6 relative z-10">
            <View className="bg-white rounded-2xl p-4 shadow-sm">
              <View className="relative">
                <Text className="block text-xl font-bold text-gray-900 leading-7 pr-24">{merchant.name}</Text>
                <View className="absolute top-0 right-0 w-20 h-8">
                  {/* 视觉层：红色分享胶囊 */}
                  <View className="w-full h-8 bg-[#FF4757] rounded-full flex flex-row items-center justify-center gap-1">
                    <Share2 size={13} color="#ffffff" />
                    <Text className="text-white text-xs font-medium">分享</Text>
                  </View>
                  {/* 透明原生按钮覆盖层：小程序触发分享面板，H5 触发复制链接 */}
                  <Button
                    openType="share"
                    onClick={handleH5Share}
                    className="absolute top-0 left-0 w-full h-8 opacity-0"
                  >
                    <Text className="text-xs">分享</Text>
                  </Button>
                </View>
              </View>

              <View className="flex flex-row flex-wrap items-center gap-2 mt-3">
                {merchant.category && (
                  <Badge className="bg-gray-100 text-gray-600 border-transparent rounded-md">
                    <Text className="text-xs">{merchant.category}</Text>
                  </Badge>
                )}
                {prizes.length > 0 && (
                  <Badge className="bg-amber-50 text-amber-600 border-amber-200 rounded-md">
                    <View className="flex flex-row items-center gap-1">
                      <Sparkles size={11} color="#d97706" />
                      <Text className="text-xs">下单即可抽霸王餐</Text>
                    </View>
                  </Badge>
                )}
              </View>

              <View className="flex flex-row items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                <Clock size={14} color="#9ca3af" />
                <Text className={`text-sm ${status.open ? 'text-green-600' : 'text-gray-500'}`}>{status.text}</Text>
              </View>
            </View>
          </View>

          {/* 地址与联系 */}
          {merchant.address && (
            <View className="px-4 mt-3">
              <View className="bg-white rounded-2xl p-4 shadow-sm flex flex-row items-center">
                <View className="flex-1 flex flex-row items-start gap-2 pr-3">
                  <MapPin size={16} color="#FF4757" className="mt-1 shrink-0" />
                  <View className="flex-1">
                    <Text className="block text-sm text-gray-900 leading-5">{merchant.address}</Text>
                  </View>
                </View>
                <View className="flex flex-row gap-4 shrink-0 border-l border-gray-100 pl-4">
                  {!!merchant.latitude && !!merchant.longitude && (
                    <View className="flex flex-col items-center gap-1" onClick={handleNavigate}>
                      <View className="w-9 h-9 rounded-full bg-red-50 flex items-center justify-center">
                        <Navigation size={16} color="#FF4757" />
                      </View>
                      <Text className="text-xs text-gray-500">导航</Text>
                    </View>
                  )}
                  {!!merchant.phone && (
                    <View className="flex flex-col items-center gap-1" onClick={handleCall}>
                      <View className="w-9 h-9 rounded-full bg-red-50 flex items-center justify-center">
                        <Phone size={16} color="#FF4757" />
                      </View>
                      <Text className="text-xs text-gray-500">联系商家</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          )}

          {/* 团购套餐 */}
          <View className="px-4 mt-3">
            <View className="bg-white rounded-2xl p-4 shadow-sm">
              <View className="flex flex-row items-center justify-between">
                <View className="flex flex-row items-center gap-2">
                  <Ticket size={17} color="#FF4757" />
                  <Text className="text-base font-bold text-gray-900">团购套餐</Text>
                </View>
                <Text className="text-xs text-gray-400">下单即可参与抽奖</Text>
              </View>

              {packages.length === 0 ? (
                <View className="flex flex-col items-center py-10">
                  <Ticket size={40} color="#e5e7eb" />
                  <Text className="block text-sm text-gray-400 mt-3">暂无团购套餐，敬请期待</Text>
                </View>
              ) : (
                <View className="flex flex-col gap-3 mt-3">
                  {packages.map((pkg) => (
                    <View
                      key={pkg.id}
                      className="flex flex-row bg-gray-50 rounded-xl overflow-hidden"
                      onClick={() => handleGoPackage(pkg.id)}
                    >
                      {pkg.cover_image ? (
                        <Image src={pkg.cover_image} className="w-28 h-28 shrink-0 bg-white" mode="aspectFill" />
                      ) : (
                        <View className="w-28 h-28 shrink-0 bg-gradient-to-br from-red-100 to-orange-100 flex items-center justify-center">
                          <Ticket size={30} color="#FF4757" />
                        </View>
                      )}
                      <View className="flex-1 flex flex-col justify-between px-3 py-2 min-w-0">
                        <View>
                          <Text className="block text-base font-semibold text-gray-900 leading-6 overflow-hidden whitespace-nowrap" style={{ textOverflow: 'ellipsis' }}>{pkg.name}</Text>
                          <View className="flex flex-row flex-wrap items-center gap-2 mt-1">
                            {!!pkg.badge && (
                              <Badge className="bg-red-50 text-[#FF4757] border-red-200 rounded-md border">
                                <Text className="text-xs">{pkg.badge}</Text>
                              </Badge>
                            )}
                            {!!pkg.category && (
                              <Text className="text-xs text-gray-400">{pkg.category}</Text>
                            )}
                          </View>
                        </View>
                        <View className="flex flex-row items-end justify-between mt-2">
                          <View className="flex flex-row items-baseline gap-2">
                            <Text className="text-lg font-bold text-[#FF4757]">¥{formatPrice(pkg.price)}</Text>
                            {!!pkg.original_price && parseFloat(pkg.original_price) > parseFloat(pkg.price) && (
                              <Text className="text-xs text-gray-400 line-through">¥{formatPrice(pkg.original_price)}</Text>
                            )}
                          </View>
                          <View className="flex flex-row items-center gap-1">
                            <Text className="text-xs text-[#FF4757] font-medium">去购买</Text>
                            <ChevronRight size={14} color="#FF4757" />
                          </View>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>

          {/* 商家奖品：横向滑动卡片 */}
          <View className="mt-3">
            <View className="bg-white rounded-2xl mx-4 pt-4 pb-4 shadow-sm">
              <View className="px-4 flex flex-row items-center justify-between">
                <View className="flex flex-row items-center gap-2">
                  <Gift size={17} color="#FF4757" />
                  <Text className="text-base font-bold text-gray-900">下单抽奖 · 100%有礼</Text>
                </View>
                <Text className="text-xs text-gray-400">共 {prizes.length} 款奖品</Text>
              </View>

              {prizes.length === 0 ? (
                <View className="flex flex-col items-center py-10">
                  <Gift size={40} color="#e5e7eb" />
                  <Text className="block text-sm text-gray-400 mt-3">商家正在筹备奖品，敬请期待</Text>
                </View>
              ) : (
                <ScrollView scrollX className="mt-3 whitespace-nowrap" showScrollbar={false}>
                  <View className="flex flex-row gap-3 px-4">
                    {prizes.map((prize) => {
                      const typeInfo = PRIZE_TYPE_MAP[prize.prize_type] || { label: '奖品', cls: 'bg-gray-100 text-gray-500 border-gray-200' }
                      return (
                        <View
                          key={prize.id}
                          className="w-40 shrink-0 bg-gradient-to-b from-amber-50 to-white rounded-xl overflow-hidden border border-amber-100"
                        >
                          <View className="relative w-40 h-40 bg-white">
                            {prize.image_url ? (
                              <Image src={prize.image_url} className="w-full h-full" mode="aspectFill" />
                            ) : (
                              <View className="w-full h-full bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center">
                                <Gift size={36} color="#f59e0b" />
                              </View>
                            )}
                            <View className="absolute top-2 left-2">
                              <Badge className={`${typeInfo.cls} rounded-md border`}>
                                <Text className="text-xs">{typeInfo.label}</Text>
                              </Badge>
                            </View>
                          </View>
                          <View className="p-3">
                            <Text className="block text-sm font-semibold text-gray-900 leading-5 overflow-hidden whitespace-nowrap" style={{ textOverflow: 'ellipsis' }}>{prize.name}</Text>
                            <View className="flex flex-row flex-wrap items-center gap-2 mt-1">
                              {prize.prize_type === 'coupon' && !!prize.coupon_amount && (
                                <Text className="text-xs text-[#FF4757] font-medium">面额 ¥{parseFloat(prize.coupon_amount)}</Text>
                              )}
                              {prize.prize_type === 'product' && !!prize.product_name && (
                                <Text className="text-xs text-gray-500">{prize.product_name}</Text>
                              )}
                              {!!prize.validity_hours && (
                                <Text className="text-xs text-gray-400">{prize.validity_hours}小时有效</Text>
                              )}
                            </View>
                            <View className="flex flex-row items-center justify-between mt-2">
                              <Text className="text-xs text-amber-600 font-medium">{typeof prize.stock === 'number' ? `限量${prize.stock}份` : ''}</Text>
                              <View className="flex flex-row items-center gap-1">
                                <Text className="text-xs text-[#FF4757] font-medium">去抽奖</Text>
                                <ChevronRight size={12} color="#FF4757" />
                              </View>
                            </View>
                          </View>
                        </View>
                      )
                    })}
                  </View>
                </ScrollView>
              )}

            </View>
          </View>

          {/* 底部分享引导 */}
          <View className="px-4 mt-3">
            <View className="relative w-full h-11">
              <View className="w-full h-11 bg-white border border-[#FF4757] rounded-full flex flex-row items-center justify-center gap-2">
                <Share2 size={15} color="#FF4757" />
                <Text className="text-[#FF4757] text-sm font-medium">分享本页给好友，一起抽霸王餐</Text>
              </View>
              <Button
                openType="share"
                onClick={handleH5Share}
                className="absolute top-0 left-0 w-full h-11 opacity-0"
              >
                <Text className="text-xs">分享</Text>
              </Button>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}
