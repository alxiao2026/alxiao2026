import { useState, useRef } from 'react'
import Taro, { useDidShow, useShareAppMessage } from '@tarojs/taro'
import { View, Text, Image } from '@tarojs/components'
import { Network } from '@/network'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Trophy, Package, Clock, Gift, QrCode, MapPin, Navigation, Users, Share2 } from 'lucide-react-taro'
import { formatDateTime, formatShortDateTime } from '@/lib/utils'

interface LotteryRecord {
  id: string
  user_id: string
  order_id: string
  prize_id: string
  prize_name: string
  prize_type: string
  is_winner: boolean
  coupon_amount?: string | number | null
  coupon_condition?: string | number | null
  discount_rate?: number
  discount_cap?: number
  product_name?: string
  product_value?: string | number | null
  prize_image?: string
  redemption_code?: string
  refund_amount?: string | number | null
  refund_status?: string
  created_at: string
  expired?: boolean
  expiry_date?: string
  expiry_hours?: number
  // 商家信息
  shop_name?: string
  shop_address?: string
  shop_latitude?: number
  shop_longitude?: number
  // 抽奖类型与组队实时状态
  lottery_type?: 'normal' | 'team'
  team_role?: 'leader' | 'member'
  team_invite_code?: string
  team_group_id?: string | null
  merchant_id?: number | null
  package_id?: string | null
  team_size?: number | null
  team_current_count?: number | null
  team_status?: string
  team_status_text?: string
  leader_refunded?: boolean
}

interface Order {
  id: string
  package_id: string
  user_id: string
  user_name: string
  user_phone: string
  quantity: number
  total_amount: number
  status: string
  shop_name: string
  package_name?: string
  package_cover?: string
  merchant_id?: number | null
  created_at: string
}

export default function LotteryRecordsPage() {
  const [activeTab, setActiveTab] = useState('records')
  const [records, setRecords] = useState<LotteryRecord[]>([])
  const [unparticipated, setUnparticipated] = useState<Order[]>([])
  const [loading, setLoading] = useState(false)

  // 核销码弹窗状态
  const [qrDialogOpen, setQrDialogOpen] = useState(false)
  const [qrLoading, setQrLoading] = useState(false)
  const [qrCodeUrl, setQrCodeUrl] = useState('')
  const [currentRecord, setCurrentRecord] = useState<LotteryRecord | null>(null)

  // 选择抽奖方式弹窗状态
  const [choiceOpen, setChoiceOpen] = useState(false)
  const [choiceOrder, setChoiceOrder] = useState<Order | null>(null)
  const [checking, setChecking] = useState(false)

  // 页面每次显示时刷新（首次进入 / 从盲盒抽奖页返回都会触发）
  useDidShow(() => {
    const uid = Taro.getStorageSync('user_id') || Taro.getStorageSync('userInfo')?.user_id || ''
    if (uid) {
      loadRecords(uid)
      loadUnparticipated(uid)
    }
  })

  const loadRecords = async (uid: string) => {
    setLoading(true)
    try {
      const res = await Network.request({
        url: `/api/lottery/user/${uid}`,
      })
      console.log('中奖记录:', res.data)
      const envelope = res.data as any
      setRecords(Array.isArray(envelope?.data) ? envelope.data : [])
    } catch (err) {
      console.error('加载中奖记录失败:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadUnparticipated = async (uid: string) => {
    try {
      const res = await Network.request({
        url: `/api/orders/user/${uid}/unparticipated`,
      })
      console.log('未参与抽奖订单:', res.data)
      const envelope = res.data as any
      setUnparticipated(Array.isArray(envelope?.data) ? envelope.data : [])
    } catch (err) {
      console.error('加载未参与抽奖订单失败:', err)
    }
  }

  // 打开核销码弹窗并加载二维码
  const handleViewQRCode = async (record: LotteryRecord) => {
    if (record.refund_status === 'voided') {
      Taro.showToast({ title: '关联订单已退款，该奖品已作废', icon: 'none' })
      return
    }
    setCurrentRecord(record)
    setQrCodeUrl('')
    setQrDialogOpen(true)
    setQrLoading(true)
    try {
      console.log('[Records] 获取核销二维码', { url: `/api/lottery/qrcode/${record.id}`, method: 'GET' })
      const res = await Network.request({ url: `/api/lottery/qrcode/${record.id}`, method: 'GET' })
      console.log('[Records] 核销二维码响应', res.data)
      const data = (res.data as any)?.data
      if (data?.qrcode) {
        setQrCodeUrl(data.qrcode)
        // 用后端的实时过期状态更新当前记录
        setCurrentRecord(prev => prev ? {
          ...prev,
          expired: !!data.expired,
          expiry_date: data.expiry_date || prev.expiry_date,
          expiry_hours: data.expiry_hours ?? prev.expiry_hours,
        } : prev)
      }
    } catch (err) {
      console.error('[Records] 获取核销二维码失败', err)
      Taro.showToast({ title: '二维码加载失败', icon: 'none' })
    } finally {
      setQrLoading(false)
    }
  }

  // 一键导航到门店
  const handleNavigateToShop = () => {
    if (!currentRecord?.shop_latitude || !currentRecord?.shop_longitude) {
      Taro.showToast({ title: '暂无门店位置信息', icon: 'none' })
      return
    }
    Taro.openLocation({
      latitude: Number(currentRecord.shop_latitude),
      longitude: Number(currentRecord.shop_longitude),
      name: currentRecord.shop_name || '门店',
      address: currentRecord.shop_address || '',
    })
  }

  const getPrizeTypeLabel = (type: string) => {
    const map: Record<string, string> = {
      coupon: '折扣券',
      product: '商品',
      free_meal: '霸王餐',
    }
    return map[type] || type
  }

  const getPrizeTypeColor = (type: string) => {
    const map: Record<string, string> = {
      coupon: 'bg-red-100 text-red-700',
      product: 'bg-purple-100 text-purple-700',
      free_meal: 'bg-green-100 text-green-700',
    }
    return map[type] || 'bg-gray-100 text-gray-700'
  }

  const isRedeemed = (record: LotteryRecord) =>
    record.refund_status === 'redeemed' || record.refund_status === 'completed'

  // 一键分享组队邀请：记录当前点击的组队记录，分享回调读取
  const shareRecordRef = useRef<LotteryRecord | null>(null)
  useShareAppMessage(() => {
    const r = shareRecordRef.current
    if (r?.lottery_type === 'team' && r.team_invite_code) {
      const query = `merchant_id=${r.merchant_id ?? ''}&package_id=${r.package_id ?? ''}&invite_code=${r.team_invite_code}`
      return {
        title: '一起来组队抽盲盒，赢霸王餐！',
        path: `/pages/team-lottery/index?${query}`,
      }
    }
    return { title: '团团盲盒 · 中奖记录', path: '/pages/lottery-records/index' }
  })

  // 点击"参与抽奖"：先查订单抽奖状态（互斥兜底），未参与时弹出选择弹窗
  // 选择普通抽奖：跳盲盒抽奖页
  const handleParticipate = async (order: Order) => {
    if (checking) return
    setChecking(true)
    try {
      const res = await Network.request({ url: `/api/lottery/order-status/${order.id}` })
      console.log('[Records] 订单抽奖状态', res.data)
      const status = (res.data as any)?.data
      if (status?.participated) {
        Taro.showToast({
          title: status.type === 'team' ? '该订单已参与组队抽奖' : '该订单已参与普通抽奖',
          icon: 'none',
        })
        const uid = Taro.getStorageSync('user_id') || Taro.getStorageSync('userInfo')?.user_id || ''
        if (uid) loadUnparticipated(uid)
        return
      }
      setChoiceOrder(order)
      setChoiceOpen(true)
    } catch (err) {
      console.error('[Records] 查询订单状态失败', err)
      // 查询失败不拦截，直接弹选择弹窗（后端抽奖/开团时仍有互斥校验兜底）
      setChoiceOrder(order)
      setChoiceOpen(true)
    } finally {
      setChecking(false)
    }
  }

  // 选择组队抽奖：跳组队页（携带商家/套餐参数）
  const goTeamLottery = () => {
    if (!choiceOrder) return
    setChoiceOpen(false)
    Taro.navigateTo({
      url: `/pages/team-lottery/index?merchant_id=${choiceOrder.merchant_id || ''}&package_id=${choiceOrder.package_id || ''}&order_id=${choiceOrder.id || ''}`,
    })
  }

  // 选择普通抽奖：跳盲盒抽奖页
  const goNormalLottery = () => {
    if (!choiceOrder) return
    setChoiceOpen(false)
    Taro.navigateTo({ url: `/pages/lottery/index?orderId=${choiceOrder.id}` })
  }

  // 组队状态判断
  const isTeamFailed = (record: LotteryRecord) =>
    record.lottery_type === 'team' && (record.leader_refunded || record.team_status === 'expired')
  // 组队未开奖（组队中/已成团待开奖）：显示"未开奖"而非"未中奖"
  const isTeamPendingDraw = (record: LotteryRecord) =>
    record.lottery_type === 'team' && (record.team_status === 'active' || record.team_status === 'full')
  // 组队已开奖（有奖品信息）：展示奖品而非组队状态
  const isTeamDrawed = (record: LotteryRecord) =>
    record.lottery_type === 'team' && (record.team_status === 'drawed' || !!record.prize_id)

  const getRecordBadge = (record: LotteryRecord) => {
    if (isTeamFailed(record)) {
      return { label: '组队失败', className: 'bg-gray-200 text-gray-600' }
    }
    if (!record.is_winner || !record.prize_id) {
      if (isTeamPendingDraw(record)) {
        return { label: '未开奖', className: 'bg-orange-100 text-orange-600' }
      }
      return { label: '未中奖', className: 'bg-gray-100 text-gray-500' }
    }
    if (record.refund_status === 'voided') {
      return { label: '已作废', className: 'bg-gray-100 text-gray-500' }
    }
    if (record.redemption_code && record.expired && !isRedeemed(record)) {
      return { label: '已过期', className: 'bg-gray-100 text-gray-500' }
    }
    if (record.prize_type === 'free_meal') {
      return isRedeemed(record)
        ? { label: '已返现', className: 'bg-green-100 text-green-700' }
        : { label: '返现中', className: 'bg-yellow-100 text-yellow-700' }
    }
    if (record.prize_type === 'coupon') {
      // 折扣券：中奖即按折扣差额原路返现到支付账户，无需到店核销
      return { label: '已返现', className: 'bg-green-100 text-green-700' }
    }
    if (record.prize_type === 'product') {
      return isRedeemed(record)
        ? { label: '已核销', className: 'bg-green-100 text-green-700' }
        : { label: '待核销', className: 'bg-yellow-100 text-yellow-700' }
    }
    return { label: '待使用', className: 'bg-yellow-100 text-yellow-700' }
  }

  // 跳转盲盒抽奖页（含分享引导与开奖动画，与支付成功后的抽奖体验一致）
  const formatExpiryDate = (dateStr?: string) => formatShortDateTime(dateStr)

  return (
    <View className="min-h-screen bg-gray-50">
      {/* Tabs */}
      <View className="bg-white px-4 pt-4">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v)}>
          <TabsList className="w-full bg-gray-100 rounded-xl p-1">
            <TabsTrigger value="records" className="flex-1 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <Text className="block text-sm">中奖记录 ({records.length})</Text>
            </TabsTrigger>
            <TabsTrigger value="unparticipated" className="flex-1 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <Text className="block text-sm">未参与 ({unparticipated.length})</Text>
            </TabsTrigger>
          </TabsList>

          {/* 中奖记录 */}
          <TabsContent value="records" className="mt-4">
            {loading ? (
              <View className="flex items-center justify-center py-12">
                <Text className="text-gray-400 text-sm">加载中...</Text>
              </View>
            ) : records.length === 0 ? (
              <View className="flex flex-col items-center justify-center py-16">
                <Trophy size={48} color="#d1d5db" />
                <Text className="block text-gray-400 text-sm mt-4">暂无中奖记录</Text>
                <Text className="block text-gray-300 text-xs mt-2">参与抽奖后中奖记录将显示在这里</Text>
              </View>
            ) : (
              <View className="space-y-3 pb-4">
                {records.map((record) => {
                  const statusBadge = getRecordBadge(record)
                  return (
                    <Card key={record.id} className="bg-white rounded-xl border-0 shadow-sm">
                      <CardContent className="p-4">
                        <View className="flex items-start justify-between">
                          <View className="flex-1 min-w-0">
                            <View className="flex items-center gap-2 mb-2 overflow-hidden">
                              <Text className="text-base font-semibold text-gray-900 truncate">
                                {isTeamFailed(record)
                                  ? '组队失败'
                                  : isTeamPendingDraw(record)
                                  ? '未开奖'
                                  : record.prize_name || (isTeamDrawed(record) ? '已开奖' : '未中奖')}
                              </Text>
                              {record.lottery_type === 'team' ? (
                                <Badge className="bg-purple-100 text-purple-700 text-xs shrink-0">
                                  <Text>组队盲盒</Text>
                                </Badge>
                              ) : (
                                <Badge className="bg-blue-100 text-blue-700 text-xs shrink-0">
                                  <Text>普通抽奖</Text>
                                </Badge>
                              )}
                              {record.prize_type && !isTeamFailed(record) ? (
                                <Badge className={`${getPrizeTypeColor(record.prize_type)} text-xs`}>
                                  <Text>{getPrizeTypeLabel(record.prize_type)}</Text>
                                </Badge>
                              ) : null}
                            </View>
                            {/* 组队抽奖实时状态 */}
                            {record.lottery_type === 'team' && !isTeamDrawed(record) && !isTeamFailed(record) && (
                              <View className="mt-1 mb-1 flex flex-wrap items-center gap-2">
                                <Badge className={record.team_role === 'leader' ? 'bg-amber-100 text-amber-700 text-xs' : 'bg-sky-100 text-sky-700 text-xs'}>
                                  <Text>{record.team_role === 'leader' ? '我是团长' : '我是团员'}</Text>
                                </Badge>
                                {record.team_status === 'active' && record.team_invite_code ? (
                                  <Button
                                    size="sm"
                                    openType="share"
                                    className="h-7 px-3 rounded-full bg-[#FF4757] text-white text-xs"
                                    onClick={() => {
                                      shareRecordRef.current = record
                                    }}
                                  >
                                    <View className="flex items-center gap-1">
                                      <Share2 size={12} color="#ffffff" />
                                      <Text className="text-xs text-white">邀请好友组队</Text>
                                    </View>
                                  </Button>
                                ) : null}
                                {record.team_status_text ? (
                                  <Text className="text-xs text-orange-500 font-medium">{record.team_status_text}</Text>
                                ) : null}
                              </View>
                            )}
                            {/* 组队失败提示 */}
                            {record.lottery_type === 'team' && isTeamFailed(record) && (
                              <Text className="block text-xs text-gray-500 mb-1">
                                {record.leader_refunded ? '团长已退款，队伍自动解散' : '超时未成团，队伍已解散'}
                              </Text>
                            )}
                            {record.prize_type === 'coupon' && record.discount_rate ? (
                              <Text className="block text-sm text-[#FF4757] font-medium">
                                {record.discount_rate}折 · 已返还 ¥{record.refund_amount}
                                {record.discount_cap ? `（单笔最高优惠¥${record.discount_cap}）` : ''}
                              </Text>
                            ) : null}
                            {record.prize_type === 'product' && record.product_name && (
                              <View>
                                <Text className="block text-sm text-gray-600">商品：{record.product_name}</Text>
                                {record.product_value && (
                                  <Text className="block text-sm text-gray-500">价值：¥{record.product_value}</Text>
                                )}
                              </View>
                            )}
                            {record.prize_type === 'free_meal' && record.product_name && (
                              <Text className="block text-sm text-gray-600">霸王餐商品：{record.product_name}</Text>
                            )}
                            {(record.prize_type === 'free_meal' || record.prize_type === 'coupon') && Number(record.refund_amount) > 0 && (
                              <Text className="block text-sm text-green-500 font-medium">
                                返现金额：¥{record.refund_amount}{record.prize_type === 'coupon' ? '（已原路退回支付账户）' : ''}
                              </Text>
                            )}
                            {/* 兑换码与有效期 */}
                            {record.redemption_code && (
                              <View className="mt-1">
                                <Text className="block text-sm text-[#FF4757] font-mono">兑换码：{record.redemption_code}</Text>
                                {(record.expiry_hours ?? 0) > 0 && (
                                  <Text className={`block text-xs mt-1 ${record.expired && !isRedeemed(record) ? 'text-red-500' : 'text-gray-400'}`}>
                                    {record.expired && !isRedeemed(record)
                                      ? `已过期（有效期${record.expiry_hours}小时，${formatExpiryDate(record.expiry_date)}到期）`
                                      : `有效期至 ${formatExpiryDate(record.expiry_date)}`}
                                  </Text>
                                )}
                                {!isRedeemed(record) && (
                                  <Button
                                    className="mt-2 bg-[#FF4757] hover:bg-[#e63846] text-white rounded-lg"
                                    size="sm"
                                    onClick={() => handleViewQRCode(record)}
                                  >
                                    <QrCode size={14} color="#ffffff" />
                                    <Text className="ml-1 text-xs">查看核销码</Text>
                                  </Button>
                                )}
                              </View>
                            )}
                            <View className="flex items-center gap-1 mt-2">
                              <Clock size={12} color="#9ca3af" />
                              <Text className="text-xs text-gray-400">{formatDateTime(record.created_at)}</Text>
                            </View>
                          </View>
                          <Badge className={statusBadge.className}>
                            <Text className="text-xs">{statusBadge.label}</Text>
                          </Badge>
                        </View>
                      </CardContent>
                    </Card>
                  )
                })}
              </View>
            )}
          </TabsContent>

          {/* 未参与抽奖 */}
          <TabsContent value="unparticipated" className="mt-4">
            {unparticipated.length === 0 ? (
              <View className="flex flex-col items-center justify-center py-16">
                <Package size={48} color="#d1d5db" />
                <Text className="block text-gray-400 text-sm mt-4">暂无未参与抽奖的订单</Text>
                <Text className="block text-gray-300 text-xs mt-2">购买套餐后可参与抽奖</Text>
              </View>
            ) : (
              <View className="space-y-3 pb-4">
                {unparticipated.map((order) => (
                  <Card key={order.id} className="bg-white rounded-xl border-0 shadow-sm">
                    <CardContent className="p-4">
                      <View className="flex items-start gap-3">
                        {order.package_cover && (
                          <Image
                            src={order.package_cover}
                            className="w-16 h-16 rounded-lg flex-shrink-0"
                            mode="aspectFill"
                          />
                        )}
                        <View className="flex-1 min-w-0">
                          <Text className="text-base font-semibold text-gray-900 block truncate">
                            {order.package_name || order.shop_name}
                          </Text>
                          <View className="flex items-center gap-2 mt-1">
                            <Text className="text-sm text-gray-500">×{order.quantity}</Text>
                            <Text className="text-sm font-medium text-[#FF4757]">¥{order.total_amount}</Text>
                          </View>
                          <View className="flex items-center gap-1 mt-1">
                            <Clock size={12} color="#9ca3af" />
                            <Text className="text-xs text-gray-400">{formatDateTime(order.created_at)}</Text>
                          </View>
                        </View>
                      </View>
                      <View className="mt-3 pt-3 border-t border-gray-100">
                        <Button
                          className="w-full bg-[#FF4757] hover:bg-[#e63846] text-white rounded-lg"
                          onClick={() => handleParticipate(order)}
                        >
                          <Gift size={16} color="#ffffff" />
                          <Text className="ml-2">参与抽奖</Text>
                        </Button>
                      </View>
                    </CardContent>
                  </Card>
                ))}
              </View>
            )}
          </TabsContent>
        </Tabs>
      </View>

      {/* 核销码弹窗 */}
      <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
        <DialogContent className="bg-white rounded-2xl p-6 mx-auto items-center">
          <DialogHeader className="w-full items-center">
            <DialogTitle className="text-center text-base font-semibold text-gray-900">
              {currentRecord?.prize_name || '核销码'}
            </DialogTitle>
          </DialogHeader>
          <View className="w-full flex flex-col items-center mt-2">
            {/* 具体商品（霸王餐显示所购套餐） */}
            {currentRecord?.product_name && (
              <Text className="block text-sm text-gray-600 mb-2 text-center">
                {currentRecord.prize_type === 'free_meal' ? '霸王餐商品' : '商品'}：{currentRecord.product_name}
              </Text>
            )}
            {/* 商家信息卡片：店名 + 地址 + 导航 */}
            {currentRecord?.shop_name && (
              <View
                className="w-full bg-gray-50 rounded-xl p-4 mb-3 flex flex-col items-center text-center"
                onClick={() => handleNavigateToShop()}
              >
                <Text className="block text-sm font-semibold text-gray-800 text-center">
                  {currentRecord.shop_name}
                </Text>
                {currentRecord.shop_address && (
                  <View className="flex flex-row items-center justify-center mt-1">
                    <MapPin size={12} color="#9ca3af" />
                    <Text className="block text-xs text-gray-500 ml-1 text-center line-clamp-2">
                      {currentRecord.shop_address}
                    </Text>
                  </View>
                )}
                {(currentRecord.shop_latitude && currentRecord.shop_longitude) || currentRecord.shop_address ? (
                  <View className="flex items-center justify-center bg-[#FF4757] rounded-full px-3 py-2 mt-2">
                    <Navigation size={12} color="#ffffff" />
                    <Text className="text-xs text-white ml-1">导航</Text>
                  </View>
                ) : null}
              </View>
            )}
            {/* 过期提示 */}
            {currentRecord?.expired && !isRedeemed(currentRecord) ? (
              <View className="flex flex-col items-center py-6">
                <Text className="block text-lg font-bold text-red-600 text-center">兑奖已过期</Text>
                <Text className="block text-xs text-gray-400 mt-2 text-center">
                  兑奖有效期为 {currentRecord.expiry_hours} 小时，已于 {formatExpiryDate(currentRecord.expiry_date)} 过期
                </Text>
                <Text className="block text-xs text-gray-400 mt-1 text-center">如有疑问请联系商家</Text>
              </View>
            ) : (
              <>
                {/* 二维码 */}
                <View className="bg-white rounded-2xl p-3 border border-gray-100 flex items-center justify-center">
                  {qrLoading ? (
                    <View style={{ width: '200px', height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Text className="block text-sm text-gray-400 text-center">二维码加载中...</Text>
                    </View>
                  ) : qrCodeUrl ? (
                    <Image
                      src={qrCodeUrl}
                      mode="aspectFit"
                      style={{ width: '200px', height: '200px' }}
                    />
                  ) : (
                    <View style={{ width: '200px', height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Text className="block text-sm text-gray-400 text-center">二维码加载失败</Text>
                    </View>
                  )}
                </View>
                <Text className="block text-xs text-gray-400 mt-3 text-center">请出示给商家扫码核销</Text>
                {/* 兑换码 */}
                {currentRecord?.redemption_code && (
                  <View className="bg-amber-50 rounded-xl px-4 py-2 mt-3 flex flex-row items-center justify-center gap-2">
                    <Text className="block text-xs text-amber-500">兑换码</Text>
                    <Text className="block text-sm font-bold text-amber-800 tracking-wider">
                      {currentRecord.redemption_code}
                    </Text>
                  </View>
                )}
                {/* 有效期 */}
                {(currentRecord?.expiry_hours ?? 0) > 0 && (
                  <Text className="block text-xs text-gray-400 mt-2 text-center">
                    有效期至 {formatExpiryDate(currentRecord?.expiry_date)}
                  </Text>
                )}
              </>
            )}
          </View>
        </DialogContent>
      </Dialog>

      {/* 选择抽奖方式弹窗 */}
      <Dialog open={choiceOpen} onOpenChange={setChoiceOpen}>
        <DialogContent className="bg-white rounded-2xl p-6 sm:max-w-[340px] mx-auto items-center">
          <DialogHeader className="w-full items-center">
            <DialogTitle className="text-center text-base font-semibold text-gray-900">选择抽奖方式</DialogTitle>
          </DialogHeader>
          <Text className="block text-sm text-gray-500 text-center mt-1">
            「{choiceOrder?.package_name || choiceOrder?.shop_name || '该订单'}」可参与以下抽奖，同一订单只能选择一种
          </Text>
          <View className="w-full flex flex-col gap-3 mt-4">
            <Button
              className="w-full bg-[#FF4757] hover:bg-[#e63846] text-white rounded-full"
              onClick={goTeamLottery}
            >
              <Users size={16} color="#ffffff" />
              <Text className="ml-2">组队抽奖（邀请好友一起抽）</Text>
            </Button>
            <Button
              className="w-full bg-gray-900 text-white rounded-full"
              onClick={goNormalLottery}
            >
              <Gift size={16} color="#ffffff" />
              <Text className="ml-2">普通抽奖（单人盲盒）</Text>
            </Button>
          </View>
        </DialogContent>
      </Dialog>
    </View>
  )
}
