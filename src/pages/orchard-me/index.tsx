import { useCallback, useState } from 'react'
import { View, Text, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import OrchardTabBar from '@/components/orchard/orchard-tabbar'
import ShareSheet from '@/components/orchard/share-sheet'
import { CustomerServiceModal } from '@/components/customer-service-modal'
import { orchardApi, currentUserId, type OrchardProfile, type OrchardCoupon, type OrchardShareInfo } from '@/lib/orchard-api'

interface MenuItem {
  icon: string
  label: string
  desc?: string
  badge?: string
  tile: string
  onClick: () => void
}

export default function OrchardMePage() {
  const [profile, setProfile] = useState<OrchardProfile | null>(null)
  const [coupons, setCoupons] = useState<OrchardCoupon[]>([])
  const [shareInfo, setShareInfo] = useState<OrchardShareInfo | null>(null)
  const [shareOpen, setShareOpen] = useState(false)
  const [wecomOpen, setWecomOpen] = useState(false)
  const userId = currentUserId()

  const load = useCallback(async () => {
    if (!userId) return
    try {
      const [p, c, s] = await Promise.all([
        orchardApi.profile(userId),
        orchardApi.myCoupons(userId, 'all'),
        orchardApi.shareInfo(userId),
      ])
      if (p.code === 200 && p.data) setProfile(p.data)
      if (c.code === 200 && Array.isArray(c.data)) setCoupons(c.data)
      if (s.code === 200 && s.data) setShareInfo(s.data)
    } catch (e) {
      console.error('[OrchardMe] 加载失败:', e)
    }
  }, [userId])

  useDidShow(() => {
    if (!userId) {
      Taro.showToast({ title: '请先登录', icon: 'none' })
      return
    }
    load()
  })

  const tree = profile?.tree
  const unusedCoupons = coupons.filter((c) => c.status === 'unused').length
  const level = Math.min((tree?.harvested ?? 0) + 1, 99)

  /* ---------- 最近 7 天浇水记录 ---------- */
  const week = (() => {
    const names = ['日', '一', '二', '三', '四', '五', '六']
    const wateredDates = profile?.wateredDates ?? []
    const arr: Array<{ label: string; watered: boolean; isToday: boolean }> = []
    const today = new Date(Date.now() + 8 * 3600 * 1000)
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today.getTime() - i * 24 * 3600 * 1000)
      const ds = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
      arr.push({
        label: i === 0 ? '今' : names[d.getUTCDay()],
        watered: wateredDates.includes(ds),
        isToday: i === 0,
      })
    }
    return arr
  })()
  const weekCount = week.filter((d) => d.watered).length

  const nav = (url: string) => Taro.navigateTo({ url })
  const toast = (t: string) => Taro.showToast({ title: t, icon: 'none' })

  const latestHarvest = () => {
    const history = tree?.history ?? []
    if (history.length === 0) {
      toast('还没有种植记录，先把第一棵树种成熟吧 🌱')
      return
    }
    const latest = history[history.length - 1]
    const d = new Date(latest.harvestedAt + 8 * 3600 * 1000)
    toast(`最近收获：第 ${latest.index} 棵 · ${d.getUTCMonth() + 1}月${d.getUTCDate()}日入库`)
  }

  const records: MenuItem[] = [
    { icon: '📊', label: '水滴/积分明细', desc: '看看每一滴水都去哪啦', tile: 'linear-gradient(135deg,#a7f3d0,#5eead4)', onClick: () => nav('/pages/orchard-points/index') },
    { icon: '🎟️', label: '我的优惠券', desc: `共 ${coupons.length} 张 · 未使用 ${unusedCoupons} 张`, tile: 'linear-gradient(135deg,#fecdd3,#fdba74)', onClick: () => Taro.redirectTo({ url: '/pages/orchard-coupons/index' }) },
    { icon: '🌳', label: '种植记录', desc: `已收获 ${tree?.harvested ?? 0} 棵果树`, tile: 'linear-gradient(135deg,#FFF1F2,#FFE5EC)', onClick: latestHarvest },
    { icon: '🔁', label: '积分兑换水滴', desc: '1 积分 = 1 水滴，立即浇灌', tile: 'linear-gradient(135deg,#FFE5EC,#fecdd3)', onClick: () => nav('/pages/orchard-exchange/index') },
  ]

  const tools: MenuItem[] = [
    { icon: '🤝', label: '邀请好友助力', desc: '好友点开分享卡片助力，你得补浇卡', tile: 'linear-gradient(135deg,#fde68a,#fdba74)', badge: '+1 补浇卡', onClick: () => setShareOpen(true) },
    { icon: '📖', label: '玩法规则', desc: '怎么玩转小果园', tile: 'linear-gradient(135deg,#FFF1F2,#FFE5EC)', onClick: () => nav('/pages/orchard-help/index') },
    { icon: '📞', label: '联系客服', desc: '企微客服一对一服务', tile: 'linear-gradient(135deg,#e7e5e4,#d6d3d1)', onClick: () => setWecomOpen(true) },
    ...(profile?.isAdmin
      ? [{ icon: '🛠️', label: '设置后台', desc: '运营数值配置，保存全局生效', tile: 'linear-gradient(135deg,#fdba74,#fde68a)', onClick: () => nav('/pages/orchard-admin/index') }]
      : []),
  ]

  const assets = [
    { emoji: '🪙', label: '积分', value: String(profile?.points ?? 0), bg: 'linear-gradient(135deg,#fef3c7,#fed7aa)', onClick: () => nav('/pages/orchard-points/index') },
    { emoji: '🎫', label: '补浇卡', value: String(tree?.makeupCards ?? 0), bg: 'linear-gradient(135deg,#e0f2fe,#a5f3fc)', onClick: () => toast('邀请好友助力可获得补浇卡哦 🤝') },
    { emoji: '🎟️', label: '优惠券', value: String(unusedCoupons), bg: 'linear-gradient(135deg,#ffe4e6,#fde68a)', onClick: () => Taro.redirectTo({ url: '/pages/orchard-coupons/index' }) },
  ]

  return (
    <View className="min-h-screen pb-32" style={{ backgroundColor: '#F9FAFB' }}>
      {/* ============ 顶部卡通 header ============ */}
      <View className="relative overflow-hidden px-4 pt-12 pb-20" style={{ background: 'linear-gradient(160deg, #FF4757 0%, #F43F5E 48%, #FFA502 100%)' }}>
        <View className="absolute rounded-full" style={{ top: -40, right: -40, width: 176, height: 176, backgroundColor: 'rgba(255,255,255,0.15)' }} />
        <Text className="absolute text-white" style={{ right: 32, top: 48, fontSize: 18 }}>✨</Text>

        <View className="relative" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
          {/* 头像（区域1：同步抽奖小程序客户头像）+ 等级贴纸 */}
          <View className="relative" style={{ flexShrink: 0 }}>
            <View className="rounded-full bg-white items-center justify-center overflow-hidden" style={{ width: 80, height: 80, border: '4px solid rgba(255,255,255,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 20px rgba(180,83,9,0.35)' }}>
              {profile?.avatarUrl ? (
                <Image src={profile.avatarUrl} style={{ width: 76, height: 76, borderRadius: 38 }} mode="aspectFill" />
              ) : (
                <Text style={{ fontSize: 36 }}>🍑</Text>
              )}
            </View>
            <View className="absolute rounded-full px-2" style={{ bottom: -4, right: -8, background: 'linear-gradient(90deg,#fbbf24,#f97316)', paddingTop: 2, paddingBottom: 2, transform: 'rotate(6deg)', boxShadow: '0 2px 6px rgba(0,0,0,0.2)' }}>
              <Text className="font-black text-white" style={{ fontSize: 10 }}>Lv.{level}</Text>
            </View>
          </View>
          <View className="ml-3 flex-1">
            <Text className="block font-black" style={{ fontSize: 11, letterSpacing: 2, color: 'rgba(255,255,255,0.8)' }}>MY GARDEN</Text>
            {/* 昵称（区域2：同步抽奖小程序客户名称） */}
            <Text className="block text-2xl font-black text-white mt-1" style={{ textShadow: '0 2px 4px rgba(180,83,9,0.4)' }}>
              {profile?.nickname || '果园小农夫'} 👋
            </Text>
            <Text className="block mt-1" style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)' }}>今天也要元气满满地浇水鸭～</Text>
          </View>
        </View>

        {/* 战绩玻璃胶囊 */}
        <View className="relative mt-4" style={{ display: 'flex', flexDirection: 'row', gap: 8 }}>
          {[
            { emoji: '🔥', text: `连浇 ${tree?.currentStreak ?? 0} 天` },
            { emoji: '🏆', text: `最高 ${tree?.maxStreak ?? 0} 天` },
            { emoji: '🌳', text: `收获 ${tree?.harvested ?? 0} 棵` },
          ].map((c) => (
            <View key={c.emoji} className="rounded-full px-3 py-1" style={{ backgroundColor: 'rgba(255,255,255,0.25)' }}>
              <Text className="font-black text-white" style={{ fontSize: 11 }}>{c.emoji} {c.text}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* ============ 本周浇水记录 ============ */}
      <View className="px-4 relative" style={{ marginTop: -48, zIndex: 10 }}>
        <View className="bg-white rounded-3xl p-4" style={{ boxShadow: '0 8px 24px -12px rgba(0,0,0,0.12)' }}>
          <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
              <View className="rounded-xl w-7 h-7" style={{ background: 'linear-gradient(135deg,#e0f2fe,#a5f3fc)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Text className="text-sm">📅</Text>
              </View>
              <Text className="font-black ml-2" style={{ fontSize: 15, color: '#1c1917' }}>本周浇水记录</Text>
            </View>
            <View className="rounded-full px-2 py-1" style={{ backgroundColor: weekCount >= 5 ? '#d1fae5' : '#fef3c7' }}>
              <Text className="font-black" style={{ fontSize: 11, color: weekCount >= 5 ? '#047857' : '#b45309' }}>{weekCount}/7 天 {weekCount >= 5 ? '太棒啦' : '继续加油'}</Text>
            </View>
          </View>
          <View style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', paddingLeft: 4, paddingRight: 4 }}>
            {week.map((d, i) => (
              <View key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <View
                  className="rounded-full"
                  style={{
                    width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: d.watered ? 'linear-gradient(135deg,#34d399,#22c55e)' : '#f5f5f4',
                    boxShadow: d.watered ? '0 4px 10px rgba(34,197,94,0.4)' : 'none',
                    border: d.isToday ? '2px solid #fb7185' : 'none',
                  }}
                >
                  <Text className="text-sm font-black" style={{ color: d.watered ? '#fff' : '#d6d3d1' }}>{d.watered ? '💧' : '·'}</Text>
                </View>
                <Text className="font-bold mt-1" style={{ fontSize: 10, color: d.isToday ? '#FF4757' : '#78716c' }}>{d.label}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* ============ 资产贴纸卡 ============ */}
      <View className="px-4 mt-4" style={{ display: 'flex', flexDirection: 'row', gap: 12 }}>
        {assets.map((a) => (
          <View key={a.label} className="flex-1 rounded-3xl p-3 relative" style={{ background: a.bg, boxShadow: '0 8px 24px -12px rgba(0,0,0,0.12)' }} onClick={a.onClick}>
            <View className="rounded-2xl w-10 h-10" style={{ backgroundColor: 'rgba(255,255,255,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Text className="text-xl">{a.emoji}</Text>
            </View>
            <Text className="block font-black mt-2" style={{ fontSize: 22, color: '#1c1917', lineHeight: '24px' }}>{a.value}</Text>
            <Text className="block font-bold mt-1" style={{ fontSize: 11, color: 'rgba(28,25,23,0.6)' }}>{a.label}</Text>
            <Text className="absolute font-black" style={{ top: 10, right: 12, color: 'rgba(28,25,23,0.3)', fontSize: 14 }}>›</Text>
          </View>
        ))}
      </View>

      {/* ============ 我的果园 ============ */}
      <View className="px-4 mt-6">
        <SectionTitle emoji="🌱" title="我的果园" />
        {records.map((item) => <MenuCard key={item.label} item={item} />)}
      </View>

      {/* ============ 更多好玩 ============ */}
      <View className="px-4 mt-6">
        <SectionTitle emoji="🎁" title="更多好玩" />
        {tools.map((item) => <MenuCard key={item.label} item={item} />)}
      </View>

      <Text className="block text-center mt-6" style={{ fontSize: 11, color: '#78716c' }}>🌱 每天浇水，果树才能快快长大哦～</Text>

      <ShareSheet
        visible={shareOpen}
        nickname={shareInfo?.nickname ?? profile?.nickname ?? ''}
        helpedToday={shareInfo?.helpedToday ?? 0}
        inviteLimit={profile?.config.taskInviteLimit ?? 1}
        onClose={() => setShareOpen(false)}
      />
      <CustomerServiceModal visible={wecomOpen} onClose={() => setWecomOpen(false)} />
      <OrchardTabBar active="me" />
    </View>
  )
}

function SectionTitle({ emoji, title }: { emoji: string; title: string }) {
  return (
    <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
      <View className="bg-white rounded-xl w-7 h-7" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }}>
        <Text className="text-sm">{emoji}</Text>
      </View>
      <Text className="font-black ml-2" style={{ fontSize: 17, color: '#1c1917' }}>{title}</Text>
    </View>
  )
}

function MenuCard({ item }: { item: MenuItem }) {
  return (
    <View className="bg-white rounded-2xl p-3 mb-2" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', boxShadow: '0 8px 24px -12px rgba(0,0,0,0.12)' }} onClick={item.onClick}>
      <View className="rounded-2xl w-11 h-11" style={{ background: item.tile, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transform: 'rotate(-3deg)' }}>
        <Text style={{ fontSize: 22 }}>{item.icon}</Text>
      </View>
      <View className="flex-1 ml-3">
        <Text className="block text-sm font-black" style={{ color: '#1c1917' }}>{item.label}</Text>
        {item.desc ? <Text className="block mt-1" style={{ fontSize: 11, color: '#78716c' }}>{item.desc}</Text> : null}
      </View>
      {item.badge ? (
        <View className="rounded-full px-2 py-1" style={{ backgroundColor: '#fff1f2' }}>
          <Text className="font-black" style={{ fontSize: 10, color: '#f43f5e' }}>{item.badge}</Text>
        </View>
      ) : (
        <View className="rounded-full w-6 h-6" style={{ backgroundColor: '#f5f5f4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Text className="text-xs font-black" style={{ color: '#78716c' }}>›</Text>
        </View>
      )}
    </View>
  )
}
