import { useState, useCallback } from 'react'
import Taro, { useDidShow, useShareAppMessage, useShareTimeline } from '@tarojs/taro'
import { View, Text, ScrollView } from '@tarojs/components'
import { Network } from '@/network'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import SharePosterModal from '@/components/share-poster-modal'
import {
  Users, Wallet, TrendingUp, HandCoins, UserPlus, Sparkles,
} from 'lucide-react-taro'

interface Overview {
  user_id: string
  inviter_id: string | null
  total_commission: number
  available_commission: number
  withdrawn_commission: number
  today_commission: number
  team: { level1: number; level2: number; level3: number }
  rates: { level1: number; level2: number; level3: number }
  min_withdraw: number
}

interface TeamMember {
  user_id: string
  nick_name: string
  avatar_url: string | null
  joined_at: string
}

interface CommissionRecord {
  id: string
  order_no: string
  level: number
  order_amount: number
  commission_amount: number
  status: string
  created_at: string
}

interface WithdrawRecord {
  id: string
  amount: number
  status: string
  reject_reason: string | null
  created_at: string
}

const fmt = (n: number) => (Math.round(Number(n) * 100) / 100).toFixed(2)

function formatTime(iso?: string) {
  if (!iso) return ''
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

const LEVEL_LABEL: Record<number, string> = { 1: '一级', 2: '二级', 3: '三级' }
const LEVEL_COLOR: Record<number, string> = { 1: '#FF4757', 2: '#FF8A3D', 3: '#3B82F6' }

export default function DistributionCenter() {
  const [userId, setUserId] = useState('')
  const [overview, setOverview] = useState<Overview | null>(null)
  const [loading, setLoading] = useState(true)
  const [teamLevel, setTeamLevel] = useState('1')
  const [teamList, setTeamList] = useState<TeamMember[]>([])
  const [teamLoading, setTeamLoading] = useState(false)
  const [commissions, setCommissions] = useState<CommissionRecord[]>([])
  const [withdraws, setWithdraws] = useState<WithdrawRecord[]>([])
  const [showPoster, setShowPoster] = useState(false)
  const isMiniApp = [Taro.ENV_TYPE.WEAPP as string, Taro.ENV_TYPE.TT as string].includes(Taro.getEnv())

  // 分享邀请（裂变主入口）
  useShareAppMessage(() => ({
    title: '邀你一起吃喝玩乐还能赚佣金！',
    path: `/pages/index/index?inviter=${userId}`,
  }))
  useShareTimeline(() => ({
    title: '邀你一起吃喝玩乐还能赚佣金！',
    query: `inviter=${userId}`,
  }))

  const fetchOverview = useCallback(async (uid: string) => {
    try {
      const res = await Network.request({ url: `/api/distribution/my/${uid}/overview` })
      console.log('[Distribution] 概览:', res.data)
      setOverview(res.data?.data || null)
    } catch (err) {
      console.error('[Distribution] 概览加载失败:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchTeam = useCallback(async (uid: string, level: string) => {
    setTeamLoading(true)
    try {
      const res = await Network.request({ url: `/api/distribution/my/${uid}/team?level=${level}` })
      console.log('[Distribution] 团队 L' + level + ':', res.data)
      setTeamList(res.data?.data || [])
    } catch (err) {
      console.error('[Distribution] 团队加载失败:', err)
      setTeamList([])
    } finally {
      setTeamLoading(false)
    }
  }, [])

  const fetchCommissions = useCallback(async (uid: string) => {
    try {
      const res = await Network.request({ url: `/api/distribution/my/${uid}/commissions?pageSize=50` })
      console.log('[Distribution] 佣金明细:', res.data)
      setCommissions(res.data?.data?.list || [])
    } catch (err) {
      console.error('[Distribution] 佣金明细加载失败:', err)
    }
  }, [])

  const fetchWithdraws = useCallback(async (uid: string) => {
    try {
      const res = await Network.request({ url: `/api/distribution/my/${uid}/withdraws` })
      console.log('[Distribution] 提现记录:', res.data)
      setWithdraws(res.data?.data || [])
    } catch (err) {
      console.error('[Distribution] 提现记录加载失败:', err)
    }
  }, [])

  useDidShow(() => {
    const uid = Taro.getStorageSync('user_id')
    if (!uid) {
      Taro.showModal({
        title: '提示', content: '请先登录后再查看分销中心', confirmText: '去登录', cancelText: '取消',
        success: (r) => {
          if (r.confirm) Taro.navigateTo({ url: '/pages/login/index' })
          else Taro.navigateBack().catch(() => Taro.switchTab({ url: '/pages/user-center/index' }))
        },
      })
      setLoading(false)
      return
    }
    setUserId(uid)
    setLoading(true)
    fetchOverview(uid)
    fetchTeam(uid, teamLevel)
    fetchCommissions(uid)
    fetchWithdraws(uid)
  })

  const handleWithdraw = () => {
    if (!overview) return
    if (overview.available_commission < overview.min_withdraw) {
      Taro.showToast({ title: `满 ¥${overview.min_withdraw} 可提现`, icon: 'none' })
      return
    }
    Taro.showModal({
      title: '申请提现',
      content: `可提现 ¥${fmt(overview.available_commission)}，确认全部提现？`,
      confirmText: '确认提现',
      cancelText: '再想想',
      success: async (r) => {
        if (!r.confirm) return
        try {
          const res = await Network.request({
            url: '/api/distribution/withdraw',
            method: 'POST',
            data: { user_id: userId, amount: overview.available_commission },
          })
          console.log('[Distribution] 提现申请:', res.data)
          Taro.showToast({ title: '已提交，等待审核', icon: 'success' })
          fetchOverview(userId)
          fetchWithdraws(userId)
        } catch (err: any) {
          Taro.showToast({ title: err?.data?.message || err?.message || '提现失败', icon: 'none' })
        }
      },
    })
  }

  const withdrawStatusMeta = (status: string) => {
    if (status === 'approved') return { text: '已到账', color: '#10B981' }
    if (status === 'rejected') return { text: '已驳回', color: '#EF4444' }
    return { text: '审核中', color: '#F59E0B' }
  }

  return (
    <View className="min-h-screen bg-gray-50">
      <ScrollView scrollY className="h-screen">
        {/* 顶部收益卡 */}
        <View className="bg-gradient-to-br from-[#FF6B81] via-[#FF4757] to-[#E8395A] px-5 pt-8 pb-16">
          <Text className="block text-sm" style={{ color: 'rgba(255,255,255,0.8)' }}>可提现佣金（元）</Text>
          {loading ? (
            <Skeleton className="h-12 w-40 mt-2" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }} />
          ) : (
            <Text className="block text-white text-5xl font-bold mt-2">¥{fmt(overview?.available_commission || 0)}</Text>
          )}
          <View className="flex flex-row gap-6 mt-4">
            <View>
              <Text className="block text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>累计佣金</Text>
              <Text className="block text-white text-lg font-semibold mt-1">¥{fmt(overview?.total_commission || 0)}</Text>
            </View>
            <View>
              <Text className="block text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>今日收益</Text>
              <Text className="block text-white text-lg font-semibold mt-1">¥{fmt(overview?.today_commission || 0)}</Text>
            </View>
            <View>
              <Text className="block text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>已提现</Text>
              <Text className="block text-white text-lg font-semibold mt-1">¥{fmt(overview?.withdrawn_commission || 0)}</Text>
            </View>
          </View>
        </View>

        {/* 操作区（卡片上浮） */}
        <View className="px-4 -mt-8">
          <View className="bg-white rounded-2xl shadow-sm p-4 flex flex-row gap-3">
            <View className="flex-1">
              <Button
                onClick={handleWithdraw}
                className="w-full bg-[#FF4757] text-white rounded-full"
                disabled={loading}
              >
                <View className="flex flex-row items-center justify-center gap-2">
                  <Wallet size={16} color="#ffffff" />
                  <Text className="text-white text-sm font-medium">提现</Text>
                </View>
              </Button>
            </View>
            <View className="flex-1">
              <Button
                onClick={() => {
                  if (!isMiniApp) {
                    Taro.showToast({ title: '请在小程序中邀请好友', icon: 'none' })
                    return
                  }
                  setShowPoster(true)
                }}
                className="w-full bg-gray-900 text-white rounded-full"
              >
                <View className="flex flex-row items-center justify-center gap-2">
                  <UserPlus size={16} color="#ffffff" />
                  <Text className="text-white text-sm font-medium">邀请好友</Text>
                </View>
              </Button>
            </View>
          </View>
          <Text className="block text-xs text-gray-400 text-center mt-2">满 ¥{overview?.min_withdraw ?? 10} 可提现 · 邀请好友下单你赚佣金</Text>
        </View>

        {/* 佣金规则卡 */}
        {overview && (
          <View className="px-4 mt-3">
            <View className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-100 rounded-2xl p-4">
              <View className="flex flex-row items-center gap-2 mb-2">
                <Sparkles size={15} color="#D97706" />
                <Text className="block text-sm font-semibold text-amber-800">赚钱攻略</Text>
              </View>
              <Text className="block text-xs text-amber-700 leading-5">
                好友扫你的海报码下单 → 你得 {overview.rates.level1}% 佣金{'\n'}
                好友再邀请的人下单 → 你得 {overview.rates.level2}% 佣金{'\n'}
                第三代好友下单 → 你得 {overview.rates.level3}% 佣金
              </Text>
            </View>
          </View>
        )}

        {/* Tab：团队 / 佣金明细 / 提现记录 */}
        <View className="px-4 mt-4 pb-8">
          <Tabs value={teamLevel} onValueChange={(v) => { setTeamLevel(v); if (userId && ['1','2','3'].includes(v)) fetchTeam(userId, v) }}>
            <TabsList className="w-full bg-white rounded-xl">
              <TabsTrigger value="1" className="flex-1 text-xs">一级 {overview?.team.level1 ?? 0}人</TabsTrigger>
              <TabsTrigger value="2" className="flex-1 text-xs">二级 {overview?.team.level2 ?? 0}人</TabsTrigger>
              <TabsTrigger value="3" className="flex-1 text-xs">三级 {overview?.team.level3 ?? 0}人</TabsTrigger>
              <TabsTrigger value="commissions" className="flex-1 text-xs">佣金</TabsTrigger>
              <TabsTrigger value="withdraws" className="flex-1 text-xs">提现</TabsTrigger>
            </TabsList>

            {['1', '2', '3'].map((lv) => (
              <TabsContent key={lv} value={lv}>
                <View className="bg-white rounded-2xl mt-3 overflow-hidden">
                  {teamLoading ? (
                    <View className="p-4 flex flex-col gap-3">
                      {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
                    </View>
                  ) : teamList.length === 0 ? (
                    <View className="py-12 flex flex-col items-center">
                      <Users size={32} color="#D1D5DB" />
                      <Text className="block text-sm text-gray-400 mt-3">还没有{LEVEL_LABEL[Number(lv)]}好友</Text>
                      <Text className="block text-xs text-gray-300 mt-1">快去邀请好友赚佣金吧</Text>
                    </View>
                  ) : (
                    teamList.map((m, idx) => (
                      <View key={m.user_id}>
                        <View className="flex flex-row items-center gap-3 px-4 py-3">
                          <Avatar className="w-10 h-10">
                            {m.avatar_url ? <AvatarImage src={m.avatar_url} /> : null}
                            <AvatarFallback>{(m.nick_name || '用')[0]}</AvatarFallback>
                          </Avatar>
                          <View className="flex-1">
                            <Text className="block text-sm font-medium text-gray-900">{m.nick_name}</Text>
                            <Text className="block text-xs text-gray-400 mt-1">{formatTime(m.joined_at)} 加入</Text>
                          </View>
                          <Badge style={{ backgroundColor: LEVEL_COLOR[Number(lv)] + '1A', color: LEVEL_COLOR[Number(lv)] }}>
                            {LEVEL_LABEL[Number(lv)]}
                          </Badge>
                        </View>
                        {idx < teamList.length - 1 && <View className="h-px bg-gray-50 ml-16" />}
                      </View>
                    ))
                  )}
                </View>
              </TabsContent>
            ))}

            <TabsContent value="commissions">
              <View className="bg-white rounded-2xl mt-3 overflow-hidden">
                {commissions.length === 0 ? (
                  <View className="py-12 flex flex-col items-center">
                    <HandCoins size={32} color="#D1D5DB" />
                    <Text className="block text-sm text-gray-400 mt-3">暂无佣金记录</Text>
                  </View>
                ) : (
                  commissions.map((c, idx) => (
                    <View key={c.id}>
                      <View className="flex flex-row items-center justify-between px-4 py-3">
                        <View className="flex-1">
                          <View className="flex flex-row items-center gap-2">
                            <Badge style={{ backgroundColor: LEVEL_COLOR[c.level] + '1A', color: LEVEL_COLOR[c.level] }}>
                              {LEVEL_LABEL[c.level]}佣金
                            </Badge>
                            <Text className="text-xs text-gray-400">订单 ¥{fmt(c.order_amount)}</Text>
                          </View>
                          <Text className="block text-xs text-gray-400 mt-1">{formatTime(c.created_at)}</Text>
                        </View>
                        <Text className="block text-base font-bold text-[#FF4757]">+¥{fmt(c.commission_amount)}</Text>
                      </View>
                      {idx < commissions.length - 1 && <View className="h-px bg-gray-50 mx-4" />}
                    </View>
                  ))
                )}
              </View>
            </TabsContent>

            <TabsContent value="withdraws">
              <View className="bg-white rounded-2xl mt-3 overflow-hidden">
                {withdraws.length === 0 ? (
                  <View className="py-12 flex flex-col items-center">
                    <TrendingUp size={32} color="#D1D5DB" />
                    <Text className="block text-sm text-gray-400 mt-3">暂无提现记录</Text>
                  </View>
                ) : (
                  withdraws.map((w, idx) => {
                    const meta = withdrawStatusMeta(w.status)
                    return (
                      <View key={w.id}>
                        <View className="flex flex-row items-center justify-between px-4 py-3">
                          <View className="flex-1">
                            <Text className="block text-sm font-semibold text-gray-900">提现 ¥{fmt(w.amount)}</Text>
                            <Text className="block text-xs text-gray-400 mt-1">
                              {formatTime(w.created_at)}{w.status === 'rejected' && w.reject_reason ? ` · ${w.reject_reason}` : ''}
                            </Text>
                          </View>
                          <Text className="block text-sm font-medium" style={{ color: meta.color }}>{meta.text}</Text>
                        </View>
                        {idx < withdraws.length - 1 && <View className="h-px bg-gray-50 mx-4" />}
                      </View>
                    )
                  })
                )}
              </View>
            </TabsContent>
          </Tabs>
        </View>
      </ScrollView>

      {/* 邀请海报弹层（太阳码落地首页，scene 携带 inviter） */}
      <SharePosterModal
        visible={showPoster}
        onClose={() => setShowPoster(false)}
        coverUrl={null}
        title="膨胀团 · 邀你吃喝玩乐赚佣金"
        subtitle="扫码下单，你我都有奖励"
        priceText="下单抽霸王餐"
        scene={`inviter=${userId}`}
        page="pages/index/index"
      />
    </View>
  )
}
