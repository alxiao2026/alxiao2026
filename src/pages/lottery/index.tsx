import { useState, useEffect, useMemo, useRef } from 'react'
import Taro, { useRouter, useDidShow, useShareAppMessage } from '@tarojs/taro'
import { View, Text, Image } from '@tarojs/components'
import { Network } from '@/network'
import { Button } from '@/components/ui/button'
import {
  Gift,
  Ticket,
  Coffee,
  UtensilsCrossed,
  House,
  Share2,
  PartyPopper,
  ClipboardList,
  User,
  Coins,
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

// 6 个盲盒图片（3D 黏土风，已裁剪透明画布，TOS 存储）
const BOX_IMAGES = [
  'https://coze-coding-project.tos.coze.site/coze_storage_7665771487420678144/lottery/box_01_tight_34a68dde_fcf8d726.png?sign=1787453593-55a9fffdd7-0-7c7939b3797a7aafc93dfb0b12b695145445267670ca27fcd232a28212c6a1c9',
  'https://coze-coding-project.tos.coze.site/coze_storage_7665771487420678144/lottery/box_02_tight_dc981843_b2c49880.png?sign=1787453594-de5b018c45-0-93e367261ee70071a22419135c485209be30006b13dfdfc86647d5318e2fcc51',
  'https://coze-coding-project.tos.coze.site/coze_storage_7665771487420678144/lottery/box_03_tight_97e0cf23_566392e5.png?sign=1787453594-5dee2c8f88-0-7defb0a0513c8cdacd2fb49d79d4b23bd99addeafcef2b9b79af8e5f63bcb5b7',
  'https://coze-coding-project.tos.coze.site/coze_storage_7665771487420678144/lottery/box_04_tight_7261b570_d8b60eb8.png?sign=1787453594-4ce909398c-0-cf1c5db2a9da725ec6531043e8a68aab23156ecb9398361a0e8eb2edf0f25961',
  'https://coze-coding-project.tos.coze.site/coze_storage_7665771487420678144/lottery/box_05_tight_bd3b69e6_80b50953.png?sign=1787453594-5b01baa0bb-0-82f5819de2d670389249b0b4c3fafdd9f14d175c58d7a9eb0b86cd1abb7f8039',
  'https://coze-coding-project.tos.coze.site/coze_storage_7665771487420678144/lottery/box_06_tight_38fa21a0_87805941.png?sign=1787453594-82ef6f1a91-0-a5b1fc1ce43efdbee8abacd4bcebd79711303a1161313914db3c050a4c69b7a1',
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

  // ===== 6宫格盲盒 =====
  const renderBoxes = () => (
    <View className="clay-card mx-5 px-3 pt-4 pb-4" style={{ position: 'relative', zIndex: 2 }}>
      <View className="grid grid-cols-3 gap-x-2 gap-y-3">
        {BOX_IMAGES.map((img, index) => {
          const isSelected = selectedBox === index
          const isOpening = stage === 'opening'
          const dimmed = isOpening && !isSelected
          const openingThis = isOpening && isSelected
          return (
            <View
              key={index}
              style={{ opacity: dimmed ? 0.25 : 1, transition: 'opacity 0.4s' }}
              onClick={() => handleBoxClick(index)}
            >
              <View
                className={`w-full ${
                  openingThis && !exploding ? 'clay-box-shake' : openingThis ? 'clay-box-burst' : 'clay-box-float'
                }`}
                style={{ position: 'relative', animationDelay: `${index * 0.3}s` }}
              >
                {/* 盲盒图片 */}
                <Image src={img} className="w-full mx-auto" style={{ display: 'block' }} mode="widthFix" />
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
    </View>
  )

  // ===== 3D 主按钮 =====
  const renderMainButton = () => (
    <View className="mx-6 mt-5" style={{ position: 'relative', zIndex: 2 }}>
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
                {/* 盒身：选中的盲盒图片 */}
                <Image
                  src={BOX_IMAGES[selectedBox ?? 0]}
                  mode="widthFix"
                  className="clay-prize-pop"
                  style={{ position: 'absolute', bottom: '0', width: '140px', zIndex: 2 }}
                />
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
          {renderMainButton()}
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
