import { useState, useEffect, useCallback } from 'react'
import Taro, { useRouter, useShareAppMessage, useShareTimeline } from '@tarojs/taro'
import { View, Text, Image, Swiper, SwiperItem, ScrollView } from '@tarojs/components'
import { Network } from '@/network'
import { formatPrice, calcDistanceMeters, formatDistanceText } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import AppTabBar from '@/components/app-tab-bar'
import SharePosterModal from '@/components/share-poster-modal'
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
  Trophy,
  PartyPopper,
  ImagePlus,
  Wifi,
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
  wifi_ssid?: string
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
  probability: number
}

interface WinnerRecord {
  id: string
  prize_name: string
  user_id: string
  nick_name: string
  avatar_url: string | null
  created_at: string
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
  const [winStats, setWinStats] = useState<{ totalWins: number; freeMealWins: number }>({ totalWins: 0, freeMealWins: 0 })
  const [showPoster, setShowPoster] = useState(false)
  const [winners, setWinners] = useState<WinnerRecord[]>([])
  const [distanceText, setDistanceText] = useState('')
  const [locationDenied, setLocationDenied] = useState(false)

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
      // 奖品排序：霸王餐放第一位，其他随机
      const rawPrizes = Array.isArray(data.prizes) ? data.prizes : []
      const freeMeal = rawPrizes.filter(p => p.prize_type === 'free_meal')
      const others = rawPrizes.filter(p => p.prize_type !== 'free_meal')
      // 其他奖品随机排序
      for (let i = others.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[others[i], others[j]] = [others[j], others[i]]
      }
      setPrizes([...freeMeal, ...others])
      setPackages(Array.isArray(data.packages) ? data.packages : [])
      setWinStats({
        totalWins: Number(data.winStats?.totalWins) || 0,
        freeMealWins: Number(data.winStats?.freeMealWins) || 0,
      })
    } catch (e) {
      console.error('[Merchant] 商家详情请求失败', e)
      setError('加载失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }, [merchantId])

  const fetchWinners = useCallback(async () => {
    try {
      const res = await Network.request({
        url: `/api/lottery/winners?merchant_id=${merchantId}`,
        method: 'GET',
      })
      const list = (res.data as any)?.data || res.data || []
      setWinners(Array.isArray(list) ? list : [])
    } catch (err) {
      console.error('[Merchant] 获取中奖记录失败:', err)
    }
  }, [merchantId])

  useEffect(() => {
    fetchDetail()
    fetchWinners()
  }, [fetchDetail, fetchWinners])

  useEffect(() => {
    if (merchant?.name) {
      Taro.setNavigationBarTitle({ title: merchant.name }).catch(() => {})
    }
  }, [merchant?.name])

  // 商家有坐标时，获取消费者定位并计算与门店的距离
  const fetchDistance = useCallback(() => {
    if (!merchant?.latitude || !merchant?.longitude) {
      setDistanceText('')
      setLocationDenied(false)
      return
    }
    console.log('[Merchant] 获取用户定位以计算距离')
    Taro.getLocation({
      type: 'gcj02',
      success: (loc) => {
        const d = calcDistanceMeters(
          Number(loc.latitude),
          Number(loc.longitude),
          Number(merchant.latitude),
          Number(merchant.longitude)
        )
        const text = formatDistanceText(d)
        console.log('[Merchant] 距离计算完成', { meters: Math.round(d), text })
        setDistanceText(text)
        setLocationDenied(false)
      },
      fail: (e) => {
        // 常见失败：用户拒绝授权 auth deny / 隐私协议未声明 / H5 预览环境无定位
        console.error('[Merchant] 获取用户定位失败:', (e as any)?.errMsg || e)
        setDistanceText('')
        setLocationDenied(true)
      },
    })
  }, [merchant?.latitude, merchant?.longitude])

  useEffect(() => {
    fetchDistance()
  }, [fetchDistance])

  /** 定位被拒时引导用户打开设置页授权，成功后重新计算距离 */
  const handleEnableLocation = () => {
    if (!isMiniApp) {
      Taro.showToast({ title: 'H5 预览不支持定位，请在小程序中查看距离', icon: 'none' })
      return
    }
    Taro.openSetting({
      success: (res) => {
        if (res.authSetting?.['scope.userLocation']) {
          setLocationDenied(false)
          fetchDistance()
        }
      },
    }).catch((e) => console.error('[Merchant] 打开设置页失败', e))
  }

  // 分享：小程序端触发原生分享面板（Button openType="share"），H5 端复制链接
  useShareAppMessage(() => ({
    title: merchant ? `${merchant.name} 邀你来抽霸王餐！` : '膨胀团幸运盲盒，快来抽霸王餐！',
    path: `/pages/merchant/index?id=${merchantId}`,
    imageUrl: merchant?.images?.[0] || '',
  }))

  // 分享到朋友圈
  useShareTimeline(() => ({
    title: merchant ? `${merchant.name} 邀你来抽霸王餐！` : '膨胀团幸运盲盒，快来抽霸王餐！',
    query: `id=${merchantId}`,
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
    <>
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
          {/* 顶部图集轮播：完整展示不裁切，深色底衬托，点击可放大预览 */}
          <View className="relative w-full h-72 bg-gray-900">
            {gallery.length > 0 ? (
              <Swiper
                className="w-full h-72"
                autoplay
                circular
                interval={4000}
                onChange={(e) => setSwiperIndex(e.detail.current)}
              >
                {gallery.map((url, i) => (
                  <SwiperItem key={i}>
                    <Image
                      src={url}
                      className="w-full h-64"
                      mode="aspectFill"
                      onClick={() => Taro.previewImage({ current: url, urls: gallery })}
                    />
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

              {/* 中奖榜单标签（黄色榜单位） */}
              <View className="flex flex-row flex-wrap items-center gap-2 mt-3">
                <View className="flex flex-row items-center gap-1 bg-amber-50 rounded-md px-2 py-1">
                  <PartyPopper size={12} color="#d97706" />
                  <Text className="text-xs text-amber-600 font-medium">累计中奖 {winStats.totalWins} 次</Text>
                </View>
                <View className="flex flex-row items-center gap-1 bg-amber-50 rounded-md px-2 py-1">
                  <Trophy size={12} color="#d97706" />
                  <Text className="text-xs text-amber-600 font-medium">中霸王餐 {winStats.freeMealWins} 次</Text>
                </View>
              </View>

              {/* 门店历史中奖记录（两条一组垂直滚动，年轻活泼风格） */}
              {winners.length > 0 && (
                <View
                  className="mt-3 rounded-2xl px-2 py-2 overflow-hidden"
                  style={{ background: 'linear-gradient(135deg, #FFF0F5 0%, #F3E8FF 50%, #EFF6FF 100%)' }}
                >
                  <Swiper
                    vertical
                    autoplay
                    circular
                    interval={3000}
                    duration={500}
                    className="h-20"
                  >
                    {Array.from({ length: Math.ceil(winners.length / 2) }).map((_, groupIdx) => (
                      <SwiperItem key={groupIdx}>
                        <View className="flex flex-col gap-1">
                          {winners.slice(groupIdx * 2, groupIdx * 2 + 2).map((winner) => (
                            <View
                              key={winner.id}
                              className="flex flex-row items-center gap-2 h-9 bg-white rounded-full px-2 shadow-sm"
                            >
                              <Avatar className="w-5 h-5 shrink-0">
                                {winner.avatar_url && <AvatarImage src={winner.avatar_url} />}
                                <AvatarFallback className="text-xs">{(winner.nick_name || '匿')[0]}</AvatarFallback>
                              </Avatar>
                              <Text className="flex-1 text-xs text-gray-700 truncate">
                                {winner.nick_name || '匿名用户'}
                                <Text className="text-pink-500"> 抽中 </Text>
                                {winner.prize_name}
                              </Text>
                              <Text className="text-xs text-gray-400 shrink-0">
                                {winner.created_at?.slice(5, 10)}
                              </Text>
                            </View>
                          ))}
                        </View>
                      </SwiperItem>
                    ))}
                  </Swiper>
                </View>
              )}

              {/* 营业状态 */}
              <View className="flex flex-row items-center gap-2 mt-3">
                <Clock size={14} color="#9ca3af" />
                <Text className={`text-sm ${status.open ? 'text-green-600' : 'text-gray-500'}`}>{status.text}</Text>
              </View>

              {/* 分隔线 + 地址行（右侧导航/联系圆形按钮） */}
              {merchant.address && (
                <View className="flex flex-row items-center mt-3 pt-3 border-t border-gray-100">
                  <View className="flex-1 flex flex-row items-start gap-2 pr-3" onClick={handleNavigate}>
                    <MapPin size={16} color="#FF4757" className="mt-1 shrink-0" />
                    <View className="flex-1">
                      <Text className="text-sm text-gray-900 leading-5">{merchant.address}</Text>
                      {!!distanceText && (
                        <Text className="block text-xs text-orange-500 mt-1">{distanceText} · 点击导航到店</Text>
                      )}
                      {!distanceText && locationDenied && !!merchant.latitude && !!merchant.longitude && (
                        <Text
                          className="block text-xs text-blue-500 mt-1"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleEnableLocation()
                          }}
                        >
                          定位未授权 · 点击开启后查看距离
                        </Text>
                      )}
                    </View>
                  </View>
                  <View className="flex flex-row gap-4 shrink-0">
                    {!!merchant.latitude && !!merchant.longitude && (
                      <View className="flex flex-col items-center gap-1" onClick={handleNavigate}>
                        <View className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
                          <Navigation size={16} color="#374151" />
                        </View>
                        <Text className="text-xs text-gray-500">导航</Text>
                      </View>
                    )}
                    {!!merchant.phone && (
                      <View className="flex flex-col items-center gap-1" onClick={handleCall}>
                        <View className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
                          <Phone size={16} color="#374151" />
                        </View>
                        <Text className="text-xs text-gray-500">联系商家</Text>
                      </View>
                    )}
                  </View>
                </View>
              )}

              {/* 链接店内WiFi 入口（商家已配置时展示，置于门店地址下方） */}
              {!!merchant?.wifi_ssid && (
                <View
                  className="flex flex-row items-center justify-between mt-3 rounded-2xl px-4 py-3"
                  style={{ background: 'linear-gradient(135deg, #FF4757 0%, #FF7A59 55%, #FFA502 100%)', boxShadow: '0 8px 20px rgba(255,71,87,0.28)' }}
                  onClick={() => {
                    console.log('[Merchant] 进入店内WiFi模块', merchant.id)
                    Taro.navigateTo({ url: `/pages/wifi/index?merchantId=${merchant.id}&name=${encodeURIComponent(merchant.name)}` })
                      .catch((e) => console.error('[Merchant] 跳转WiFi页失败', e))
                  }}
                >
                  <View className="flex flex-row items-center gap-3">
                    <View className="rounded-full flex items-center justify-center" style={{ width: 38, height: 38, background: 'rgba(255,255,255,0.25)' }}>
                      <Wifi size={20} color="#fff" strokeWidth={2.5} />
                    </View>
                    <View>
                      <View className="flex flex-row items-center gap-2">
                        <Text className="text-base font-black text-white">链接店内WiFi</Text>
                        <View className="px-2 py-1 rounded-full" style={{ backgroundColor: '#2ED573' }}>
                          <Text className="text-xs font-bold" style={{ color: '#fff', lineHeight: 1 }}>FREE</Text>
                        </View>
                      </View>
                      <Text className="block text-xs mt-1" style={{ color: 'rgba(255,255,255,0.85)' }}>一键免费上网 · {merchant.wifi_ssid}</Text>
                    </View>
                  </View>
                  <ChevronRight size={18} color="rgba(255,255,255,0.9)" />
                </View>
              )}
            </View>
          </View>

          {/* 商家奖品：横向滑动卡片（下单抽奖，置于团购套餐上方） */}
          <View className="mt-3 mx-5">
            {/* 渐变背景容器 */}
            <View
              className="rounded-2xl pt-3 pb-3 px-3 shadow-md"
              style={{ background: 'linear-gradient(135deg, #E8D5F2 0%, #D4B8E8 50%, #C9A8E8 100%)' }}
            >
              {/* 标题行 */}
              <View className="flex flex-row items-center justify-between mb-3">
                <View className="flex flex-row items-center gap-2">
                  <Sparkles size={16} color="#5B3A8C" className="shrink-0" />
                  <Text className="text-sm font-bold text-[#5B3A8C]">下单抽奖 · 100%有礼</Text>
                </View>
                <View className="bg-white bg-opacity-30 rounded-full px-2 py-0">
                  <Text className="text-xs text-[#5B3A8C] font-medium">共 {prizes.length} 款</Text>
                </View>
              </View>

              {prizes.length === 0 ? (
                <View className="flex flex-col items-center py-6">
                  <Gift size={32} color="rgba(255,255,255,0.6)" />
                  <Text className="block text-sm text-gray-200 mt-2">商家正在筹备奖品，敬请期待</Text>
                </View>
              ) : (
                <ScrollView
                  scrollX
                  className="w-full whitespace-nowrap"
                  style={{ whiteSpace: 'nowrap' }}
                >
                  <View className="flex flex-row gap-1 px-0">
                    {prizes.map((prize) => (
                      <View
                        key={prize.id}
                        className="flex-1 bg-white rounded-lg overflow-hidden shadow-sm"
                        style={{ minWidth: '32%', maxWidth: '34%' }}
                      >
                        <View className="h-18 bg-gray-50 flex items-center justify-center relative">
                          {prize.image_url ? (
                            <Image src={prize.image_url} className="w-full h-full" mode="aspectFill" />
                          ) : (
                            <Gift size={24} color="#FF6B9D" />
                          )}
                          {prize.prize_type === 'free_meal' && (
                            <View className="absolute top-1 left-1 bg-gradient-to-r from-orange-400 to-red-400 rounded-full px-1 py-0">
                              <Text className="text-white text-xs font-bold">霸王餐</Text>
                            </View>
                          )}
                        </View>
                        <View className="py-1 px-2">
                          <Text className="block text-xs font-bold text-gray-800 text-center truncate">{prize.name}</Text>
                          <Text className="block text-xs text-[#FF6B6B] text-center mt-1">中奖概率 {prize.probability}%</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </ScrollView>
              )}
            </View>
          </View>

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
                          {/* 抽奖提示（红色背景） */}
                          <View className="flex flex-row mt-1">
                            <View className="bg-[#FF4757] rounded-full px-3 py-1">
                              <Text className="block text-xs text-white font-semibold">下单抽霸王餐</Text>
                            </View>
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
            {/* 生成分享海报 */}
            <View
              className="w-full h-11 mt-2 bg-gradient-to-r from-[#FF6B81] to-[#FF4757] rounded-full flex flex-row items-center justify-center gap-2"
              onClick={() => {
                if (!isMiniApp) {
                  Taro.showToast({ title: '请在小程序中生成分享海报', icon: 'none' })
                  return
                }
                setShowPoster(true)
              }}
            >
              <ImagePlus size={15} color="#ffffff" />
              <Text className="text-white text-sm font-medium">生成分享海报（含小程序码）</Text>
            </View>
          </View>

          {/* 分享海报弹层 */}
          <SharePosterModal
            visible={showPoster}
            onClose={() => setShowPoster(false)}
            coverUrl={merchant?.images?.[0] || merchant?.logo || null}
            title={merchant?.name || ''}
            subtitle={merchant?.address || ''}
            pageParams={{ id: String(merchantId), inviter: Taro.getStorageSync('user_id') || '' }}
            page="pages/merchant/index"
          />

          {/* 底部文案 */}
          <View className="py-4 text-center">
            <Text className="block text-sm text-gray-400">- 给生活来点小惊喜 -</Text>
          </View>

          {/* 底部占位避免被导航栏遮挡 */}
          <View className="h-20" />
        </View>
      )}
    </View>
    <AppTabBar current="/pages/merchant/index" />
  </>
  )
}
