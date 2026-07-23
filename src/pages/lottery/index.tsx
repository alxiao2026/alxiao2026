import { useState, useEffect, useMemo, useRef } from 'react'
import Taro, { useRouter, useDidShow, useShareAppMessage } from '@tarojs/taro'
import { View, Text, Image } from '@tarojs/components'
import { Network } from '@/network'
import { Button } from '@/components/ui/button'
import {
  Gift,
  Sparkles,
  Ticket,
  Package as PackageIcon,
  UtensilsCrossed,
  House,
  Share2,
  PartyPopper,
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

const BOX_COLORS: Array<[string, string]> = [
  ['#FF4757', '#FF6B81'],
  ['#FF7F50', '#FFA502'],
  ['#FF6B9D', '#EE5A9B'],
  ['#A55EEA', '#8854D0'],
  ['#45AAF2', '#2E86DE'],
  ['#F7B731', '#FA8231'],
]

const CONFETTI_COLORS = ['#FF4757', '#FFA502', '#F7B731', '#45AAF2', '#A55EEA', '#FF6B9D', '#2ED573', '#FFFFFF']

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

  const stateRef = useRef({ sharePending, orderId, selectedBox, stage })
  stateRef.current = { sharePending, orderId, selectedBox, stage }

  const env = Taro.getEnv()
  const isMiniApp = env === Taro.ENV_TYPE.WEAPP || env === Taro.ENV_TYPE.TT

  // 彩带粒子（中奖时）
  const confetti = useMemo(
    () =>
      Array.from({ length: 24 }, (_, i) => ({
        id: i,
        left: `${(i * 41) % 100}%`,
        delay: `${(i % 8) * 0.28}s`,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        size: i % 3 === 0 ? 10 : 7,
        round: i % 2 === 0,
      })),
    []
  )

  // 星星粒子（盲盒页背景氛围）
  const stars = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        id: i,
        left: `${(i * 67) % 96}%`,
        top: `${(i * 37) % 88}%`,
        delay: `${(i % 5) * 0.4}s`,
        size: 3 + (i % 3),
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

  useEffect(() => {
    const init = async () => {
      const uid = Taro.getStorageSync('user_id') || ''
      setUserId(uid)
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
    }, 600)
  }

  const goHome = () => {
    Taro.reLaunch({ url: '/pages/index/index' })
  }

  const goRecords = () => {
    Taro.navigateTo({ url: '/pages/lottery-records/index' })
  }

  const renderPrizeIcon = () => {
    const type = drawResult?.prize_type
    if (type === 'coupon') return <Ticket size={44} color="#FF4757" />
    if (type === 'product') return <PackageIcon size={44} color="#A55EEA" />
    if (type === 'free_meal') return <UtensilsCrossed size={44} color="#2ED573" />
    return <Gift size={44} color="#FF4757" />
  }

  const renderPrizeExtra = () => {
    if (!drawResult?.is_winner) return null
    const type = drawResult.prize_type
    if (type === 'coupon' && drawResult.coupon_amount) {
      const minSpend = parseFloat(drawResult.coupon_min_spend || '0')
      return (
        <Text className="block text-sm text-gray-500 mt-2">
          {minSpend > 0 ? `满 ¥${minSpend} 可用 · ` : ''}立减 ¥{drawResult.coupon_amount}
        </Text>
      )
    }
    if (type === 'product') {
      return (
        <View className="mt-3 w-full">
          {drawResult.product_name ? (
            <Text className="block text-sm text-gray-500 mb-2">奖品：{drawResult.product_name}</Text>
          ) : null}
          {drawResult.redemption_code ? (
            <View className="bg-gray-50 rounded-xl px-4 py-3">
              <Text className="block text-xs text-gray-400 mb-1">兑换码（到店出示）</Text>
              <Text className="block text-base font-bold text-gray-800 tracking-wider">{drawResult.redemption_code}</Text>
            </View>
          ) : null}
        </View>
      )
    }
    if (type === 'free_meal') {
      return (
        <Text className="block text-sm text-gray-500 mt-2">
          本单免单 ¥{drawResult.refund_amount}，退款将原路返回
        </Text>
      )
    }
    // 兼容已抽记录（无 prize_type）
    if (drawResult.redemption_code) {
      return (
        <View className="bg-gray-50 rounded-xl px-4 py-3 mt-3 w-full">
          <Text className="block text-xs text-gray-400 mb-1">兑换码（到店出示）</Text>
          <Text className="block text-base font-bold text-gray-800 tracking-wider">{drawResult.redemption_code}</Text>
        </View>
      )
    }
    if (drawResult.refund_amount && parseFloat(drawResult.refund_amount) > 0) {
      return (
        <Text className="block text-sm text-gray-500 mt-2">返现 ¥{drawResult.refund_amount} 将原路返回</Text>
      )
    }
    return null
  }

  return (
    <View
      className="min-h-screen flex flex-col"
      style={{ background: 'linear-gradient(180deg, #1a0533 0%, #3b1155 45%, #5b1a4a 100%)' }}
    >
      {/* 背景星星 */}
      {stage !== 'result' &&
        stars.map((s) => (
          <View
            key={s.id}
            className="lottery-star-twinkle"
            style={{
              position: 'absolute',
              left: s.left,
              top: s.top,
              width: `${s.size}px`,
              height: `${s.size}px`,
              borderRadius: '50%',
              backgroundColor: '#FFD700',
              animationDelay: s.delay,
              zIndex: 1,
            }}
          />
        ))}

      {/* 标题区 */}
      <View className="pt-14 pb-6 flex flex-col items-center" style={{ position: 'relative', zIndex: 2 }}>
        <View className="flex flex-row items-center gap-2">
          <Sparkles size={22} color="#FFD700" />
          <Text className="block text-2xl font-bold text-white lottery-title-glow">幸运盲盒</Text>
          <Sparkles size={22} color="#FFD700" />
        </View>
        <Text className="block text-sm text-white text-opacity-70 mt-2">
          {stage === 'select' && '挑选一个盲盒，开启你的专属好运'}
          {stage === 'opening' && '正在为你开奖...'}
          {stage === 'result' && (drawResult?.is_winner ? '恭喜！好运降临' : '开奖结果')}
          {stage === 'loading' && '加载中...'}
        </Text>
        {orderInfo?.package_name ? (
          <Text className="block text-xs text-white text-opacity-50 mt-1">订单：{orderInfo.package_name}</Text>
        ) : null}
      </View>

      {/* 盲盒选择区 */}
      {(stage === 'select' || stage === 'opening') && (
        <View className="flex-1 px-6" style={{ position: 'relative', zIndex: 2 }}>
          <View className="grid grid-cols-3 gap-4 mt-4">
            {BOX_COLORS.map(([from, to], index) => {
              const isSelected = selectedBox === index
              const isOpening = stage === 'opening'
              const dimmed = isOpening && !isSelected
              return (
                <View
                  key={index}
                  className="flex flex-col items-center"
                  style={{
                    opacity: dimmed ? 0.25 : 1,
                    transition: 'opacity 0.4s',
                  }}
                  onClick={() => handleBoxClick(index)}
                >
                  <View
                    className={`w-full rounded-2xl flex flex-col items-center justify-center ${
                      isOpening && isSelected && !exploding
                        ? 'lottery-box-shake'
                        : isOpening && isSelected && exploding
                          ? 'lottery-box-explode'
                          : 'lottery-box-float'
                    }`}
                    style={{
                      aspectRatio: '0.85',
                      background: `linear-gradient(135deg, ${from} 0%, ${to} 100%)`,
                      boxShadow: isSelected
                        ? `0 0 24px ${from}, 0 8px 16px rgba(0,0,0,0.35)`
                        : '0 8px 16px rgba(0,0,0,0.35)',
                      animationDelay: `${index * 0.25}s`,
                      border: isSelected ? '2px solid #FFD700' : '2px solid rgba(255,255,255,0.25)',
                    }}
                  >
                    <Gift size={36} color="rgba(255,255,255,0.95)" />
                    <Text className="block text-lg font-bold text-white mt-2">?</Text>
                  </View>
                  <Text className="block text-xs text-white text-opacity-60 mt-2">{index + 1}号盒</Text>
                </View>
              )
            })}
          </View>

          {stage === 'select' && (
            <Text className="block text-center text-xs text-white text-opacity-50 mt-8">
              每个盲盒都藏着不同的惊喜：优惠券 / 商品 / 霸王餐
            </Text>
          )}
        </View>
      )}

      {/* 结果展示区 */}
      {stage === 'result' && drawResult && (
        <View className="flex-1 flex flex-col items-center justify-center px-8 pb-10" style={{ position: 'relative', zIndex: 2 }}>
          {/* 中奖彩带 */}
          {drawResult.is_winner &&
            confetti.map((c) => (
              <View
                key={c.id}
                className="lottery-confetti"
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

          {/* 光芒背景 */}
          {drawResult.is_winner && (
            <View
              className="lottery-ray-spin"
              style={{
                position: 'absolute',
                width: '320px',
                height: '320px',
                borderRadius: '50%',
                background:
                  'conic-gradient(from 0deg, rgba(255,215,0,0.28) 0deg, transparent 30deg, rgba(255,215,0,0.28) 60deg, transparent 90deg, rgba(255,215,0,0.28) 120deg, transparent 150deg, rgba(255,215,0,0.28) 180deg, transparent 210deg, rgba(255,215,0,0.28) 240deg, transparent 270deg, rgba(255,215,0,0.28) 300deg, transparent 330deg)',
                zIndex: 1,
              }}
            />
          )}

          {/* 奖品卡片 */}
          <View
            className="bg-white rounded-3xl px-8 py-8 w-full flex flex-col items-center lottery-prize-pop"
            style={{ position: 'relative', zIndex: 2, boxShadow: '0 16px 40px rgba(0,0,0,0.4)' }}
          >
            {drawResult.is_winner ? (
              <>
                <View
                  className="w-20 h-20 rounded-full flex items-center justify-center lottery-glow-pulse"
                  style={{ background: 'linear-gradient(135deg, #FFF3D6 0%, #FFE1A8 100%)' }}
                >
                  {drawResult.image_url ? (
                    <Image src={drawResult.image_url} className="w-14 h-14 rounded-full" mode="aspectFill" />
                  ) : (
                    renderPrizeIcon()
                  )}
                </View>
                <Text className="block text-xs font-semibold text-[#F7B731] mt-4 tracking-widest">CONGRATULATIONS</Text>
                <Text className="block text-xl font-bold text-gray-800 mt-1 text-center">{drawResult.prize_name}</Text>
                {renderPrizeExtra()}
              </>
            ) : (
              <>
                <View className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center">
                  <PartyPopper size={40} color="#9ca3af" />
                </View>
                <Text className="block text-xl font-bold text-gray-800 mt-4">差一点点</Text>
                <Text className="block text-sm text-gray-500 mt-2 text-center">
                  好运正在路上{'\n'}下次一定能中大奖
                </Text>
              </>
            )}
          </View>

          {/* 底部操作按钮 */}
          <View className="flex flex-col gap-3 w-full mt-6" style={{ position: 'relative', zIndex: 2 }}>
            {drawResult.is_winner && (
              <Button className="w-full rounded-full bg-[#FF4757] text-white h-12" onClick={goRecords}>
                <Text className="text-base font-semibold text-white">查看我的奖品</Text>
              </Button>
            )}
            <Button
              className={`w-full rounded-full h-12 ${drawResult.is_winner ? 'bg-white bg-opacity-15' : 'bg-[#FF4757]'}`}
              onClick={goHome}
            >
              <View className="flex flex-row items-center gap-2">
                <House size={18} color="#fff" />
                <Text className="text-base font-semibold text-white">返回首页</Text>
              </View>
            </Button>
          </View>
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
            backgroundColor: 'rgba(0,0,0,0.65)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <View className="bg-white rounded-3xl px-8 py-8 mx-8 w-full max-w-sm flex flex-col items-center">
            <View
              className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #FFE1E6 0%, #FFC2CC 100%)' }}
            >
              <Share2 size={30} color="#FF4757" />
            </View>
            <Text className="block text-xl font-bold text-gray-800 mt-4">分享给好友开奖</Text>
            <Text className="block text-sm text-gray-500 mt-2 text-center">
              把好运分享出去{'\n'}即可立即开启你选的盲盒
            </Text>
            <View className="flex flex-col gap-3 w-full mt-6">
              {isMiniApp ? (
                <Button
                  openType="share"
                  className="w-full h-12 rounded-full bg-[#FF4757] text-base font-semibold text-white"
                  onClick={() => setSharePending(true)}
                >
                  喊好友助力，立即开奖
                </Button>
              ) : (
                <Button className="w-full rounded-full bg-[#FF4757] text-white h-12" onClick={handleH5Share}>
                  <Text className="text-base font-semibold text-white">分享给好友，立即开奖</Text>
                </Button>
              )}
              <Button
                className="w-full rounded-full bg-gray-100 h-12"
                onClick={() => {
                  setNeedShare(false)
                  setSelectedBox(null)
                }}
              >
                <Text className="text-base text-gray-600">再想想</Text>
              </Button>
            </View>
          </View>
        </View>
      )}

      {/* 加载态 */}
      {stage === 'loading' && (
        <View className="flex-1 flex items-center justify-center" style={{ position: 'relative', zIndex: 2 }}>
          <View className="lottery-glow-pulse">
            <Gift size={56} color="#FFD700" />
          </View>
        </View>
      )}
    </View>
  )
}
