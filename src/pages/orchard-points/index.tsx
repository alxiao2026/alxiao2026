import { useCallback, useEffect, useMemo, useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { orchardApi, type OrchardProfile, type OrchardRecord } from '@/lib/orchard-api'
import { ensureLogin } from '@/lib/silent-login'

type FilterKey = 'all' | 'in' | 'out'

const REASON_META: Record<string, { emoji: string; label: string; tone: 'in' | 'out' | 'system' }> = {
  daily_checkin: { emoji: '💧', label: '每日签到浇水', tone: 'in' },
  meal_morning: { emoji: '🌅', label: '早餐时段', tone: 'in' },
  meal_noon: { emoji: '🍱', label: '午餐时段', tone: 'in' },
  meal_evening: { emoji: '🌙', label: '晚餐时段', tone: 'in' },
  group_buy: { emoji: '🛒', label: '团购下单', tone: 'in' },
  share_friend: { emoji: '📣', label: '分享好友', tone: 'in' },
  invite_friend: { emoji: '🤝', label: '邀请好友', tone: 'system' },
  help_friend: { emoji: '🙌', label: '助力好友', tone: 'system' },
  order_bonus: { emoji: '🎁', label: '下单返水滴', tone: 'in' },
  points_exchange: { emoji: '🔁', label: '积分兑换水滴', tone: 'in' },
  makeup: { emoji: '🎫', label: '补浇', tone: 'out' },
  admin_grant: { emoji: '🎁', label: '系统/活动', tone: 'system' },
}

export default function OrchardPointsPage() {
  const [profile, setProfile] = useState<OrchardProfile | null>(null)
  const [records, setRecords] = useState<OrchardRecord[]>([])
  const [filter, setFilter] = useState<FilterKey>('all')
  const [userId, setUserId] = useState('')

  const load = useCallback(async () => {
    if (!userId) return
    try {
      const [p, r] = await Promise.all([orchardApi.profile(userId), orchardApi.records(userId)])
      if (p.code === 200 && p.data) setProfile(p.data)
      if (r.code === 200 && Array.isArray(r.data)) setRecords(r.data)
    } catch (e) {
      console.error('[OrchardPoints] 加载失败:', e)
    }
  }, [userId])

  useDidShow(() => {
    if (!userId) {
      ensureLogin()
        .then((id) => setUserId(id))
        .catch((e) => {
          console.error('[OrchardPoints] 静默登录失败:', e)
          Taro.showToast({ title: '登录失败，请稍后重试', icon: 'none' })
        })
      return
    }
    load()
  })

  // 静默登录成功后自动加载
  useEffect(() => {
    if (userId) load()
  }, [userId, load])

  const rows = useMemo(() => {
    return records.map((r) => {
      const meta = REASON_META[r.reason] ?? { emoji: '✨', label: r.remark || '系统变动', tone: 'system' as const }
      const isPointsOnly = r.reason === 'admin_grant' || r.reason === 'invite_friend'
      return {
        id: r.id,
        createdAt: r.createdAt,
        title: meta.label,
        emoji: meta.emoji,
        droplets: r.amount > 0 && !isPointsOnly ? r.amount : undefined,
        points: isPointsOnly && (r.remark ?? '').includes('+') ? extractPoints(r.remark ?? '') : undefined,
        tone: meta.tone,
      }
    })
  }, [records])

  const filtered = rows.filter((r) => {
    if (filter === 'all') return true
    if (filter === 'in') return r.tone === 'in'
    return r.tone === 'out' || r.tone === 'system'
  })

  const fmtTime = (ts: number) => {
    const d = new Date(ts + 8 * 3600 * 1000)
    return `${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')} ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
  }

  return (
    <View className="min-h-screen pb-10" style={{ backgroundColor: '#F9FAFB' }}>
      {/* 头部 */}
      <View className="px-4 pt-12 pb-10" style={{ background: 'linear-gradient(180deg, #FFE5EC 0%, #FFF1F2 60%, rgba(249,250,251,0) 100%)' }}>
        <View onClick={() => Taro.navigateBack({ delta: 1 })}>
          <Text className="text-sm font-bold" style={{ color: '#78716c' }}>← 返回</Text>
        </View>
        <View className="mt-2" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Text className="block font-black" style={{ fontSize: 11, letterSpacing: 2, color: 'rgba(255,71,87,0.7)' }}>MY WALLET</Text>
          <View className="mt-2" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 24 }}>
            <View style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <Text className="font-black" style={{ fontSize: 36, color: '#FF4757' }}>
                {profile?.tree.growth ?? 0}<Text className="text-base">g</Text>
              </Text>
              <Text className="font-bold" style={{ fontSize: 11, color: 'rgba(4,120,87,0.8)' }}>当前水滴（已浇入果树）</Text>
            </View>
            <View style={{ width: 1, height: 40, backgroundColor: 'rgba(4,120,87,0.2)' }} />
            <View style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <Text className="font-black" style={{ fontSize: 36, color: '#d97706' }}>{profile?.points ?? 0}</Text>
              <Text className="font-bold" style={{ fontSize: 11, color: 'rgba(180,83,9,0.8)' }}>积分余额</Text>
            </View>
          </View>
        </View>
      </View>

      {/* 筛选 */}
      <View className="px-4" style={{ marginTop: -16 }}>
        <View className="bg-white rounded-2xl p-1" style={{ display: 'flex', flexDirection: 'row', boxShadow: '0 8px 24px -12px rgba(0,0,0,0.12)' }}>
          {([{ k: 'all', l: '全部' }, { k: 'in', l: '收入' }, { k: 'out', l: '支出/系统' }] as Array<{ k: FilterKey; l: string }>).map((t) => (
            <View
              key={t.k}
              className="flex-1 rounded-xl py-2"
              style={filter === t.k ? { background: 'linear-gradient(135deg,#fbbf24,#f97316)', display: 'flex', alignItems: 'center', justifyContent: 'center' } : { display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              onClick={() => setFilter(t.k)}
            >
              <Text className="text-xs font-black" style={{ color: filter === t.k ? '#fff' : '#78716c' }}>{t.l}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* 列表 */}
      <View className="px-4 mt-4">
        {filtered.length === 0 ? (
          <View className="bg-white rounded-2xl p-8" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', boxShadow: '0 8px 24px -12px rgba(0,0,0,0.12)' }}>
            <Text style={{ fontSize: 36 }}>🍃</Text>
            <Text className="block text-sm font-black mt-2" style={{ color: '#1c1917' }}>暂无记录</Text>
          </View>
        ) : (
          filtered.map((r) => (
            <View key={r.id} className="bg-white rounded-2xl p-3 mb-2" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', boxShadow: '0 8px 24px -12px rgba(0,0,0,0.12)' }}>
              <View className="rounded-xl w-10 h-10" style={{ backgroundColor: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Text className="text-xl">{r.emoji}</Text>
              </View>
              <View className="flex-1 ml-3">
                <Text className="block text-sm font-black" style={{ color: '#1c1917' }}>{r.title}</Text>
                <Text className="block mt-1" style={{ fontSize: 11, color: '#78716c' }}>{fmtTime(r.createdAt)}</Text>
              </View>
              <View style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                {r.droplets !== undefined && (
                  <Text className="text-sm font-black" style={{ color: r.droplets >= 0 ? '#FF4757' : '#78716c' }}>
                    {r.droplets >= 0 ? '+' : ''}{r.droplets}g
                  </Text>
                )}
                {r.points !== undefined && (
                  <Text className="text-xs font-black" style={{ color: '#d97706' }}>+{r.points} 积分</Text>
                )}
              </View>
            </View>
          ))
        )}
      </View>
    </View>
  )
}

function extractPoints(remark: string): number | undefined {
  const m = remark.match(/\+(\d+)\s*积分/)
  return m ? Number(m[1]) : undefined
}
