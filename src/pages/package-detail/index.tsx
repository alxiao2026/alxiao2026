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
  // 交易规则
  purchase_limit?: number
  purchase_limit_type?: string
  purchase_limit_per_person?: number
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

  const currentPrice = parseFloat(pkg.price)

  // 计算套餐原价（合计价）
  const originalPrice = (pkg.combinations || []).reduce((sum, combo) => {
    return sum + (combo.items || []).reduce((itemSum, item) => {
      return itemSum + (parseFloat(String(item.price || 0)) * (item.quantity || 1))
    }, 0)
  }, 0)

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
                    ? `每周${pkg.unavailable_weekdays.map((d: number) => ['日', '一', '二', '三', '四', '五', '六'][d]).join('、')}不可用`
                    : '部分日期不可用'}
                </Text>
              )}
              {pkg.unavailable_date_type === 'all' && (
                <Text className="block text-xs text-gray-600">全周可用</Text>
              )}
              {!pkg.unavailable_date_type && (
                <Text className="block text-xs text-gray-600">全周可用</Text>
              )}
              {/* 限购规则 */}
              {pkg.purchase_limit_type === 'limited' && (pkg.purchase_limit_per_person || 0) > 0 && (
                <Text className="block text-xs text-gray-600">每人限购{pkg.purchase_limit_per_person}份</Text>
              )}
              {(pkg.purchase_limit_per_day || 0) > 0 && (
                <Text className="block text-xs text-gray-600">每人每天限购{pkg.purchase_limit_per_day}份</Text>
              )}
              {(pkg.purchase_limit_per_month || 0) > 0 && (
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
                    <View className="bg-orange-50 px-2 py-1 rounded">
                      <Text className="block text-xs text-orange-600">
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
                  return <Text className="block text-sm text-gray-600">· 每周{names.join('、')}不可用</Text>
                })()}
                {pkg.unavailable_holidays && Array.isArray(pkg.unavailable_holidays) && pkg.unavailable_holidays.length > 0 && (
                  <Text className="block text-sm text-gray-600">· 节假日{pkg.unavailable_holidays.join('、')}不可用</Text>
                )}
                {pkg.unavailable_dates && Array.isArray(pkg.unavailable_dates) && pkg.unavailable_dates.length > 0 && (
                  <Text className="block text-sm text-gray-600">· 指定日期{pkg.unavailable_dates.join('、')}不可用</Text>
                )}
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
                <Text className="block text-sm text-gray-600">到店消费: 需提前预约</Text>
              </View>
            </View>
          )}

          {/* 使用方式 */}
          <View className="mb-4">
            <View className="flex flex-row items-center gap-2 mb-2">
              <Check size={16} color="#666" />
              <Text className="block text-sm font-medium text-gray-800">使用方式</Text>
            </View>
            <View className="ml-6">
              <Text className="block text-sm text-gray-600">
                {pkg.dine_in_type === 'dine_in' ? '仅堂食' : 
                 pkg.dine_in_type === 'takeout' ? '仅外带' : 
                 pkg.dine_in_type === 'both' ? '堂食外带均可' : '仅堂食'}
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
        <View className="flex flex-row items-end gap-3">
          <View className="flex flex-col">
            <Text className="block text-xs text-gray-500">到手价</Text>
            <Text className="block text-xl font-bold text-red-500">¥{currentPrice.toFixed(0)}</Text>
          </View>
          {originalPrice > currentPrice && (
            <Text className="block text-sm text-gray-400 line-through pb-1">¥{originalPrice.toFixed(0)}</Text>
          )}
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
