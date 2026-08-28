import { useState, useEffect, useCallback } from 'react'
import Taro, { useRouter, useDidShow, useShareAppMessage, useShareTimeline } from '@tarojs/taro'
import { View, Text, Image, ScrollView } from '@tarojs/components'
import { Network } from '@/network'
import SharePosterModal from '@/components/share-poster-modal'
import { TuantuanLoader, TuantuanEmpty } from '@/components/tuantuan-loader'
import { formatPrice, calcDistanceMeters, formatDistanceText } from '@/lib/utils'
import { buildPackageShare, buildBrandShare, trackShare } from '@/lib/share'
import {
  Phone,
  Clock,
  Check,
  Info,
  Calendar,
  Gift,
  RefreshCw,
  FileText,
  Minus,
  Plus,
  X,
  Sparkles,
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
  // 交易规则
  purchase_limit?: number
  purchase_limit_type?: string
  purchase_limit_per_day?: number
  purchase_limit_per_month?: number
  valid_days?: number
  valid_from_purchase?: boolean
  valid_date_type?: string
  valid_date_start?: string
  valid_date_end?: string
  unavailable_dates?: any
  unavailable_date_type?: string
  unavailable_weekdays?: any
  unavailable_holidays?: any
  available_time_type?: string
  available_time_start?: string
  available_time_end?: string
  limit_usage_count?: boolean
  usage_count_limit?: number
  need_reservation?: boolean
  reservation_hours?: number
  // 消费规则
  other_discount?: string
  private_room?: string
  dine_in_type?: string
  has_extra_fee?: boolean
  extra_fees?: any
  other_notes?: string
}

interface Merchant {
  id: string
  name: string
  address: string
  phone: string
  business_hours: string
  location?: string
  logo?: string
  images?: string[]
  avg_price?: string
  has_private_room?: boolean
  latitude?: string | number
  longitude?: string | number
}

interface Prize {
  id: string
  name: string
  prize_type: string
  image_url?: string
  coupon_amount?: number
  product_name?: string
  validity_hours?: number
  stock?: number
  probability?: number
}

export default function PackageDetail() {
  const router = useRouter()
  const { id } = router.params
  const [pkg, setPkg] = useState<Package | null>(null)
  const [merchant, setMerchant] = useState<Merchant | null>(null)
  const [prizes, setPrizes] = useState<Prize[]>([])
  const [loading, setLoading] = useState(true)
  const [distanceText, setDistanceText] = useState('')
  const [locationDenied, setLocationDenied] = useState(false)
  const [showPoster, setShowPoster] = useState(false)
  const isMiniApp = [Taro.ENV_TYPE.WEAPP as string, Taro.ENV_TYPE.TT as string].includes(Taro.getEnv())

  // 每次页面显示时重新加载，确保门店等后台数据变更后展示最新内容
  useDidShow(() => {
    if (id) {
      loadPackage()
    }
  })

  // 转发给朋友：文案由分享引擎按团购内容自动生成（价格锚点/销量钩子，20 字左右），封面用头图+品牌底图兜底
  useShareAppMessage(() => {
    const share = pkg
      ? buildPackageShare(pkg, 'share')
      : buildBrandShare(null, 'share')
    trackShare('package', pkg?.id || id || '', { page: 'pages/package-detail/index', template: share.title })
    return {
      title: share.title,
      path: `/pages/package-detail/index?id=${id || ''}`,
      imageUrl: share.imageUrl,
    }
  })

  // 分享到朋友圈：文案同引擎生成，封面 1:1 底图
  useShareTimeline(() => {
    const share = pkg
      ? buildPackageShare(pkg, 'square')
      : buildBrandShare(null, 'square')
    return {
      title: share.title,
      query: `id=${id || ''}`,
      imageUrl: share.imageUrl,
    }
  })

  const loadPackage = async () => {
    try {
      // 重新加载前先清空商家信息，避免展示过期数据
      setMerchant(null)
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
        url: `/api/merchants/${merchantId}/detail`,
      })
      const data = res.data?.data || res.data
      if (data) {
        setMerchant(data.merchant)
        // 奖品排序：霸王餐优先，其他随机
        const sortedPrizes = [...(data.prizes || [])].sort((a, b) => {
          const aIsFreeMeal = a.prize_type === 'free_meal' ? 1 : 0
          const bIsFreeMeal = b.prize_type === 'free_meal' ? 1 : 0
          if (aIsFreeMeal !== bIsFreeMeal) return bIsFreeMeal - aIsFreeMeal
          return Math.random() - 0.5
        })
        setPrizes(sortedPrizes)
      }
    } catch (err) {
      console.error('加载商家失败:', err)
    }
  }

  // 商家有坐标时，获取消费者定位并计算与门店的距离
  const fetchDistance = useCallback(() => {
    if (!merchant?.latitude || !merchant?.longitude) {
      setDistanceText('')
      setLocationDenied(false)
      return
    }
    console.log('[PackageDetail] 获取用户定位以计算距离')
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
        console.log('[PackageDetail] 距离计算完成', { meters: Math.round(d), text })
        setDistanceText(text)
        setLocationDenied(false)
      },
      fail: (e) => {
        console.error('[PackageDetail] 获取用户定位失败:', (e as any)?.errMsg || e)
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
    }).catch((e) => console.error('[PackageDetail] 打开设置页失败', e))
  }

  const [buying, setBuying] = useState(false)
  const [showPurchaseModal, setShowPurchaseModal] = useState(false)
  const [quantity, setQuantity] = useState(1)
  const [checking, setChecking] = useState(false)
  const [checkResult, setCheckResult] = useState<{ can_buy: boolean; reason?: string; remaining?: number } | null>(null)

  // 打开购买确认弹窗
  const handleBuy = () => {
    const isLoggedIn = Taro.getStorageSync('is_logged_in');
    if (!isLoggedIn) {
      Taro.showModal({
        title: '提示',
        content: '请先登录后再下单购买',
        confirmText: '去登录',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm) {
            Taro.navigateTo({ url: '/pages/login/index' });
          }
        },
      });
      return;
    }
    if (!pkg) return
    setQuantity(1)
    setCheckResult(null)
    setShowPurchaseModal(true)
    checkPurchase(1)
  }

  // 校验购买条件
  const checkPurchase = async (qty: number) => {
    if (!pkg) return
    setChecking(true)
    try {
      const userId = Taro.getStorageSync('user_id')
      if (!userId) {
        setChecking(false)
        setCheckResult({ can_buy: false, reason: '请先登录后再下单购买' })
        return
      }
      const res = await Network.request({
        url: '/api/orders/check-purchase',
        method: 'POST',
        data: { user_id: userId, package_id: pkg.id, quantity: qty },
      })
      console.log('[PackageDetail] 购买校验响应:', res.data)
      const data = res.data?.data || res.data
      setCheckResult(data)
    } catch (err) {
      console.error('[PackageDetail] 购买校验失败:', err)
      setCheckResult({ can_buy: true })
    } finally {
      setChecking(false)
    }
  }

  // 修改份数时重新校验
  const handleQuantityChange = (delta: number) => {
    const newQty = Math.max(1, quantity + delta)
    setQuantity(newQty)
    checkPurchase(newQty)
  }

  // 确认购买
  const handleConfirmBuy = async () => {
    if (!pkg || buying) return

    // 如果校验结果不可购买，提示原因
    if (checkResult && !checkResult.can_buy) {
      Taro.showModal({ title: '无法购买', content: checkResult.reason || '不满足购买条件', showCancel: false })
      return
    }

    setBuying(true)
    try {
      const userId = Taro.getStorageSync('user_id')
      if (!userId) {
        setBuying(false)
        Taro.showModal({ title: '请先登录', content: '登录后才能下单购买', showCancel: false })
        return
      }
      const nickName = Taro.getStorageSync('nick_name') || ''

      console.log('[PackageDetail] 创建订单, package:', pkg.name, 'price:', pkg.price, 'quantity:', quantity)
      const res = await Network.request({
        url: '/api/orders',
        method: 'POST',
        data: {
          user_id: userId,
          nick_name: nickName,
          package_id: pkg.id,
          package_name: pkg.name,
          price: String(pkg.price),
          original_price: pkg.original_price ? String(pkg.original_price) : undefined,
          shop_name: merchant?.name || undefined,
          quantity,
        },
      })
      console.log('[PackageDetail] 创建订单响应:', res.data)
      const orderData = res.data?.data || res.data
      if (orderData?.id) {
        setShowPurchaseModal(false)
        // 下单成功（待支付），直接跳订单详情页完成支付，无需弹窗
        Taro.navigateTo({ url: `/pages/order-detail/index?id=${orderData.id}` })
      } else {
        Taro.showModal({
          title: '提示',
          content: '下单失败，请稍后重试',
          showCancel: false,
        })
      }
    } catch (err) {
      console.error('[PackageDetail] 购买失败:', err)
      Taro.showModal({
        title: '提示',
        content: '您还未支付，支付成功即可参与膨胀活动',
        showCancel: false,
      })
    } finally {
      setBuying(false)
    }
  }

  if (loading) {
    return (
      <View className="flex items-center justify-center h-screen bg-gray-50">
        <TuantuanLoader size={112} />
      </View>
    )
  }

  if (!pkg) {
    return (
      <View className="flex items-center justify-center h-screen bg-gray-50">
        <TuantuanEmpty title="套餐不存在或已下架" desc="晚点再来看看，好东西不等人哦~" size={112} />
      </View>
    )
  }

  const currentPrice = parseFloat(String(pkg.price || 0)) || 0

  // 计算套餐原价（合计价）- 与管理页逻辑一致：几选几取前N个最高价商品
  const originalPrice = (pkg.combinations || []).reduce((sum, combo) => {
    const items = combo.items || []
    // 全选：直接累加所有商品
    if (combo.select_count === items.length) {
      return sum + items.reduce((itemSum, item) => {
        return itemSum + (parseFloat(String(item.price || 0)) * (Number(item.quantity) || 1))
      }, 0)
    }
    // 几选几：按商品总价（单价×份数）从高到低排序，取前 select_count 个商品
    const sortedItems = [...items].sort((a, b) => {
      const totalA = (parseFloat(String(a.price || 0))) * (Number(a.quantity) || 1)
      const totalB = (parseFloat(String(b.price || 0))) * (Number(b.quantity) || 1)
      return totalB - totalA
    })
    return sum + sortedItems.slice(0, combo.select_count).reduce((itemSum, item) => {
      return itemSum + (parseFloat(String(item.price || 0)) * (Number(item.quantity) || 1))
    }, 0)
  }, 0)

  // 合并所有图片（兼容 environment_images 为 JSON 字符串的情况）
  const envImages: string[] = (() => {
    if (Array.isArray(pkg.environment_images)) return pkg.environment_images
    if (typeof pkg.environment_images === 'string') {
      try { return JSON.parse(pkg.environment_images) } catch { return [] }
    }
    return []
  })()
  const allImages = [
    ...(pkg.cover_image ? [pkg.cover_image] : []),
    ...envImages
  ]

  return (
    <View className="min-h-screen bg-gray-50 pb-24">
      <ScrollView scrollY className="h-screen">
        {/* 头图：点击可放大预览 */}
        <View className="w-full h-72 bg-gray-100 relative">
          {allImages.length > 0 ? (
            <Image
              src={allImages[0]}
              className="w-full h-full"
              mode="aspectFill"
              onClick={() => Taro.previewImage({ current: allImages[0], urls: allImages })}
            />
          ) : (
            <View className="flex items-center justify-center h-full">
              <Text className="block text-gray-400">暂无图片</Text>
            </View>
          )}
        </View>

        {/* 套餐名称 */}
        <View className="bg-white px-4 py-3">
          <Text className="block text-lg font-bold text-gray-800">{pkg.name}</Text>
        </View>

        {/* 服务标签 + 使用须知 + 门店信息 - 紧凑排版 */}
        <View className="bg-white px-4 py-2">
          {/* 服务标签 */}
          <View className="flex flex-row items-center gap-2 py-2 border-b border-gray-100">
            <Text className="block text-xs text-gray-400 w-10">服务</Text>
            <View className="flex flex-row items-center gap-3 flex-1 flex-wrap">
              <Text className="block text-xs text-gray-600">随时退</Text>
              <Text className="block text-xs text-gray-600">过期自动退</Text>
              <Text className="block text-xs text-gray-600">可赠送好友</Text>
            </View>
          </View>

          {/* 使用须知 */}
          <View className="flex flex-row items-start gap-2 py-2 border-b border-gray-100">
            <Text className="block text-xs text-gray-400 w-10 mt-1">须知</Text>
            <View className="flex flex-row items-center gap-3 flex-1 flex-wrap flex-1">
              {/* 不可用日期 */}
              {pkg.unavailable_date_type === 'partial' && (
                <Text className="block text-xs text-gray-600">
                  {pkg.unavailable_weekdays && Array.isArray(pkg.unavailable_weekdays) && pkg.unavailable_weekdays.length > 0
                    ? `每周：${pkg.unavailable_weekdays.map((d: number) => ['日', '一', '二', '三', '四', '五', '六'][d]).join('、')}不可用`
                    : '部分日期不可用'}
                </Text>
              )}
              {pkg.unavailable_date_type === 'all' && (
                <Text className="block text-xs text-gray-600">全周可用</Text>
              )}
              {!pkg.unavailable_date_type && (
                <Text className="block text-xs text-gray-600">全周可用</Text>
              )}
              {/* 限购规则 - 仅在限制购买模式下显示 */}
              {pkg.purchase_limit_type === 'limited' && (pkg.purchase_limit || 0) > 0 && (
                <Text className="block text-xs text-gray-600">每人限购{pkg.purchase_limit}份</Text>
              )}
              {pkg.purchase_limit_type === 'limited' && (pkg.purchase_limit_per_day || 0) > 0 && (
                <Text className="block text-xs text-gray-600">每人每天限购{pkg.purchase_limit_per_day}份</Text>
              )}
              {pkg.purchase_limit_type === 'limited' && (pkg.purchase_limit_per_month || 0) > 0 && (
                <Text className="block text-xs text-gray-600">每人每月限购{pkg.purchase_limit_per_month}份</Text>
              )}
              {/* 限制使用张数 */}
              {pkg.limit_usage_count && (pkg.usage_count_limit || 0) > 0 && (
                <Text className="block text-xs text-gray-600">每桌限用{pkg.usage_count_limit}张券</Text>
              )}
              {/* 预约规则 */}
              {pkg.need_reservation && (
                <Text className="block text-xs text-gray-600">
                  {pkg.reservation_hours ? `至少提前${pkg.reservation_hours}小时预约` : '需提前预约'}
                </Text>
              )}
              {/* 使用方式 */}
              {pkg.dine_in_type === 'dine_in' && (
                <Text className="block text-xs text-gray-600">仅堂食</Text>
              )}
              {pkg.dine_in_type === 'takeout' && (
                <Text className="block text-xs text-gray-600">仅外带</Text>
              )}
              {pkg.dine_in_type === 'both' && (
                <Text className="block text-xs text-gray-600">堂食外带均可</Text>
              )}
            </View>
          </View>

          {/* 门店信息 */}
          {merchant && (
            <View className="flex flex-row items-center gap-2 py-2">
              <Text className="block text-xs text-gray-400 w-10">门店</Text>
              <View className="flex flex-row items-center gap-2 flex-1">
                {!!distanceText && (
                  <Text className="block text-xs text-gray-600">{distanceText}</Text>
                )}
                {!distanceText && locationDenied && !!merchant.latitude && !!merchant.longitude && (
                  <Text className="block text-xs text-blue-500" onClick={handleEnableLocation}>
                    定位未授权 · 点击开启后查看距离
                  </Text>
                )}
                <Text className="block text-xs text-gray-700 font-medium">{merchant.name}</Text>
              </View>
            </View>
          )}
        </View>

        {/* 奖品展示栏 */}
        {prizes.length > 0 && (
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
            </View>
          </View>
        )}

        {/* 团购详情 */}
        {pkg.combinations && Array.isArray(pkg.combinations) && pkg.combinations.length > 0 && (
          <View className="bg-white mt-2 px-4 py-4">
            <Text className="block text-base font-bold text-gray-800 mb-3">团购详情</Text>
            {pkg.combinations.map((combo: any, idx: number) => (
              <View key={idx} className="mb-4">
                {/* 商品组标题行 */}
                <View className="flex flex-row items-center gap-2 mb-2">
                  <Text className="block text-base font-bold text-gray-800">{combo.name}</Text>
                  {combo.select_count > 0 && combo.items.length > 0 && (
                    <View className="bg-red-50 px-2 py-1 rounded">
                      <Text className="block text-xs text-[#FF4757]">
                        {combo.items.length}选{combo.select_count}
                      </Text>
                    </View>
                  )}
                </View>
                {/* 商品列表 */}
                {combo.items.map((item: any, itemIdx: number) => (
                  <View key={itemIdx} className="flex flex-row items-center py-1">
                    <View className="w-1 h-1 rounded-full bg-gray-400 mr-2" />
                    <Text className="block text-sm text-gray-800 flex-1">{item.name}</Text>
                    <Text className="block text-sm text-gray-400 mr-4">
                      {item.quantity}{item.unit || '份'}
                    </Text>
                    <Text className="block text-sm text-gray-700">
                      ¥{item.price || 0}
                    </Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        )}

        {/* 图片详情：完整展示不裁切，点击可放大预览 */}
        {allImages.length > 1 && (
          <View className="bg-white mt-2 px-4 py-4">
            <Text className="block text-base font-bold text-gray-800 mb-4">图片详情</Text>
            <View className="flex flex-col gap-3">
              {allImages.map((img: string, idx: number) => (
                <View key={idx} className="w-full h-52 rounded-lg bg-gray-100 overflow-hidden">
                  <Image
                    src={img}
                    className="w-full h-full"
                    mode="aspectFill"
                    onClick={() => Taro.previewImage({ current: img, urls: allImages })}
                  />
                </View>
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
                {pkg.valid_date_type === 'date_range' && pkg.valid_date_start && pkg.valid_date_end
                  ? `${pkg.valid_date_start} 至 ${pkg.valid_date_end}`
                  : `自购买次日起${pkg.valid_days || 60}天${pkg.valid_from_purchase ? ', 购买当天默认可用' : ''}`}
              </Text>
            </View>
          </View>

          {/* 不可用日期 */}
          {pkg.unavailable_date_type === 'partial' && (
            <View className="mb-4">
              <View className="flex flex-row items-center gap-2 mb-2">
                <Calendar size={16} color="#666" />
                <Text className="block text-sm font-medium text-gray-800">不可用日期</Text>
              </View>
              <View className="ml-6 flex flex-col gap-1">
                {pkg.unavailable_weekdays && Array.isArray(pkg.unavailable_weekdays) && pkg.unavailable_weekdays.length > 0 && (() => {
                  const weekdayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
                  const names = pkg.unavailable_weekdays.map((d: number) => weekdayNames[d] || `周${d}`)
                  return <Text className="block text-sm text-gray-600">· 每周：{names.join('、')}不可用</Text>
                })()}
                {pkg.unavailable_holidays && Array.isArray(pkg.unavailable_holidays) && pkg.unavailable_holidays.length > 0 && (() => {
                  const holidayMap: Record<string, { name: string; date: string }> = {
                    'qixi': { name: '七夕节', date: '2026.08.19' },
                    'zhongqiu': { name: '中秋节', date: '2026.09.25 ~ 2026.09.27' },
                    'guoqing': { name: '国庆节', date: '2026.10.01 ~ 2026.10.07' },
                    'shengdan': { name: '圣诞节', date: '2026.12.25' },
                    'yuandan': { name: '元旦', date: '2027.01.01' },
                    'chunjie': { name: '春节', date: '2027.01.28 ~ 2027.02.03' }
                  }
                  const names = pkg.unavailable_holidays.map((h: string) => {
                    const holiday = holidayMap[h]
                    return holiday ? `${holiday.name}(${holiday.date})` : h
                  })
                  return (
                    <View className="flex gap-1">
                      <Text className="block text-sm text-gray-600">· 节假日：</Text>
                      <Text className="block text-sm text-gray-600 flex-1">{names.join('、')}不可用</Text>
                    </View>
                  )
                })()}
                {pkg.unavailable_dates && Array.isArray(pkg.unavailable_dates) && pkg.unavailable_dates.length > 0 && (() => {
                  const formatDate = (dateStr: string) => {
                    const date = new Date(dateStr)
                    return `${date.getMonth() + 1}月${date.getDate()}日`
                  }
                  const dates = pkg.unavailable_dates.map((d: string) => formatDate(d))
                  return <Text className="block text-sm text-gray-600">· 指定日期：{dates.join('、')}不可用</Text>
                })()}
              </View>
            </View>
          )}

          {/* 可用时间 */}
          <View className="mb-4">
            <View className="flex flex-row items-center gap-2 mb-2">
              <Clock size={16} color="#666" />
              <Text className="block text-sm font-medium text-gray-800">可用时间</Text>
            </View>
            <View className="ml-6">
              <Text className="block text-sm text-gray-600">
                {pkg.available_time_type === 'custom' && pkg.available_time_start && pkg.available_time_end
                  ? `每日${pkg.available_time_start}至${pkg.available_time_end}可用`
                  : merchant?.business_hours || '商家营业时间可用'}
              </Text>
            </View>
          </View>

          {/* 限购规则 */}
          {pkg.purchase_limit_type === 'limited' && (
            <View className="mb-4">
              <View className="flex flex-row items-center gap-2 mb-2">
                <Info size={16} color="#666" />
                <Text className="block text-sm font-medium text-gray-800">限购规则</Text>
              </View>
              <View className="ml-6 flex flex-col gap-1">
                {(pkg.purchase_limit || 0) > 0 && (
                  <Text className="block text-sm text-gray-600">· 每人最多购买{pkg.purchase_limit}份</Text>
                )}
                {(pkg.purchase_limit_per_day || 0) > 0 && (
                  <Text className="block text-sm text-gray-600">· 每人每天最多购买{pkg.purchase_limit_per_day}份</Text>
                )}
                {(pkg.purchase_limit_per_month || 0) > 0 && (
                  <Text className="block text-sm text-gray-600">· 每人每月最多购买{pkg.purchase_limit_per_month}份</Text>
                )}
              </View>
            </View>
          )}

          {/* 限制使用张数 */}
          {pkg.limit_usage_count && (
            <View className="mb-4">
              <View className="flex flex-row items-center gap-2 mb-2">
                <FileText size={16} color="#666" />
                <Text className="block text-sm font-medium text-gray-800">限制使用张数</Text>
              </View>
              <View className="ml-6">
                <Text className="block text-sm text-gray-600">每单限用{pkg.usage_count_limit || 1}张券</Text>
              </View>
            </View>
          )}

          {/* 预约规则 */}
          {pkg.need_reservation && (
            <View className="mb-4">
              <View className="flex flex-row items-center gap-2 mb-2">
                <Info size={16} color="#666" />
                <Text className="block text-sm font-medium text-gray-800">预约规则</Text>
              </View>
              <View className="ml-6">
                <Text className="block text-sm text-gray-600">
                  到店消费: {pkg.reservation_hours ? `需至少提前${pkg.reservation_hours}小时预约` : '需提前预约'}
                </Text>
              </View>
            </View>
          )}

          {/* 就餐方式 */}
          <View className="mb-4">
            <View className="flex flex-row items-center gap-2 mb-2">
              <Check size={16} color="#666" />
              <Text className="block text-sm font-medium text-gray-800">就餐方式</Text>
            </View>
            <View className="ml-6 flex flex-col gap-1">
              <Text className="block text-sm text-gray-600">
                {pkg.dine_in_type === 'dine_in' ? '仅限堂食' : 
                 pkg.dine_in_type === 'take_out' ? '仅限外带' : 
                 pkg.dine_in_type === 'all' ? '堂食外带都可以' : '堂食外带都可以'}
              </Text>
            </View>
          </View>

          {/* 使用规则 */}
          <View className="mb-4">
            <View className="flex flex-row items-center gap-2 mb-2">
              <FileText size={16} color="#666" />
              <Text className="block text-sm font-medium text-gray-800">使用规则</Text>
            </View>
            <View className="ml-6 flex flex-col gap-1">
              {pkg.other_discount && (
                <Text className="block text-sm text-gray-600">· {pkg.other_discount}</Text>
              )}
              {pkg.private_room && (
                <Text className="block text-sm text-gray-600">· {pkg.private_room}</Text>
              )}
            </View>
          </View>

          {/* 额外费用 */}
          {pkg.has_extra_fee && pkg.extra_fees && Array.isArray(pkg.extra_fees) && pkg.extra_fees.length > 0 && (
            <View className="mb-4">
              <View className="flex flex-row items-center gap-2 mb-2">
                <Info size={16} color="#666" />
                <Text className="block text-sm font-medium text-gray-800">额外费用</Text>
              </View>
              <View className="ml-6 flex flex-col gap-1">
                {pkg.extra_fees.map((fee: any, idx: number) => (
                  <Text key={idx} className="block text-sm text-gray-600">
                    · {fee.condition}: {fee.amount}元/{fee.unit}
                  </Text>
                ))}
              </View>
            </View>
          )}

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

          {/* 其他说明 */}
          {pkg.other_notes && (
            <View className="mb-4">
              <View className="flex flex-row items-center gap-2 mb-2">
                <FileText size={16} color="#666" />
                <Text className="block text-sm font-medium text-gray-800">其他说明</Text>
              </View>
              <View className="ml-6">
                <Text className="block text-sm text-gray-600 whitespace-pre-wrap">{pkg.other_notes}</Text>
              </View>
            </View>
          )}
        </View>

        {/* 使用方式步骤 */}
        <View className="bg-white mt-2 px-4 py-4">
          <View className="flex flex-row items-baseline gap-2 mb-4">
            <Text className="block text-base font-bold text-gray-800">使用方式</Text>
            <Text className="block text-xs text-gray-400">4 步解锁快乐</Text>
          </View>
          <View className="flex flex-row items-start">
            <View className="flex-1 flex flex-col items-center gap-1">
              <View className="w-11 h-11 rounded-2xl bg-red-50 flex items-center justify-center relative">
                <Text className="block text-xl">🛒</Text>
                <View className="absolute -top-1 -left-1 w-5 h-5 rounded-full bg-gradient-to-br from-[#FF6B6B] to-[#FF8E53] flex items-center justify-center">
                  <Text className="block text-xs font-bold text-white">1</Text>
                </View>
              </View>
              <Text className="block text-xs font-bold text-gray-800 mt-1">点击购买</Text>
              <Text className="block text-xs text-gray-400">一键拿下</Text>
            </View>
            <View className="flex items-center justify-center pt-3 px-1">
              <Text className="block text-gray-300">▸</Text>
            </View>
            <View className="flex-1 flex flex-col items-center gap-1">
              <View className="w-11 h-11 rounded-2xl bg-orange-50 flex items-center justify-center relative">
                <Text className="block text-xl">💳</Text>
                <View className="absolute -top-1 -left-1 w-5 h-5 rounded-full bg-gradient-to-br from-[#FFA502] to-[#FFC312] flex items-center justify-center">
                  <Text className="block text-xs font-bold text-white">2</Text>
                </View>
              </View>
              <Text className="block text-xs font-bold text-gray-800 mt-1">支付订单</Text>
              <Text className="block text-xs text-gray-400">秒速搞定</Text>
            </View>
            <View className="flex items-center justify-center pt-3 px-1">
              <Text className="block text-gray-300">▸</Text>
            </View>
            <View className="flex-1 flex flex-col items-center gap-1">
              <View className="w-11 h-11 rounded-2xl bg-pink-50 flex items-center justify-center relative">
                <Text className="block text-xl">🎁</Text>
                <View className="absolute -top-1 -left-1 w-5 h-5 rounded-full bg-gradient-to-br from-[#FF6B81] to-[#FF9FF3] flex items-center justify-center">
                  <Text className="block text-xs font-bold text-white">3</Text>
                </View>
              </View>
              <Text className="block text-xs font-bold text-gray-800 mt-1">抽奖领奖品</Text>
              <Text className="block text-xs text-[#FF4757]">100%有礼</Text>
            </View>
            <View className="flex items-center justify-center pt-3 px-1">
              <Text className="block text-gray-300">▸</Text>
            </View>
            <View className="flex-1 flex flex-col items-center gap-1">
              <View className="w-11 h-11 rounded-2xl bg-green-50 flex items-center justify-center relative">
                <Text className="block text-xl">🏪</Text>
                <View className="absolute -top-1 -left-1 w-5 h-5 rounded-full bg-gradient-to-br from-[#2ED573] to-[#7BED9F] flex items-center justify-center">
                  <Text className="block text-xs font-bold text-white">4</Text>
                </View>
              </View>
              <Text className="block text-xs font-bold text-gray-800 mt-1">到店使用</Text>
              <Text className="block text-xs text-gray-400">开心享用</Text>
            </View>
          </View>
        </View>

        {/* 适用门店 */}
        {merchant && (
          <View className="bg-white mt-2 px-4 py-4 mb-4">
            <Text className="block text-base font-bold text-gray-800 mb-4">适用门店</Text>
            <View
              className="flex flex-row items-start gap-3"
              onClick={() => {
                Taro.navigateTo({ url: `/pages/merchant/index?id=${merchant.id}` })
              }}
            >
              <View className="w-16 h-16 bg-gray-200 rounded-lg overflow-hidden flex-shrink-0">
                {(merchant.logo || merchant.images?.[0]) && (
                  <Image src={merchant.logo || merchant.images?.[0] || ''} className="w-full h-full" mode="aspectFill" />
                )}
              </View>
              <View className="flex-1">
                <Text className="block text-base font-semibold text-gray-800">{merchant.name}</Text>
                <View className="flex flex-row items-center gap-2 mt-1">
                  <Text className="block text-xs text-gray-500">人均¥{merchant.avg_price || '88'}</Text>
                  <Text className="block text-xs text-gray-500">{merchant.business_hours || '10:30-20:30营业'}</Text>
                  <Text className="block text-xs text-gray-500">{merchant.has_private_room ? '有包厢' : ''}</Text>
                </View>
              </View>
              <View
                className="flex flex-col items-center gap-1"
                onClick={(e) => {
                  e.stopPropagation()
                  if (merchant.phone) {
                    Taro.makePhoneCall({ phoneNumber: merchant.phone })
                  }
                }}
              >
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
      <View style={{ position: 'fixed', bottom: 0, left: 0, right: 0, display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', backgroundColor: '#fff', borderTop: '1px solid #e5e7eb', zIndex: 100 }}>
        <View className="flex flex-row items-end gap-3">
          <View className="flex flex-col">
            <Text className="block text-xs text-gray-500">到手价</Text>
            <Text className="block text-xl font-bold text-[#FF4757]">¥{formatPrice(currentPrice)}</Text>
          </View>
          {originalPrice > currentPrice && (
            <Text className="block text-sm text-gray-400 line-through pb-1">¥{formatPrice(originalPrice)}</Text>
          )}
        </View>
        <View className="flex flex-row items-center gap-2">
          {/* 分享海报 */}
          <View
            onClick={() => {
              if (!isMiniApp) {
                Taro.showToast({ title: '请在小程序中分享', icon: 'none' })
                return
              }
              setShowPoster(true)
            }}
            className="px-4 py-3 rounded-full border border-[#FF4757]"
          >
            <Text className="block text-sm font-semibold text-[#FF4757]">分享</Text>
          </View>
          <View
            onClick={handleBuy}
            className={`px-8 py-3 rounded-full ${buying ? 'bg-[#ffaab3]' : 'bg-[#FF4757]'}`}
          >
            <Text className="block text-base font-semibold text-white">
              {buying ? '购买中...' : '立即购买'}
            </Text>
          </View>
        </View>
      </View>

      {/* 分享海报弹层 */}
      {pkg && (
        <SharePosterModal
          visible={showPoster}
          onClose={() => setShowPoster(false)}
          coverUrl={pkg.cover_image || null}
          title={pkg.name}
          subtitle={merchant?.name || ''}
          priceText={`¥${formatPrice(currentPrice)}`}
          pageParams={{ id: String(pkg.id), inviter: Taro.getStorageSync('user_id') || '' }}
          page="pages/package-detail/index"
        />
      )}

      {/* 购买确认弹窗 */}
      {showPurchaseModal && pkg && (
        <View style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 200 }}>
          {/* 遮罩层 */}
          <View
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)' }}
            onClick={() => setShowPurchaseModal(false)}
          />
          {/* 底部弹窗 */}
          <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderTopLeftRadius: '16px', borderTopRightRadius: '16px', padding: '20px 16px', paddingBottom: '32px' }}>
            {/* 关闭按钮 */}
            <View className="flex flex-row items-center justify-between mb-4">
              <Text className="block text-base font-bold text-gray-900">确认订单</Text>
              <View onClick={() => setShowPurchaseModal(false)}>
                <X size={20} color="#9ca3af" />
              </View>
            </View>

            {/* 套餐信息 */}
            <View className="flex flex-row gap-3 mb-5">
              {pkg.cover_image && (
                <Image src={pkg.cover_image} className="w-16 h-16 rounded-lg" mode="aspectFill" />
              )}
              <View className="flex-1">
                <Text className="block text-sm font-semibold text-gray-900 leading-5">{pkg.name}</Text>
                <View className="flex flex-row items-end gap-2 mt-1">
                  <Text className="block text-lg font-bold text-[#FF4757]">¥{pkg.price}</Text>
                  {pkg.original_price && parseFloat(String(pkg.original_price)) > parseFloat(String(pkg.price)) && (
                    <Text className="block text-xs text-gray-400 line-through pb-1">¥{pkg.original_price}</Text>
                  )}
                </View>
              </View>
            </View>

            {/* 份数选择 */}
            <View className="flex flex-row items-center justify-between py-4 border-t border-gray-100">
              <Text className="block text-sm text-gray-700">购买份数</Text>
              <View className="flex flex-row items-center gap-3">
                <View
                  onClick={() => handleQuantityChange(-1)}
                  className={`w-8 h-8 rounded-full flex items-center justify-center ${quantity <= 1 ? 'bg-gray-100' : 'bg-gray-200'}`}
                >
                  <Minus size={16} color={quantity <= 1 ? '#d1d5db' : '#374151'} />
                </View>
                <Text className="block text-base font-bold text-gray-900 w-8 text-center">{quantity}</Text>
                <View
                  onClick={() => handleQuantityChange(1)}
                  className={`w-8 h-8 rounded-full flex items-center justify-center ${checkResult && !checkResult.can_buy && quantity >= (checkResult.remaining || 1) ? 'bg-gray-100' : 'bg-[#FF4757]'}`}
                >
                  <Plus size={16} color={checkResult && !checkResult.can_buy && quantity >= (checkResult.remaining || 1) ? '#d1d5db' : '#ffffff'} />
                </View>
              </View>
            </View>

            {/* 限购提示 - 仅在限制购买模式下显示 */}
            {pkg.purchase_limit_type === 'limited' && ((pkg.purchase_limit ?? 0) > 0 || (pkg.purchase_limit_per_day ?? 0) > 0 || (pkg.purchase_limit_per_month ?? 0) > 0) && (
              <View className="flex flex-row items-center gap-1 py-2 border-t border-gray-100">
                <Info size={12} color="#9ca3af" />
                <Text className="block text-xs text-gray-400">
                  {(pkg.purchase_limit ?? 0) > 0 && `每人限购${pkg.purchase_limit}份`}
                  {(pkg.purchase_limit ?? 0) > 0 && ((pkg.purchase_limit_per_day ?? 0) > 0 || (pkg.purchase_limit_per_month ?? 0) > 0) && ' · '}
                  {(pkg.purchase_limit_per_day ?? 0) > 0 && `每日限购${pkg.purchase_limit_per_day}份`}
                  {(pkg.purchase_limit_per_day ?? 0) > 0 && (pkg.purchase_limit_per_month ?? 0) > 0 && ' · '}
                  {(pkg.purchase_limit_per_month ?? 0) > 0 && `每月限购${pkg.purchase_limit_per_month}份`}
                </Text>
              </View>
            )}

            {/* 库存提示 */}
            {pkg.stock > 0 && (
              <View className="flex flex-row items-center gap-1 py-1">
                <Text className="block text-xs text-gray-400">库存 {pkg.stock} 份</Text>
              </View>
            )}

            {/* 校验结果提示 */}
            {checkResult && !checkResult.can_buy && (
              <View className="bg-red-50 rounded-lg px-3 py-2 mt-2">
                <Text className="block text-xs text-[#FF4757]">{checkResult.reason}</Text>
              </View>
            )}

            {/* 合计和确认按钮 */}
            <View className="flex flex-row items-center justify-between mt-4 pt-4 border-t border-gray-100">
              <View>
                <Text className="block text-xs text-gray-500">合计</Text>
                <Text className="block text-xl font-bold text-[#FF4757]">¥{formatPrice(parseFloat(String(pkg.price)) * quantity)}</Text>
              </View>
              <View
                onClick={handleConfirmBuy}
                className={`px-8 py-3 rounded-full ${buying || checking || (checkResult && !checkResult.can_buy) ? 'bg-gray-300' : 'bg-[#FF4757]'}`}
              >
                <Text className="block text-base font-semibold text-white">
                  {buying ? '提交中...' : checking ? '校验中...' : '确认购买'}
                </Text>
              </View>
            </View>
          </View>
        </View>
      )}

    </View>
  )
}
