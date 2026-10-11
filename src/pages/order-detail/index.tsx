import { useState, useEffect, useRef } from 'react'
import Taro, { useRouter } from '@tarojs/taro'
import { View, Text, ScrollView, Image } from '@tarojs/components'
import { Network } from '@/network'
import { preloadSubscribeTemplates, requestSubscribeByScene } from '@/utils/subscribe-message'
import { formatPrice } from '@/lib/utils'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { Clock, CircleCheck, Info, ChevronRight, Store, Phone, MapPin, RefreshCw, Wallet, Sparkles, Gift, Sprout, Users } from 'lucide-react-taro'
import { orchardApi, type OrchardCoupon } from '@/lib/orchard-api'

interface Order {
  id: string
  order_no: string | null
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
  verified_count: number
  refunded_quantity?: number
  created_at: string
  pay_amount?: string | null
  original_amount?: string | null
  discount_amount?: string | null
  paid_at?: string | null
  pay_expire_at?: string | null
  merchant_id?: number | null
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
  merchant_id?: string | number | null
}

interface CommunityConfig {
  community_enabled: boolean
  community_title: string
  community_subtitle: string
  community_button_text: string
  community_qrcode_url: string | null
}

interface PrepayInfo {
  prepay_id: string
  channel: string
  original_amount: number
  discount_amount: number
  pay_amount: number
  discount_name: string | null
  pay_expire_at: string | null
  /** 果园满减券抵扣（叠加在抽奖折扣之后） */
  orchard_discount_amount?: number | null
  orchard_discount_name?: string | null
  orchard_coupon_code?: string | null
  /** 微信通道：小程序调起支付参数（后端二次签名） */
  wechat_pay?: {
    timeStamp: string
    nonceStr: string
    package: string
    signType: 'RSA'
    paySign: string
  }
}

const STATUS_CONFIG: Record<string, { label: string; bgGradient: string }> = {
  created: {
    label: '待支付',
    bgGradient: 'linear-gradient(135deg, #FF6B7A 0%, #FF4757 100%)',
  },
  paid: {
    label: '待使用',
    bgGradient: 'linear-gradient(135deg, #FF9F43 0%, #FF6B35 100%)',
  },
  used: {
    label: '已使用',
    bgGradient: 'linear-gradient(135deg, #52C41A 0%, #389E0D 100%)',
  },
  refunded: {
    label: '已退款',
    bgGradient: 'linear-gradient(135deg, #999999 0%, #666666 100%)',
  },
  expired: {
    label: '已过期',
    bgGradient: 'linear-gradient(135deg, #999999 0%, #666666 100%)',
  },
  closed: {
    label: '已关闭',
    bgGradient: 'linear-gradient(135deg, #999999 0%, #666666 100%)',
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
  const [prepayInfo, setPrepayInfo] = useState<PrepayInfo | null>(null)
  const [paying, setPaying] = useState(false)
  const [orchardCoupons, setOrchardCoupons] = useState<OrchardCoupon[]>([])
  const [selectedOrchardCoupon, setSelectedOrchardCoupon] = useState<string | null>(null)
  const orchardCouponRef = useRef<string | null>(null)
  const [countdownText, setCountdownText] = useState('')
  const [showPaySuccess, setShowPaySuccess] = useState(false)
  const [communityConfig, setCommunityConfig] = useState<CommunityConfig | null>(null)
  const [communityLoading, setCommunityLoading] = useState(true)
  const [teamLotteryEnabled, setTeamLotteryEnabled] = useState(false)
  /** 当前订单的抽奖参与状态：null=未参与, normal=已普通抽奖, team=已组队 */
  const [orderLotteryStatus, setOrderLotteryStatus] = useState<'normal' | 'team' | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    preloadSubscribeTemplates()
    if (id) {
      loadOrder()
    }
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current)
    }
  }, [id])

  useEffect(() => {
    if (order?.package_id) {
      loadPackageInfo(order.package_id)
    }
  }, [order?.package_id])

  useEffect(() => {
    const merchantId = packageInfo?.merchant_id || order?.merchant_id
    if (merchantId) {
      loadCommunityConfig(Number(merchantId))
    } else {
      loadCommunityConfig()
    }
  }, [packageInfo?.merchant_id, order?.merchant_id])

  // 已支付后加载核销二维码
  useEffect(() => {
    if (order?.status === 'paid') {
      loadQRCode()
    }
  }, [order?.status])

  // 待支付：加载支付金额明细 + 启动倒计时 + 拉取果园可用券
  useEffect(() => {
    if (order?.status === 'created') {
      loadPrepay(true)
      startCountdown(order.pay_expire_at)
      loadOrchardCoupons()
    }
  }, [order?.status, order?.pay_expire_at])

  /** 果园满减券：按订单金额过滤门槛，仅取未使用的券 */
  const loadOrchardCoupons = async () => {
    try {
      const userId = Taro.getStorageSync('user_id')
      if (!userId || !order) return
      const amount = toAmount(order.original_amount) || toAmount(order.price) * (order.quantity || 1)
      const res = await orchardApi.availableCoupons(userId, amount)
      if (res.code === 200 && Array.isArray(res.data)) {
        setOrchardCoupons(res.data.filter((c) => c.status === 'unused'))
      }
    } catch (e) {
      console.warn('[OrderDetail] 果园券加载失败:', e)
    }
  }

  /** 选择/取消果园券：重新预下单（后端换锁），金额明细实时刷新 */
  const handlePickOrchardCoupon = () => {
    const items = ['不使用优惠券', ...orchardCoupons.map((c) => `满${c.threshold}减${c.amount}元（${c.title}）`)]
    const currentIdx = selectedOrchardCoupon
      ? orchardCoupons.findIndex((c) => c.code === selectedOrchardCoupon) + 1
      : 0
    Taro.showActionSheet({
      itemList: items,
      success: async (r) => {
        if (r.tapIndex === currentIdx) return
        const code = r.tapIndex === 0 ? null : orchardCoupons[r.tapIndex - 1]?.code || null
        orchardCouponRef.current = code
        setSelectedOrchardCoupon(code)
        const data = await loadPrepay(true, code)
        if (!data && code) {
          Taro.showToast({ title: '该券暂不可用', icon: 'none' })
          orchardCouponRef.current = null
          setSelectedOrchardCoupon(null)
          loadPrepay(true, null)
        }
      },
    })
  }

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

  const loadTeamLotteryStatus = async () => {
    try {
      const merchantId = packageInfo?.merchant_id || order?.merchant_id
      if (!merchantId) return
      const res = await Network.request({
        url: `/api/team-lottery/merchants/${merchantId}/status`,
        method: 'GET',
      })
      const body = typeof res.data === 'string' ? JSON.parse(res.data) : res.data
      setTeamLotteryEnabled(!!body?.data?.enabled)
    } catch (err) {
      console.warn('[OrderDetail] 加载组队抽奖状态失败:', err)
    }
  }

  useEffect(() => {
    const merchantId = packageInfo?.merchant_id || order?.merchant_id
    if (merchantId && (order?.status === 'paid' || order?.status === 'used')) {
      loadTeamLotteryStatus()
    }
  }, [packageInfo?.merchant_id, order?.merchant_id, order?.status])

  /** 加载订单抽奖参与状态（普通/组队互斥前置检查） */
  const loadOrderLotteryStatus = async () => {
    if (!id) return
    try {
      const res = await Network.request({ url: `/api/lottery/order-status/${id}`, method: 'GET' })
      const body = typeof res.data === 'string' ? JSON.parse(res.data) : res.data
      const type = body?.data?.type || null
      setOrderLotteryStatus(type === 'normal' || type === 'team' ? type : null)
    } catch (err) {
      console.warn('[OrderDetail] 加载订单抽奖状态失败:', err)
    }
  }

  useEffect(() => {
    if (order?.status === 'paid' || order?.status === 'used') {
      loadOrderLotteryStatus()
    }
  }, [order?.status, id])

  /** 打开组队抽奖：已参与普通抽奖的订单不允许再组队 */
  const openTeamLottery = () => {
    setShowPaySuccess(false)
    const merchantId = packageInfo?.merchant_id || order?.merchant_id
    const packageId = order?.package_id
    if (orderLotteryStatus === 'normal') {
      Taro.showModal({
        title: '无法参与组队抽奖',
        content: '该订单已参与普通抽奖，同一订单只能选择一种抽奖方式',
        showCancel: false,
      })
      return
    }
    Taro.navigateTo({ url: `/pages/team-lottery/index?merchant_id=${merchantId}&package_id=${packageId}&order_id=${order?.id || id || ''}` })
  }

  /** 打开普通抽奖：已参与组队抽奖的订单不允许再普通抽奖 */
  const openNormalLottery = () => {
    setShowPaySuccess(false)
    if (orderLotteryStatus === 'team') {
      Taro.showModal({
        title: '无法参与普通抽奖',
        content: '该订单已参与组队抽奖，同一订单只能选择一种抽奖方式',
        showCancel: false,
      })
      return
    }
    Taro.navigateTo({ url: `/pages/lottery/index?orderId=${id}` })
  }

  const loadCommunityConfig = async (merchantId?: number) => {
    try {
      let cfg: any = null
      if (merchantId) {
        try {
          const merchantRes = await Network.request({
            url: `/api/merchants/${merchantId}/community-marketing`,
            method: 'GET',
          })
          const merchantBody = typeof merchantRes.data === 'string' ? JSON.parse(merchantRes.data) : merchantRes.data
          const merchantCfg = merchantBody?.data
          // 门店关闭或未配置时，自动回退到系统账号配置
          if (merchantCfg && merchantCfg.enabled) {
            cfg = merchantCfg
          }
        } catch (err) {
          console.warn('[OrderDetail] 加载门店社群营销配置失败:', err)
        }
      }
      if (!cfg) {
        const res = await Network.request({ url: '/api/customer-service/config', method: 'GET' })
        const body = typeof res.data === 'string' ? JSON.parse(res.data) : res.data
        cfg = body?.data
      }
      if (cfg) {
        // 门店配置字段为 enabled/title/subtitle/button_text/qrcode_url，系统配置字段为 community_ 前缀
        const isMerchantConfig = merchantId && cfg.enabled !== undefined && cfg.community_enabled === undefined
        setCommunityConfig({
          community_enabled: isMerchantConfig ? !!cfg.enabled : !!cfg.community_enabled,
          community_title: (isMerchantConfig ? cfg.title : cfg.community_title) || '加店长领券享88折',
          community_subtitle: (isMerchantConfig ? cfg.subtitle : cfg.community_subtitle) || '进群抽免单，天天享9折',
          community_button_text: (isMerchantConfig ? cfg.button_text : cfg.community_button_text) || '长按识别二维码加店长',
          community_qrcode_url: (isMerchantConfig ? cfg.qrcode_url : cfg.community_qrcode_url) || null,
        })
      }
    } catch (err) {
      console.warn('[OrderDetail] 加载社群营销配置失败:', err)
    } finally {
      setCommunityLoading(false)
    }
  }

  const handlePreviewCommunityQR = () => {
    const url = communityConfig?.community_qrcode_url
    if (!url) return
    Taro.previewImage({ urls: [url], current: url })
  }

  const handleImageError = (source: string) => (e: any) => {
    console.warn('[OrderDetail] 图片加载失败:', source, e?.detail?.errMsg || e)
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

  /** 未绑定微信时：引导微信授权绑定，成功后返回 true（调用方应重试支付） */
  const promptBindWechat = async (): Promise<boolean> => {
    const env = Taro.getEnv()
  const isMiniApp = env === Taro.ENV_TYPE.WEAPP || env === Taro.ENV_TYPE.TT
    if (!isMiniApp) {
      Taro.showToast({ title: '请在微信小程序中打开完成绑定', icon: 'none' })
      return false
    }
    const modal = await Taro.showModal({
      title: '绑定微信支付',
      content: '当前账号未绑定微信，无法发起微信支付。是否立即绑定当前微信号？',
      confirmText: '立即绑定',
      cancelText: '取消'
    })
    if (!modal.confirm) return false
    try {
      const loginRes = await Taro.login()
      if (!loginRes.code) throw new Error('未获取到微信授权码')
      const userId = Taro.getStorageSync('user_id')
      const res = await Network.request({
        url: '/api/users/bind-wechat',
        method: 'POST',
        data: { user_id: userId, code: loginRes.code }
      })
      console.log('[订单详情] 绑定微信响应:', JSON.stringify(res.data))
      const body = res.data as { code?: number; msg?: string; message?: string }
      if (res.statusCode >= 400 || (body?.code !== undefined && body.code !== 200)) {
        throw new Error(body?.msg || body?.message || '绑定失败')
      }
      Taro.showToast({ title: '绑定成功', icon: 'none' })
      return true
    } catch (err: any) {
      Taro.showToast({ title: err?.message || '绑定失败，请重试', icon: 'none' })
      return false
    }
  }

  /** 预下单：后端金额引擎计算实付（含抽奖券+果园券抵扣），前端只展示 */
  const loadPrepay = async (silent = false, orchardCouponCode?: string | null): Promise<PrepayInfo | null> => {
    try {
      const userId = Taro.getStorageSync('user_id')
      if (!userId) return null
      const couponCode = orchardCouponCode === undefined ? orchardCouponRef.current : orchardCouponCode
      console.log('[OrderDetail] 请求预下单, order_id:', id, '果园券:', couponCode)
      const res = await Network.request({
        url: '/api/payment/prepay',
        method: 'POST',
        data: { order_id: id, user_id: userId, orchard_coupon_code: couponCode || undefined },
      })
      console.log('[OrderDetail] 预下单响应:', res.data)
      const data = res.data?.data || res.data
      if (data?.prepay_id) {
        setPrepayInfo(data)
        // 恢复此前会话中已锁定的果园券选中态
        if (orchardCouponCode === undefined && data.orchard_coupon_code && !orchardCouponRef.current) {
          orchardCouponRef.current = data.orchard_coupon_code
          setSelectedOrchardCoupon(data.orchard_coupon_code)
        }
        return data as PrepayInfo
      }
      // prepay 失败（如支付通道未配置）：透传后端真实错误，避免静默无反应；自动预取时静默
      if (!silent) {
        const errMsg = (res.data as { message?: string })?.message
        if (errMsg && String(errMsg).includes('未绑定微信')) {
          const bound = await promptBindWechat()
          if (bound) return loadPrepay()
          return null
        }
        Taro.showToast({ title: errMsg ? String(errMsg).slice(0, 30) : '获取支付信息失败', icon: 'none' })
      }
    } catch (err: any) {
      console.error('[OrderDetail] 预下单失败:', err)
      const errMsg = err?.data?.message
      if (errMsg && String(errMsg).includes('未绑定微信')) {
        const bound = await promptBindWechat()
        if (bound) return loadPrepay()
        return null
      }
      Taro.showToast({ title: errMsg || '获取支付信息失败', icon: 'none' })
    }
    return null
  }

  const startCountdown = (expireAt?: string | null) => {
    if (countdownRef.current) clearInterval(countdownRef.current)
    if (!expireAt) {
      setCountdownText('')
      return
    }
    const tick = () => {
      const remain = new Date(expireAt).getTime() - Date.now()
      if (remain <= 0) {
        setCountdownText('已超时')
        if (countdownRef.current) clearInterval(countdownRef.current)
        // 超时后刷新订单（后端懒关单会置为 closed）
        loadOrder()
        return
      }
      const mm = Math.floor(remain / 60000)
      const ss = Math.floor((remain % 60000) / 1000)
      setCountdownText(`${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`)
    }
    tick()
    countdownRef.current = setInterval(tick, 1000)
  }

  /** 轮询等待微信支付回调落库（订单 → paid），最长约 8 秒 */
  const waitOrderPaid = async (): Promise<boolean> => {
    for (let i = 0; i < 8; i++) {
      await new Promise((r) => setTimeout(r, 1000))
      try {
        const res = await Network.request({ url: `/api/orders/${id}` })
        const data = res.data?.data || res.data
        if (data?.status === 'paid' || data?.status === 'used') return true
      } catch (e) {
        console.warn('[OrderDetail] 轮询订单状态失败:', e)
      }
    }
    return false
  }

  /** 立即支付：微信通道（小程序真实支付）/ Mock 通道（H5、开发态） */
  const handlePay = async () => {
    if (paying) return
    // 支付点击瞬间同步请求订阅授权（订单付款/核销/退款结果通知），不阻断支付流程
    requestSubscribeByScene('order')
    setPaying(true)
    try {
      let prepay = prepayInfo
      if (!prepay?.prepay_id) {
        prepay = await loadPrepay()
      }
      if (!prepay?.prepay_id) {
        setPaying(false)
        return
      }

      // ===== 微信通道：小程序端调起真实微信支付，订单状态以微信回调为准 =====
      if (prepay.channel === 'wechat' && prepay.wechat_pay && Taro.getEnv() === Taro.ENV_TYPE.WEAPP) {
        console.log('[OrderDetail] 调起微信支付, prepay_id:', prepay.prepay_id)
        try {
          await Taro.requestPayment({
            timeStamp: prepay.wechat_pay.timeStamp,
            nonceStr: prepay.wechat_pay.nonceStr,
            package: prepay.wechat_pay.package,
            signType: prepay.wechat_pay.signType,
            paySign: prepay.wechat_pay.paySign,
          })
        } catch (payErr: any) {
          console.warn('[OrderDetail] 微信支付未完成:', payErr?.errMsg)
          Taro.showToast({
            title: payErr?.errMsg?.includes('cancel') ? '已取消支付' : '支付未完成，请重试',
            icon: 'none',
          })
          return
        }
        // 用户支付成功：等待微信异步回调落库（状态以回调为准，前端不直接改状态）
        const paid = await waitOrderPaid()
        if (countdownRef.current) clearInterval(countdownRef.current)
        setPrepayInfo(null)
        await loadOrder()
        if (paid) {
          setShowPaySuccess(true)
        } else {
          Taro.showToast({ title: '支付确认中，请稍后刷新查看', icon: 'none' })
        }
        return
      }

      // ===== Mock 通道（H5 / 开发态）：模拟微信异步回调 =====
      console.log('[OrderDetail] 发起 Mock 支付回调, prepay_id:', prepay.prepay_id)
      const res = await Network.request({
        url: '/api/payment/mock-notify',
        method: 'POST',
        data: { prepay_id: prepay.prepay_id, result: 'success' },
      })
      console.log('[OrderDetail] 支付回调响应:', res.data)
      const data = res.data?.data || res.data
      if (data?.status === 'paid') {
        if (countdownRef.current) clearInterval(countdownRef.current)
        setPrepayInfo(null)
        await loadOrder()
        setShowPaySuccess(true)
      } else {
        const errMsg = (res.data as { message?: string })?.message
        Taro.showToast({ title: errMsg ? String(errMsg).slice(0, 30) : '支付未完成，请重试', icon: 'none' })
      }
    } catch (err: any) {
      console.error('[OrderDetail] 支付失败:', err)
      const errMsg = err?.data?.message
      if (errMsg && String(errMsg).includes('未绑定微信')) {
        const bound = await promptBindWechat()
        if (bound) return handlePay()
        return
      }
      Taro.showToast({ title: errMsg || '支付失败，请重试', icon: 'none' })
    } finally {
      setPaying(false)
    }
  }

  /** 申请退款（跳转退款申请页：选择份数/原因/金额明细） */
  const handleRefund = () => {
    Taro.navigateTo({ url: `/pages/refund-apply/index?id=${id}` })
  }


  const handleRefreshQR = async () => {
    setRefreshingQR(true)
    await loadQRCode()
    setRefreshingQR(false)
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

  const toAmount = (v: string | number | null | undefined) => parseFloat(String(v || '0')) || 0

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

  const statusCfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.paid
  const isCreated = order.status === 'created'
  const isPaid = order.status === 'paid'
  const verifiedCount = order.verified_count || 0
  const totalQty = order.quantity || 1
  // 可退条件：已支付且仍有未核销、未退款份数（已核销/已退款的份数均不可再退）
  const refundedQty = order.refunded_quantity || 0
  const refundableQty = Math.max(totalQty - verifiedCount - refundedQty, 0)
  const canRefund = isPaid && refundableQty > 0

  // 金额明细：优先用 prepay 返回（含券抵扣），否则用订单字段兜底
  const originalAmount = prepayInfo
    ? prepayInfo.original_amount
    : toAmount(order.original_amount) || toAmount(order.price) * (order.quantity || 1)
  const discountAmount = prepayInfo ? prepayInfo.discount_amount : toAmount(order.discount_amount)
  const orchardDiscountAmount = prepayInfo?.orchard_discount_amount || 0
  const payAmount = prepayInfo
    ? prepayInfo.pay_amount
    : Math.max(originalAmount - discountAmount, 0.01)

  return (
    <View className="flex flex-col h-screen bg-gray-100">
      {/* 状态横幅 */}
      <View style={{ background: statusCfg.bgGradient }} className="px-5 pt-4 pb-6">
        <View className="flex flex-col items-center mt-2">
          <View className="flex flex-row items-center gap-2 mb-1">
            {order.status === 'used' ? (
              <CircleCheck size={28} color="#FFFFFF" />
            ) : (
              <Clock size={28} color="#FFFFFF" />
            )}
            <Text className="block text-2xl font-bold text-white">{statusCfg.label}</Text>
          </View>
          {isCreated && (
            <Text className="block text-xs text-white opacity-80 mt-1">
              {countdownText && countdownText !== '已超时'
                ? `请在 ${countdownText} 内完成支付，超时订单将自动关闭`
                : '订单已超时，请重新下单'}
            </Text>
          )}
          {isPaid && (
            <Text className="block text-xs text-white opacity-80 mt-1">
              {order.quantity > 1
                ? '共' + order.quantity + '份，已核销' + (order.verified_count || 0) + '份' + ((order.refunded_quantity || 0) > 0 ? '，已退款' + order.refunded_quantity + '份' : '') + '，剩余' + (order.quantity - (order.verified_count || 0) - (order.refunded_quantity || 0)) + '份'
                : '请在有效期内到店使用'}
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
        {/* 待支付：支付金额卡片 */}
        {isCreated && (
          <View className="mx-4 rounded-2xl bg-white overflow-hidden">
            <View className="flex flex-row items-center gap-2 px-4 pt-4 pb-1">
              <Wallet size={16} color="#FF4757" />
              <Text className="block text-sm font-semibold text-gray-900">支付金额</Text>
            </View>
            <View className="px-4 py-3">
              <View className="flex flex-row justify-between items-center py-2">
                <Text className="block text-sm text-gray-400">订单金额</Text>
                <Text className="block text-sm text-gray-800">¥{originalAmount.toFixed(2)}</Text>
              </View>
              {discountAmount > 0 && (
                <>
                  <Separator />
                  <View className="flex flex-row justify-between items-center py-2">
                    <Text className="block text-sm text-gray-400">
                      {prepayInfo?.discount_name || '抽奖优惠抵扣'}
                    </Text>
                    <Text className="block text-sm font-semibold text-[#52C41A]">
                      -¥{discountAmount.toFixed(2)}
                    </Text>
                  </View>
                </>
              )}
              {/* 果园满减券：种树收获的券可在本单直接抵扣 */}
              {orchardCoupons.length > 0 && (
                <>
                  <Separator />
                  <View className="flex flex-row justify-between items-center py-2" onClick={handlePickOrchardCoupon}>
                    <View className="flex flex-row items-center gap-1">
                      <Sprout size={14} color="#16A34A" />
                      <Text className="block text-sm text-gray-400">果园满减券</Text>
                    </View>
                    <View className="flex flex-row items-center gap-1">
                      {selectedOrchardCoupon ? (
                        <Text className="block text-sm font-semibold text-[#16A34A]">
                          {(() => {
                            const c = orchardCoupons.find((x) => x.code === selectedOrchardCoupon)
                            return c ? `满${c.threshold}减${c.amount}元` : '已选 1 张'
                          })()}
                        </Text>
                      ) : (
                        <Text className="block text-sm text-[#FF4757]">{orchardCoupons.length} 张可用</Text>
                      )}
                      <ChevronRight size={14} color="#9CA3AF" />
                    </View>
                  </View>
                </>
              )}
              {orchardDiscountAmount > 0 && (
                <>
                  <Separator />
                  <View className="flex flex-row justify-between items-center py-2">
                    <Text className="block text-sm text-gray-400">
                      {prepayInfo?.orchard_discount_name || '果园满减券抵扣'}
                    </Text>
                    <Text className="block text-sm font-semibold text-[#16A34A]">
                      -¥{orchardDiscountAmount.toFixed(2)}
                    </Text>
                  </View>
                </>
              )}
              <Separator />
              <View className="flex flex-row justify-between items-center py-2">
                <Text className="block text-sm text-gray-400">实付金额</Text>
                <Text className="block text-xl font-bold text-[#FF4757]">¥{payAmount.toFixed(2)}</Text>
              </View>
            </View>

            {/* 抽奖提示（纯文案，不可点击） */}
            <View
              className="mx-4 mb-3 rounded-xl flex flex-row items-center gap-2 px-3 py-3"
              style={{ background: 'linear-gradient(135deg, #FFF7E6 0%, #FFF0DB 100%)' }}
            >
              <Sparkles size={18} color="#FF9F43" />
              <View className="flex-1">
                <Text className="block text-xs font-semibold text-[#B88230]">支付成功后即可抽奖，赢霸王餐/折扣券/商品券</Text>
                <Text className="block text-xs text-[#D6A95C] mt-1">中奖折扣券或霸王餐，中奖金额自动退还原账户</Text>
              </View>
            </View>

            {/* 立即支付按钮 */}
            <View className="px-4 pb-4">
              <Button
                className="w-full h-12 rounded-xl text-base font-semibold"
                style={{ background: 'linear-gradient(135deg, #FF6B7A 0%, #FF4757 100%)', color: '#fff' }}
                disabled={paying || countdownText === '已超时'}
                onClick={handlePay}
              >
                <Text>{paying ? '支付中...' : `立即支付 ¥${payAmount.toFixed(2)}`}</Text>
              </Button>
              {countdownText === '已超时' && (
                <Text className="block text-center text-xs text-gray-400 mt-2">订单已超时关闭，请重新下单</Text>
              )}
            </View>
          </View>
        )}

        {/* 已支付：二维码卡片 */}
        {isPaid && (
          <View className="mx-4 rounded-2xl bg-white overflow-hidden">
            <View className="flex flex-col items-center px-6 pt-6 pb-2">
              {qrcode ? (
                <View className="p-4 rounded-2xl" style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
                  <Image
                    src={qrcode}
                    style={{ width: '170px', height: '170px' }}
                    mode="aspectFit"
                    onError={handleImageError('qrcode')}
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
                  onError={handleImageError('cover_image')}
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
                <Text className="block text-lg font-bold text-[#FF4757]">
                  ¥{formatPrice(order.price)}
                </Text>
                {order.original_price && parseFloat(String(order.original_price)) > parseFloat(String(order.price)) && (
                  <Text className="block text-xs text-gray-400 line-through">
                    ¥{formatPrice(order.original_price)}
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

        {/* 社群营销卡片 */}
        {!communityLoading && communityConfig?.community_enabled && communityConfig.community_qrcode_url && (
          <View className="mx-4 mt-3 rounded-2xl bg-white overflow-hidden">
            <View className="flex flex-row items-center px-4 pt-4 pb-1">
              <Text className="block text-sm font-semibold text-gray-900">社群福利</Text>
            </View>
            <View className="px-4 py-4">
              <View className="flex flex-row items-center gap-4">
                <View className="flex-1 flex flex-col justify-center">
                  <Text className="block text-lg font-bold text-gray-900 leading-tight">
                    {communityConfig.community_title}
                  </Text>
                  <Text className="block text-sm text-gray-500 mt-2">
                    {communityConfig.community_subtitle}
                  </Text>
                  <View
                    className="mt-4 self-start px-4 py-2 rounded-full"
                    style={{ background: 'linear-gradient(135deg, #FF6B7A 0%, #FF4757 100%)' }}
                  >
                    <Text className="block text-sm font-semibold text-white">
                      {communityConfig.community_button_text}
                    </Text>
                  </View>
                </View>
                <View
                  className="w-28 h-28 rounded-xl overflow-hidden bg-gray-50 border border-gray-100 flex-shrink-0"
                  onClick={handlePreviewCommunityQR}
                >
                  <Image
                    src={communityConfig.community_qrcode_url}
                    className="w-full h-full"
                    mode="aspectFit"
                    showMenuByLongpress
                    onError={handleImageError('community_qrcode')}
                  />
                </View>
              </View>
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
              <Text className="block text-sm text-gray-800 font-mono">{order.order_no || order.id.slice(0, 18).toUpperCase()}</Text>
            </View>
            <Separator />
            <View className="flex flex-row justify-between items-center py-2">
              <Text className="block text-sm text-gray-400">下单时间</Text>
              <Text className="block text-sm text-gray-800">{formatDate(order.created_at)}</Text>
            </View>
            {order.paid_at && (
              <>
                <Separator />
                <View className="flex flex-row justify-between items-center py-2">
                  <Text className="block text-sm text-gray-400">支付时间</Text>
                  <Text className="block text-sm text-gray-800">{formatDate(order.paid_at)}</Text>
                </View>
              </>
            )}
            {(order.status === 'paid' || order.status === 'used' || order.status === 'refunded') && toAmount(order.pay_amount) > 0 && (
              <>
                <Separator />
                <View className="flex flex-row justify-between items-center py-2">
                  <Text className="block text-sm text-gray-400">实付金额</Text>
                  <Text className="block text-sm font-semibold text-[#FF4757]">¥{toAmount(order.pay_amount).toFixed(2)}</Text>
                </View>
                {toAmount(order.discount_amount) > 0 && (
                  <>
                    <Separator />
                    <View className="flex flex-row justify-between items-center py-2">
                      <Text className="block text-sm text-gray-400">优惠抵扣（抽奖/果园券）</Text>
                      <Text className="block text-sm font-semibold text-[#52C41A]">-¥{toAmount(order.discount_amount).toFixed(2)}</Text>
                    </View>
                  </>
                )}
              </>
            )}
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
            <Separator />
            <View className="flex flex-row justify-between items-center py-2">
              <Text className="block text-sm text-gray-400">核销进度</Text>
              <Text className="block text-sm font-semibold text-[#FF4757]">
                {order.verified_count || 0} / {order.quantity || 1} 已核销
              </Text>
            </View>
            {(order.refunded_quantity || 0) > 0 && (
              <>
                <Separator />
                <View className="flex flex-row justify-between items-center py-2">
                  <Text className="block text-sm text-gray-400">已退款份数</Text>
                  <Text className="block text-sm font-semibold text-orange-500">{order.refunded_quantity} 份已退款</Text>
                </View>
              </>
            )}
            {order.verification_code && (order.status === 'paid' || order.status === 'used') && (
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
                style={{ backgroundColor: isCreated ? '#FFF0F0' : isPaid ? '#FFF3ED' : order.status === 'used' ? '#F6FFED' : '#F5F5F5' }}
              >
                <Text
                  className="block text-xs font-medium"
                  style={{ color: isCreated ? '#FF4757' : isPaid ? '#FF6B35' : order.status === 'used' ? '#52C41A' : '#999' }}
                >
                  {statusCfg.label}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* 已支付订单：抽奖入口 */}
        {(isPaid || order.status === 'used') && (
          <View className="mx-4 mt-3">
            {teamLotteryEnabled ? (
              <View style={{ display: 'flex', flexDirection: 'row', gap: '8px' }}>
                <View style={{ flex: 1 }}>
                  <Button
                    className="w-full h-11 rounded-xl border-0"
                    style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #A855F7 100%)' }}
                    onClick={openTeamLottery}
                  >
                    <View className="flex flex-row items-center gap-1">
                      <Users size={16} color="#FFFFFF" />
                      <Text className="block text-sm font-semibold text-white">组队抽奖</Text>
                    </View>
                  </Button>
                </View>
                <View style={{ flex: 1 }}>
                  <Button
                    className="w-full h-11 rounded-xl border-0"
                    style={{ background: 'linear-gradient(135deg, #FF4757 0%, #FF6B81 100%)' }}
                    onClick={openNormalLottery}
                  >
                    <View className="flex flex-row items-center gap-1">
                      <Gift size={16} color="#FFFFFF" />
                      <Text className="block text-sm font-semibold text-white">普通抽奖</Text>
                    </View>
                  </Button>
                </View>
              </View>
            ) : (
              <Button
                className="w-full h-11 rounded-xl border-0"
                style={{ background: 'linear-gradient(135deg, #FF4757 0%, #FF6B81 100%)' }}
                onClick={() => Taro.navigateTo({ url: `/pages/lottery/index?orderId=${id}` })}
              >
                <View className="flex flex-row items-center gap-2">
                  <Gift size={16} color="#FFFFFF" />
                  <Text className="block text-sm font-semibold text-white">去抽奖赢免单</Text>
                </View>
              </Button>
            )}
          </View>
        )}

        {/* 退款入口：已支付且有未核销份数（已核销份数不可退） */}
        {canRefund && (
          <View className="mx-4 mt-3">
            <Button
              variant="outline"
              className="w-full h-11 rounded-xl text-sm"

              onClick={handleRefund}
            >
              <Text>{verifiedCount > 0 || refundedQty > 0 ? `申请退款（已核销${verifiedCount}份 · 已退款${refundedQty}份 · 可退${refundableQty}份）` : '申请退款（未消费随时退）'}</Text>
            </Button>
          </View>
        )}

        {/* 使用说明卡片 */}
        <View className="mx-4 mt-3 rounded-2xl bg-white overflow-hidden">
          <View className="flex flex-row items-center gap-2 px-4 pt-4 pb-1">
            <Info size={16} color="#666" />
            <Text className="block text-sm font-semibold text-gray-900">使用说明</Text>
          </View>
          <View className="px-4 py-3">
            <View className="flex flex-col gap-2">
              <View className="flex flex-row items-start gap-2">
                <View className="w-4 h-4 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 mt-1">
                  <Text className="block text-[#FF4757]" style={{ fontSize: '10px', lineHeight: '16px' }}>1</Text>
                </View>
                <Text className="block text-xs text-gray-500 leading-5 flex-1">
                  到店消费时请出示本页面的二维码或核销码
                </Text>
              </View>
              <View className="flex flex-row items-start gap-2">
                <View className="w-4 h-4 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 mt-1">
                  <Text className="block text-[#FF4757]" style={{ fontSize: '10px', lineHeight: '16px' }}>2</Text>
                </View>
                <Text className="block text-xs text-gray-500 leading-5 flex-1">
                  商家使用微信扫一扫扫描二维码即可完成核销
                </Text>
              </View>
              <View className="flex flex-row items-start gap-2">
                <View className="w-4 h-4 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 mt-1">
                  <Text className="block text-[#FF4757]" style={{ fontSize: '10px', lineHeight: '16px' }}>3</Text>
                </View>
                <Text className="block text-xs text-gray-500 leading-5 flex-1">
                  核销后订单状态变更为已使用，不可重复使用
                </Text>
              </View>
              <View className="flex flex-row items-start gap-2">
                <View className="w-4 h-4 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 mt-1">
                  <Text className="block text-[#FF4757]" style={{ fontSize: '10px', lineHeight: '16px' }}>4</Text>
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



      {/* 支付成功弹层（自定义活泼风格） */}
      {showPaySuccess && (
        <View
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.55)', zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <View className="pay-success-pop relative mx-8 w-full max-w-sm rounded-3xl bg-white px-6 pb-6 pt-10 flex flex-col items-center overflow-visible">
            {/* 彩色撒花装饰 */}
            <View className="absolute rounded-full" style={{ top: 28, left: 36, width: 10, height: 10, backgroundColor: '#FFD666' }} />
            <View className="absolute rounded-full" style={{ top: 52, left: 20, width: 7, height: 7, backgroundColor: '#95DE64' }} />
            <View className="absolute rounded-full" style={{ top: 36, right: 40, width: 8, height: 8, backgroundColor: '#69C0FF' }} />
            <View className="absolute rounded-full" style={{ top: 64, right: 24, width: 6, height: 6, backgroundColor: '#FF85C0' }} />
            <View className="absolute rounded-full" style={{ top: 20, right: 78, width: 5, height: 5, backgroundColor: '#B37FEB' }} />

            {/* 渐变对勾圆 + 光晕 */}
            <View className="pay-success-badge relative flex items-center justify-center rounded-full" style={{ width: 88, height: 88, background: 'linear-gradient(135deg, #FF6B6B 0%, #FF9F43 100%)', boxShadow: '0 8px 24px rgba(255,107,107,0.35)' }}>
              <View className="absolute rounded-full" style={{ width: 112, height: 112, backgroundColor: 'rgba(255,159,67,0.15)' }} />
              <CircleCheck size={44} color="#FFFFFF" strokeWidth={2.5} />
            </View>

            {/* 文案 */}
            <Text className="block text-xl font-bold text-gray-900 mt-5">支付成功啦</Text>
            {teamLotteryEnabled ? (
              <Text className="block text-sm text-gray-500 mt-2 text-center">选择抽奖方式，好运等你来</Text>
            ) : (
              <Text className="block text-sm text-gray-500 mt-2 text-center">好运已到账，快去抽奖赢霸王餐吧</Text>
            )}

            {/* 按钮组 */}
            {teamLotteryEnabled ? (
              <>
                <Button
                  className="w-full h-12 rounded-full mt-6 border-0 shadow-lg"
                  style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #A855F7 100%)' }}
                  onClick={openTeamLottery}
                >
                  <View className="flex flex-row items-center gap-2">
                    <Users size={18} color="#FFFFFF" />
                    <Text className="block text-base font-semibold text-white">组队抽奖</Text>
                  </View>
                </Button>
                <Button
                  className="w-full h-11 rounded-full mt-3 bg-gradient-to-r from-[#FF4757] to-[#FF6B81] border-0 shadow-lg"
                  onClick={openNormalLottery}
                >
                  <View className="flex flex-row items-center gap-2">
                    <Gift size={18} color="#FFFFFF" />
                    <Text className="block text-base font-semibold text-white">普通抽奖</Text>
                  </View>
                </Button>
              </>
            ) : (
              <Button
                className="w-full h-12 rounded-full mt-6 bg-gradient-to-r from-[#FF4757] to-[#FF6B81] border-0 shadow-lg"
                onClick={() => {
                  setShowPaySuccess(false)
                  Taro.navigateTo({ url: `/pages/lottery/index?orderId=${id}` })
                }}
              >
                <View className="flex flex-row items-center gap-2">
                  <Gift size={18} color="#FFFFFF" />
                  <Text className="block text-base font-semibold text-white">去抽奖赢免单</Text>
                </View>
              </Button>
            )}
            <Button
              variant="outline"
              className="w-full h-11 rounded-full mt-3 border-gray-200"
              onClick={() => setShowPaySuccess(false)}
            >
              <Text className="block text-sm text-gray-600">查看订单</Text>
            </Button>
          </View>
        </View>
      )}
    </View>
  )
}
