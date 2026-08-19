import { useCallback, useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { Input } from '@/components/ui/input'
import { orchardApi, currentUserId, type OrchardConfig } from '@/lib/orchard-api'

type NumKey = Exclude<keyof OrchardConfig, 'couponTiers' | 'wecomQrCode'>

interface FieldDef { key: NumKey; label: string; desc?: string; unit?: string }
interface SectionDef { emoji: string; title: string; note?: string; tile: string; fields: FieldDef[] }

const SECTIONS: SectionDef[] = [
  {
    emoji: '💧', title: '浇水设置', tile: 'linear-gradient(135deg,#e0f2fe,#a5f3fc)',
    fields: [
      { key: 'dailyWater', label: '每日签到浇水', unit: 'g/天' },
      { key: 'mealWater', label: '三餐每餐领取', unit: 'g/餐' },
      { key: 'treeFullGrowth', label: '果树成熟总水滴', unit: 'g', desc: '6 个成长阶段阈值会按此总值等比换算' },
    ],
  },
  {
    emoji: '🎫', title: '补浇设置', note: '补浇卡获取不限量，仅限制每个种树周期的使用张数', tile: 'linear-gradient(135deg,#FFF1F2,#FFE5EC)',
    fields: [
      { key: 'cycleMakeupUseLimit', label: '补浇卡每周期限用', unit: '张' },
      { key: 'makeupCostPoints', label: '积分补浇消耗', unit: '积分/次' },
    ],
  },
  {
    emoji: '🔁', title: '积分兑换水滴', tile: 'linear-gradient(135deg,#fef3c7,#fed7aa)',
    fields: [
      { key: 'pointsExchangeRate', label: '兑换比例（1 积分 = N g）', unit: 'g' },
      { key: 'pointsExchangeMin', label: '最低起兑积分', unit: '积分' },
    ],
  },
  {
    emoji: '✅', title: '日常任务奖励', tile: 'linear-gradient(135deg,#FFF1F2,#FFE5EC)',
    fields: [
      { key: 'taskGroupBuyReward', label: '团购下单奖励', unit: 'g/单' },
      { key: 'taskGroupBuyLimit', label: '团购下单每日上限', unit: '单' },
      { key: 'taskShareReward', label: '分享好友奖励', unit: 'g/次' },
      { key: 'taskShareLimit', label: '分享好友每日上限', unit: '次' },
      { key: 'taskInviteLimit', label: '邀请好友每日上限', unit: '次' },
    ],
  },
  {
    emoji: '🌱', title: '成长任务奖励（一次性）', tile: 'linear-gradient(135deg,#a7f3d0,#5eead4)',
    fields: [
      { key: 'growthBindPhonePoints', label: '绑定手机号奖励', unit: '积分' },
      { key: 'growthAddWecomPoints', label: '添加企微客服奖励', unit: '积分' },
    ],
  },
]

export default function OrchardAdminPage() {
  const [, setConfig] = useState<OrchardConfig | null>(null)
  const [draft, setDraft] = useState<Record<NumKey, string> | null>(null)
  const [tiers, setTiers] = useState<Array<{ threshold: string; amount: string; treeCost: string }>>([])
  const [denied, setDenied] = useState(false)
  const [saving, setSaving] = useState(false)
  const adminId = currentUserId()

  const toDraft = (c: OrchardConfig): Record<NumKey, string> => ({
    dailyWater: String(c.dailyWater),
    mealWater: String(c.mealWater),
    makeupCostPoints: String(c.makeupCostPoints),
    cycleMakeupUseLimit: String(c.cycleMakeupUseLimit),
    pointsExchangeRate: String(c.pointsExchangeRate),
    pointsExchangeMin: String(c.pointsExchangeMin),
    treeFullGrowth: String(c.treeFullGrowth),
    taskGroupBuyReward: String(c.taskGroupBuyReward),
    taskGroupBuyLimit: String(c.taskGroupBuyLimit),
    taskShareReward: String(c.taskShareReward),
    taskShareLimit: String(c.taskShareLimit),
    taskInviteLimit: String(c.taskInviteLimit),
    growthBindPhonePoints: String(c.growthBindPhonePoints),
    growthAddWecomPoints: String(c.growthAddWecomPoints),
  })

  const load = useCallback(async () => {
    if (!adminId) return
    try {
      const res = await orchardApi.adminGetConfig(adminId)
      if (res.code === 200 && res.data) {
        setConfig(res.data)
        setDraft(toDraft(res.data))
        setTiers((res.data.couponTiers ?? []).map((t) => ({ threshold: String(t.threshold), amount: String(t.amount), treeCost: String(t.treeCost) })))
        setDenied(false)
      } else if (res.code === 403 || res.biz_code === 40300) {
        setDenied(true)
      } else {
        Taro.showToast({ title: res.msg || '加载失败', icon: 'none' })
      }
    } catch (e) {
      Taro.showToast({ title: '网络异常', icon: 'none' })
    }
  }, [adminId])

  useDidShow(() => {
    if (!adminId) {
      Taro.showToast({ title: '请先登录', icon: 'none' })
      return
    }
    load()
  })

  const handleSave = async () => {
    if (!draft || saving || !adminId) return
    const patch: Partial<OrchardConfig> = {}
    for (const k of Object.keys(draft) as NumKey[]) {
      const n = Number(draft[k])
      if (!Number.isFinite(n) || n < 0) {
        Taro.showToast({ title: '存在非法数值，请检查', icon: 'none' })
        return
      }
      ;(patch as Record<string, number>)[k] = n
    }
    const parsedTiers = tiers.map((t) => ({ threshold: Number(t.threshold), amount: Number(t.amount), treeCost: Number(t.treeCost) }))
    if (parsedTiers.some((t) => !Number.isFinite(t.threshold) || !Number.isFinite(t.amount) || !Number.isFinite(t.treeCost))) {
      Taro.showToast({ title: '券档位数值非法', icon: 'none' })
      return
    }
    patch.couponTiers = parsedTiers

    setSaving(true)
    try {
      const res = await orchardApi.adminUpdateConfig(adminId, patch)
      if (res.code === 200 && res.data) {
        setConfig(res.data)
        setDraft(toDraft(res.data))
        Taro.showToast({ title: '已保存，全局生效 ✅', icon: 'none' })
      } else {
        Taro.showToast({ title: res.msg || '保存失败', icon: 'none' })
      }
    } catch (e) {
      Taro.showToast({ title: '网络异常', icon: 'none' })
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    Taro.showModal({
      title: '恢复默认配置？',
      content: '所有运营数值将恢复为系统默认值，立即全局生效。',
      confirmText: '恢复默认',
      confirmColor: '#ef4444',
      success: async (r) => {
        if (!r.confirm || !adminId) return
        const res = await orchardApi.adminResetConfig(adminId)
        if (res.code === 200 && res.data) {
          setConfig(res.data)
          setDraft(toDraft(res.data))
          setTiers((res.data.couponTiers ?? []).map((t) => ({ threshold: String(t.threshold), amount: String(t.amount), treeCost: String(t.treeCost) })))
          Taro.showToast({ title: '已恢复默认', icon: 'none' })
        } else {
          Taro.showToast({ title: res.msg || '重置失败', icon: 'none' })
        }
      },
    })
  }

  if (denied) {
    return (
      <View className="min-h-screen" style={{ backgroundColor: '#FFF8EE', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 120 }}>
        <Text style={{ fontSize: 48 }}>🔒</Text>
        <Text className="block text-lg font-black mt-4" style={{ color: '#1c1917' }}>无权限访问</Text>
        <Text className="block text-xs mt-2" style={{ color: '#78716c' }}>果园设置后台仅系统管理员可用</Text>
        <View className="rounded-full px-6 py-2 mt-6" style={{ background: 'linear-gradient(135deg,#fbbf24,#f97316)' }} onClick={() => Taro.navigateBack({ delta: 1 })}>
          <Text className="text-sm font-black text-white">返回</Text>
        </View>
      </View>
    )
  }

  return (
    <View className="min-h-screen pb-24" style={{ backgroundColor: '#F9FAFB' }}>
      <View className="px-4 pt-12 pb-8" style={{ background: 'linear-gradient(180deg, #FFE5EC 0%, #FFF1F2 60%, rgba(249,250,251,0) 100%)' }}>
        <View onClick={() => Taro.navigateBack({ delta: 1 })}>
          <Text className="text-sm font-bold" style={{ color: '#78716c' }}>← 返回</Text>
        </View>
        <View className="mt-2" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Text className="block font-black" style={{ fontSize: 11, letterSpacing: 2, color: 'rgba(255,71,87,0.7)' }}>ORCHARD ADMIN</Text>
          <Text className="block text-2xl font-black mt-1" style={{ color: '#1c1917' }}>🛠️ 果园设置后台</Text>
          <Text className="block text-xs mt-1" style={{ color: '#78716c' }}>运营数值配置，保存后全局生效</Text>
        </View>
      </View>

      {draft && (
        <View className="px-4" style={{ marginTop: -8 }}>
          {SECTIONS.map((sec) => (
            <View key={sec.title} className="bg-white rounded-2xl p-4 mb-3" style={{ boxShadow: '0 8px 24px -12px rgba(0,0,0,0.12)' }}>
              <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <View className="rounded-xl w-7 h-7" style={{ background: sec.tile, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Text className="text-sm">{sec.emoji}</Text>
                </View>
                <Text className="font-black ml-2" style={{ fontSize: 15, color: '#1c1917' }}>{sec.title}</Text>
              </View>
              {sec.note ? <Text className="block mb-2" style={{ fontSize: 10, color: '#a8a29e' }}>{sec.note}</Text> : null}
              {sec.fields.map((f) => (
                <View key={f.key} style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', paddingTop: 8, paddingBottom: 8, borderTop: '1px solid #fafaf9' }}>
                  <View className="flex-1">
                    <Text className="block text-xs font-bold" style={{ color: '#1c1917' }}>{f.label}</Text>
                    {f.desc ? <Text className="block mt-1" style={{ fontSize: 10, color: '#a8a29e' }}>{f.desc}</Text> : null}
                  </View>
                  <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
                    <Input
                      className="h-8 rounded-xl border-0 px-2"
                      style={{ backgroundColor: '#fafaf9', width: 72, fontSize: 14, fontWeight: 900, color: '#1c1917', textAlign: 'right' }}
                      type="number"
                      value={draft[f.key]}
                      onInput={(e) => setDraft({ ...draft, [f.key]: e.detail.value })}
                    />
                    {f.unit ? <Text className="ml-1" style={{ fontSize: 10, color: '#a8a29e', width: 40 }}>{f.unit}</Text> : null}
                  </View>
                </View>
              ))}
            </View>
          ))}

          {/* 券档位 */}
          <View className="bg-white rounded-2xl p-4 mb-3" style={{ boxShadow: '0 8px 24px -12px rgba(0,0,0,0.12)' }}>
            <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <View className="rounded-xl w-7 h-7" style={{ background: 'linear-gradient(135deg,#ffe4e6,#fde68a)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Text className="text-sm">🎟️</Text>
              </View>
              <Text className="font-black ml-2" style={{ fontSize: 15, color: '#1c1917' }}>优惠券档位</Text>
              <Text className="ml-auto" style={{ fontSize: 10, color: '#a8a29e' }}>满X减Y · 消耗N棵</Text>
            </View>
            {tiers.map((t, i) => (
              <View key={i} style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 8, paddingBottom: 8, borderTop: '1px solid #fafaf9' }}>
                {(['threshold', 'amount', 'treeCost'] as const).map((k) => (
                  <View key={k} className="flex-1">
                    <Text className="block" style={{ fontSize: 10, color: '#a8a29e' }}>{k === 'threshold' ? '满(元)' : k === 'amount' ? '减(元)' : '棵数'}</Text>
                    <Input
                      className="h-8 rounded-xl border-0 px-2 mt-1"
                      style={{ backgroundColor: '#fafaf9', fontSize: 14, fontWeight: 900, color: '#1c1917', textAlign: 'center' }}
                      type="number"
                      value={t[k]}
                      onInput={(e) => {
                        const next = [...tiers]
                        next[i] = { ...next[i], [k]: e.detail.value }
                        setTiers(next)
                      }}
                    />
                  </View>
                ))}
              </View>
            ))}
            <Text className="block mt-2" style={{ fontSize: 10, color: '#a8a29e' }}>企微客服二维码在膨胀团后台「客服设置」中统一维护。</Text>
          </View>

          {/* 操作按钮 */}
          <View style={{ display: 'flex', flexDirection: 'row', gap: 12, marginTop: 8 }}>
            <View className="flex-1 rounded-full py-3" style={{ backgroundColor: '#f5f5f4', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={handleReset}>
              <Text className="text-sm font-black" style={{ color: '#ef4444' }}>恢复默认</Text>
            </View>
            <View
              className="flex-1 rounded-full py-3"
              style={{ background: 'linear-gradient(135deg,#fbbf24,#f97316)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: saving ? 0.6 : 1, boxShadow: '0 8px 20px -8px rgba(249,115,22,0.5)' }}
              onClick={handleSave}
            >
              <Text className="text-sm font-black text-white">{saving ? '保存中…' : '保存全部配置'}</Text>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}
