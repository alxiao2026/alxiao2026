import { useState, useEffect, useMemo, useRef } from 'react'
import Taro, { useRouter, useDidShow, useShareAppMessage } from '@tarojs/taro'
import { View, Text, Image } from '@tarojs/components'
import { Network } from '@/network'
import { Button } from '@/components/ui/button'
import {
  Gift,
  Sparkles,
  Ticket,
  Coffee,
  UtensilsCrossed,
  House,
  Share2,
  PartyPopper,
  ClipboardList,
  User,
  Coins,
  Star,
} from 'lucide-react-taro'
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
  product_name?: string
}

interface OrderInfo {
  id: string
  shared: boolean
  package_name?: string
  shop_name?: string
}

interface PrizePoolItem {
  id: string
  name: string
  prize_type?: string
  image_url?: string | null
}

const LOGO_URL =
  'https://coze-coding-project.tos.coze.site/coze_storage_7662281810482692131/logo_new_pengtuan_2d6e000c.png?sign=1786611400-ab636b32a4-0-481e336cec57d85a4be349e1365bbc63d2a048d78e79de1c43bc7c0cc8dbdea9'

// 马卡龙配色盲盒（立方体）：晴空蓝 / 浅粉 / 桃粉 / 淡紫 / 奶黄 / 暖橙
const BOX_THEMES = [
  { top: '#CDEBFA', face: ['#8FCCF2', '#62ABE6'], num: '#2E7CC4', dark: '#3D7DB8' },
  { top: '#FFDEE7', face: ['#FFB3C6', '#FF8FAB'], num: '#E85D82', dark: '#C94F70' },
  { top: '#FFE6DA', face: ['#FFBFA8', '#FF9C7E'], num: '#E8704A', dark: '#C75B38' },
  { top: '#EFE3FA', face: ['#D2B0EF', '#B488E2'], num: '#8B5FC7', dark: '#6E45A3' },
  { top: '#FFF6D1', face: ['#FFE083', '#FFCB52'], num: '#E8A33D', dark: '#C78224' },
  { top: '#FFE8CC', face: ['#FFC38D', '#FFA266'], num: '#E87F3A', dark: '#C76528' },
]

const CONFETTI_COLORS = ['#FF6B9D', '#FFA502', '#F7B731', '#45AAF2', '#A55EEA', '#FF8A5C', '#2ED573', '#FFFFFF']

const POOL_ICON_COLORS = ['#FF6B9D', '#A55EEA', '#45AAF2', '#2ED573']

export default function Lottery() {
  const router = useRouter()
  const orderId = router.params?.orderId || ''

  const [stage, setStage] = useState<Stage>('loading')
  const [userId, setUserId] = useState('')
  const [orderInfo, setOrderInfo] = useState<OrderInfo | null>(null)
  const [selectedBox, setSelectedBox] = useState<number | null>(null)
  const [needShare, setNeedShare] = useState(false)
  const [sharePending, setSharePending] = useState(false)
  const [drawResult, setDrawResult] = useState<DrawResultData | null>(null)
  const [exploding, setExploding] = useState(false)
  const [drawing, setDrawing] = useState(false)
  const [prizePool, setPrizePool] = useState<PrizePoolItem[]>([])
  const [nickName] = useState(() => Taro.getStorageSync('nick_name') || '玩家001')

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
    setOrderInfo({ id: order.id, shared: !!order.shared, package_name: order.package_name, shop_name: order.shop_name })
    return order
  }

  const fetchRecord = async (): Promise<boolean> => {
    console.log('[Lottery] 查询抽奖记录', { url: `/api/lottery/record/${orderId}`, method: 'GET' })
    const res = await Network.request({ url: `/api/lottery/record/${orderId}`, method: 'GET' })
    console.log('[Lottery] 抽奖记录响应', res.data)
    const envelope = res.data as any
    const record = envelope?.data
    if (record && record.id) {
      setDrawResult({
        is_winner: !!record.is_winner,
        prize_name: record.prize_name || '',
        redemption_code: record.redemption_code || '',
        refund_amount: record.refund_amount || '0',
      })
      setStage('result')
      return true
    }
    return false
  }

  // 今日奖池
  const fetchPrizePool = async () => {
    try {
      console.log('[Lottery] 请求奖池', { url: '/api/prizes/active', method: 'GET' })
      const res = await Network.request({ url: '/api/prizes/active', method: 'GET' })
      const list = (res.data as any)?.data || []
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
      if (!orderId) {
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
    try {
      const res = await Network.request({ url: `/api/orders/${orderId}/share`, method: 'POST' })
      console.log('[Lottery] 标记分享响应', res.data)
    } catch (err: any) {
      // 已分享过会报 400，视为成功继续
      console.log('[Lottery] 标记分享异常（可能已分享过）:', err?.message)
    }
    setOrderInfo((prev) => (prev ? { ...prev, shared: true } : prev))
  }

  const handleShareDone = async () => {
    setNeedShare(false)
    await markOrderShared()
    await startDraw()
  }

  // H5 端：点击按钮直接完成"分享"
  const handleH5Share = async () => {
    Taro.showLoading({ title: '分享中...' })
    await markOrderShared()
    Taro.hideLoading()
    setNeedShare(false)
    await startDraw()
  }

  const handleBoxClick = (index: number) => {
    if (drawing || stage !== 'select') return
    setSelectedBox(index)
    if (!orderInfo?.shared) {
      setNeedShare(true)
      return
    }
    void startDraw(index)
  }

  const handleMainButton = () => {
    if (stage !== 'select') return
    Taro.showToast({ title: '点击上方任意盲盒开启惊喜', icon: 'none' })
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
        const data = envelope.data
        const prize = data.prize
        const record = data.record
        setDrawResult({
          is_winner: !!data.is_winner,
          prize_name: prize?.name || record?.prize_name || '',
          prize_type: prize?.prize_type,
          image_url: prize?.image_url || '',
          redemption_code: record?.redemption_code || '',
          refund_amount: record?.refund_amount || '0',
          coupon_amount: prize?.coupon_amount,
          coupon_min_spend: prize?.coupon_min_spend,
          product_name: prize?.product_name,
        })
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
    Taro.reLaunch({ url: '/pages/index/index' })
  }

  const goRecords = () => {
    Taro.navigateTo({ url: '/pages/lottery-records/index' })
  }

  const goUserCenter = () => {
    Taro.navigateTo({ url: '/pages/user-center/index' })
  }

  const handleTab = (key: string) => {
    if (key === 'hall') goHome()
    else if (key === 'task') Taro.showToast({ title: '任务中心敬请期待', icon: 'none' })
    else if (key === 'mine') goUserCenter()
  }

  const renderPoolIcon = (item: PrizePoolItem, index: number) => {
    const color = POOL_ICON_COLORS[index % POOL_ICON_COLORS.length]
    const name = item.name || ''
    if (name.includes('霸王餐') || name.includes('免单')) return <UtensilsCrossed size={22} color={color} />
    if (name.includes('饮') || name.includes('茶') || name.includes('咖啡')) return <Coffee size={22} color={color} />
    if (name.includes('券')) return <Ticket size={22} color={color} />
    return <Gift size={22} color={color} />
  }

  const renderPrizeExtra = () => {
    if (!drawResult?.is_winner) return null
    const type = drawResult.prize_type
    if (type === 'coupon' && drawResult.coupon_amount) {
      const minSpend = parseFloat(drawResult.coupon_min_spend || '0')
      return (
        <Text className="block text-sm text-amber-700 mt-2 text-center">
          {minSpend > 0 ? `满 ¥${minSpend} 可用 · ` : ''}立减 ¥{drawResult.coupon_amount}
        </Text>
      )
    }
    if (type === 'product') {
      return (
        <View className="mt-3 w-full">
          {drawResult.product_name ? (
            <Text className="block text-sm text-amber-700 mb-2 text-center">奖品：{drawResult.product_name}</Text>
          ) : null}
          {drawResult.redemption_code ? (
            <View className="bg-amber-50 rounded-xl px-4 py-3">
              <Text className="block text-xs text-amber-500 mb-1 text-center">兑换码（到店出示）</Text>
              <Text className="block text-base font-bold text-amber-800 tracking-wider text-center">
                {drawResult.redemption_code}
              </Text>
            </View>
          ) : null}
        </View>
      )
    }
    if (type === 'free_meal') {
      return (
        <Text className="block text-sm text-amber-700 mt-2 text-center">
          本单免单 ¥{drawResult.refund_amount}，退款将原路返回
        </Text>
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

  // ===== 顶栏：IP头像 + 玩家 + 膨胀团胶囊 | 我的奖品 =====
  const renderTopBar = () => (
    <View className="flex flex-row items-center justify-between px-4 pt-3" style={{ position: 'relative', zIndex: 5 }}>
      <View className="flex flex-row items-center gap-2">
        <View className="bg-white rounded-full p-1" style={{ boxShadow: '0 3px 8px rgba(200, 90, 20, 0.25)' }}>
          <Image src={LOGO_URL} className="w-9 h-9 rounded-full" mode="aspectFill" />
        </View>
        <Text className="text-base font-black text-amber-900">{nickName}</Text>
        <View className="clay-pill px-3 py-1">
          <Text className="text-xs font-bold text-white">膨胀团</Text>
        </View>
      </View>
      <View
        className="flex flex-row items-center gap-1 bg-white rounded-full px-3 py-2"
        style={{ boxShadow: '0 3px 8px rgba(200, 90, 20, 0.2)' }}
        onClick={goRecords}
      >
        <Coins size={16} color="#F7B731" />
        <Text className="text-sm font-bold text-amber-900">我的奖品</Text>
      </View>
    </View>
  )

  // ===== 立体气泡标题 =====
  const renderTitle = () => {
    let main = '膨胀盲盒'
    let sub = '下单获得一次翻盒机会'
    if (stage === 'opening') {
      main = '膨胀盲盒'
      sub = '正在打开惊喜'
    } else if (stage === 'result') {
      main = drawResult?.is_winner ? '恭喜中奖!' : '差一点点'
      sub = drawResult?.is_winner ? '膨胀团为你送上惊喜福利' : '好运正在路上'
    }
    return (
      <View className="flex flex-col items-center mt-2 mb-4" style={{ position: 'relative', zIndex: 2 }}>
        <Text className="block clay-title text-4xl">{main}</Text>
        <Text className="block text-sm font-bold text-amber-800 mt-3">{sub}</Text>
        <Text className="block text-xs font-bold text-amber-600 mt-1">— 抢免单 —</Text>
      </View>
    )
  }

  // ===== 6宫格立方体盲盒（3列×2行） =====
  const renderBoxes = () => (
    <View
      className="clay-card mx-5 px-3 pb-4"
      style={{ position: 'relative', zIndex: 2, marginTop: '20px', paddingTop: '46px' }}
    >
      {/* 骑缝胶囊：盲盒玩法 */}
      <View
        className="clay-pill px-5 py-2"
        style={{ position: 'absolute', top: '-15px', left: '50%', transform: 'translateX(-50%)', zIndex: 5 }}
      >
        <Text className="text-sm font-black text-white" style={{ letterSpacing: '3px' }}>
          盲盒玩法
        </Text>
      </View>

      <View className="grid grid-cols-3 gap-3">
        {BOX_THEMES.map((theme, index) => {
          const isSelected = selectedBox === index
          const isOpening = stage === 'opening'
          const dimmed = isOpening && !isSelected
          const openingThis = isOpening && isSelected
          const exploded = openingThis && exploding
          return (
            <View
              key={index}
              style={{ opacity: dimmed ? 0.25 : 1, transition: 'opacity 0.4s' }}
              onClick={() => handleBoxClick(index)}
            >
              <View
                className={`w-full ${
                  openingThis && !exploding ? 'clay-box-shake' : openingThis ? '' : 'clay-box-float'
                }`}
                style={{ position: 'relative', aspectRatio: '0.88', animationDelay: `${index * 0.3}s` }}
              >
                {/* 盒身正面 */}
                <View
                  className={exploded ? 'clay-box-open-body' : ''}
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    bottom: 0,
                    top: '20%',
                    borderRadius: '16px',
                    background: `linear-gradient(165deg, ${theme.face[0]} 0%, ${theme.face[1]} 100%)`,
                    boxShadow: '0 7px 14px rgba(180, 100, 40, 0.22), inset 0 2px 0 rgba(255,255,255,0.55)',
                    zIndex: 2,
                  }}
                />

                {/* 盒口暗影（开盖后露出） */}
                {exploded && (
                  <View
                    style={{
                      position: 'absolute',
                      left: '6%',
                      right: '6%',
                      top: '17%',
                      height: '11%',
                      borderRadius: '50%',
                      background: theme.dark,
                      zIndex: 3,
                    }}
                  />
                )}

                {/* 盒内金色光球（开盖后） */}
                {exploded && (
                  <View
                    className="clay-pulse"
                    style={{
                      position: 'absolute',
                      left: '16%',
                      right: '16%',
                      top: 0,
                      aspectRatio: '1',
                      borderRadius: '50%',
                      background:
                        'radial-gradient(circle at 50% 45%, #FFF6C9 0%, #FFD93D 45%, rgba(255,217,61,0) 75%)',
                      zIndex: 4,
                    }}
                  />
                )}

                {/* 盒盖（顶面 + 前檐一体，开盒时整体后翻） */}
                <View
                  className={exploded ? 'clay-lid-flip' : ''}
                  style={{ position: 'absolute', left: 0, right: 0, top: 0, height: '30%', zIndex: 5 }}
                >
                  {/* 顶面（等距平行四边形） */}
                  <View
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: '8%',
                      right: '8%',
                      height: '55%',
                      transform: 'skewX(-14deg)',
                      borderTopLeftRadius: '10px',
                      borderTopRightRadius: '10px',
                      background: `linear-gradient(180deg, ${theme.top} 0%, ${theme.face[0]} 100%)`,
                      boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.65)',
                    }}
                  />
                  {/* 前檐 */}
                  <View
                    style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      bottom: 0,
                      height: '52%',
                      borderTopLeftRadius: '14px',
                      borderTopRightRadius: '14px',
                      borderBottomLeftRadius: '6px',
                      borderBottomRightRadius: '6px',
                      background: `linear-gradient(180deg, ${theme.face[0]} 0%, ${theme.face[1]} 100%)`,
                      boxShadow: '0 3px 5px rgba(180,100,40,0.18), inset 0 2px 0 rgba(255,255,255,0.5)',
                    }}
                  />
                </View>

                {/* 盒面元素（未爆开时显示） */}
                {!exploded && (
                  <>
                    {/* 大问号 */}
                    <View
                      className="flex items-center justify-center"
                      style={{ position: 'absolute', left: 0, right: 0, top: '34%', zIndex: 6 }}
                    >
                      <Text
                        className="font-black"
                        style={{
                          fontSize: '38px',
                          color: '#FFFDF6',
                          textShadow: '0 3px 0 rgba(180,100,40,0.15)',
                          lineHeight: '40px',
                        }}
                      >
                        ?
                      </Text>
                    </View>
                    {/* 金星贴纸 */}
                    <View className="clay-star-twinkle" style={{ position: 'absolute', left: '12%', top: '62%', zIndex: 6 }}>
                      <Star size={13} color="#FFE066" />
                    </View>
                    {/* IP 表情贴 */}
                    <View
                      className="bg-white rounded-full overflow-hidden"
                      style={{
                        position: 'absolute',
                        right: '10%',
                        top: '36%',
                        width: '22px',
                        height: '22px',
                        zIndex: 6,
                        boxShadow: '0 2px 4px rgba(180,100,40,0.25)',
                      }}
                    >
                      <Image src={LOGO_URL} className="w-full h-full" mode="aspectFill" />
                    </View>
                    {/* 编号 */}
                    <Text
                      className="block font-black text-center"
                      style={{
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        bottom: '4%',
                        zIndex: 6,
                        fontSize: '14px',
                        color: 'rgba(255,255,255,0.95)',
                        textShadow: `0 1.5px 0 ${theme.num}`,
                      }}
                    >
                      {String(index + 1).padStart(2, '0')}
                    </Text>
                  </>
                )}

                {/* 开盒金光粒子 */}
                {exploded &&
                  sparkles.map((s) => (
                    <View
                      key={s.id}
                      className="clay-sparkle"
                      style={{
                        position: 'absolute',
                        left: s.left,
                        top: '14%',
                        width: `${s.size}px`,
                        height: `${s.size}px`,
                        borderRadius: s.round ? '50%' : '2px',
                        backgroundColor: s.color,
                        animationDelay: s.delay,
                        zIndex: 7,
                      }}
                    />
                  ))}

                {/* “惊喜即将出现”气泡 */}
                {openingThis && (
                  <View
                    className="clay-bubble bg-white rounded-full px-3 py-1"
                    style={{
                      position: 'absolute',
                      top: '-8%',
                      right: '-10%',
                      zIndex: 8,
                      boxShadow: '0 3px 8px rgba(180,100,40,0.25)',
                    }}
                  >
                    <Text className="text-xs font-bold text-amber-800">惊喜即将出现</Text>
                  </View>
                )}

                {/* “获得次数”提示气泡（中间盒，选择阶段） */}
                {index === 1 && stage === 'select' && (
                  <View
                    className="clay-bubble"
                    style={{
                      position: 'absolute',
                      top: '-34px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      zIndex: 10,
                      background: '#FFFDF6',
                      borderRadius: '12px',
                      padding: '5px 8px',
                      boxShadow: '0 4px 10px rgba(180,100,40,0.2)',
                      width: '96px',
                    }}
                  >
                    <Text className="block text-center font-black" style={{ fontSize: '11px', color: '#7C4A03' }}>
                      获得次数 1 次
                    </Text>
                    <View className="flex flex-row items-center justify-center" style={{ marginTop: '2px' }}>
                      <Coins size={10} color="#F5B301" />
                      <Text className="font-bold" style={{ fontSize: '10px', color: '#B8860B', marginLeft: '3px' }}>
                        点击翻盒
                      </Text>
                    </View>
                    {/* 小三角尾巴 */}
                    <View
                      style={{
                        position: 'absolute',
                        bottom: '-4px',
                        left: '50%',
                        transform: 'translateX(-50%) rotate(45deg)',
                        width: '9px',
                        height: '9px',
                        background: '#FFFDF6',
                        borderRadius: '2px',
                      }}
                    />
                  </View>
                )}
              </View>
            </View>
          )
        })}
      </View>

      {/* 金币小胶囊条 */}
      <View className="flex flex-row justify-center items-center" style={{ marginTop: '14px' }}>
        {['今日奖池', '点击翻盒', '惊喜连连'].map((text, i) => (
          <View
            key={i}
            className="flex flex-row items-center rounded-full"
            style={{
              padding: '4px 10px',
              margin: '0 4px',
              background: i === 0 ? 'linear-gradient(180deg, #FFC53D, #FF7A29)' : '#FFF6DC',
              boxShadow: '0 2px 4px rgba(180,100,40,0.15)',
            }}
          >
            <Coins size={11} color={i === 0 ? '#FFFFFF' : '#F5B301'} />
            <Text
              className="font-bold"
              style={{ fontSize: '11px', color: i === 0 ? '#FFFFFF' : '#B8860B', marginLeft: '3px' }}
            >
              {text}
            </Text>
          </View>
        ))}
      </View>

      {/* 3D 主按钮（卡片内） */}
      <View style={{ marginTop: '14px' }}>
        <Button
          className={`w-full h-14 border-none ${stage === 'opening' ? 'clay-btn clay-btn-waiting' : 'clay-btn'}`}
          onClick={handleMainButton}
        >
          <Text
            className="text-xl font-black text-white"
            style={{ textShadow: '0 2px 0 rgba(180, 60, 10, 0.4)', letterSpacing: '2px' }}
          >
            {stage === 'opening' ? '稍等一下' : '选择一个盲盒'}
          </Text>
        </Button>
      </View>
    </View>
  )

  // ===== 今日奖池 =====
  const renderPrizePool = () => {
    if (prizePool.length === 0) return null
    return (
      <View className="mt-5 mb-4" style={{ position: 'relative', zIndex: 2 }}>
        <View className="flex flex-row justify-center">
          <View className="clay-pill px-5 py-2">
            <Text className="text-sm font-black text-white" style={{ letterSpacing: '2px' }}>
              今日奖池
            </Text>
          </View>
        </View>
        <View className="clay-card mx-5 mt-3 px-4 py-4">
          <View className="flex flex-row justify-between">
            {prizePool.map((item, index) => (
              <View key={item.id} className="flex flex-col items-center" style={{ width: '23%' }}>
                {item.image_url ? (
                  <Image
                    src={item.image_url}
                    className="w-12 h-12 rounded-2xl"
                    mode="aspectFill"
                    style={{ boxShadow: '0 3px 6px rgba(180,100,40,0.2)' }}
                  />
                ) : (
                  <View
                    className="w-12 h-12 rounded-2xl flex items-center justify-center bg-amber-50"
                    style={{ boxShadow: '0 3px 6px rgba(180,100,40,0.15)' }}
                  >
                    {renderPoolIcon(item, index)}
                  </View>
                )}
                <Text className="block text-xs font-bold text-amber-900 mt-2 text-center" numberOfLines={1}>
                  {item.name}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    )
  }

  // ===== 游戏手柄渐变底部导航 =====
  const renderTabBar = () => {
    const tabs = [
      { key: 'hall', label: '大厅', icon: House, active: false },
      { key: 'box', label: '膨胀盲盒', icon: Gift, active: true },
      { key: 'task', label: '任务', icon: ClipboardList, active: false },
      { key: 'mine', label: '我的', icon: User, active: false },
    ]
    return (
      <View
        style={{
          position: 'fixed',
          bottom: 14,
          left: 16,
          right: 16,
          zIndex: 50,
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'space-around',
          alignItems: 'center',
          padding: '10px 8px',
          paddingBottom: 'calc(10px + env(safe-area-inset-bottom))',
        }}
        className="clay-tabbar"
      >
        {tabs.map((tab) => {
          const IconComp = tab.icon
          return (
            <View
              key={tab.key}
              className={`flex flex-col items-center px-4 py-1 ${tab.active ? 'clay-tab-active' : ''}`}
              onClick={() => handleTab(tab.key)}
            >
              <IconComp size={20} color={tab.active ? '#E8739F' : '#B89A6A'} />
              <Text
                className="block mt-1"
                style={{
                  fontSize: '10px',
                  fontWeight: tab.active ? 800 : 600,
                  color: tab.active ? '#E8739F' : '#B89A6A',
                }}
              >
                {tab.label}
              </Text>
            </View>
          )
        })}
      </View>
    )
  }

  // ===== 中奖结果页 =====
  const renderResult = () => {
    if (!drawResult) return null
    const win = drawResult.is_winner
    return (
      <View className="flex-1 flex flex-col" style={{ position: 'relative', zIndex: 2 }}>
        {/* 彩带 */}
        {win &&
          confetti.map((c) => (
            <View
              key={c.id}
              className="clay-confetti"
              style={{
                position: 'fixed',
                top: 0,
                left: c.left,
                width: `${c.size}px`,
                height: `${c.size}px`,
                backgroundColor: c.color,
                borderRadius: c.round ? '50%' : '2px',
                animationDelay: c.delay,
                zIndex: 3,
              }}
            />
          ))}

        <View className="clay-card mx-5 px-6 pt-6 pb-8 flex flex-col items-center" style={{ position: 'relative' }}>
          {/* 盲盒玩法胶囊 */}
          <View className="clay-pill px-5 py-2" style={{ marginTop: '-38px' }}>
            <Text className="text-sm font-black text-white" style={{ letterSpacing: '2px' }}>
              盲盒玩法
            </Text>
          </View>

          {win ? (
            <>
              {/* 奖品名胶囊卡片 */}
              <View
                className="mt-5 px-6 py-3 rounded-2xl"
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

              {/* 打开的盲盒 + IP 弹跳探出 */}
              <View className="flex items-center justify-center mt-4" style={{ position: 'relative', width: '100%', height: '180px' }}>
                {/* 金色光芒 */}
                <View
                  className="clay-ray-spin"
                  style={{
                    position: 'absolute',
                    width: '200px',
                    height: '200px',
                    borderRadius: '50%',
                    background:
                      'conic-gradient(from 0deg, rgba(255,200,60,0.45) 0deg, transparent 30deg, rgba(255,200,60,0.45) 60deg, transparent 90deg, rgba(255,200,60,0.45) 120deg, transparent 150deg, rgba(255,200,60,0.45) 180deg, transparent 210deg, rgba(255,200,60,0.45) 240deg, transparent 270deg, rgba(255,200,60,0.45) 300deg, transparent 330deg)',
                    zIndex: 1,
                  }}
                />
                {/* IP 从盒中弹跳探出 */}
                <View
                  className="clay-ip-bounce bg-white rounded-full overflow-hidden"
                  style={{
                    position: 'absolute',
                    top: '6px',
                    width: '96px',
                    height: '96px',
                    zIndex: 3,
                    boxShadow: '0 8px 16px rgba(200, 100, 30, 0.3)',
                    border: '4px solid #FFE9A8',
                  }}
                >
                  {drawResult.image_url ? (
                    <Image src={drawResult.image_url} className="w-full h-full" mode="aspectFill" />
                  ) : (
                    <Image src={LOGO_URL} className="w-full h-full" mode="aspectFill" />
                  )}
                </View>
                {/* 盒身 */}
                <View
                  style={{
                    position: 'absolute',
                    bottom: '6px',
                    width: '150px',
                    height: '86px',
                    borderRadius: '20px',
                    background: 'linear-gradient(160deg, #FFC7DD 0%, #FF9BBF 100%)',
                    boxShadow: '0 10px 20px rgba(200, 100, 40, 0.3), inset 0 2px 0 rgba(255,255,255,0.6)',
                    zIndex: 2,
                  }}
                >
                  <Text
                    className="font-black"
                    style={{ position: 'absolute', left: '12%', bottom: '10%', fontSize: '14px', color: 'rgba(255,255,255,0.9)' }}
                  >
                    {String((selectedBox ?? 0) + 1).padStart(2, '0')}
                  </Text>
                  <View style={{ position: 'absolute', right: '10%', bottom: '12%' }}>
                    <Sparkles size={16} color="rgba(255,255,255,0.9)" />
                  </View>
                </View>
              </View>

              {renderPrizeExtra()}
            </>
          ) : (
            <>
              <View
                className="w-20 h-20 rounded-full flex items-center justify-center mt-6"
                style={{ background: 'linear-gradient(135deg, #FFF0D6 0%, #FFE1A8 100%)' }}
              >
                <PartyPopper size={40} color="#E8A33D" />
              </View>
              <Text className="block text-lg font-black text-amber-800 mt-4 text-center">
                好运正在路上{'\n'}下次一定能中大奖
              </Text>
            </>
          )}
        </View>

        {/* 操作按钮 */}
        <View className="mx-6 mt-6 flex flex-col gap-3">
          {win && (
            <Button className="w-full h-14 border-none clay-btn" onClick={goRecords}>
              <Text
                className="text-xl font-black text-white"
                style={{ textShadow: '0 2px 0 rgba(180, 60, 10, 0.4)', letterSpacing: '3px' }}
              >
                立即领取
              </Text>
            </Button>
          )}
          <Button
            className={`w-full h-12 border-none ${win ? 'bg-white' : 'clay-btn'}`}
            style={win ? { boxShadow: '0 4px 10px rgba(200, 120, 30, 0.2)' } : {}}
            onClick={goHome}
          >
            <View className="flex flex-row items-center gap-2">
              {!win && <House size={18} color="#fff" />}
              <Text className={`text-base font-black ${win ? 'text-amber-800' : 'text-white'}`}>返回首页</Text>
            </View>
          </Button>
        </View>
      </View>
    )
  }

  return (
    <View className="min-h-screen flex flex-col" style={{ background: '#FFF3CC' }}>
      {/* 顶部红橙渐变圆弧装饰 */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '120px',
          background: 'linear-gradient(180deg, #FF6B4A 0%, #FF9A3D 100%)',
          borderBottomLeftRadius: '36px',
          borderBottomRightRadius: '36px',
          zIndex: 0,
        }}
      />

      {renderTopBar()}
      {renderTitle()}

      {/* 选盒 / 开盒阶段 */}
      {(stage === 'select' || stage === 'opening') && (
        <>
          {renderBoxes()}
          {stage === 'select' && renderPrizePool()}
          <View style={{ height: '120px' }} />
          {renderTabBar()}
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
            <Text className="block text-xl font-black text-amber-900 mt-4">分享给好友开奖</Text>
            <Text className="block text-sm text-amber-700 mt-2 text-center">
              把好运分享出去{'\n'}即可立即开启你选的盲盒
            </Text>
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
                onClick={() => {
                  setNeedShare(false)
                  setSelectedBox(null)
                }}
              >
                <Text className="text-base font-bold text-amber-700">再想想</Text>
              </Button>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}
