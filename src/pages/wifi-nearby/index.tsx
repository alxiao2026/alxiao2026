import { useCallback, useMemo, useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useDidShow, useRouter } from '@tarojs/taro'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import WifiTabBar from '@/components/wifi/wifi-tabbar'
import { Network } from '@/network'
import { isWifiSupported, getConnected, scanNearby, signalLevel } from '@/lib/wifi'
import { Search, Wifi, Lock, RefreshCw, Check, Zap, PencilLine } from 'lucide-react-taro'
import '../wifi/index.css'

interface WifiItem {
  ssid: string
  secure: boolean
  level: number
  /** merchant=商家热点 / current=当前已连 / scanned=扫描到 */
  source: 'merchant' | 'current' | 'scanned'
}

/** 附近 WiFi 列表页：搜索 + 一键连接 */
export default function WifiNearbyPage() {
  const router = useRouter()
  const merchantId = router.params.merchantId || ''
  const merchantName = decodeURIComponent(router.params.name || '')

  const [supported] = useState(() => isWifiSupported())
  const [keyword, setKeyword] = useState('')
  const [list, setList] = useState<WifiItem[]>([])
  const [loading, setLoading] = useState(false)
  const [scanLimited, setScanLimited] = useState(false)
  // 加密热点密码输入弹窗
  const [pwdTarget, setPwdTarget] = useState<WifiItem | null>(null)
  const [pwdInput, setPwdInput] = useState('')
  // 手动连接其他 WiFi 弹窗
  const [manualOpen, setManualOpen] = useState(false)
  const [manualSsid, setManualSsid] = useState('')
  const [manualPwd, setManualPwd] = useState('')

  /** 组装列表：商家 WiFi 置顶 → 当前已连 → 扫描结果（去重按信号排序） */
  const loadList = useCallback(async () => {
    if (!supported) return
    setLoading(true)
    const items: WifiItem[] = []
    let merchantSsid = ''

    // 1. 商家配置的店内 WiFi
    if (merchantId) {
      try {
        const res = await Network.request({ url: `/api/merchants/${merchantId}/wifi` })
        console.log('[附近WiFi] 商家WiFi配置:', res.data)
        const d = (res.data as any)?.data
        if (d?.has_wifi && d.ssid) {
          merchantSsid = d.ssid
          items.push({ ssid: d.ssid, secure: true, level: 4, source: 'merchant' })
        }
      } catch (e) {
        console.error('[附近WiFi] 加载商家WiFi失败:', e)
      }
    }

    // 2. 当前已连接
    const cur = await getConnected()
    if (cur?.SSID && cur.SSID !== merchantSsid) {
      items.push({ ssid: cur.SSID, secure: true, level: signalLevel(cur.signalStrength), source: 'current' })
    }

    // 3. 扫描附近热点（iOS 不支持时为空）
    const scanned = await scanNearby()
    if (scanned.length === 0) setScanLimited(true)
    else setScanLimited(false)
    const exist = new Set(items.map((i) => i.ssid))
    const dedup = new Map<string, WifiItem>()
    scanned.forEach((w) => {
      if (!w.SSID || exist.has(w.SSID)) return
      const item: WifiItem = { ssid: w.SSID, secure: w.secure !== false, level: signalLevel(w.signalStrength), source: 'scanned' }
      const old = dedup.get(w.SSID)
      if (!old || item.level > old.level) dedup.set(w.SSID, item)
    })
    items.push(...Array.from(dedup.values()).sort((a, b) => b.level - a.level))

    setList(items)
    setLoading(false)
  }, [supported, merchantId])

  useDidShow(() => { loadList() })

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    if (!kw) return list
    return list.filter((i) => i.ssid.toLowerCase().includes(kw))
  }, [list, keyword])

  /** 跳回首页执行连接流程（复用连接中/成功动效页） */
  const goConnect = (ssid: string, password: string) => {
    const url = `/pages/wifi/index?merchantId=${merchantId}&name=${encodeURIComponent(merchantName)}&autoSsid=${encodeURIComponent(ssid)}&autoPwd=${encodeURIComponent(password)}`
    Taro.redirectTo({ url }).catch(() => Taro.navigateTo({ url }))
  }

  /** 点击连接：商家/开放热点直连，加密热点弹密码框 */
  const handleConnect = (item: WifiItem) => {
    if (item.source === 'current') {
      Taro.showToast({ title: '当前已连接该WiFi', icon: 'none' })
      return
    }
    if (item.source === 'merchant') {
      // 商家热点密码已下发，重新拉一次确保最新
      Network.request({ url: `/api/merchants/${merchantId}/wifi` }).then((res) => {
        const d = (res.data as any)?.data
        goConnect(item.ssid, d?.password || '')
      }).catch(() => goConnect(item.ssid, ''))
      return
    }
    if (!item.secure) {
      goConnect(item.ssid, '')
      return
    }
    setPwdInput('')
    setPwdTarget(item)
  }

  /* ================= H5 降级 ================= */
  if (!supported) {
    return (
      <View className="min-h-screen flex flex-col items-center justify-center px-8" style={{ background: 'linear-gradient(160deg, #FF4757 0%, #FF7A59 45%, #FFA502 80%, #FFE5EC 100%)' }}>
        <Text style={{ fontSize: 64 }}>📶</Text>
        <Text className="block text-2xl font-black text-white mt-6">附近WiFi</Text>
        <Text className="block text-sm text-center mt-3 leading-6" style={{ color: 'rgba(255,255,255,0.9)' }}>
          WiFi 连接功能仅在微信小程序中可用{'\n'}请使用微信扫码打开小程序体验
        </Text>
      </View>
    )
  }

  return (
    <View className="min-h-screen pb-32" style={{ backgroundColor: '#F9FAFB' }}>
      {/* 头部：标题 + 搜索 */}
      <View className="relative overflow-hidden px-5 pt-12 pb-8" style={{ background: 'linear-gradient(150deg, #FF4757 0%, #FF6B6B 45%, #FFA07A 80%, #FFE5EC 100%)' }}>
        <View className="wifi-blob absolute rounded-full" style={{ width: 100, height: 100, top: -26, right: -20, background: 'rgba(255,255,255,0.14)' }} />
        <Text className="absolute" style={{ top: 30, right: 90, fontSize: 18 }}>✨</Text>
        <View className="wifi-pop-in flex flex-row items-center justify-between relative">
          <View className="flex flex-row items-center gap-2">
            <Text style={{ fontSize: 32 }}>🛜</Text>
            <Text className="text-2xl font-black text-white" style={{ textShadow: '0 2px 8px rgba(194,24,51,0.4)' }}>附近WiFi</Text>
          </View>
          <View className="wifi-ripple rounded-full p-2" style={{ background: 'rgba(255,255,255,0.25)' }} onClick={loadList}>
            <RefreshCw size={18} color="#fff" className={loading ? 'wifi-spin' : ''} />
          </View>
        </View>
        {/* 搜索框 */}
        <View className="wifi-pop-in relative mt-4 rounded-full px-4 py-1 flex flex-row items-center gap-2" style={{ background: 'rgba(255,255,255,0.95)', animationDelay: '0.1s' }}>
          <Search size={17} color="#FF8FA3" />
          <View className="flex-1">
            <Input
              className="w-full bg-transparent"
              placeholder="搜索 WiFi 名称…"
              value={keyword}
              onInput={(e) => setKeyword(e.detail.value)}
            />
          </View>
        </View>
      </View>

      {/* 列表 */}
      <View className="px-5 mt-4 flex flex-col gap-3">
        {filtered.map((item, idx) => (
          <View
            key={`${item.source}-${item.ssid}`}
            className="wifi-pop-in rounded-[2rem] p-4 flex flex-row items-center justify-between"
            style={{
              background: '#fff',
              boxShadow: '0 8px 22px rgba(255,71,87,0.08)',
              border: item.source === 'merchant' ? '2px solid #FFE8BF' : '2px solid transparent',
              animationDelay: `${0.05 * idx}s`,
            }}
          >
            <View className="flex flex-row items-center gap-3 flex-1 pr-2">
              <View
                className="rounded-2xl flex items-center justify-center shrink-0"
                style={{
                  width: 46, height: 46,
                  background: item.source === 'merchant' ? 'linear-gradient(135deg, #FFA502, #FF4757)' : item.source === 'current' ? '#E8FFF1' : '#FFF1F2',
                }}
              >
                {item.source === 'merchant' ? <Zap size={22} color="#fff" /> : item.source === 'current' ? <Check size={22} color="#2ED573" /> : <Wifi size={22} color="#FF4757" />}
              </View>
              <View className="flex-1">
                <View className="flex flex-row items-center gap-2 flex-wrap">
                  <Text className="text-base font-bold" style={{ color: '#1F2937' }}>{item.ssid}</Text>
                  {(item.source === 'merchant' || !item.secure) && (
                    <View className="px-2 py-1 rounded-full" style={{ backgroundColor: '#2ED573' }}>
                      <Text className="text-xs font-bold" style={{ color: '#fff', lineHeight: 1 }}>FREE</Text>
                    </View>
                  )}
                  {item.secure && item.source === 'scanned' && <Lock size={13} color="#B6BCC7" />}
                </View>
                <View className="flex flex-row items-center gap-2 mt-1">
                  {/* 信号格 */}
                  <View className="flex flex-row items-end gap-1">
                    {[1, 2, 3, 4].map((i) => (
                      <View key={i} style={{ width: 5, height: 4 + i * 4, borderRadius: 2, backgroundColor: i <= item.level ? '#FFA502' : 'rgba(0,0,0,0.08)' }} />
                    ))}
                  </View>
                  <Text className="text-xs" style={{ color: '#9CA3AF' }}>
                    {item.source === 'merchant' ? '店内推荐 · 免密直连' : item.source === 'current' ? '当前已连接' : ['信号较弱', '信号一般', '信号良好', '信号极好'][item.level - 1]}
                  </Text>
                </View>
              </View>
            </View>
            {item.source === 'current' ? (
              <View className="px-3 py-2 rounded-full shrink-0" style={{ backgroundColor: '#E8FFF1' }}>
                <Text className="text-xs font-bold" style={{ color: '#2ED573' }}>已连接</Text>
              </View>
            ) : (
              <Button
                className="rounded-full border-0 wifi-ripple shrink-0"
                style={{ background: item.secure && item.source !== 'merchant' ? '#FFE5EC' : 'linear-gradient(135deg, #FF4757, #FF7A59)', height: 38, paddingLeft: 16, paddingRight: 16 }}
                onClick={() => handleConnect(item)}
              >
                <Text className="text-sm font-bold" style={{ color: item.secure && item.source !== 'merchant' ? '#FF4757' : '#fff' }}>
                  {item.secure && item.source !== 'merchant' ? '输密码' : '连接'}
                </Text>
              </Button>
            )}
          </View>
        ))}

        {/* 空状态 / iOS 扫描限制提示 */}
        {!loading && filtered.length === 0 && (
          <View className="wifi-pop-in flex flex-col items-center py-14">
            <Text style={{ fontSize: 52 }}>📡</Text>
            <Text className="block text-base font-bold mt-4" style={{ color: '#374151' }}>
              {keyword ? '没有找到匹配的WiFi' : '暂未发现附近热点'}
            </Text>
            <Text className="block text-sm mt-2 text-center" style={{ color: '#9CA3AF' }}>
              {keyword ? '换个关键词试试' : '靠近店内路由器后点右上角刷新'}
            </Text>
          </View>
        )}
        {scanLimited && !keyword && (
          <View className="wifi-pop-in rounded-[2rem] px-4 py-3" style={{ background: '#FFF7E6', border: '1px solid #FFE8BF' }}>
            <Text className="block text-xs leading-5" style={{ color: '#B45309' }}>
              💡 受手机系统限制，部分设备无法扫描全部热点；可用首页「扫码连WiFi」或下方手动输入名称连接
            </Text>
          </View>
        )}

        {/* 手动连接其他 WiFi */}
        <View
          className="wifi-pop-in rounded-[2rem] p-4 flex flex-row items-center justify-center gap-2 wifi-ripple"
          style={{ background: 'linear-gradient(135deg, #FFE5EC, #FFF7E6)', border: '2px dashed #FFB3BD' }}
          onClick={() => { setManualSsid(''); setManualPwd(''); setManualOpen(true) }}
        >
          <PencilLine size={17} color="#FF4757" />
          <Text className="text-sm font-bold" style={{ color: '#FF4757' }}>手动连接其他WiFi</Text>
        </View>
      </View>

      {/* 加密热点密码输入弹窗 */}
      <Dialog open={!!pwdTarget} onOpenChange={(open) => { if (!open) setPwdTarget(null) }}>
        <DialogContent className="bg-white rounded-[2rem]">
          <DialogHeader>
            <DialogTitle>连接「{pwdTarget?.ssid}」</DialogTitle>
          </DialogHeader>
          <View className="py-2">
            <Text className="block text-xs mb-2" style={{ color: '#9CA3AF' }}>该热点需要密码，请输入后连接</Text>
            <View className="rounded-2xl px-4 py-1" style={{ background: '#F3F4F6' }}>
              <Input
                className="w-full bg-transparent"
                placeholder="请输入 WiFi 密码"
                value={pwdInput}
                onInput={(e) => setPwdInput(e.detail.value)}
                maxlength={64}
              />
            </View>
          </View>
          <DialogFooter>
            <Button
              className="w-full rounded-full border-0"
              style={{ background: 'linear-gradient(135deg, #FF4757, #FF7A59)', height: 44 }}
              onClick={() => {
                if (!pwdTarget) return
                const ssid = pwdTarget.ssid
                setPwdTarget(null)
                goConnect(ssid, pwdInput)
              }}
            >
              <Text className="text-sm font-bold text-white">立即连接</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 手动连接其他 WiFi 弹窗 */}
      <Dialog open={manualOpen} onOpenChange={(open) => { if (!open) setManualOpen(false) }}>
        <DialogContent className="bg-white rounded-[2rem]">
          <DialogHeader>
            <DialogTitle>手动连接WiFi</DialogTitle>
          </DialogHeader>
          <View className="py-2 flex flex-col gap-3">
            <View>
              <Text className="block text-xs mb-2" style={{ color: '#9CA3AF' }}>WiFi 名称（SSID）</Text>
              <View className="rounded-2xl px-4 py-1" style={{ background: '#F3F4F6' }}>
                <Input className="w-full bg-transparent" placeholder="请输入 WiFi 名称" value={manualSsid} onInput={(e) => setManualSsid(e.detail.value)} maxlength={32} />
              </View>
            </View>
            <View>
              <Text className="block text-xs mb-2" style={{ color: '#9CA3AF' }}>WiFi 密码（无密码可留空）</Text>
              <View className="rounded-2xl px-4 py-1" style={{ background: '#F3F4F6' }}>
                <Input className="w-full bg-transparent" placeholder="请输入 WiFi 密码" value={manualPwd} onInput={(e) => setManualPwd(e.detail.value)} maxlength={64} />
              </View>
            </View>
          </View>
          <DialogFooter>
            <Button
              className="w-full rounded-full border-0"
              style={{ background: 'linear-gradient(135deg, #FF4757, #FF7A59)', height: 44 }}
              onClick={() => {
                if (!manualSsid.trim()) {
                  Taro.showToast({ title: '请输入 WiFi 名称', icon: 'none' })
                  return
                }
                setManualOpen(false)
                goConnect(manualSsid.trim(), manualPwd)
              }}
            >
              <Text className="text-sm font-bold text-white">立即连接</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <WifiTabBar active="nearby" merchantId={merchantId} merchantName={merchantName} />
    </View>
  )
}
