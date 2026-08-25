import { useCallback, useEffect, useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import OrchardTabBar from '@/components/orchard/orchard-tabbar'
import {
  orchardApi,
  type OrchardCoupon, type OrchardCouponDef, type OrchardProfile,
} from '@/lib/orchard-api'
import { ensureLogin } from '@/lib/silent-login'

type FilterKey = 'all' | 'unused' | 'used' | 'expired'
const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'unused', label: '未使用' },
  { key: 'used', label: '已使用' },
  { key: 'expired', label: '已过期' },
]

export default function OrchardCouponsPage() {
  const [profile, setProfile] = useState<OrchardProfile | null>(null)
  const [defs, setDefs] = useState<OrchardCouponDef[]>([])
  const [list, setList] = useState<OrchardCoupon[]>([])
  const [filter, setFilter] = useState<FilterKey>('unused')
  const [exchangingId, setExchangingId] = useState<string | null>(null)

  const [userId, setUserId] = useState('')

  const load = useCallback(async () => {
    if (!userId) return
    try {
      const [p, d, c] = await Promise.all([
        orchardApi.profile(userId),
        orchardApi.couponDefs(),
        orchardApi.myCoupons(userId, 'all'),
      ])
      if (p.code === 200 && p.data) setProfile(p.data)
      if (d.code === 200 && Array.isArray(d.data)) setDefs(d.data)
      if (c.code === 200 && Array.isArray(c.data)) setList(c.data)
    } catch (e) {
      console.error('[OrchardCoupons] 加载失败:', e)
    }
  }, [userId])

  useDidShow(() => {
    if (!userId) {
      ensureLogin()
        .then((id) => setUserId(id))
        .catch((e) => {
          console.error('[OrchardCoupons] 静默登录失败:', e)
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

  const tree = profile?.tree
  const stock = tree?.availableTrees ?? 0
  const growth = tree?.growth ?? 0
  const fullGrowth = profile?.config.treeFullGrowth ?? 1500
  const growthPct = Math.min(100, (growth / fullGrowth) * 100)
  const isMature = tree?.isMature ?? false
  const currentTreeIndex = (tree?.harvested ?? 0) + 1

  const filtered = list.filter((c) => filter === 'all' || c.status === filter)
  const unusedCount = list.filter((c) => c.status === 'unused').length

  const handleExchange = async (defId: string) => {
    if (!userId || exchangingId) return
    setExchangingId(defId)
    try {
      const res = await orchardApi.claimCoupon(userId, defId)
      if (res.biz_code === 0 && res.data) {
        Taro.showToast({ title: `兑换成功！券码 ${res.data.code}`, icon: 'none' })
        load()
      } else {
        Taro.showToast({ title: res.msg || '兑换失败', icon: 'none' })
      }
    } catch (e) {
      Taro.showToast({ title: '网络异常，请重试', icon: 'none' })
    } finally {
      setExchangingId(null)
    }
  }

  /** 去使用：跳转膨胀团团购首页，下单付款时可直接抵扣 */
  const handleUse = () => {
    Taro.showToast({ title: '去挑选团购，付款时用券抵扣', icon: 'none' })
    setTimeout(() => {
      Taro.switchTab({ url: '/pages/index/index' })
    }, 600)
  }

  const goOrchard = () => Taro.switchTab({ url: '/pages/tuantuan/index' })

  return (
    <View className="min-h-screen pb-32" style={{ backgroundColor: '#F9FAFB' }}>
      {/* 头部 */}
      <View className="px-4 pt-12 pb-8" style={{ background: 'linear-gradient(180deg, #FFE5EC 0%, #FFF1F2 50%, rgba(249,250,251,0) 100%)' }}>
        <View style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <Text className="block text-xs font-black" style={{ color: 'rgba(255,71,87,0.8)', letterSpacing: 2 }}>COUPON WALL</Text>
            <Text className="block text-2xl font-black mt-1" style={{ color: '#1c1917' }}>优惠券</Text>
          </View>
          <View className="rounded-full px-3 py-1" style={{ backgroundColor: 'rgba(255,255,255,0.85)' }}>
            <Text className="text-xs font-black" style={{ color: '#047857' }}>🌳 库存 {stock} 棵</Text>
          </View>
        </View>

        {isMature && (
          <View className="mt-3 rounded-2xl p-3" style={{ background: 'linear-gradient(90deg,#f472b6,#fb923c,#fbbf24)' }} onClick={goOrchard}>
            <Text className="block text-xs font-black" style={{ color: 'rgba(255,255,255,0.9)', fontSize: 10 }}>TREE MATURED</Text>
            <Text className="block text-sm font-black text-white mt-1">🎁 果树已成熟，回果园收获兑换优惠券 →</Text>
          </View>
        )}
      </View>

      {/* 果树收获兑券 */}
      <View className="px-4" style={{ marginTop: -8 }}>
        <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
          <View className="bg-white rounded-lg w-7 h-7 items-center justify-center" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Text className="text-base">🌳</Text>
          </View>
          <Text className="text-lg font-black ml-2" style={{ color: '#1c1917' }}>果树收获兑券</Text>
          <Text className="text-xs font-bold ml-auto" style={{ color: '#78716c' }}>每棵树只能兑换一次</Text>
        </View>

        {/* 当前果树进度卡 */}
        <View className="bg-white rounded-3xl p-4 mb-3" style={{ boxShadow: '0 8px 24px -12px rgba(0,0,0,0.12)' }} onClick={goOrchard}>
          <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ fontSize: 28 }}>{isMature ? '🌟' : '🌱'}</Text>
            <View className="flex-1 ml-3">
              <Text className="block text-sm font-black" style={{ color: '#1c1917' }}>
                {isMature ? '果树成熟啦，快回去收获！' : `正在种第 ${currentTreeIndex} 棵果树`}
              </Text>
              <Text className="block text-xs mt-1" style={{ color: '#78716c' }}>
                {isMature ? '收下果实入库就能换优惠券' : `再浇 ${fullGrowth - growth}g 就能收获入库`}
              </Text>
            </View>
            <View className="rounded-full px-3 py-1" style={{ background: 'linear-gradient(135deg,#FF4757,#F43F5E)' }}>
              <Text className="text-xs font-black text-white">{isMature ? '去收获' : '去浇水'}</Text>
            </View>
          </View>
          <View className="rounded-full mt-3" style={{ height: 10, backgroundColor: '#f5f5f4', overflow: 'hidden' }}>
            <View style={{ height: 10, borderRadius: 5, width: `${growthPct}%`, background: 'linear-gradient(90deg,#FF4757,#FFA502,#FBBF24)' }} />
          </View>
          <View style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
            <Text className="text-xs font-bold" style={{ color: '#059669' }}>🌳 果树库存 {stock} 棵</Text>
            <Text className="text-xs font-bold" style={{ color: '#78716c' }}>{growth}/{fullGrowth}g</Text>
          </View>
        </View>

        {/* 三档收获券 */}
        {defs.map((def) => {
          const unlocked = stock >= def.treeCost
          return (
            <View key={def.id} className="bg-white rounded-2xl p-3 mb-3 relative overflow-hidden" style={{ boxShadow: '0 8px 24px -12px rgba(0,0,0,0.12)', opacity: unlocked ? 1 : 0.8 }}>
              <View style={{ display: 'flex', flexDirection: 'row' }}>
                <View
                  className="rounded-xl items-center justify-center py-3"
                  style={{
                    width: 100, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    background: !unlocked ? 'linear-gradient(135deg,#cbd5e1,#94a3b8)' : 'linear-gradient(135deg,#fb7185,#f97316)',
                  }}
                >
                  <Text className="text-xs font-black" style={{ color: 'rgba(255,255,255,0.9)', fontSize: 10 }}>满减券</Text>
                  <Text className="text-3xl font-black text-white mt-1"><Text className="text-base">¥</Text>{def.amount}</Text>
                  <Text className="text-xs font-bold mt-1" style={{ color: 'rgba(255,255,255,0.9)', fontSize: 10 }}>满{def.threshold}可用</Text>
                </View>
                <View className="flex-1 ml-3" style={{ display: 'flex', flexDirection: 'column' }}>
                  <Text className="block text-sm font-black" style={{ color: '#1c1917' }}>{def.title}</Text>
                  <Text className="block text-xs mt-1" style={{ color: '#78716c' }}>{def.desc}</Text>
                  <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', marginTop: 'auto', paddingTop: 8 }}>
                    {unlocked ? (
                      <>
                        <Text className="text-xs font-black" style={{ color: '#059669' }}>消耗 {def.treeCost} 棵</Text>
                        <View
                          className="rounded-full px-4 py-1 ml-auto"
                          style={{ background: 'linear-gradient(135deg,#fbbf24,#f97316)', opacity: exchangingId === def.id ? 0.6 : 1 }}
                          onClick={() => handleExchange(def.id)}
                        >
                          <Text className="text-xs font-black text-white">{exchangingId === def.id ? '兑换中…' : '立即兑换'}</Text>
                        </View>
                      </>
                    ) : (
                      <>
                        <Text className="text-xs font-black" style={{ color: '#78716c' }}>🔒 需 {def.treeCost} 棵一起兑</Text>
                        <View className="rounded-full px-3 py-1 ml-auto" style={{ backgroundColor: '#ecfdf5' }} onClick={goOrchard}>
                          <Text className="text-xs font-black" style={{ color: '#059669', fontSize: 10 }}>还差 {def.treeCost - stock} 棵 · 去种树</Text>
                        </View>
                      </>
                    )}
                  </View>
                </View>
              </View>
            </View>
          )
        })}
      </View>

      {/* 我的券 */}
      <View className="px-4 mt-6">
        <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
          <View className="bg-white rounded-lg w-7 h-7 items-center justify-center" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Text className="text-base">🎟️</Text>
          </View>
          <Text className="text-lg font-black ml-2" style={{ color: '#1c1917' }}>我的券</Text>
          <Text className="text-xs font-bold ml-auto" style={{ color: '#78716c' }}>未使用 {unusedCount} 张</Text>
        </View>

        <View style={{ display: 'flex', flexDirection: 'row', gap: 8, marginBottom: 12 }}>
          {FILTERS.map((f) => (
            <View
              key={f.key}
              className="rounded-full px-3 py-1"
              style={filter === f.key ? { background: 'linear-gradient(135deg,#fbbf24,#f97316)' } : { backgroundColor: '#fff' }}
              onClick={() => setFilter(f.key)}
            >
              <Text className="text-xs font-black" style={{ color: filter === f.key ? '#fff' : '#78716c' }}>{f.label}</Text>
            </View>
          ))}
        </View>

        {filtered.length === 0 ? (
          <View className="bg-white rounded-2xl p-8 items-center" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', boxShadow: '0 8px 24px -12px rgba(0,0,0,0.12)' }}>
            <Text style={{ fontSize: 36 }}>🎫</Text>
            <Text className="block text-sm font-black mt-2" style={{ color: '#1c1917' }}>暂无优惠券</Text>
            <Text className="block text-xs mt-1" style={{ color: '#78716c' }}>把果树种成熟，就能收获优惠券啦</Text>
            <View className="rounded-full px-5 py-2 mt-4" style={{ background: 'linear-gradient(135deg,#FF4757,#F43F5E)' }} onClick={goOrchard}>
              <Text className="text-xs font-black text-white">回果园浇水 🌱</Text>
            </View>
          </View>
        ) : (
          filtered.map((c) => <CouponCard key={c.code} coupon={c} onUse={handleUse} />)
        )}
      </View>

      <OrchardTabBar active="coupons" />
    </View>
  )
}

function CouponCard({ coupon, onUse }: { coupon: OrchardCoupon; onUse: () => void }) {
  const isUsed = coupon.status === 'used'
  const isExpired = coupon.status === 'expired'
  const isLocked = coupon.status === 'locked'
  const disabled = isUsed || isExpired
  return (
    <View className="bg-white rounded-2xl p-3 mb-3 relative overflow-hidden" style={{ boxShadow: '0 8px 24px -12px rgba(0,0,0,0.12)', opacity: disabled ? 0.7 : 1 }}>
      <View style={{ display: 'flex', flexDirection: 'row' }}>
        <View
          className="rounded-xl items-center justify-center py-3 relative"
          style={{
            width: 100, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            background: disabled ? 'linear-gradient(135deg,#cbd5e1,#94a3b8)' : 'linear-gradient(135deg,#fb7185,#f97316)',
          }}
        >
          <Text className="text-xs font-black" style={{ color: 'rgba(255,255,255,0.9)', fontSize: 10 }}>满减券</Text>
          <Text className="text-3xl font-black text-white mt-1"><Text className="text-base">¥</Text>{coupon.amount}</Text>
          <Text className="text-xs font-bold mt-1" style={{ color: 'rgba(255,255,255,0.9)', fontSize: 10 }}>满{coupon.threshold}可用</Text>
          {(disabled || isLocked) && (
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Text className="text-xs font-black text-white" style={{ transform: 'rotate(-20deg)', border: '2px solid rgba(255,255,255,0.8)', borderRadius: 4, paddingLeft: 8, paddingRight: 8 }}>
                {isUsed ? '已使用' : isExpired ? '已过期' : '锁定中'}
              </Text>
            </View>
          )}
        </View>
        <View className="flex-1 ml-3" style={{ display: 'flex', flexDirection: 'column' }}>
          <Text className="block text-sm font-black" style={{ color: '#1c1917' }}>{coupon.title}</Text>
          <Text className="block text-xs mt-1" style={{ color: '#a8a29e', fontSize: 10 }}>券码 {coupon.code}</Text>
          {coupon.fromTree ? <Text className="block text-xs mt-1" style={{ color: '#059669', fontSize: 10 }}>🌳 第 {coupon.fromTree} 棵树收获</Text> : null}
          <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', marginTop: 'auto', paddingTop: 8 }}>
            <Text className="text-xs" style={{ color: '#a8a29e', fontSize: 10 }}>
              有效期至 {coupon.expireAt ? new Date(coupon.expireAt).toLocaleDateString() : '长期'}
            </Text>
            {!disabled && !isLocked && (
              <View className="rounded-full px-4 py-1 ml-auto" style={{ background: 'linear-gradient(135deg,#FF4757,#F43F5E)' }} onClick={onUse}>
                <Text className="text-xs font-black text-white">去使用</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </View>
  )
}
