import { useCallback, useEffect, useRef, useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useDidShow, useRouter, useShareAppMessage } from '@tarojs/taro'
import { Button } from '@/components/ui/button'
import WifiTabBar from '@/components/wifi/wifi-tabbar'
import { Network } from '@/network'
import {
  isWifiSupported, initWifi, getConnected, scanNearby, connectAndVerify,
  parseWifiQr, signalLevel, signalText, type WifiInfo,
} from '@/lib/wifi'
import { ScanLine, Wifi, Zap, Gauge, Share2, Check, RefreshCw, Hand } from 'lucide-react-taro'
import './index.css'

type Phase = 'home' | 'connecting' | 'success'

interface WifiConfig { has_wifi: boolean; ssid: string; password: string; merchant_name: string }

/** 信号格（1-4 格） */
function SignalBars({ level, color = '#2ED573', blink = false }: { level: number; color?: string; blink?: boolean }) {
  return (
    <View className="flex flex-row items-end gap-1">
      {[1, 2, 3, 4].map((i) => (
        <View
          key={i}
          className={blink ? 'wifi-bar-blink' : ''}
          style={{
            width: 7, height: 5 + i * 5, borderRadius: 3,
            backgroundColor: i <= level ? color : 'rgba(0,0,0,0.10)',
            animationDelay: `${i * 0.18}s`,
          }}
        />
      ))}
    </View>
  )
}

/** 扫码连接首页：一键连WiFi（波普流体风） */
export default function WifiHomePage() {
  const router = useRouter()
  const merchantId = router.params.merchantId || ''
  const merchantName = decodeURIComponent(router.params.name || '')
  // 附近页带参跳转：自动连接参数
  const autoSsid = decodeURIComponent(router.params.autoSsid || '')
  const autoPwd = decodeURIComponent(router.params.autoPwd || '')
  const autoFiredRef = useRef(false)

  const [supported] = useState(() => isWifiSupported())
  const [config, setConfig] = useState<WifiConfig | null>(null)
  const [currentWifi, setCurrentWifi] = useState<WifiInfo | null>(null)
  const [nearbyCount, setNearbyCount] = useState(0)
  const [phase, setPhase] = useState<Phase>('home')
  const [connectSsid, setConnectSsid] = useState('')
  const [progressDone, setProgressDone] = useState(false)
  const [connectedInfo, setConnectedInfo] = useState<WifiInfo | null>(null)
  const [speed, setSpeed] = useState<{ phase: 'idle' | 'running' | 'done'; ping: number; kbps: number }>({ phase: 'idle', ping: 0, kbps: 0 })

  /** 拉商家 WiFi 配置 */
  const loadConfig = useCallback(async () => {
    if (!merchantId) return
    try {
      const res = await Network.request({ url: `/api/merchants/${merchantId}/wifi` })
      console.log('[WiFi首页] 商家WiFi配置:', res.data)
      const d = (res.data as any)?.data
      if (d) setConfig(d)
    } catch (e) {
      console.error('[WiFi首页] 加载商家WiFi配置失败:', e)
    }
  }, [merchantId])

  /** 刷新当前连接 + 附近热点数 */
  const refreshWifiState = useCallback(async () => {
    if (!supported) return
    const cur = await getConnected()
    setCurrentWifi(cur)
    const list = await scanNearby()
    setNearbyCount(list.length)
  }, [supported])

  useDidShow(() => {
    loadConfig()
    if (supported) {
      initWifi().then(() => refreshWifiState())
    }
    // 从附近页带参跳转：自动发起连接（仅消费一次）
    if (autoSsid && !autoFiredRef.current && supported) {
      autoFiredRef.current = true
      startConnect(autoSsid, autoPwd)
    }
  })

  useEffect(() => {
    // 页面进入即尝试预热 WiFi 模块
    if (supported) initWifi()
  }, [supported])

  /** 分享好友一起蹭网 */
  useShareAppMessage(() => ({
    title: `快来${merchantName || config?.merchant_name || '店里'}免费连WiFi，一键即连超方便！`,
    path: `/pages/wifi/index?merchantId=${merchantId}&name=${encodeURIComponent(merchantName)}`,
  }))

  /** 统一连接流程：连接中动效 → 真实连接 → 成功/失败 */
  const startConnect = useCallback(async (ssid: string, password: string) => {
    if (!ssid) return
    setConnectSsid(ssid)
    setProgressDone(false)
    setConnectedInfo(null)
    setSpeed({ phase: 'idle', ping: 0, kbps: 0 })
    setPhase('connecting')
    try {
      const info = await connectAndVerify(ssid, password)
      setConnectedInfo(info)
      setCurrentWifi(info)
      setProgressDone(true)
      setTimeout(() => setPhase('success'), 400)
    } catch (e: any) {
      console.error('[WiFi首页] 连接失败:', e)
      setProgressDone(true)
      setTimeout(() => {
        setPhase('home')
        Taro.showToast({ title: e?.message || '连接失败，请重试', icon: 'none', duration: 2500 })
      }, 400)
    }
  }, [])

  /** 扫码连接：识别 WiFi 分享二维码 */
  const handleScan = useCallback(async () => {
    if (!supported) return
    try {
      const res = await Taro.scanCode({ scanType: ['qrCode'] })
      const text = res?.result || ''
      console.log('[WiFi首页] 扫码结果:', text)
      const parsed = parseWifiQr(text)
      if (parsed) {
        startConnect(parsed.ssid, parsed.password)
      } else {
        Taro.showModal({
          title: '未识别到WiFi二维码',
          content: '这张二维码不是WiFi分享码，可以扫描店内WiFi贴纸，或手动选择热点',
          confirmText: '手动选择',
          cancelText: '再扫一次',
          success: (r) => {
            if (r.confirm) {
              Taro.navigateTo({ url: `/pages/wifi-nearby/index?merchantId=${merchantId}&name=${encodeURIComponent(merchantName)}` })
            }
          },
        })
      }
    } catch (e) {
      console.log('[WiFi首页] 扫码取消或失败:', e)
    }
  }, [supported, startConnect, merchantId, merchantName])

  /** 真实测速：请求业务接口计时估算延迟与下载速度 */
  const runSpeedTest = useCallback(async () => {
    if (speed.phase === 'running') return
    setSpeed({ phase: 'running', ping: 0, kbps: 0 })
    try {
      let totalPing = 0
      let totalBytes = 0
      const rounds = 2
      for (let i = 0; i < rounds; i++) {
        const t0 = Date.now()
        const res = await Network.request({ url: '/api/packages/active' })
        const cost = Date.now() - t0
        totalPing += cost
        totalBytes += JSON.stringify(res.data || {}).length
        console.log(`[WiFi测速] 第${i + 1}轮: ${cost}ms`)
      }
      const ping = Math.round(totalPing / rounds)
      const kbps = Math.max(1, Math.round((totalBytes / 1024) / (totalPing / 1000)))
      setSpeed({ phase: 'done', ping, kbps })
    } catch (e) {
      console.error('[WiFi测速] 失败:', e)
      setSpeed({ phase: 'idle', ping: 0, kbps: 0 })
      Taro.showToast({ title: '测速失败，请检查网络', icon: 'none' })
    }
  }, [speed.phase])

  const goNearby = () => {
    Taro.navigateTo({ url: `/pages/wifi-nearby/index?merchantId=${merchantId}&name=${encodeURIComponent(merchantName)}` })
  }

  const confettiEmojis = ['🎉', '✨', '🎊', '⭐', '💛', '🧡', '🎈', '💥']

  /* ================= H5 降级 ================= */
  if (!supported) {
    return (
      <View className="min-h-screen flex flex-col items-center justify-center px-8" style={{ background: 'linear-gradient(160deg, #FF4757 0%, #FF7A59 45%, #FFA502 80%, #FFE5EC 100%)' }}>
        <Text style={{ fontSize: 64 }}>📶</Text>
        <Text className="block text-2xl font-black text-white mt-6">一键连WiFi</Text>
        <Text className="block text-sm text-center mt-3 leading-6" style={{ color: 'rgba(255,255,255,0.9)' }}>
          WiFi 连接功能仅在微信小程序中可用{'\n'}请使用微信扫码打开小程序体验
        </Text>
      </View>
    )
  }

  /* ================= 连接中动效页 ================= */
  if (phase === 'connecting') {
    return (
      <View className="min-h-screen flex flex-col items-center justify-center px-8" style={{ background: 'linear-gradient(160deg, #FF4757 0%, #FF6B6B 40%, #FFA07A 75%, #FFE5EC 100%)' }}>
        <View className="relative flex items-center justify-center" style={{ width: 180, height: 180 }}>
          {[0, 1, 2].map((i) => (
            <View key={i} className="wifi-wave-ring" style={{ width: 110, height: 110, animationDelay: `${i * 0.5}s` }} />
          ))}
          <View className="rounded-full flex items-center justify-center" style={{ width: 110, height: 110, background: 'rgba(255,255,255,0.25)' }}>
            <View className="rounded-full flex items-center justify-center" style={{ width: 84, height: 84, background: '#fff' }}>
              <Wifi size={40} color="#FF4757" strokeWidth={2.5} />
            </View>
          </View>
        </View>
        <Text className="block text-xl font-black text-white mt-10">正在连接中…</Text>
        <Text className="block text-sm mt-2" style={{ color: 'rgba(255,255,255,0.85)' }}>{connectSsid}</Text>
        <View className="mt-6">
          <SignalBars level={4} color="#fff" blink />
        </View>
        {/* 进度条：2 秒模拟进度，真实连接完成后补满 */}
        <View className="w-full max-w-xs mt-8 rounded-full overflow-hidden" style={{ height: 10, background: 'rgba(255,255,255,0.3)' }}>
          <View
            className={`h-full rounded-full ${progressDone ? 'wifi-progress-done' : 'wifi-progress-run'}`}
            style={{ background: 'linear-gradient(90deg, #FFF, #FFE58F)' }}
          />
        </View>
        <Text className="block text-xs mt-3" style={{ color: 'rgba(255,255,255,0.75)' }}>正在握手验证，请稍候 ⚡</Text>
      </View>
    )
  }

  /* ================= 连接成功页 ================= */
  if (phase === 'success') {
    const lv = signalLevel(connectedInfo?.signalStrength)
    return (
      <View className="min-h-screen pb-32 relative overflow-hidden" style={{ background: 'linear-gradient(180deg, #2ED573 0%, #7BED9F 35%, #E8FFF1 70%, #F9FAFB 100%)' }}>
        {/* 彩屑 */}
        {confettiEmojis.map((emoji, i) => (
          <Text
            key={i}
            className="wifi-confetti"
            style={{ left: `${6 + i * 12}%`, top: 0, fontSize: 22 + (i % 3) * 6, animationDuration: `${2.4 + (i % 4) * 0.7}s`, animationDelay: `${i * 0.22}s` }}
          >
            {emoji}
          </Text>
        ))}

        <View className="flex flex-col items-center px-6 pt-20">
          {/* 大绿对勾 */}
          <View className="wifi-check rounded-full flex items-center justify-center" style={{ width: 120, height: 120, background: '#fff', boxShadow: '0 16px 40px rgba(46,213,115,0.4)' }}>
            <Check size={64} color="#2ED573" strokeWidth={3.5} />
          </View>
          <Text className="wifi-pop-in block text-3xl font-black mt-6" style={{ color: '#0B6B3A', animationDelay: '0.15s' }}>连接成功！</Text>
          <Text className="wifi-pop-in block text-sm mt-1" style={{ color: 'rgba(11,107,58,0.65)', animationDelay: '0.25s' }}>开始愉快冲浪吧 🏄</Text>

          {/* 当前 WiFi 信息卡 */}
          <View className="wifi-pop-in w-full mt-8 rounded-[2rem] p-5" style={{ background: 'rgba(255,255,255,0.92)', boxShadow: '0 10px 30px rgba(46,213,115,0.18)', animationDelay: '0.35s' }}>
            <View className="flex flex-row items-center justify-between">
              <View className="flex flex-row items-center gap-3">
                <View className="rounded-full flex items-center justify-center" style={{ width: 46, height: 46, background: 'linear-gradient(135deg, #FF4757, #FFA502)' }}>
                  <Wifi size={22} color="#fff" strokeWidth={2.5} />
                </View>
                <View>
                  <Text className="block text-base font-black" style={{ color: '#1F2937' }}>{connectedInfo?.SSID || connectSsid}</Text>
                  <Text className="block text-xs mt-1" style={{ color: '#9CA3AF' }}>{merchantName || config?.merchant_name || '免费热点'}</Text>
                </View>
              </View>
              <View className="flex flex-col items-end gap-1">
                <SignalBars level={lv} />
                <Text className="text-xs" style={{ color: '#2ED573' }}>
                  {signalText(connectedInfo?.signalStrength)}{connectedInfo?.signalStrength ? ` ${connectedInfo.signalStrength}dBm` : ''}
                </Text>
              </View>
            </View>

            {/* 测速结果 */}
            {speed.phase === 'done' && (
              <View className="wifi-pop-in mt-4 rounded-2xl px-4 py-3 flex flex-row items-center justify-between" style={{ background: 'linear-gradient(135deg, #FFF7E6, #FFE5EC)' }}>
                <Text className="text-sm font-bold" style={{ color: '#B45309' }}>⚡ 延迟 {speed.ping}ms</Text>
                <Text className="text-sm font-bold" style={{ color: '#FF4757' }}>🚀 约 {speed.kbps} KB/s</Text>
              </View>
            )}
          </View>

          {/* 操作按钮 */}
          <View className="wifi-pop-in w-full flex flex-row gap-3 mt-6" style={{ animationDelay: '0.45s' }}>
            <Button
              className="flex-1 rounded-full border-0 wifi-ripple"
              style={{ background: 'linear-gradient(135deg, #FF4757, #FFA502)', height: 50 }}
              onClick={runSpeedTest}
              disabled={speed.phase === 'running'}
            >
              <View className="flex flex-row items-center justify-center gap-2">
                <Gauge size={18} color="#fff" />
                <Text className="text-base font-bold text-white">{speed.phase === 'running' ? '测速中…' : '测速'}</Text>
              </View>
            </Button>
            <Button
              className="flex-1 rounded-full wifi-ripple"
              style={{ background: '#fff', border: '2px solid #FFD6DE', height: 50 }}
              openType="share"
            >
              <View className="flex flex-row items-center justify-center gap-2">
                <Share2 size={18} color="#FF4757" />
                <Text className="text-base font-bold" style={{ color: '#FF4757' }}>分享给好友</Text>
              </View>
            </Button>
          </View>

          <View className="wifi-pop-in mt-6 wifi-ripple" style={{ animationDelay: '0.55s' }} onClick={() => setPhase('home')}>
            <View className="flex flex-row items-center gap-1 px-4 py-2">
              <RefreshCw size={14} color="#6B7280" />
              <Text className="text-sm" style={{ color: '#6B7280' }}>再连其他WiFi</Text>
            </View>
          </View>
        </View>
      </View>
    )
  }

  /* ================= 首页（扫码连接页） ================= */
  const freeCount = nearbyCount + (config?.has_wifi ? 1 : 0)
  return (
    <View className="min-h-screen pb-32 relative overflow-hidden" style={{ backgroundColor: '#F9FAFB' }}>
      {/* 流体渐变头部 */}
      <View className="relative overflow-hidden px-6 pt-14 pb-24" style={{ background: 'linear-gradient(160deg, #FF4757 0%, #FF6B6B 38%, #FF8E53 68%, #FFA502 100%)' }}>
        {/* 漂浮气泡 */}
        <View className="wifi-blob absolute rounded-full" style={{ width: 130, height: 130, top: -30, right: -30, background: 'rgba(255,255,255,0.14)' }} />
        <View className="wifi-blob absolute rounded-full" style={{ width: 80, height: 80, top: 70, left: -24, background: 'rgba(255,229,143,0.28)', animationDelay: '1.2s' }} />
        <View className="wifi-blob absolute rounded-full" style={{ width: 52, height: 52, bottom: 20, right: 60, background: 'rgba(255,255,255,0.18)', animationDelay: '2s' }} />
        <Text className="absolute" style={{ top: 26, right: 110, fontSize: 20 }}>✨</Text>
        <Text className="absolute" style={{ top: 90, left: 30, fontSize: 16 }}>⚡</Text>

        <View className="wifi-pop-in relative">
          <View className="flex flex-row items-center gap-2">
            <Text style={{ fontSize: 40 }}>📶</Text>
            <Text className="text-3xl font-black text-white" style={{ textShadow: '0 2px 10px rgba(194,24,51,0.4)' }}>一键连WiFi</Text>
          </View>
          <Text className="block text-sm mt-2" style={{ color: 'rgba(255,255,255,0.9)' }}>
            {merchantName || config?.merchant_name ? `${merchantName || config?.merchant_name} 请你免费上网 🎈` : '扫码即连，免费冲浪 🏄'}
          </Text>
        </View>
      </View>

      {/* 超大扫码按钮（呼吸光晕） */}
      <View className="wifi-pop-in flex flex-col items-center -mt-16" style={{ animationDelay: '0.15s' }}>
        <View
          className="wifi-breathe wifi-ripple rounded-full flex flex-col items-center justify-center"
          style={{ width: 190, height: 190, background: 'linear-gradient(150deg, #FFFFFF 0%, #FFF1F2 100%)', border: '3px solid rgba(255,255,255,0.9)' }}
          onClick={handleScan}
        >
          <View className="rounded-full flex items-center justify-center" style={{ width: 92, height: 92, background: 'linear-gradient(135deg, #FF4757, #FFA502)' }}>
            <ScanLine size={44} color="#fff" strokeWidth={2.2} />
          </View>
          <Text className="block text-lg font-black mt-3" style={{ color: '#FF4757' }}>扫码连WiFi</Text>
          <Text className="block text-xs mt-1" style={{ color: '#B6BCC7' }}>对准店内WiFi二维码</Text>
        </View>
      </View>

      {/* 店内 WiFi 直连卡（商家已配置） */}
      {config?.has_wifi && (
        <View className="wifi-pop-in px-5 mt-7" style={{ animationDelay: '0.25s' }}>
          <View className="rounded-[2rem] p-5" style={{ background: 'linear-gradient(135deg, #FFF 0%, #FFF7E6 100%)', boxShadow: '0 10px 28px rgba(255,165,2,0.16)', border: '2px solid #FFE8BF' }}>
            <View className="flex flex-row items-center justify-between">
              <View className="flex flex-row items-center gap-3 flex-1">
                <View className="rounded-2xl flex items-center justify-center" style={{ width: 48, height: 48, background: 'linear-gradient(135deg, #FFA502, #FF4757)' }}>
                  <Zap size={24} color="#fff" />
                </View>
                <View className="flex-1">
                  <View className="flex flex-row items-center gap-2">
                    <Text className="text-base font-black" style={{ color: '#1F2937' }}>店内WiFi已就绪</Text>
                    <View className="px-2 py-1 rounded-full" style={{ backgroundColor: '#2ED573' }}>
                      <Text className="text-xs font-bold" style={{ color: '#fff', lineHeight: 1 }}>FREE</Text>
                    </View>
                  </View>
                  <Text className="block text-xs mt-1" style={{ color: '#9CA3AF' }}>{config.ssid}</Text>
                </View>
              </View>
              <Button
                className="rounded-full border-0 wifi-ripple shrink-0"
                style={{ background: 'linear-gradient(135deg, #FF4757, #FF7A59)', height: 40, paddingLeft: 18, paddingRight: 18 }}
                onClick={() => startConnect(config.ssid, config.password)}
              >
                <Text className="text-sm font-bold text-white">一键直连</Text>
              </Button>
            </View>
          </View>
        </View>
      )}

      {/* 附近热点数量卡 */}
      <View className="wifi-pop-in px-5 mt-4" style={{ animationDelay: '0.35s' }}>
        <View className="rounded-[2rem] p-5 flex flex-row items-center justify-between" style={{ background: '#fff', boxShadow: '0 8px 24px rgba(255,71,87,0.10)' }}>
          <View className="flex flex-row items-center gap-3">
            <Text style={{ fontSize: 34 }}>🎈</Text>
            <View>
              <Text className="block text-base font-black" style={{ color: '#1F2937' }}>
                附近有 <Text style={{ color: '#FF4757', fontSize: 22 }}>{freeCount}</Text> 个免费热点
              </Text>
              <Text className="block text-xs mt-1" style={{ color: '#9CA3AF' }}>
                {currentWifi ? `当前已连接：${currentWifi.SSID}` : '出门在外，流量能省则省'}
              </Text>
            </View>
          </View>
          {currentWifi && (
            <View className="px-2 py-1 rounded-full" style={{ backgroundColor: '#E8FFF1' }}>
              <Text className="text-xs font-bold" style={{ color: '#2ED573' }}>已在线</Text>
            </View>
          )}
        </View>
      </View>

      {/* 手动选择入口 */}
      <View className="wifi-pop-in px-5 mt-4" style={{ animationDelay: '0.45s' }}>
        <View
          className="rounded-[2rem] p-4 flex flex-row items-center justify-center gap-2 wifi-ripple"
          style={{ background: 'linear-gradient(135deg, #FFE5EC, #FFF7E6)', border: '2px dashed #FFB3BD' }}
          onClick={goNearby}
        >
          <Hand size={18} color="#FF4757" />
          <Text className="text-base font-bold" style={{ color: '#FF4757' }}>手动选择WiFi</Text>
          <Text style={{ fontSize: 14 }}>👉</Text>
        </View>
      </View>

      <WifiTabBar active="home" merchantId={merchantId} merchantName={merchantName} />
    </View>
  )
}
