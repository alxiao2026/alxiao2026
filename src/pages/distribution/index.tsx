import { useState, useCallback, useEffect, useMemo } from 'react'
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
  Users, Wallet, HandCoins, UserPlus, Zap, Flame, Crown, Rocket, Gift, Coins, TrendingUp,
} from 'lucide-react-taro'

interface Overview {
  user_id: string
  inviter_id: string | null
  total_commission: number
  pending_commission: number
  available_commission: number
  withdrawn_commission: number
  today_commission: number
  team: { level1: number; level2: number }
  rates: { level1: number; level2: number; merchant: number; pool: number; platform: number; cooling_days: number }
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
  settle_status: string
  available_at?: string
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

const LEVEL_LABEL: Record<number, string> = { 1: '直属', 2: '徒弟' }
const LEVEL_COLOR: Record<number, string> = { 1: '#FBBF24', 2: '#F97316' }

export default function DistributionCenter() {
  const [userId, setUserId] = useState('')
  const [overview, setOverview] = useState<Overview | null>(null)
  const [loading, setLoading] = useState(true)
  const [teamLevel, setTeamLevel] = useState('1')
  const [teamList, setTeamList] = useState<TeamMember[]>([])
  const [teamLoading, setTeamLoading] = useState(false)
  const [commissions, setCommissions] = useState<CommissionRecord[]>([])
  const [withdraws, setWithdraws] = useState<WithdrawRecord[]>([])
  const [walletTab, setWalletTab] = useState('commissions')
  const [showPoster, setShowPoster] = useState(false)
  const [posterMode, setPosterMode] = useState<'share' | 'team'>('share')
  const [battleIdx, setBattleIdx] = useState(0)
  const isMiniApp = [Taro.ENV_TYPE.WEAPP as string, Taro.ENV_TYPE.TT as string].includes(Taro.getEnv())

  useShareAppMessage(() => ({
    title: '邀你一起吃喝玩乐，顺便把钱赚了',
    path: `/pages/index/index?inviter=${userId}`,
  }))
  useShareTimeline(() => ({
    title: '邀你一起吃喝玩乐，顺便把钱赚了',
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
      setCommissions(res.data?.data?.list || [])
    } catch (err) {
      console.error('[Distribution] 佣金明细加载失败:', err)
    }
  }, [])

  const fetchWithdraws = useCallback(async (uid: string) => {
    try {
      const res = await Network.request({ url: `/api/distribution/my/${uid}/withdraws` })
      setWithdraws(res.data?.data || [])
    } catch (err) {
      console.error('[Distribution] 提现记录加载失败:', err)
    }
  }, [])

  useDidShow(() => {
    const uid = Taro.getStorageSync('user_id')
    if (!uid) {
      Taro.showModal({
        title: '提示', content: '先登录，再开启搞钱之路', confirmText: '去登录', cancelText: '取消',
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

  // 战报弹幕数据（真实收益 + 氛围文案）
  const battleList = useMemo(() => {
    const list: string[] = []
    commissions.slice(0, 5).forEach((c) => {
      const label = c.settle_status === 'settled' ? '已到账' : '入账中'
      list.push(`好友下单，你躺赚 ¥${fmt(c.commission_amount)}（${label}）`)
    })
    if (overview && Number(overview.today_commission) > 0) {
      list.unshift(`今日已进账 ¥${fmt(overview.today_commission)}，继续冲`)
    }
    if (list.length === 0) {
      list.push('分享海报，好友下单你就赚佣金')
      list.push('组建战队，徒弟的徒弟下单你也有份')
      list.push('动动手指，睡后收入安排上')
    }
    return list
  }, [commissions, overview])

  useEffect(() => {
    if (battleList.length <= 1) return
    const t = setInterval(() => setBattleIdx((i) => (i + 1) % battleList.length), 3000)
    return () => clearInterval(t)
  }, [battleList.length])

  const handleWithdraw = () => {
    if (!overview) return
    if (overview.available_commission < overview.min_withdraw) {
      Taro.showToast({ title: `满 ¥${overview.min_withdraw} 就能提现`, icon: 'none' })
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
          await Network.request({
            url: '/api/distribution/withdraw',
            method: 'POST',
            data: { user_id: userId, amount: overview.available_commission },
          })
          Taro.showToast({ title: '已提交，坐等打款', icon: 'success' })
          fetchOverview(userId)
          fetchWithdraws(userId)
        } catch (err: any) {
          Taro.showToast({ title: err?.data?.message || err?.message || '提现失败', icon: 'none' })
        }
      },
    })
  }

  const openPoster = (mode: 'share' | 'team') => {
    if (!isMiniApp) {
      Taro.showToast({ title: '请在小程序中分享邀请', icon: 'none' })
      return
    }
    setPosterMode(mode)
    setShowPoster(true)
  }

  const settleMeta = (c: CommissionRecord) => {
    if (c.settle_status === 'revoked') return { text: '已回收', color: '#F87171' }
    if (c.settle_status === 'settled') return { text: '已到账', color: '#34D399' }
    const days = overview?.rates.cooling_days ?? 7
    return { text: `${days}天后可提`, color: '#FBBF24' }
  }

  const teamCount = (overview?.team.level1 ?? 0) + (overview?.team.level2 ?? 0)

  return (
    <View className="min-h-screen" style={{ background: '#12101F' }}>
      <ScrollView scrollY className="h-screen">
        {/* 顶部战报弹幕 */}
        <View className="px-4 pt-5">
          <View
            className="flex flex-row items-center gap-2 rounded-full px-4 py-2"
            style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)' }}
          >
            <Flame size={14} color="#FBBF24" />
            <Text key={battleIdx} className="text-xs flex-1" style={{ color: '#FCD34D' }}>{battleList[battleIdx]}</Text>
            <Zap size={12} color="#F59E0B" />
          </View>
        </View>

        {/* 收入主卡 */}
        <View className="px-4 mt-4">
          <View
            className="rounded-3xl p-5 relative overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, #2A2140 0%, #1B1530 60%, #241A38 100%)',
              border: '1px solid rgba(251,191,36,0.3)',
            }}
          >
            {/* 装饰光斑 */}
            <View style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: 60, background: 'rgba(251,191,36,0.15)' }} />
            <View className="flex flex-row items-center gap-2">
              <Crown size={16} color="#FBBF24" />
              <Text className="text-sm" style={{ color: '#E9D5FF' }}>今日预估收入（元）</Text>
            </View>
            {loading ? (
              <Skeleton className="h-14 w-44 mt-3" style={{ backgroundColor: 'rgba(255,255,255,0.12)' }} />
            ) : (
              <Text
                className="block font-bold mt-2"
                style={{
                  fontSize: 44, lineHeight: '52px',
                  background: 'linear-gradient(90deg, #FDE68A, #F59E0B)',
                  WebkitBackgroundClip: 'text', color: '#FBBF24',
                }}
              >
                ¥{fmt(overview?.today_commission || 0)}
              </Text>
            )}
            {/* 三标签 */}
            <View className="flex flex-row mt-5">
              <View className="flex-1">
                <Text className="block text-xs" style={{ color: 'rgba(233,213,255,0.6)' }}>可提现</Text>
                <Text className="block text-lg font-bold mt-1" style={{ color: '#34D399' }}>¥{fmt(overview?.available_commission || 0)}</Text>
              </View>
              <View className="flex-1">
                <Text className="block text-xs" style={{ color: 'rgba(233,213,255,0.6)' }}>待入账</Text>
                <Text className="block text-lg font-bold mt-1" style={{ color: '#FBBF24' }}>¥{fmt(overview?.pending_commission || 0)}</Text>
              </View>
              <View className="flex-1">
                <Text className="block text-xs" style={{ color: 'rgba(233,213,255,0.6)' }}>战队成员</Text>
                <Text className="block text-lg font-bold mt-1 text-white">{teamCount} 人</Text>
              </View>
            </View>
          </View>
        </View>

        {/* 两个大按钮 */}
        <View className="px-4 mt-4 flex flex-row gap-3">
          <View className="flex-1">
            <Button
              onClick={() => openPoster('share')}
              className="w-full rounded-2xl border-0"
              style={{ background: 'linear-gradient(135deg, #FBBF24, #F97316)', height: 54 }}
            >
              <View className="flex flex-row items-center justify-center gap-2">
                <Rocket size={18} color="#3B2A00" />
                <Text className="text-sm font-bold" style={{ color: '#3B2A00' }}>分享今日爆款</Text>
              </View>
            </Button>
          </View>
          <View className="flex-1">
            <Button
              onClick={() => openPoster('team')}
              className="w-full rounded-2xl"
              style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.5)', height: 54 }}
            >
              <View className="flex flex-row items-center justify-center gap-2">
                <UserPlus size={18} color="#FBBF24" />
                <Text className="text-sm font-bold" style={{ color: '#FBBF24' }}>组建搞钱战队</Text>
              </View>
            </Button>
          </View>
        </View>
        <Text className="block text-center text-xs mt-2" style={{ color: 'rgba(233,213,255,0.45)' }}>
          满 ¥{overview?.min_withdraw ?? 1} 可提现 · 好友下单你赚佣金
        </Text>

        {/* 躺赚攻略 */}
        {overview && (
          <View className="px-4 mt-4">
            <View
              className="rounded-2xl p-4"
              style={{ background: 'rgba(251,146,60,0.08)', border: '1px solid rgba(251,146,60,0.25)' }}
            >
              <View className="flex flex-row items-center gap-2 mb-2">
                <Gift size={15} color="#FB923C" />
                <Text className="block text-sm font-semibold" style={{ color: '#FDBA74' }}>躺赚攻略</Text>
              </View>
              <Text className="block text-xs leading-5" style={{ color: 'rgba(254,215,170,0.85)' }}>
                好友扫你的码下单 → 你拿 {overview.rates.level1}%（每单分销池的大头）{'\n'}
                好友再拉的人下单 → 你再拿 {overview.rates.level2}%{'\n'}
                佣金冷静 {overview.rates.cooling_days} 天后可提现，退款自动回收
              </Text>
            </View>
          </View>
        )}

        {/* 钱包区 */}
        <View className="px-4 mt-4">
          <View className="rounded-2xl p-4" style={{ background: '#1E1A2E', border: '1px solid rgba(255,255,255,0.06)' }}>
            <View className="flex flex-row items-center justify-between">
              <View className="flex flex-row items-center gap-2">
                <Wallet size={16} color="#FBBF24" />
                <Text className="text-sm font-semibold text-white">我的钱包</Text>
              </View>
              <Button
                onClick={handleWithdraw}
                disabled={loading}
                className="rounded-full border-0"
                style={{ background: 'linear-gradient(135deg, #34D399, #10B981)', height: 34, paddingLeft: 16, paddingRight: 16 }}
              >
                <View className="flex flex-row items-center gap-1">
                  <Coins size={14} color="#052e16" />
                  <Text className="text-xs font-bold" style={{ color: '#052e16' }}>提现</Text>
                </View>
              </Button>
            </View>
            <View className="flex flex-row items-end justify-between mt-3">
              <View>
                <Text className="block text-xs" style={{ color: 'rgba(233,213,255,0.55)' }}>可提现余额（元）</Text>
                <Text className="block text-3xl font-bold mt-1" style={{ color: '#34D399' }}>¥{fmt(overview?.available_commission || 0)}</Text>
              </View>
              <View className="items-end">
                <Text className="block text-xs" style={{ color: 'rgba(233,213,255,0.55)' }}>待入账 ¥{fmt(overview?.pending_commission || 0)}</Text>
                <Text className="block text-xs mt-1" style={{ color: 'rgba(233,213,255,0.4)' }}>累计 ¥{fmt(overview?.total_commission || 0)}</Text>
              </View>
            </View>

            {/* 明细 tabs */}
            <View className="mt-4">
              <Tabs value={walletTab} onValueChange={setWalletTab}>
                <TabsList className="w-full rounded-xl" style={{ background: 'rgba(255,255,255,0.05)' }}>
                  <TabsTrigger value="commissions" className="flex-1 text-xs">佣金明细</TabsTrigger>
                  <TabsTrigger value="withdraws" className="flex-1 text-xs">提现记录</TabsTrigger>
                </TabsList>

                <TabsContent value="commissions">
                  <View className="mt-3">
                    {commissions.length === 0 ? (
                      <View className="py-10 flex flex-col items-center">
                        <HandCoins size={30} color="#4B4565" />
                        <Text className="block text-sm mt-3" style={{ color: '#6B6585' }}>还没有佣金，去分享第一单吧</Text>
                      </View>
                    ) : (
                      commissions.map((c, idx) => {
                        const meta = settleMeta(c)
                        return (
                          <View key={c.id}>
                            <View className="flex flex-row items-center justify-between py-3">
                              <View className="flex-1">
                                <View className="flex flex-row items-center gap-2">
                                  <Badge style={{ backgroundColor: LEVEL_COLOR[c.level] + '22', color: LEVEL_COLOR[c.level] }}>
                                    {LEVEL_LABEL[c.level]}佣金
                                  </Badge>
                                  <Text className="text-xs" style={{ color: '#6B6585' }}>订单 ¥{fmt(c.order_amount)}</Text>
                                </View>
                                <Text className="block text-xs mt-1" style={{ color: '#565073' }}>{formatTime(c.created_at)}</Text>
                              </View>
                              <View className="items-end">
                                <Text className="block text-base font-bold" style={{ color: c.settle_status === 'revoked' ? '#6B6585' : '#FBBF24' }}>
                                  {c.settle_status === 'revoked' ? '' : '+'}¥{fmt(c.commission_amount)}
                                </Text>
                                <Text className="block text-xs mt-1" style={{ color: meta.color }}>{meta.text}</Text>
                              </View>
                            </View>
                            {idx < commissions.length - 1 && <View style={{ height: 1, background: 'rgba(255,255,255,0.05)' }} />}
                          </View>
                        )
                      })
                    )}
                  </View>
                </TabsContent>

                <TabsContent value="withdraws">
                  <View className="mt-3">
                    {withdraws.length === 0 ? (
                      <View className="py-10 flex flex-col items-center">
                        <TrendingUp size={30} color="#4B4565" />
                        <Text className="block text-sm mt-3" style={{ color: '#6B6585' }}>暂无提现记录</Text>
                      </View>
                    ) : (
                      withdraws.map((w, idx) => {
                        const meta = w.status === 'approved' ? { text: '已到账', color: '#34D399' }
                          : w.status === 'rejected' ? { text: '已驳回', color: '#F87171' }
                          : { text: '审核中', color: '#FBBF24' }
                        return (
                          <View key={w.id}>
                            <View className="flex flex-row items-center justify-between py-3">
                              <View className="flex-1">
                                <Text className="block text-sm font-semibold text-white">提现 ¥{fmt(w.amount)}</Text>
                                <Text className="block text-xs mt-1" style={{ color: '#565073' }}>
                                  {formatTime(w.created_at)}{w.status === 'rejected' && w.reject_reason ? ` · ${w.reject_reason}` : ''}
                                </Text>
                              </View>
                              <Text className="block text-sm font-medium" style={{ color: meta.color }}>{meta.text}</Text>
                            </View>
                            {idx < withdraws.length - 1 && <View style={{ height: 1, background: 'rgba(255,255,255,0.05)' }} />}
                          </View>
                        )
                      })
                    )}
                  </View>
                </TabsContent>
              </Tabs>
            </View>
          </View>
        </View>

        {/* 战队区（两级） */}
        <View className="px-4 mt-4 pb-10">
          <View className="rounded-2xl p-4" style={{ background: '#1E1A2E', border: '1px solid rgba(255,255,255,0.06)' }}>
            <View className="flex flex-row items-center gap-2 mb-3">
              <Users size={16} color="#FBBF24" />
              <Text className="text-sm font-semibold text-white">我的战队</Text>
              <Text className="text-xs" style={{ color: '#6B6585' }}>（两级收益）</Text>
            </View>
            <Tabs value={teamLevel} onValueChange={(v) => { setTeamLevel(v); if (userId && ['1', '2'].includes(v)) fetchTeam(userId, v) }}>
              <TabsList className="w-full rounded-xl" style={{ background: 'rgba(255,255,255,0.05)' }}>
                <TabsTrigger value="1" className="flex-1 text-xs">直属 {overview?.team.level1 ?? 0} 人</TabsTrigger>
                <TabsTrigger value="2" className="flex-1 text-xs">徒弟 {overview?.team.level2 ?? 0} 人</TabsTrigger>
              </TabsList>
              {['1', '2'].map((lv) => (
                <TabsContent key={lv} value={lv}>
                  <View className="mt-3">
                    {teamLoading ? (
                      <View className="flex flex-col gap-3">
                        {[1, 2].map((i) => <Skeleton key={i} className="h-12 w-full" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }} />)}
                      </View>
                    ) : teamList.length === 0 ? (
                      <View className="py-10 flex flex-col items-center">
                        <Users size={30} color="#4B4565" />
                        <Text className="block text-sm mt-3" style={{ color: '#6B6585' }}>还没有{LEVEL_LABEL[Number(lv)]}成员</Text>
                        <Text className="block text-xs mt-1" style={{ color: '#565073' }}>分享海报，拉人进战队</Text>
                      </View>
                    ) : (
                      teamList.map((m, idx) => (
                        <View key={m.user_id}>
                          <View className="flex flex-row items-center gap-3 py-3">
                            <Avatar className="w-10 h-10">
                              {m.avatar_url ? <AvatarImage src={m.avatar_url} /> : null}
                              <AvatarFallback>{(m.nick_name || '友')[0]}</AvatarFallback>
                            </Avatar>
                            <View className="flex-1">
                              <Text className="block text-sm font-medium text-white">{m.nick_name}</Text>
                              <Text className="block text-xs mt-1" style={{ color: '#565073' }}>{formatTime(m.joined_at)} 加入</Text>
                            </View>
                            <Badge style={{ backgroundColor: LEVEL_COLOR[Number(lv)] + '22', color: LEVEL_COLOR[Number(lv)] }}>
                              {LEVEL_LABEL[Number(lv)]}
                            </Badge>
                          </View>
                          {idx < teamList.length - 1 && <View style={{ height: 1, background: 'rgba(255,255,255,0.05)', marginLeft: 52 }} />}
                        </View>
                      ))
                    )}
                  </View>
                </TabsContent>
              ))}
            </Tabs>
          </View>
        </View>
      </ScrollView>

      {/* 邀请海报弹层 */}
      <SharePosterModal
        visible={showPoster}
        onClose={() => setShowPoster(false)}
        coverUrl={null}
        title={posterMode === 'team' ? '膨胀团 · 组建搞钱战队' : '膨胀团 · 分享今日爆款'}
        subtitle={posterMode === 'team' ? '扫码进战队，一起躺赚' : '扫码下单，你我都有奖励'}
        priceText="下单抽霸王餐"
        pageParams={{ inviter: userId }}
        page="pages/index/index"
      />
    </View>
  )
}
