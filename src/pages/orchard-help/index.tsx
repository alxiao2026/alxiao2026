import { useCallback, useEffect, useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { orchardApi, type OrchardProfile } from '@/lib/orchard-api'
import { ensureLogin } from '@/lib/silent-login'

const STAGES = ['种子', '发芽', '幼苗', '小树', '大树', '成熟']

export default function OrchardHelpPage() {
  const [profile, setProfile] = useState<OrchardProfile | null>(null)
  const [userId, setUserId] = useState('')

  const load = useCallback(async () => {
    if (!userId) return
    try {
      const p = await orchardApi.profile(userId)
      if (p.code === 200 && p.data) setProfile(p.data)
    } catch (e) {
      console.error('[OrchardHelp] 加载失败:', e)
    }
  }, [userId])

  useDidShow(() => {
    if (!userId) {
      ensureLogin()
        .then((id) => setUserId(id))
        .catch((e) => {
          console.error('[OrchardHelp] 静默登录失败:', e)
        })
      return
    }
    load()
  })

  // 静默登录成功后自动加载
  useEffect(() => {
    if (userId) load()
  }, [userId, load])

  const cfg = profile?.config
  const full = cfg?.treeFullGrowth ?? 1500
  const ratios = [0, 0.08, 0.25, 0.5, 0.8, 1]
  const stageText = STAGES.map((name, i) => (ratios[i] > 0 ? `${name}(${Math.round(full * ratios[i])}g)` : name)).join('→')

  const rules = [
    `1. 每日签到浇水 +${cfg?.dailyWater ?? 20}g，水滴立即浇灌到当前果树；`,
    `2. 三餐时段（7-9 / 12-14 / 19-21 点）各可领 ${cfg?.mealWater ?? 10}g 水滴；`,
    '3. 完成任务（团购下单 / 分享好友）可继续获得水滴；',
    `4. 果树成长：${stageText}；`,
    '5. 成熟后收获果树入库，用库存果树兑换优惠券，兑换后重新种下一棵；',
    `6. 漏浇可补浇：补浇卡每周期限用 ${cfg?.cycleMakeupUseLimit ?? 3} 张，也可用 ${cfg?.makeupCostPoints ?? 100} 积分补浇。`,
    '7. 绑定手机号、添加企微客服可一次性领取积分奖励；',
    '8. 邀请好友助力成功，好友得水滴、你得补浇卡；',
    '9. 果园积分与膨胀团积分互通，获得的满减券下单付款时可直接抵扣。',
  ]

  return (
    <View className="min-h-screen pb-10" style={{ backgroundColor: '#F9FAFB' }}>
      <View className="px-4 pt-12 pb-8" style={{ background: 'linear-gradient(180deg, #FFE5EC 0%, #FFF1F2 60%, rgba(249,250,251,0) 100%)' }}>
        <View onClick={() => Taro.navigateBack({ delta: 1 })}>
          <Text className="text-sm font-bold" style={{ color: '#78716c' }}>← 返回</Text>
        </View>
        <View className="mt-2" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Text className="block font-black" style={{ fontSize: 11, letterSpacing: 2, color: 'rgba(255,71,87,0.7)' }}>HOW TO PLAY</Text>
          <Text className="block text-2xl font-black mt-1" style={{ color: '#1c1917' }}>📖 玩法规则</Text>
          <Text className="block text-xs mt-1" style={{ color: '#78716c' }}>怎么玩转小果园</Text>
        </View>
      </View>

      <View className="px-4" style={{ marginTop: -8 }}>
        <View className="bg-white rounded-3xl p-4" style={{ boxShadow: '0 8px 24px -12px rgba(0,0,0,0.12)' }}>
          {rules.map((r) => (
            <Text key={r} className="block mb-2" style={{ fontSize: 12, color: '#78716c', lineHeight: '20px' }}>{r}</Text>
          ))}
        </View>

        <View className="bg-white rounded-3xl p-4 mt-4" style={{ boxShadow: '0 8px 24px -12px rgba(0,0,0,0.12)' }}>
          <Text className="block text-sm font-black mb-2" style={{ color: '#1c1917' }}>🎟️ 优惠券档位</Text>
          {(cfg?.couponTiers ?? [{ threshold: 50, amount: 10, treeCost: 1 }, { threshold: 100, amount: 25, treeCost: 2 }, { threshold: 200, amount: 60, treeCost: 4 }]).map((t) => (
            <Text key={t.amount} className="block mb-1" style={{ fontSize: 12, color: '#78716c', lineHeight: '20px' }}>
              · 满{t.threshold}减{t.amount}元：消耗 {t.treeCost} 棵库存果树兑换
            </Text>
          ))}
          <Text className="block mt-2" style={{ fontSize: 11, color: '#a8a29e' }}>优惠券可在膨胀团团购下单付款时直接抵扣，每单限用一张。</Text>
        </View>
      </View>
    </View>
  )
}
