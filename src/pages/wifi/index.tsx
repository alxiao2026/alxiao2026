import { useCallback, useEffect, useRef, useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useDidShow, useRouter, useShareAppMessage } from '@tarojs/taro'
import { Button } from '@/components/ui/button'
import WifiTabBar from '@/components/wifi/wifi-tabbar'
import { Network } from '@/network'
import {
  initWifi, getConnected, scanNearby, connectAndVerify,
  signalLevel, signalText, type WifiInfo,
} from '@/lib/wifi'
import { Wifi, Zap, Gauge, Share2, Check, RefreshCw, ChevronRight } from 'lucide-react-taro'
import './index.css'

type Phase = 'home' | 'connecting' | 'success'

/** 路由参数安全解码：跳转方已 encodeURIComponent，未解码会导致中文商家名显示成 %E8%9C%9C%E9%9B%AA... 乱码 */
function decodeParam(v?: string): string {
  if (!v) return ''
  try {
    return decodeURIComponent(v)
  } catch {
    return v
  }
}

interface MerchantWifiConfig {
  has_wifi: boolean
  ssid: string | null
  password: string | null
  merchant_name?: string
  merchant_id?: string | number
}

/** 信号强度四格条 */
function SignalBars({ level, color = '#FF4757', blink = false }: { level: 1 | 2 | 3 | 4; color?: string; blink?: boolean }) {
  return (
    <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 16 }}>
      {[1, 2, 3, 4].map((bar) => {
        const on = bar <= level
        const height = 4 + bar * 3.5
        return (
          <View
            key={bar}
            className={blink && on ? 'wifi-bar-blink' : ''}
            style={{ width: 3.5, height, borderRadius: 1.5, backgroundColor: on ? color : 'rgba(0,0,0,0.10)' }}
          />
        )
      })}
    </View>
  )
}

export default function WifiPage() {
  const router = useRouter()
  const merchantId = router.params.merchantId
  const merchantName = decodeParam(router.params.name)
  const autoSsid = router.params.autoSsid

  const [phase, setPhase] = useState<Phase>('home')
  const [config, setConfig] = useState<MerchantWifiConfig | null>(null)
  const [currentWifi, setCurrentWifi] = useState<WifiInfo | null>(null)
  const [nearbyCount, setNearbyCount] = useState<number>(0)
  const [connected, setConnected] = useState<WifiInfo | null>(null)
  const [connectSsid, setConnectSsid] = useState('')
  const [speedMbps, setSpeedMbps] = useState<number | null>(null)
  const [speedTesting, setSpeedTesting] = useState(false)
  const [progressDone, setProgressDone] = useState(false)
  const startConnectRef = useRef<(ssid: string, password: string, persist?: boolean) => void>(() => {})

  useShareAppMessage(() => ({
    title: connected ? `我在用「${connected.SSID}」免费冲浪` : '一键连WiFi，免费网络即点即连',
    path: `/pages/wifi/index?merchantId=${merchantId ?? ''}&name=${encodeURIComponent(merchantName)}`,
  }))

  /** 拉取商家 WiFi 配置 */
  const fetchConfig = useCallback(async () => {
    if (!merchantId) return
    try {
      const res = await Network.request({
        url: `/api/merchants/${merchantId}/wifi`,
        method: 'GET',
      })
      console.log('[wifi] config response:', JSON.stringify(res.data))
      const payload = res.data?.data
      if (payload) {
        setConfig({
          has_wifi: !!payload.has_wifi,
          ssid: payload.ssid ?? null,
          password: payload.password ?? null,
          merchant_name: payload.merchant_name,
          merchant_id: payload.merchant_id,
        })
      }
    } catch (err) {
      console.log('[wifi] config request failed:', err)
    }
  }, [merchantId])

  /** 连接指定 WiFi；默认 persist=true（「记住它」模式：触发系统保存，保存后到店自动连、退出不断网） */
  const startConnect = useCallback(async (ssid: string, password: string, persist = true) => {
    if (!(await initWifi())) {
      Taro.showToast({ title: 'WiFi 初始化失败，请重新点击', icon: 'none' })
      return
    }
    setConnectSsid(ssid)
    setPhase('connecting')
    setProgressDone(false)
    try {
      const info = await connectAndVerify(ssid, password, persist)
      setConnected(info)
      setProgressDone(true)
      setTimeout(() => {
        setPhase('success')
        setSpeedMbps(null)
      }, 450)
    } catch (err: any) {
      Taro.showModal({
        title: '连接失败',
        content: err?.message || '请靠近路由器后重试，或到附近热点页选择其他网络',
        confirmText: '去附近',
        cancelText: '取消',
        success: (r) => {
          if (r.confirm) Taro.redirectTo({ url: `/pages/wifi-nearby/index?merchantId=${merchantId ?? ''}&name=${encodeURIComponent(merchantName)}` })
        },
      })
      setPhase('home')
    }
  }, [merchantId, merchantName])
  startConnectRef.current = startConnect

  /** 主 CTA：点击直接以「记住它」模式连接店内 WiFi（引导文案展示在连接中页面，非阻断） */
  const handleMain = useCallback(() => {
    if (config?.has_wifi && config.ssid) {
      startConnect(config.ssid, config.password || '', true)
      return
    }
    if (!merchantId || config === null) {
      Taro.showToast({ title: 'WiFi信息获取中，请稍候再试', icon: 'none' })
      if (!config) fetchConfig()
      return
    }
    Taro.showToast({ title: '该门店暂未提供WiFi', icon: 'none' })
  }, [config, startConnect, merchantId, fetchConfig])

  /** 刷新当前连接 + 附近热点数量 */
  const refreshState = useCallback(async () => {
    if (!(await initWifi())) return
    try {
      const cur = await getConnected()
      setCurrentWifi(cur)
    } catch { /* 手机可能未开 WiFi，忽略 */ }
    try {
      const list = await scanNearby()
      setNearbyCount(list.length)
    } catch { /* 扫描权限未授予，忽略 */ }
  }, [])

  useDidShow(() => {
    fetchConfig()
    refreshState()
    // 从附近热点页带 ssid 参数回来：直接自动连接（注意参数名与 nearby 页的 autoPwd 对齐）
    if (autoSsid && phase === 'home') {
      const pwd = router.params.autoPwd ? decodeURIComponent(router.params.autoPwd) : ''
      setTimeout(() => startConnectRef.current(autoSsid, pwd, true), 600)
    }
  })

  useEffect(() => { fetchConfig() }, [fetchConfig])

  /** 简易测速 */
  const testSpeed = async () => {
    if (speedTesting) return
    setSpeedTesting(true)
    const start = Date.now()
    try {
      await Network.request({
        url: merchantId ? `/api/merchants/${merchantId}/wifi` : '/api/merchants',
        method: 'GET',
      })
      const cost = Math.max(40, Date.now() - start)
      const mbps = Math.round((64 / cost) * 1000 * 8 / 1024)
      setSpeedMbps(Math.max(1, Math.min(mbps, 300)))
    } catch {
      setSpeedMbps(null)
      Taro.showToast({ title: '测速失败，请稍后重试', icon: 'none' })
    } finally {
      setSpeedTesting(false)
    }
  }

  const goNearby = () => Taro.redirectTo({
    url: `/pages/wifi-nearby/index?merchantId=${merchantId ?? ''}&name=${encodeURIComponent(merchantName)}`,
  })

  // ============ 连接中 ============
  if (phase === 'connecting') {
    return (
      <View className="min-h-screen flex flex-col items-center justify-center px-8" style={{ background: 'linear-gradient(180deg, #FFFFFF 0%, #FFF3F4 18%, #FF4757 52%, #FF6B6B 100%)' }}>
        <View style={{ position: 'relative', width: 150, height: 150, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <View className="wifi-wave-ring" style={{ width: 150, height: 150 }} />
          <View className="wifi-wave-ring" style={{ width: 150, height: 150, animationDelay: '0.55s' }} />
          <View style={{ width: 104, height: 104, borderRadius: 9999, backgroundColor: 'rgba(255,255,255,0.96)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 16px 40px rgba(0,0,0,0.18)' }}>
            <Wifi size={46} color="#FF4757" strokeWidth={2.2} />
          </View>
        </View>

        <Text className="wifi-pop-in block text-xl font-bold text-white mt-10">秒速连接中</Text>
        <Text className="wifi-pop-in block text-sm mt-2 font-medium" style={{ color: 'rgba(255,255,255,0.9)' }}>{connectSsid}</Text>

        <View className="wifi-pop-in" style={{ marginTop: 20 }}>
          <SignalBars level={4} color="#fff" blink />
        </View>

        <View className="wifi-pop-in" style={{ width: '72%', marginTop: 26 }}>
          <View style={{ height: 5, borderRadius: 9999, backgroundColor: 'rgba(255,255,255,0.25)', overflow: 'hidden' }}>
            <View className={progressDone ? 'wifi-progress-done wifi-progress-run' : 'wifi-progress-run'} style={{ height: '100%', borderRadius: 9999, background: 'linear-gradient(90deg, #FFFFFF, #FFE5EC)' }} />
          </View>
        </View>
        <Text className="wifi-pop-in block text-xs mt-3 font-medium" style={{ color: 'rgba(255,255,255,0.85)' }}>安全验证中，马上就好</Text>

        {/* 团团引导文案（保留原弹窗思路，改为非阻断展示）：系统「保存网络」确认框会在连接过程中弹出 */}
        <View className="wifi-pop-in" style={{ marginTop: 30, width: '82%', backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 18, padding: '14px 18px' }}>
          <Text className="block text-xs font-semibold" style={{ color: '#FFFFFF' }}>若系统询问「保存网络」，点「保存」</Text>
          <Text className="block text-xs mt-2" style={{ color: 'rgba(255,255,255,0.9)' }}>团团会记住这个网络，下次到店自动秒连，抢套餐快人一步～</Text>
        </View>
      </View>
    )
  }

  // ============ 连接成功 ============
  if (phase === 'success' && connected) {
    return (
      <View className="min-h-screen pb-32" style={{ background: 'linear-gradient(180deg, #FFFFFF 0%, #EAFBF2 16%, #2ED573 48%, #7BED9F 72%, #F7F8FA 100%)' }}>
        <View className="flex flex-col items-center px-5 pt-20">
          <View className="wifi-check rounded-full flex items-center justify-center" style={{ width: 96, height: 96, backgroundColor: '#FFFFFF', boxShadow: '0 16px 40px rgba(46,213,115,0.35)' }}>
            <Check size={52} color="#2ED573" strokeWidth={3} />
          </View>

          <Text className="wifi-pop-in block text-2xl font-black mt-6" style={{ color: '#0B6B3A' }}>连接成功</Text>
          <Text className="wifi-pop-in block text-sm mt-2 font-medium" style={{ color: 'rgba(11,107,58,0.72)' }}>网速拉满，冲浪去吧</Text>

          <View className="wifi-pop-in w-full rounded-3xl bg-white p-5 mt-8" style={{ boxShadow: '0 10px 30px rgba(0,0,0,0.06)' }}>
            <View className="flex flex-row items-center gap-3">
              <View className="rounded-full flex items-center justify-center" style={{ width: 46, height: 46, backgroundColor: '#FFF1F2' }}>
                <Wifi size={22} color="#FF4757" strokeWidth={2.2} />
              </View>
              <View className="flex-1">
                <Text className="block text-base font-bold" style={{ color: '#1F2937' }}>{connected.SSID}</Text>
                <Text className="block text-xs mt-1" style={{ color: '#9CA3AF' }}>{signalText(connected.signalStrength)}</Text>
              </View>
              <SignalBars level={signalLevel(connected.signalStrength)} />
            </View>

            <View style={{ height: 1, backgroundColor: '#F3F4F6', marginTop: 16, marginBottom: 16 }} />

            <View className="flex flex-row items-center justify-between">
              <Text className="text-xs" style={{ color: '#9CA3AF' }}>网速状态</Text>
              {speedTesting ? (
                <View className="flex flex-row items-center gap-2">
                  <View className="wifi-spin rounded-full" style={{ width: 14, height: 14, border: '2px solid #E5E7EB', borderTopColor: '#FF4757' }} />
                  <Text className="text-xs" style={{ color: '#FF4757' }}>测速中…</Text>
                </View>
              ) : speedMbps !== null ? (
                <View className="flex flex-row items-baseline gap-1">
                  <Text className="text-lg font-black" style={{ color: '#FF4757' }}>{speedMbps}</Text>
                  <Text className="text-xs" style={{ color: '#9CA3AF' }}>Mbps</Text>
                </View>
              ) : (
                <Text className="text-xs" style={{ color: '#9CA3AF' }}>点击下方按钮测速</Text>
              )}
            </View>
          </View>

          <View className="wifi-pop-in flex flex-row gap-3 mt-5" style={{ width: '100%' }}>
            <View className="wifi-ripple flex-1 rounded-full flex flex-row items-center justify-center gap-2" style={{ height: 48, backgroundColor: '#1F2937' }} onClick={testSpeed}>
              <Gauge size={18} color="#FFFFFF" strokeWidth={2.2} />
              <Text className="text-sm font-semibold text-white">测个速</Text>
            </View>
            <Button
              className="flex-1 rounded-full h-12"
              style={{ background: 'linear-gradient(135deg, #FF4757, #FF6B6B)', color: '#fff', border: 'none' }}
              openType="share"
            >
              <View className="flex flex-row items-center justify-center gap-2">
                <Share2 size={18} color="#FFFFFF" strokeWidth={2.2} />
                <Text className="text-sm font-semibold text-white">安利给朋友</Text>
              </View>
            </Button>
          </View>

          <View className="wifi-ripple flex flex-row items-center gap-2 mt-6" onClick={() => { setPhase('home'); refreshState() }}>
            <RefreshCw size={14} color="#9CA3AF" strokeWidth={2.2} />
            <Text className="text-xs" style={{ color: '#9CA3AF' }}>连其他WiFi</Text>
          </View>
        </View>

    <WifiTabBar active="home" merchantId={merchantId} merchantName={merchantName} />
      </View>
    )
  }

  // ============ 首页 ============
  const displayName = merchantName || config?.merchant_name || ''

  return (
    <View className="min-h-screen pb-32" style={{ backgroundColor: '#F7F8FA' }}>
      {/* 顶部 */}
      <View className="px-6 pt-10 pb-9" style={{ background: 'linear-gradient(180deg, #FFF3F4 0%, #F7F8FA 100%)' }}>
        <Text className="block text-2xl font-black" style={{ color: '#1F2937' }}>一键连WiFi</Text>
        <Text className="block text-sm mt-2 font-medium" style={{ color: '#6B7280' }}>
          {displayName ? `${displayName} · 到店免密直连` : '到店免密，一秒上网'}
        </Text>
      </View>

      {/* 核心连接卡 */}
      <View className="px-5" style={{ marginTop: -6 }}>
        <View className="wifi-pop-in rounded-3xl bg-white flex flex-col items-center px-6 pt-8 pb-7" style={{ boxShadow: '0 10px 34px rgba(31,41,55,0.06)' }}>
          <View
            className="wifi-breathe wifi-ripple rounded-full flex items-center justify-center"
            style={{ width: 128, height: 128, background: 'linear-gradient(150deg, #FF4757, #FF6B6B)' }}
            onClick={handleMain}
          >
            <Wifi size={52} color="#FFFFFF" strokeWidth={2} />
          </View>

          <Text className="block text-lg font-bold mt-6" style={{ color: '#1F2937' }}>
            {config?.has_wifi ? '连接店内WiFi' : '一键连接WiFi'}
          </Text>
          <Text className="block text-xs mt-2 font-medium" style={{ color: '#6B7280' }}>
            {config?.has_wifi && config.ssid ? config.ssid : '无需密码，点击秒连'}
          </Text>

          {currentWifi && (
            <View className="flex flex-row items-center gap-2 rounded-full mt-5" style={{ backgroundColor: '#F0FDF4', padding: '6px 14px' }}>
              <Check size={13} color="#2ED573" strokeWidth={3} />
              <Text className="text-xs" style={{ color: '#0B6B3A' }}>当前已连：{currentWifi.SSID}</Text>
            </View>
          )}
        </View>
      </View>

      {/* 附近热点入口 */}
      <View className="px-5 mt-4" onClick={goNearby}>
        <View className="wifi-pop-in rounded-3xl bg-white flex flex-row items-center justify-between p-5" style={{ boxShadow: '0 6px 20px rgba(31,41,55,0.04)' }}>
          <View className="flex flex-row items-center gap-3">
            <View className="rounded-2xl flex items-center justify-center" style={{ width: 44, height: 44, backgroundColor: '#FFF1F2' }}>
              <Zap size={20} color="#FF4757" strokeWidth={2.2} />
            </View>
            <View>
              <Text className="block text-base font-semibold" style={{ color: '#1F2937' }}>附近免费热点</Text>
              <Text className="block text-xs mt-1 font-medium" style={{ color: '#6B7280' }}>
                {nearbyCount > 0 ? `${nearbyCount} 个网络即点即连` : '周边网络一键直达'}
              </Text>
            </View>
          </View>
          <ChevronRight size={18} color="#D1D5DB" strokeWidth={2.2} />
        </View>
      </View>

      {/* 使用提示 */}
      <View className="px-5 mt-4">
        <View className="wifi-pop-in rounded-3xl bg-white p-5 flex flex-row gap-3" style={{ boxShadow: '0 6px 20px rgba(31,41,55,0.04)' }}>
          <View className="rounded-full flex items-center justify-center" style={{ width: 34, height: 34, backgroundColor: '#F3F4F6', flexShrink: 0, marginTop: 2 }}>
            <Zap size={15} color="#6B7280" strokeWidth={2.2} />
          </View>
          <View className="flex-1">
            <Text className="block text-sm font-semibold" style={{ color: '#4B5563' }}>连接小贴士</Text>
            <Text className="block text-xs mt-2 font-medium" style={{ color: '#9CA3AF', lineHeight: 1.6 }}>
              连接前请打开手机WiFi开关；连接失败时靠近路由器，或到「附近」切换其他热点秒连。
            </Text>
          </View>
        </View>
      </View>

      <WifiTabBar active="home" merchantId={merchantId} merchantName={merchantName} />
    </View>
  )
}
