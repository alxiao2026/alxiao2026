import { useState, useEffect, useMemo, useRef } from 'react'
import Taro, { useRouter, useDidShow, useShareAppMessage } from '@tarojs/taro'
import { View, Text, Image } from '@tarojs/components'
import { Network } from '@/network'
import { preloadSubscribeTemplates, requestSubscribeByScene } from '@/utils/subscribe-message'
import { navigateToTabBar } from '@/utils/navigate'
import { Button } from '@/components/ui/button'
import AppTabBar from '@/components/app-tab-bar'
import {
  Gift,
  Ticket,
  Coffee,
  UtensilsCrossed,
  House,
  Share2,
  PartyPopper,
  Sparkles,
} from 'lucide-react-taro'
import { formatDateTime } from '@/lib/utils'
import './index.css'

type Stage = 'loading' | 'select' | 'opening' | 'result'

interface DrawResultData {
  is_winner: boolean
  prize_name: string
  prize_type?: string
  image_url?: string
  redemption_code?: string
  refund_amount?: string
  coupon_amount?: string
  coupon_min_spend?: string
  discount_rate?: number
  discount_cap?: number
  discount_capped?: boolean
  product_name?: string
  record_id?: string
  refund_status?: string
  expired?: boolean
  expiry_hours?: number
  expiry_date?: string
}

interface PrizePoolItem {
  id: string
  name: string
  prize_type?: string
  image_url?: string | null
}

const LOGO_URL =
  'https://coze-coding-project.tos.coze.site/coze_storage_7662281810482692131/logo_new_pengtuan_2d6e000c.png?sign=1786611400-ab636b32a4-0-481e336cec57d85a4be349e1365bbc63d2a048d78e79de1c43bc7c0cc8dbdea9'

// 顶部标题区卡片图（膨胀盲盒大标题 + 副标题 + 装饰，按参考设计稿切图）
const TITLE_CARD_URL =
  'https://coze-coding-project.tos.coze.site/coze_storage_7665771487420678144/lottery/title_card_f19ec67b.jpg?sign=1787462487-e5e95baf36-0-60f38917a60395dd4a8b20ba47fcf8f70c600030174c3dcd403e4dde7828161c'

// 6 个盲盒图片（用户提供的 3D 黏土风，不裁切原始比例，TOS 存储）
const BOX_IMAGES = [
  'https://coze-coding-project.tos.coze.site/coze_storage_7665771487420678144/lottery/full_box_01_71b79235.jpg?sign=1787471315-f0df2855a5-0-a8eee7d11331d50154a76b5ef3f156ba743239c5a857ee29f0808df066dc4e3e',
  'https://coze-coding-project.tos.coze.site/coze_storage_7665771487420678144/lottery/full_box_02_b67fc1f7.jpg?sign=1787471315-6fa305fa43-0-4175e00faeba9d80a9eada841375fcc2d6834f2b2f70472f1da194a7f8d1758d',
  'https://coze-coding-project.tos.coze.site/coze_storage_7665771487420678144/lottery/full_box_03_ae83f602.jpg?sign=1787471316-8fec97d945-0-b00ca560dc83e7423243fc3ae0ba7f6fae6417584b727330d930420d4610da5f',
  'https://coze-coding-project.tos.coze.site/coze_storage_7665771487420678144/lottery/full_box_04_c9420ef2.jpg?sign=1787471317-af9a1b724f-0-41af6f9d4ad190e6200a28646bb2424ae11072eb7dc32ed7a4934da0ef0770a3',
  'https://coze-coding-project.tos.coze.site/coze_storage_7665771487420678144/lottery/full_box_05_21225e6f.jpg?sign=1787471318-92250a8d49-0-6777e37e416c89ffaf640acbc6fc7011cf49b4cd86f94544dd90a6c614a30e9c',
  'https://coze-coding-project.tos.coze.site/coze_storage_7665771487420678144/lottery/full_box_06_513884ca.jpg?sign=1787471318-b5fd5b0a49-0-7fd587b797f06bf4c4410600153c88ee19eec6ae91a5c387a4db69369df57cf9',
]


const CONFETTI_COLORS = ['#FF6B9D', '#FFA502', '#F7B731', '#45AAF2', '#A55EEA', '#FF8A5C', '#2ED573', '#FFFFFF']

// 中奖弹窗吉祥物盒子图（设计稿切图，底色已羽化为奶油色，TOS 存储）
const MASCOT_POPUP_URL =
  'https://coze-coding-project.tos.coze.site/coze_storage_7665771487420678144/lottery/popup_mascot_box_v3_7348436c.png?sign=1816447151-18db31b37c-0-9c4deb7f1db9de651dac418676b92f3b20ad560b1f14704e7a18ca7a2775ff7f'

const POOL_ICON_COLORS = ['#FF6B9D', '#A55EEA', '#45AAF2', '#2ED573']

export default function Lottery() {
  const router = useRouter()
  const orderId = router.params?.orderId || ''
  const recordId = router.params?.recordId || ''

  const [stage, setStage] = useState<Stage>('loading')
  const [userId, setUserId] = useState('')
  const [selectedBox, setSelectedBox] = useState<number | null>(null)
  const [needShare, setNeedShare] = useState(false)
  const [sharePending, setSharePending] = useState(false)
  const [drawResult, setDrawResult] = useState<DrawResultData | null>(null)
  const [exploding, setExploding] = useState(false)
  const [drawing, setDrawing] = useState(false)
  const [prizePool, setPrizePool] = useState<PrizePoolItem[]>([])
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('')
  const [showQrView, setShowQrView] = useState(false)

  const stateRef = useRef({ sharePending, orderId, selectedBox, stage })
  stateRef.current = { sharePending, orderId, selectedBox, stage }

  const env = Taro.getEnv()
  const isMiniApp = env === Taro.ENV_TYPE.WEAPP || env === Taro.ENV_TYPE.TT

  // 中奖彩带粒子
  const confetti = useMemo(
    () =>
      Array.from({ length: 26 }, (_, i) => ({
        id: i,
        left: `${(i * 37) % 100}%`,
        delay: `${(i % 8) * 0.25}s`,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        size: i % 3 === 0 ? 10 : 7,
        round: i % 2 === 0,
      })),
    []
  )

  // 开盒金光粒子
  const sparkles = useMemo(
    () =>
      Array.from({ length: 10 }, (_, i) => ({
        id: i,
        left: `${8 + ((i * 23) % 84)}%`,
        delay: `${(i % 5) * 0.12}s`,
        size: 6 + (i % 4) * 3,
        color: ['#FFD700', '#FFF3B0', '#FFB340', '#FFFFFF'][i % 4],
        round: i % 2 === 0,
      })),
    []
  )

  useShareAppMessage(() => {
    return {
      title: '膨胀团幸运盲盒，快来帮我开出霸王餐！',
      path: '/pages/index/index',
    }
  })

  // 中奖后获取核销二维码（商品/霸王餐等可核销类型）
  useEffect(() => {
    preloadSubscribeTemplates()
  }, [])

  useEffect(() => {
    const redeemableTypes = ['product', 'free_meal', 'refund']
    if (stage === 'result' && drawResult?.prize_type && redeemableTypes.includes(drawResult.prize_type) && drawResult?.record_id && !qrCodeUrl && drawResult?.refund_status !== 'voided') {
      console.log('[Lottery] 获取核销二维码', { record_id: drawResult.record_id, prize_type: drawResult.prize_type })
      Network.request({ url: `/api/lottery/qrcode/${drawResult.record_id}`, method: 'GET' })
        .then((res) => {
          console.log('[Lottery] 核销二维码响应', res.data)
          const data = (res.data as any)?.data
          if (data?.qrcode) {
            setQrCodeUrl(data.qrcode)
          }
        })
        .catch((err) => {
          console.error('[Lottery] 获取核销二维码失败', err)
        })
    }
  }, [stage, drawResult, qrCodeUrl])

  // 中奖弹窗展示期间隐藏 H5 顶部导航栏，保证弹窗完整覆盖
  useEffect(() => {
    if (Taro.getEnv() !== Taro.ENV_TYPE.WEB) return
    if (stage === 'result' && drawResult?.is_winner) {
      document.body.classList.add('lottery-win-popup-active')
      return () => document.body.classList.remove('lottery-win-popup-active')
    }
  }, [stage, drawResult])

  const fetchOrder = async (uid: string) => {
    console.log('[Lottery] 请求订单信息', { url: `/api/orders/${orderId}`, method: 'GET' })
    const res = await Network.request({ url: `/api/orders/${orderId}`, method: 'GET' })
    console.log('[Lottery] 订单信息响应', res.data)
    const envelope = res.data as any
    const order = envelope?.data
    if (!order) throw new Error('订单不存在')
    if (order.user_id && uid && order.user_id !== uid) {
      Taro.showToast({ title: '订单与当前用户不匹配', icon: 'none' })
    }
    return order
  }

  const fetchRecord = async (autoStage = true): Promise<boolean> => {
    // If we have recordId, use the record-by-id endpoint; otherwise use orderId
    if (recordId) {
      console.log('[Lottery] 查询抽奖记录(by recordId)', { url: `/api/lottery/record-by-id/${recordId}`, method: 'GET' })
      const res = await Network.request({ url: `/api/lottery/record-by-id/${recordId}`, method: 'GET' })
      console.log('[Lottery] 抽奖记录响应', res.data)
      const envelope = res.data as any
      const record = envelope?.data
      if (record && record.id) {
        setDrawResult({
          is_winner: !!record.is_winner,
          prize_name: record.prize_name || '',
          prize_type: record.prize_type,
          redemption_code: record.redemption_code || '',
          refund_amount: record.refund_amount || '0',
          record_id: record.id || '',
          refund_status: record.refund_status || 'pending',
          discount_rate: record.discount_rate || 0,
          discount_cap: record.discount_cap || 0,
          discount_capped: !!record.discount_capped,
          expired: !!record.expired,
          expiry_hours: record.expiry_hours || 0,
          expiry_date: record.expiry_date || '',
        })
        if (autoStage) setStage('result')
        return true
      }
      return false
    }

    if (!orderId) return false
    console.log('[Lottery] 查询抽奖记录', { url: `/api/lottery/record/${orderId}`, method: 'GET' })
    const res = await Network.request({ url: `/api/lottery/record/${orderId}`, method: 'GET' })
    console.log('[Lottery] 抽奖记录响应', res.data)
    const envelope = res.data as any
    const record = envelope?.data
    if (record && record.id) {
      setDrawResult({
        is_winner: !!record.is_winner,
        prize_name: record.prize_name || '',
        prize_type: record.prize_type,
        redemption_code: record.redemption_code || '',
        refund_amount: record.refund_amount || '0',
        record_id: record.id || '',
        refund_status: record.refund_status || 'pending',
        discount_rate: record.discount_rate || 0,
        discount_cap: record.discount_cap || 0,
        discount_capped: !!record.discount_capped,
        expired: !!record.expired,
        expiry_hours: record.expiry_hours || 0,
        expiry_date: record.expiry_date || '',
      })
      if (autoStage) setStage('result')
      return true
    }
    return false
  }

  // 今日奖池
  const fetchPrizePool = async () => {
    try {
      const url = orderId ? `/api/prizes/active?order_id=${orderId}` : '/api/prizes/active'
      console.log('[Lottery] 请求奖池', { url, method: 'GET' })
      const res = await Network.request({ url, method: 'GET' })
      // 接口直接返回数组（无信封结构），兼容两种返回格式
      const raw = res.data as any
      const list = Array.isArray(raw) ? raw : (raw?.data || [])
      console.log('[Lottery] 奖池响应', list)
      if (Array.isArray(list)) setPrizePool(list.slice(0, 4))
    } catch (err) {
      console.error('[Lottery] 获取奖池失败:', err)
    }
  }

  useEffect(() => {
    const init = async () => {
      const uid = Taro.getStorageSync('user_id') || ''
      setUserId(uid)
      void fetchPrizePool()
      if (!orderId && !recordId) {
        Taro.showToast({ title: '缺少订单参数', icon: 'none' })
        setTimeout(() => Taro.navigateBack(), 1200)
        return
      }
      if (!uid) {
        Taro.showToast({ title: '请先登录', icon: 'none' })
        setTimeout(() => Taro.redirectTo({ url: '/pages/login/index' }), 1200)
        return
      }
      try {
        const hasRecord = await fetchRecord()
        if (!hasRecord) {
          if (!orderId) {
            Taro.showToast({ title: '记录不存在', icon: 'none' })
            setTimeout(() => Taro.navigateBack(), 1200)
            return
          }
          await fetchOrder(uid)
          setStage('select')
        }
      } catch (err) {
        console.error('[Lottery] 初始化失败:', err)
        Taro.showToast({ title: '加载失败，请重试', icon: 'none' })
        setTimeout(() => Taro.navigateBack(), 1200)
      }
    }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 小程序分享后返回页面：标记分享并继续开奖
  useDidShow(() => {
    const s = stateRef.current
    if (s.sharePending) {
      setSharePending(false)
      void handleShareDone()
    }
  })

  const markOrderShared = async () => {
    console.log('[Lottery] 标记订单已分享', { url: `/api/orders/${orderId}/share`, method: 'POST' })
    let firstShared = false
    try {
      const res = await Network.request({ url: `/api/orders/${orderId}/share`, method: 'POST' })
      console.log('[Lottery] 标记分享响应', res.statusCode, res.data)
      firstShared = res.statusCode === 200
    } catch (err: any) {
      // 已分享过会报 400，不重复累计分享次数
      console.log('[Lottery] 标记分享异常（可能已分享过）:', err?.message)
    }
    // 首次分享成功 → 分享次数+1（每位霸王餐权重+0.5，最多计入10位）
    if (firstShared && userId) {
      try {
        const shareRes = await Network.request({ url: `/api/lottery/share/${userId}`, method: 'POST' })
        console.log('[Lottery] 分享次数+1 响应', shareRes.statusCode, shareRes.data)
      } catch (err: any) {
        console.log('[Lottery] 分享次数累加失败:', err?.message)
      }
    }
  }

  const handleShareDone = async () => {
    setNeedShare(false)
    await markOrderShared()
    Taro.showToast({ title: '分享成功，霸王餐概率提升', icon: 'none' })
  }

  // H5 端：点击按钮直接完成"分享"
  const handleH5Share = async () => {
    Taro.showLoading({ title: '分享中...' })
    await markOrderShared()
    Taro.hideLoading()
    setNeedShare(false)
    Taro.showToast({ title: '分享成功，霸王餐概率提升', icon: 'none' })
  }

  // 点击盲盒直接开奖（分享仅用于提升霸王餐概率，不再强制）
  const handleBoxClick = (index: number) => {
    if (drawing || stage !== 'select') return
    // 点击抽奖瞬间同步请求订阅授权（中奖/奖品核销/优惠券到期通知），不阻断抽奖流程
    requestSubscribeByScene('lottery')
    setSelectedBox(index)
    void startDraw(index)
  }

  const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

  const startDraw = async (boxIndex?: number) => {
    const idx = boxIndex ?? stateRef.current.selectedBox
    if (idx === null || idx === undefined) return
    setSelectedBox(idx)
    setDrawing(true)
    setStage('opening')

    try {
      console.log('[Lottery] 发起抽奖', {
        url: '/api/lottery/draw',
        method: 'POST',
        data: { order_id: orderId, user_id: userId },
      })
      const [res] = await Promise.all([
        Network.request({
          url: '/api/lottery/draw',
          method: 'POST',
          data: { order_id: orderId, user_id: userId },
        }),
        delay(2400), // 保证开奖动画完整播放
      ])
      console.log('[Lottery] 抽奖响应', res.data)
      const envelope = res.data as any
      if (envelope?.code === 200 && envelope?.data) {
        // 统一走记录接口拉取富化数据（prize_type/有效期/核销状态），保证与再次进入时一致
        // autoStage=false：结果页切换由下方爆开动画完成后统一执行
        await fetchRecord(false)
      } else {
        throw new Error(envelope?.msg || '抽奖失败')
      }
    } catch (err: any) {
      console.error('[Lottery] 抽奖失败:', err)
      const msg = err?.data?.msg || err?.message || '抽奖失败，请重试'
      // 已抽过奖：直接展示已有结果
      if (String(msg).includes('已抽过奖')) {
        try {
          await fetchRecord()
          setDrawing(false)
          return
        } catch (e) {
          console.error('[Lottery] 拉取已有记录失败:', e)
        }
      }
      Taro.showToast({ title: String(msg).slice(0, 30), icon: 'none' })
      setStage('select')
      setSelectedBox(null)
      setDrawing(false)
      return
    }

    // 爆开动画后展示结果
    setExploding(true)
    setTimeout(() => {
      setStage('result')
      setExploding(false)
      setDrawing(false)
    }, 900)
  }

  const goHome = () => {
    navigateToTabBar('/pages/index/index')
  }

  const goRecords = () => {
    Taro.navigateTo({ url: '/pages/lottery-records/index' })
  }

  const renderPoolIcon = (item: PrizePoolItem, index: number) => {
    const color = POOL_ICON_COLORS[index % POOL_ICON_COLORS.length]
    const name = item.name || ''
    if (item.prize_type === 'coupon') return <Ticket size={22} color={color} />
    if (name.includes('霸王餐') || name.includes('免单')) return <UtensilsCrossed size={22} color={color} />
    if (name.includes('饮') || name.includes('茶') || name.includes('咖啡')) return <Coffee size={22} color={color} />
    if (name.includes('券')) return <Ticket size={22} color={color} />
    return <Gift size={22} color={color} />
  }

  const renderPrizeExtra = () => {
    if (!drawResult?.is_winner) return null
    const type = drawResult.prize_type
    if (type === 'coupon' && drawResult.discount_rate) {
      return (
        <View className="mt-2">
          <Text className="block text-sm text-amber-700 text-center">
            消费券金额随后返还原账户
          </Text>
          {drawResult.discount_capped ? (
            <Text className="block text-xs text-amber-500 mt-1 text-center">
              单笔最高优惠 ¥{drawResult.discount_cap}，已按上限返还 ¥{drawResult.refund_amount}
            </Text>
          ) : null}
        </View>
      )
    }
    if (type === 'product' || type === 'free_meal') {
      const isFreeMeal = type === 'free_meal'
      return (
        <View className="mt-3 w-full">
          {drawResult.product_name && !isFreeMeal ? (
            <Text className="block text-sm text-amber-700 mb-2 text-center">奖品：{drawResult.product_name}</Text>
          ) : null}
          {isFreeMeal && (
            <Text className="block text-sm text-amber-700 mb-2 text-center">
              本单免单 ¥{drawResult.refund_amount}，退款将原路返回
            </Text>
          )}
          {drawResult.redemption_code ? (
            <View className="w-full flex flex-col items-center gap-3 mt-1">
              {/* 过期提示 */}
              {drawResult.expired && (
                <View className="bg-red-50 rounded-xl px-4 py-3 w-full flex flex-col items-center gap-1">
                  <Text className="block text-base font-bold text-red-600 text-center">兑奖已过期</Text>
                  <Text className="block text-xs text-red-400 text-center">
                    兑奖有效期为 {drawResult.expiry_hours} 小时，已于 {drawResult.expiry_date ? formatDateTime(drawResult.expiry_date) : ''} 过期
                  </Text>
                  <Text className="block text-xs text-gray-400 text-center">请联系商家处理</Text>
                </View>
              )}
              {/* 核销二维码（未过期且未核销时显示） */}
              {!drawResult.expired && (
                <>
                  {drawResult.refund_status === 'voided' ? (
                    <View className="bg-gray-50 rounded-2xl p-4 flex flex-col items-center" style={{ width: '180px', height: '180px', justifyContent: 'center' }}>
                      <Text className="block text-base text-gray-500 font-bold">已作废</Text>
                      <Text className="block text-xs text-gray-400 mt-1">关联订单已退款</Text>
                    </View>
                  ) : drawResult.refund_status === 'redeemed' ? (
                    <View className="bg-gray-50 rounded-2xl p-4 flex flex-col items-center" style={{ width: '180px', height: '180px', justifyContent: 'center' }}>
                      <Text className="block text-base text-green-600 font-bold">✓ 已核销</Text>
                      <Text className="block text-xs text-gray-400 mt-1">奖品已领取</Text>
                    </View>
                  ) : (
                    <View className="bg-white rounded-2xl p-4 flex flex-col items-center" style={{ boxShadow: '0 4rpx 16rpx rgba(0,0,0,0.08)' }}>
                      {qrCodeUrl ? (
                        <Image
                          src={qrCodeUrl}
                          mode="aspectFit"
                          style={{ width: '180px', height: '180px' }}
                        />
                      ) : (
                        <View style={{ width: '180px', height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Text className="block text-xs text-gray-400 text-center">二维码加载中...</Text>
                        </View>
                      )}
                      <Text className="block text-xs text-gray-400 mt-2">商家扫一扫核销奖品</Text>
                    </View>
                  )}
                </>
              )}
              {/* 核销码 */}
              {drawResult.refund_status === 'voided' ? (
                <View className="bg-gray-100 rounded-xl px-4 py-2 flex flex-row items-center justify-center gap-2">
                  <Text className="block text-xs text-gray-400">订单已退款，该奖品无法核销</Text>
                </View>
              ) : (
                <View className="bg-amber-50 rounded-xl px-4 py-2 flex flex-row items-center justify-center gap-2">
                  <Text className="block text-xs text-amber-500">核销码</Text>
                  <Text className="block text-base font-bold text-amber-800 tracking-wider">
                    {drawResult.redemption_code}
                  </Text>
                </View>
              )}
              {/* 有效期提示 */}
              {drawResult.refund_status !== 'voided' && !drawResult.expired && (drawResult.expiry_hours ?? 0) > 0 && (
                <Text className="block text-xs text-gray-400 text-center">
                  兑奖有效期 {drawResult.expiry_hours} 小时
                  {drawResult.expiry_date ? `，请于 ${formatDateTime(drawResult.expiry_date)} 前使用` : ''}
                </Text>
              )}
              {/* 核销状态 */}
              {drawResult.refund_status === 'redeemed' && !drawResult.expired && (
                <View className="flex flex-row items-center gap-1">
                  <View className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
                    <Text className="text-white text-xs">✓</Text>
                  </View>
                  <Text className="block text-sm text-green-600 font-medium">已核销</Text>
                </View>
              )}
            </View>
          ) : null}
        </View>
      )
    }
    // 兼容已抽记录（无 prize_type）
    if (drawResult.redemption_code) {
      return (
        <View className="bg-amber-50 rounded-xl px-4 py-3 mt-3 w-full">
          <Text className="block text-xs text-amber-500 mb-1 text-center">兑换码（到店出示）</Text>
          <Text className="block text-base font-bold text-amber-800 tracking-wider text-center">
            {drawResult.redemption_code}
          </Text>
        </View>
      )
    }
    if (drawResult.refund_amount && parseFloat(drawResult.refund_amount) > 0) {
      return (
        <Text className="block text-sm text-amber-700 mt-2 text-center">
          返现 ¥{drawResult.refund_amount} 将原路返回
        </Text>
      )
    }
    return null
  }

  // ===== 顶部标题区：白框圆角卡片 + 设计稿标题图 =====
  const renderTitleCard = () => (
    <View style={{ position: 'relative', zIndex: 2 }}>
      <View
        className="mx-4 mt-3 rounded-3xl overflow-hidden"
        style={{
          border: '4px solid #FFFFFF',
          boxShadow: '0 8px 20px rgba(220, 120, 30, 0.28)',
        }}
      >
        <Image src={TITLE_CARD_URL} className="w-full h-auto" style={{ display: 'block' }} mode="widthFix" />
      </View>
      {/* 开盒 / 结果阶段的动态文案 */}
      {stage !== 'select' && stage !== 'loading' && (
        <View className="flex flex-col items-center mt-2">
          <Text
            className="block text-lg font-black text-white"
            style={{ textShadow: '0 2px 4px rgba(180, 80, 10, 0.35)' }}
          >
            {stage === 'opening' ? '正在打开惊喜' : drawResult?.is_winner ? '恭喜中奖！' : '差一点点'}
          </Text>
          <Text
            className="block text-xs font-bold text-white mt-1"
            style={{ textShadow: '0 1px 3px rgba(180, 80, 10, 0.3)' }}
          >
            {stage === 'opening' ? '膨胀团为你准备了好运' : drawResult?.is_winner ? '膨胀团为你送上惊喜福利' : '好运正在路上'}
          </Text>
        </View>
      )}
    </View>
  )

  // ===== 盲盒玩法区：白卡 + 顶部胶囊标签 =====
  const renderBoxes = () => (
    <View className="clay-card mx-4 mt-6 px-3 pt-5 pb-4" style={{ position: 'relative', zIndex: 2 }}>
      {/* 玩法标签胶囊（压在卡片上边缘） */}
      <View
        style={{
          position: 'absolute',
          top: '-18px',
          left: 0,
          right: 0,
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'center',
          zIndex: 3,
        }}
      >
        <View
          className="clay-tag px-6 flex flex-row items-center"
          style={{ gap: '4px', paddingTop: '6px', paddingBottom: '6px' }}
        >
          <Sparkles size={14} color="#FFF3B0" />
          <Text className="block text-white text-sm font-black" style={{ letterSpacing: '1px', textShadow: '0 1px 2px rgba(160, 50, 5, 0.3)' }}>
            盲盒玩法
          </Text>
        </View>
      </View>
      <View className="grid grid-cols-3 gap-x-1 gap-y-2 px-3 mt-1">
        {BOX_IMAGES.map((img, index) => {
          const isSelected = selectedBox === index
          const isOpening = stage === 'opening'
          const dimmed = isOpening && !isSelected
          const openingThis = isOpening && isSelected
          return (
            <View
              key={index}
              style={{ opacity: dimmed ? 0.25 : 1, transition: 'opacity 0.4s', transform: 'scale(0.85)' }}
              onClick={() => handleBoxClick(index)}
            >
              <View
                className={`w-full ${
                  openingThis && !exploding ? 'clay-box-shake' : openingThis ? 'clay-box-burst' : 'clay-box-float'
                }`}
                style={{ position: 'relative', animationDelay: `${index * 0.3}s` }}
              >
                {/* 盲盒图片（不裁切，保持原始比例，圆角） */}
                <View className="rounded-xl overflow-hidden bg-orange-50">
                  <Image src={img} className="w-full h-auto" style={{ display: 'block' }} mode="widthFix" />
                </View>
                {/* 开盒金光粒子 */}
                {openingThis && exploding &&
                  sparkles.map((s) => (
                    <View
                      key={s.id}
                      className="clay-sparkle"
                      style={{
                        position: 'absolute',
                        left: s.left,
                        top: '20%',
                        width: `${s.size}px`,
                        height: `${s.size}px`,
                        borderRadius: s.round ? '50%' : '2px',
                        backgroundColor: s.color,
                        animationDelay: s.delay,
                        zIndex: 6,
                      }}
                    />
                  ))}

                {/* “惊喜即将出现”气泡 */}
                {openingThis && (
                  <View
                    className="clay-bubble bg-white rounded-full px-3 py-1"
                    style={{
                      position: 'absolute',
                      top: '-10%',
                      right: '-8%',
                      zIndex: 7,
                      boxShadow: '0 3px 8px rgba(180,100,40,0.25)',
                    }}
                  >
                    <Text className="text-xs font-bold text-amber-800">惊喜即将出现</Text>
                  </View>
                )}
              </View>
            </View>
          )
        })}
      </View>
      {/* 提示文字 */}
      <View className="flex flex-row justify-center items-center mt-2" style={{ gap: '4px' }}>
        <Gift size={12} color="#E8A33D" />
        <Text className="block text-xs text-amber-500 font-bold">点击盲盒，开启你的惊喜</Text>
      </View>
    </View>
  )

  // ===== 今日奖品区：白卡 + 胶囊标签 + 4列浅橙格位 =====
  const renderPrizePool = () => {
    // 不足 4 个奖品时用占位格补齐，保持 4 列布局与参考图一致
    const slots = [0, 1, 2, 3].map((i) => prizePool[i] || null)
    return (
      <View className="clay-card mx-4 mt-8 mb-4 px-3 pt-7 pb-3" style={{ position: 'relative', zIndex: 2 }}>
        {/* 奖品标签胶囊（压在卡片上边缘） */}
        <View
          style={{
            position: 'absolute',
            top: '-18px',
            left: 0,
            right: 0,
            display: 'flex',
            flexDirection: 'row',
            justifyContent: 'center',
            zIndex: 3,
          }}
        >
          <View
            className="clay-tag px-6 flex flex-row items-center"
            style={{ gap: '4px', paddingTop: '6px', paddingBottom: '6px' }}
          >
            <Sparkles size={14} color="#FFF3B0" />
            <Text className="block text-white text-sm font-black" style={{ letterSpacing: '2px', textShadow: '0 1px 2px rgba(160, 50, 5, 0.3)' }}>
              今日奖品
            </Text>
          </View>
        </View>

        <View className="grid grid-cols-4 gap-2">
          {slots.map((item, index) =>
            item ? (
              <View key={item.id} className="flex flex-col items-center">
                <View
                  className="w-full aspect-square rounded-2xl flex items-center justify-center overflow-hidden"
                  style={{
                    background: 'linear-gradient(160deg, #FFF2D9 0%, #FFE3B0 100%)',
                    border: '1.5px solid #FFD98E',
                  }}
                >
                  {item.image_url ? (
                    <Image src={item.image_url} className="w-full h-full" mode="aspectFill" />
                  ) : (
                    renderPoolIcon(item, index)
                  )}
                </View>
                <View className="h-8 flex items-center justify-center mt-1">
                  <Text className="block text-xs font-bold text-amber-900 text-center line-clamp-2">
                    {item.prize_type === 'coupon' ? '随机立减' : item.name}
                  </Text>
                </View>
              </View>
            ) : (
              <View key={`empty-${index}`} className="flex flex-col items-center">
                <View
                  className="w-full aspect-square rounded-2xl flex items-center justify-center"
                  style={{
                    background: 'linear-gradient(160deg, #FFF7E8 0%, #FFEFD2 100%)',
                    border: '1.5px dashed #FFD98E',
                  }}
                >
                  <Gift size={28} color="#E8B45A" />
                </View>
                <Text className="block text-xs font-bold text-amber-300 mt-1 text-center">敬请期待</Text>
              </View>
            )
          )}
        </View>
        <View className="flex flex-row justify-center mt-2">
          <Text className="block text-xs text-amber-500 font-bold">每日0点刷新库存</Text>
        </View>
      </View>
    )
  }

  // ===== 中奖结果页 =====
  const renderResult = () => {
    if (!drawResult) return null
    const win = drawResult.is_winner

    // 中奖：设计稿同款弹窗（90% 宽 / 600rpx 上限 / 透明背景 / 高度自适应）
    if (win) {
      const isCoupon = drawResult.prize_type === 'coupon'
      return (
        <View className="win-popup-overlay">
          {/* 彩带层 */}
          <View className="win-popup-confetti">
            {confetti.map((c) => (
              <View
                key={c.id}
                className="clay-confetti"
                style={{
                  position: 'absolute',
                  top: '-4%',
                  left: c.left,
                  width: `${c.size}px`,
                  height: `${c.size}px`,
                  backgroundColor: c.color,
                  borderRadius: c.round ? '50%' : '2px',
                  animationDelay: c.delay,
                }}
              />
            ))}
          </View>

          {/* 弹窗容器：90% 宽 / 600rpx 上限 / 居中 / 背景透明 */}
          <View className="win-popup-wrap">
            {!showQrView ? (
              <>
                {/* 标题组（透明背景上） */}
                <View className="win-popup-header">
                  <Text className="win-popup-title">恭喜中奖</Text>
                  <Text className="block win-popup-subtitle">膨胀团为你送上惊喜福利</Text>
                  <Text className="block win-popup-freemeal">— 抢免单 —</Text>
                </View>

                {/* 奶油卡片 */}
                <View className="win-popup-card">
                  {/* 奖品名胶囊卡片（右移叠到吉祥物左手位置） */}
                  <View
                    className="mt-4 mr-10 -mb-5 px-6 py-3 rounded-2xl self-end z-10"
                    style={{
                      position: 'relative',
                      background: '#FFF3CC',
                      boxShadow: '0 4px 10px rgba(200, 120, 30, 0.2), inset 0 2px 0 rgba(255,255,255,0.8)',
                    }}
                  >
                    <Text className="block text-xl font-black text-amber-800 text-center">{drawResult.prize_name}</Text>
                    <View
                      className="rounded-full px-2 py-1"
                      style={{
                        position: 'absolute',
                        top: '-12px',
                        right: '-14px',
                        background: 'linear-gradient(180deg, #FF8A5C 0%, #F74E16 100%)',
                        transform: 'rotate(8deg)',
                        boxShadow: '0 3px 6px rgba(247,78,22,0.35)',
                      }}
                    >
                      <Text className="font-bold text-white" style={{ fontSize: '10px' }}>
                        限量惊喜
                      </Text>
                    </View>
                  </View>

                  {/* 吉祥物破盒而出 */}
                  <Image src={MASCOT_POPUP_URL} mode="widthFix" className="win-popup-mascot" />

                  {/* 立即领取 → 跳转兑换二维码 */}
                  <Button
                    className="win-popup-cta border-none"
                    onClick={() => {
                      if (isCoupon) {
                        goRecords()
                      } else {
                        setShowQrView(true)
                      }
                    }}
                  >
                    <Text className="win-popup-cta-text">立即领取</Text>
                  </Button>
                </View>

                <Text className="block win-popup-back" onClick={goHome}>
                  返回首页
                </Text>
              </>
            ) : (
              /* 兑换二维码视图 */
              <View className="win-popup-card win-popup-qr">
                <Text className="win-popup-qr-title">扫码核销领奖品</Text>
                <Text className="block win-popup-qr-sub">到店出示二维码，商家扫一扫核销</Text>
                {renderPrizeExtra()}
                <View className="win-popup-qr-actions">
                  <Button className="win-popup-qr-btn border-none" onClick={goRecords}>
                    <Text className="win-popup-qr-btn-text">查看中奖记录</Text>
                  </Button>
                  <Text className="block win-popup-qr-back" onClick={() => setShowQrView(false)}>
                    返回结果
                  </Text>
                </View>
              </View>
            )}
          </View>
        </View>
      )
    }

    // 未中奖：保留原有整页结果
    return (
      <View className="flex-1 flex flex-col" style={{ position: 'relative', zIndex: 2 }}>
        <View className="clay-card mx-5 px-6 pt-6 pb-8 flex flex-col items-center" style={{ position: 'relative' }}>
          <View
            className="w-20 h-20 rounded-full flex items-center justify-center mt-6"
            style={{ background: 'linear-gradient(135deg, #FFF0D6 0%, #FFE1A8 100%)' }}
          >
            <PartyPopper size={40} color="#E8A33D" />
          </View>
          <Text className="block text-lg font-black text-amber-800 mt-4 text-center">
            好运正在路上{'\n'}下次一定能中大奖
          </Text>
        </View>
        <View className="mx-6 mt-6 flex flex-col gap-3">
          <Button className="w-full h-12 border-none clay-btn" onClick={goHome}>
            <View className="flex flex-row items-center gap-2">
              <House size={18} color="#fff" />
              <Text className="text-base font-black text-white">返回首页</Text>
            </View>
          </Button>
        </View>
      </View>
    )
  }

  return (
    <View
      className="min-h-screen flex flex-col"
      style={{
        background: 'linear-gradient(180deg, #FF9A3D 0%, #FFC966 22%, #FFF0CC 48%, #FFE3A1 100%)',
      }}
    >
      {renderTitleCard()}

      {/* 选盒 / 开盒阶段 */}
      {(stage === 'select' || stage === 'opening') && (
        <>
          {renderBoxes()}
          {stage === 'select' && (
            <View className="clay-card mx-4 mb-3 px-4 py-3 flex flex-row items-center gap-3">
              <View style={{ flex: 1 }}>
                <Text className="block text-sm font-black text-amber-900">分享提升霸王餐中奖概率</Text>
                <Text className="block text-xs text-amber-700 mt-1">分享一位好友，霸王餐权重 +0.5，最高可分享 10 位</Text>
              </View>
              <Button className="border-none clay-btn h-10 px-5" onClick={() => setNeedShare(true)}>
                <Text className="text-sm font-black text-white">去分享</Text>
              </Button>
            </View>
          )}
          {stage === 'select' && renderPrizePool()}
          <View style={{ height: '120px' }} />
          <AppTabBar current="/pages/lottery/index" />
        </>
      )}

      {/* 结果阶段 */}
      {stage === 'result' && renderResult()}

      {/* 加载态 */}
      {stage === 'loading' && (
        <View className="flex-1 flex flex-col items-center justify-center" style={{ position: 'relative', zIndex: 2 }}>
          <View className="clay-pulse bg-white rounded-full p-4" style={{ boxShadow: '0 8px 20px rgba(200, 100, 30, 0.25)' }}>
            <Image src={LOGO_URL} className="w-16 h-16 rounded-full" mode="aspectFill" />
          </View>
          <Text className="block text-sm font-bold text-amber-700 mt-4">加载中...</Text>
        </View>
      )}

      {/* 分享引导弹层 */}
      {needShare && (
        <View
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(120, 70, 10, 0.5)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <View className="clay-card px-8 py-8 mx-8 w-full max-w-sm flex flex-col items-center">
            <View className="bg-white rounded-full p-2" style={{ boxShadow: '0 6px 14px rgba(200, 100, 30, 0.25)' }}>
              <Image src={LOGO_URL} className="w-16 h-16 rounded-full" mode="aspectFill" />
            </View>
            <Text className="block text-xl font-black text-amber-900 mt-4">分享提升霸王餐中奖概率</Text>
            <Text className="block text-sm text-amber-700 mt-2 text-center">
              不分享也可以直接点击盲盒开奖{'\n'}分享给好友可提升霸王餐的中奖概率
            </Text>
            <View className="bg-amber-50 rounded-xl px-4 py-3 mt-3 w-full">
              <Text className="block text-xs text-amber-700 text-center">规则：分享一位好友，霸王餐权重 +0.5{'\n'}最高可分享 10 位（+5.0）</Text>
            </View>
            <View className="flex flex-col gap-3 w-full mt-6">
              {isMiniApp ? (
                <Button
                  openType="share"
                  className="w-full h-12 border-none clay-btn"
                  onClick={() => setSharePending(true)}
                >
                  <View className="flex flex-row items-center gap-2">
                    <Share2 size={18} color="#fff" />
                    <Text className="text-base font-black text-white">喊好友助力，立即开奖</Text>
                  </View>
                </Button>
              ) : (
                <Button className="w-full h-12 border-none clay-btn" onClick={handleH5Share}>
                  <View className="flex flex-row items-center gap-2">
                    <Share2 size={18} color="#fff" />
                    <Text className="text-base font-black text-white">分享给好友，立即开奖</Text>
                  </View>
                </Button>
              )}
              <Button
                className="w-full rounded-full bg-amber-50 h-12 border-none"
                onClick={() => setNeedShare(false)}
              >
                <Text className="text-base font-bold text-amber-700">暂不分享，直接开奖</Text>
              </Button>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}
