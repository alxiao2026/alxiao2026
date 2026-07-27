import { useState } from 'react'
import Taro, { useRouter, useDidShow } from '@tarojs/taro'
import { View, Text, Image, ScrollView } from '@tarojs/components'
import { Network } from '@/network'
import { formatPrice } from '@/lib/utils'
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
  CircleCheck,
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
  avg_price?: string
  has_private_room?: boolean
}

export default function PackageDetail() {
  const router = useRouter()
  const { id } = router.params
  const [pkg, setPkg] = useState<Package | null>(null)
  const [merchant, setMerchant] = useState<Merchant | null>(null)
  const [loading, setLoading] = useState(true)

  // 每次页面显示时重新加载，确保门店等后台数据变更后展示最新内容
  useDidShow(() => {
    if (id) {
      loadPackage()
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

  const [buying, setBuying] = useState(false)
  const [showPurchaseModal, setShowPurchaseModal] = useState(false)
  const [quantity, setQuantity] = useState(1)
  const [checking, setChecking] = useState(false)
  const [checkResult, setCheckResult] = useState<{ can_buy: boolean; reason?: string; remaining?: number } | null>(null)
  const [showLotteryEntry, setShowLotteryEntry] = useState(false)
  const [paidOrderId, setPaidOrderId] = useState('')

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
        // 校验支付是否成功：查询订单状态
        try {
          const verifyRes = await Network.request({
            url: `/api/orders/${orderData.id}`,
            method: 'GET',
          })
          const orderInfo = (verifyRes.data as any)?.data || verifyRes.data
          console.log('[PackageDetail] 支付校验响应:', orderInfo)
          if (orderInfo?.id && orderInfo?.status !== 'refunded' && orderInfo?.status !== 'expired') {
            // 支付成功，弹出抽奖入口
            setPaidOrderId(orderData.id)
            setShowLotteryEntry(true)
          } else {
            Taro.showModal({
              title: '提示',
              content: '您还未支付，支付成功即可参与膨胀活动',
              showCancel: false,
              confirmText: '去支付',
              success: () => {
                Taro.navigateTo({ url: `/pages/order-detail/index?id=${orderData.id}` })
              },
            })
          }
        } catch (verifyErr) {
          console.error('[PackageDetail] 支付校验失败:', verifyErr)
          // 校验失败也提示未支付
          Taro.showModal({
            title: '提示',
            content: '您还未支付，支付成功即可参与膨胀活动',
            showCancel: false,
            confirmText: '去支付',
            success: () => {
              Taro.navigateTo({ url: `/pages/order-detail/index?id=${orderData.id}` })
            },
          })
        }
      } else {
        Taro.showModal({
          title: '提示',
          content: '您还未支付，支付成功即可参与膨胀活动',
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
                <Text className="block text-xs text-gray-600">最近9.4公里</Text>
                <Text className="block text-xs text-gray-700 font-medium">{merchant.name}</Text>
              </View>
            </View>
          )}
        </View>

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

          {/* 使用方式 */}
          <View className="mb-4">
            <View className="flex flex-row items-center gap-2 mb-2">
              <Check size={16} color="#666" />
              <Text className="block text-sm font-medium text-gray-800">使用方式</Text>
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

          {/* 使用方式 */}
          <View className="mb-4">
            <View className="flex flex-row items-center gap-2 mb-2">
              <Check size={16} color="#666" />
              <Text className="block text-sm font-medium text-gray-800">使用方式</Text>
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
          <View className="flex flex-col gap-2">
            <View className="flex flex-row items-center gap-3 bg-red-50 rounded-2xl px-3 py-3">
              <View className="w-8 h-8 rounded-full bg-gradient-to-br from-[#FF6B6B] to-[#FF8E53] flex items-center justify-center flex-shrink-0">
                <Text className="block text-sm font-bold text-white">1</Text>
              </View>
              <Text className="block text-xl">🛒</Text>
              <View className="flex-1">
                <Text className="block text-sm font-bold text-gray-800">点击购买</Text>
                <Text className="block text-xs text-gray-500 mt-1">心动套餐，一键拿下</Text>
              </View>
            </View>
            <View className="flex flex-row items-center gap-3 bg-orange-50 rounded-2xl px-3 py-3">
              <View className="w-8 h-8 rounded-full bg-gradient-to-br from-[#FFA502] to-[#FFC312] flex items-center justify-center flex-shrink-0">
                <Text className="block text-sm font-bold text-white">2</Text>
              </View>
              <Text className="block text-xl">💳</Text>
              <View className="flex-1">
                <Text className="block text-sm font-bold text-gray-800">支付订单</Text>
                <Text className="block text-xs text-gray-500 mt-1">微信支付，秒速搞定</Text>
              </View>
            </View>
            <View className="flex flex-row items-center gap-3 bg-pink-50 rounded-2xl px-3 py-3 relative overflow-hidden">
              <View className="absolute top-2 right-2 bg-[#FF4757] rounded-full px-2 py-1">
                <Text className="block text-xs font-bold text-white">100%有礼</Text>
              </View>
              <View className="w-8 h-8 rounded-full bg-gradient-to-br from-[#FF6B81] to-[#FF9FF3] flex items-center justify-center flex-shrink-0">
                <Text className="block text-sm font-bold text-white">3</Text>
              </View>
              <Text className="block text-xl">🎁</Text>
              <View className="flex-1">
                <Text className="block text-sm font-bold text-gray-800">抽奖领奖品</Text>
                <Text className="block text-xs text-gray-500 mt-1">下单自动抽奖，好运挡不住</Text>
              </View>
            </View>
            <View className="flex flex-row items-center gap-3 bg-green-50 rounded-2xl px-3 py-3">
              <View className="w-8 h-8 rounded-full bg-gradient-to-br from-[#2ED573] to-[#7BED9F] flex items-center justify-center flex-shrink-0">
                <Text className="block text-sm font-bold text-white">4</Text>
              </View>
              <Text className="block text-xl">🏪</Text>
              <View className="flex-1">
                <Text className="block text-sm font-bold text-gray-800">到店使用</Text>
                <Text className="block text-xs text-gray-500 mt-1">出示核销码，开心享用</Text>
              </View>
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
        <View
          onClick={handleBuy}
          className={`px-8 py-3 rounded-full ${buying ? 'bg-[#ffaab3]' : 'bg-[#FF4757]'}`}
        >
          <Text className="block text-base font-semibold text-white">
            {buying ? '购买中...' : '立即购买'}
          </Text>
        </View>
      </View>

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

      {/* 抽奖入口弹窗 */}
      {showLotteryEntry && (
        <View style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <View className="bg-white rounded-2xl p-8 mx-8 w-full max-w-sm flex flex-col items-center">
            {/* 成功图标 */}
            <View className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mb-4">
              <CircleCheck size={32} color="#22c55e" />
            </View>
            <Text className="block text-xl font-bold text-gray-800 mb-2">支付成功</Text>
            <Text className="block text-sm text-gray-500 mb-6 text-center">恭喜您，现在可以参与抽奖活动{'\n'}赢取优惠券、商品或霸王餐</Text>
            {/* 按钮组 */}
            <View className="flex flex-col gap-3 w-full">
              <View
                className="w-full bg-[#FF4757] rounded-full py-3 flex items-center justify-center"
                onClick={() => {
                  setShowLotteryEntry(false)
                  Taro.navigateTo({ url: `/pages/lottery/index?orderId=${paidOrderId}` })
                }}
              >
                <Text className="block text-base font-semibold text-white">去抽奖</Text>
              </View>
              <View
                className="w-full bg-gray-100 rounded-full py-3 flex items-center justify-center"
                onClick={() => {
                  setShowLotteryEntry(false)
                  Taro.navigateTo({ url: `/pages/order-detail/index?id=${paidOrderId}` })
                }}
              >
                <Text className="block text-base text-gray-600">查看订单</Text>
              </View>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}
