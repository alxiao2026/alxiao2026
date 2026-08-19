import { useCallback, useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { Input } from '@/components/ui/input'
import { orchardApi, currentUserId, type OrchardProfile } from '@/lib/orchard-api'

const PRESETS = [10, 50, 100, 200]

export default function OrchardExchangePage() {
  const [profile, setProfile] = useState<OrchardProfile | null>(null)
  const [value, setValue] = useState(10)
  const [busy, setBusy] = useState(false)
  const userId = currentUserId()

  const load = useCallback(async () => {
    if (!userId) return
    try {
      const p = await orchardApi.profile(userId)
      if (p.code === 200 && p.data) {
        setProfile(p.data)
        setValue((v) => (v < p.data!.config.pointsExchangeMin ? p.data!.config.pointsExchangeMin : v))
      }
    } catch (e) {
      console.error('[OrchardExchange] 加载失败:', e)
    }
  }, [userId])

  useDidShow(() => {
    if (!userId) {
      Taro.showToast({ title: '请先登录', icon: 'none' })
      return
    }
    load()
  })

  const points = profile?.points ?? 0
  const exchangeMin = profile?.config.pointsExchangeMin ?? 10
  const rate = profile?.config.pointsExchangeRate ?? 1
  const canExchange = value >= exchangeMin && value <= points && !busy

  const handleExchange = async () => {
    if (!canExchange || !userId) return
    setBusy(true)
    try {
      const res = await orchardApi.exchangePoints(userId, value)
      if (res.biz_code === 0 && res.data) {
        Taro.showToast({ title: `成功兑换 ${res.data.gainedDroplets}g 水滴 🌱`, icon: 'none' })
        setValue(exchangeMin)
        load()
      } else {
        Taro.showToast({ title: res.msg || '兑换失败', icon: 'none' })
      }
    } catch (e) {
      Taro.showToast({ title: '网络异常，请重试', icon: 'none' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <View className="min-h-screen pb-10" style={{ backgroundColor: '#F9FAFB' }}>
      {/* 头部 */}
      <View className="px-4 pt-12 pb-10" style={{ background: 'linear-gradient(180deg, #FFE5EC 0%, #FFF1F2 60%, rgba(249,250,251,0) 100%)' }}>
        <View onClick={() => Taro.navigateBack({ delta: 1 })}>
          <Text className="text-sm font-bold" style={{ color: '#78716c' }}>← 返回</Text>
        </View>
        <View className="mt-2" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Text className="block font-black" style={{ fontSize: 11, letterSpacing: 2, color: 'rgba(255,71,87,0.8)' }}>POINTS → DROPLETS</Text>
          <Text className="block text-2xl font-black mt-1" style={{ color: '#1e293b' }}>积分兑换水滴</Text>
          <Text className="block text-xs mt-1" style={{ color: 'rgba(71,85,105,0.8)' }}>1 积分 = {rate}g 水滴，兑换后立即浇灌到果树</Text>
        </View>
      </View>

      <View className="px-4" style={{ marginTop: -16 }}>
        <View className="bg-white rounded-2xl p-5" style={{ boxShadow: '0 8px 24px -12px rgba(0,0,0,0.12)' }}>
          <View style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text className="text-xs font-bold" style={{ color: '#78716c' }}>当前积分</Text>
            <Text className="text-xl font-black" style={{ color: '#d97706' }}>🪙 {points}</Text>
          </View>
          <View style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
            <Text className="text-xs font-bold" style={{ color: '#78716c' }}>将获得水滴</Text>
            <Text className="text-2xl font-black" style={{ color: '#FF4757' }}>💧 {Math.max(0, Math.min(value, points)) * rate}g</Text>
          </View>

          <Text className="block text-xs font-black mt-4" style={{ color: '#78716c' }}>兑换数量（积分）</Text>
          <Input
            className="mt-2 h-14 rounded-2xl border-0"
            style={{ backgroundColor: '#fafaf9', fontSize: 24, fontWeight: 900, color: '#1c1917' }}
            type="number"
            value={String(value)}
            onInput={(e) => setValue(Number(e.detail.value) || 0)}
          />

          <View className="mt-3" style={{ display: 'flex', flexDirection: 'row', gap: 8 }}>
            {PRESETS.map((p) => (
              <View
                key={p}
                className="flex-1 rounded-full py-2"
                style={value === p ? { background: 'linear-gradient(135deg,#fbbf24,#f97316)', display: 'flex', alignItems: 'center', justifyContent: 'center' } : { backgroundColor: '#f5f5f4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                onClick={() => setValue(p)}
              >
                <Text className="text-xs font-black" style={{ color: value === p ? '#fff' : '#78716c' }}>{p}</Text>
              </View>
            ))}
          </View>
          <View
            className="rounded-full py-2 mt-2"
            style={value === points ? { background: 'linear-gradient(135deg,#fbbf24,#f97316)', display: 'flex', alignItems: 'center', justifyContent: 'center' } : { backgroundColor: '#f5f5f4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={() => setValue(points)}
          >
            <Text className="text-xs font-black" style={{ color: value === points ? '#fff' : '#78716c' }}>全部兑换（{points} 积分）</Text>
          </View>

          <View
            className="rounded-full py-3 mt-5"
            style={{ background: 'linear-gradient(135deg,#FF4757,#F43F5E)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: canExchange ? 1 : 0.5, boxShadow: '0 8px 24px -12px rgba(2,132,199,0.5)' }}
            onClick={handleExchange}
          >
            <Text className="text-base font-black text-white">
              {value < exchangeMin ? `至少兑换 ${exchangeMin} 积分` : value > points ? '积分不足' : busy ? '兑换中…' : `立即兑换 ${value * rate}g 水滴`}
            </Text>
          </View>
        </View>

        <View className="bg-white rounded-2xl p-4 mt-4" style={{ boxShadow: '0 8px 24px -12px rgba(0,0,0,0.12)' }}>
          <Text className="block text-sm font-black mb-2" style={{ color: '#1c1917' }}>💡 兑换说明</Text>
          <Text className="block" style={{ fontSize: 11, color: '#78716c', lineHeight: '18px' }}>· 每次最低兑换 {exchangeMin} 积分，1 积分 = {rate}g 水滴；</Text>
          <Text className="block" style={{ fontSize: 11, color: '#78716c', lineHeight: '18px' }}>· 兑换成功后水滴立即浇灌到当前果树，不进入余额；</Text>
          <Text className="block" style={{ fontSize: 11, color: '#78716c', lineHeight: '18px' }}>· 水滴无法反向兑换为积分，请按需兑换；</Text>
          <Text className="block" style={{ fontSize: 11, color: '#78716c', lineHeight: '18px' }}>· 兑换记录可在「水滴/积分明细」中查看。</Text>
        </View>
      </View>
    </View>
  )
}
