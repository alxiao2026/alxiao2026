import { useCallback, useEffect, useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useDidShow, useShareAppMessage } from '@tarojs/taro'
import { Button } from '@/components/ui/button'
import OrchardTabBar from '@/components/orchard/orchard-tabbar'
import ShareSheet from '@/components/orchard/share-sheet'
import { CustomerServiceModal } from '@/components/customer-service-modal'
import {
  orchardApi,
  type OrchardTasksData, type OrchardTask, type OrchardShareInfo, type OrchardRecord,
} from '@/lib/orchard-api'
import { ensureLogin } from '@/lib/silent-login'

const TASK_EMOJI: Record<string, string> = {
  group_buy: '🛒',
  share_friend: '📣',
  invite_friend: '🤝',
  bind_phone: '📱',
  add_wecom: '💬',
}

export default function OrchardTasksPage() {
  const [data, setData] = useState<OrchardTasksData | null>(null)
  const [shareInfo, setShareInfo] = useState<OrchardShareInfo | null>(null)
  const [todayDroplets, setTodayDroplets] = useState(0)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [shareOpen, setShareOpen] = useState(false)
  const [wecomOpen, setWecomOpen] = useState(false)
  const [wecomClaiming, setWecomClaiming] = useState(false)

  const [userId, setUserId] = useState('')
  const env = Taro.getEnv()
  const isMiniApp = env === Taro.ENV_TYPE.WEAPP || env === Taro.ENV_TYPE.TT

  const load = useCallback(async () => {
    if (!userId) return
    try {
      const [t, s, r] = await Promise.all([
        orchardApi.tasks(userId),
        orchardApi.shareInfo(userId),
        orchardApi.records(userId),
      ])
      if (t.code === 200 && t.data) setData(t.data)
      if (s.code === 200 && s.data) setShareInfo(s.data)
      if (r.code === 200 && Array.isArray(r.data)) {
        const start = new Date(); start.setHours(0, 0, 0, 0)
        const sum = (r.data as OrchardRecord[])
          .filter((x) => x.createdAt >= start.getTime() && x.amount > 0)
          .reduce((acc, x) => acc + x.amount, 0)
        setTodayDroplets(sum)
      }
    } catch (e) {
      console.error('[OrchardTasks] 加载失败:', e)
    }
  }, [userId])

  useDidShow(() => {
    if (!userId) {
      ensureLogin()
        .then((id) => setUserId(id))
        .catch((e) => {
          console.error('[OrchardTasks] 静默登录失败:', e)
          Taro.showToast({ title: '登录失败，请稍后重试', icon: 'none' })
        })
      return
    }
    load()
    // 进入任务页时结算好友助力（分享/邀请任务的奖励来源）
    orchardApi.settleHelps(userId).then((r) => {
      if (r.data && r.data.settled > 0) load()
    }).catch(() => undefined)
  })

  // 静默登录成功后自动加载
  useEffect(() => {
    if (userId) load()
  }, [userId, load])

  /** 分享卡片：好友点开进入助力页 */
  useShareAppMessage(() => {
    const name = Taro.getStorageSync('nick_name') || '好友'
    return {
      title: `快来帮 ${name} 浇水，一起种出真果树！`,
      path: `/pages/orchard-assist/index?from=${userId}&name=${encodeURIComponent(name)}`,
    }
  })

  const dailyTasks = data?.dailyTasks ?? []
  const growthTasks = data?.growthTasks ?? []

  /** 日常任务按钮 */
  const handleDaily = async (t: OrchardTask) => {
    if (!userId || loadingId) return
    if (t.progress >= t.dailyLimit) {
      Taro.showToast({ title: '今日已完成，明天再来～', icon: 'none' })
      return
    }
    // 分享/邀请：打开分享面板，好友点开小程序卡片助力后结算奖励
    if (t.id === 'share_friend' || t.id === 'invite_friend') {
      setShareOpen(true)
      return
    }
    if (t.id === 'group_buy') {
      // 去买团购：支付成功后后端自动完成本任务
      Taro.switchTab({ url: '/pages/index/index' })
      Taro.showToast({ title: '购买团购后自动到账水滴', icon: 'none' })
      return
    }
  }

  /** 成长任务按钮 */
  const handleGrowth = async (t: OrchardTask) => {
    if (!userId || loadingId) return
    if (t.done) {
      Taro.showToast({ title: '已经完成过啦', icon: 'none' })
      return
    }
    if (t.id === 'add_wecom') {
      setWecomOpen(true)
      return
    }
    if (t.id === 'bind_phone') {
      // 已有登录手机号：直接完成；否则走下方 getPhoneNumber 授权按钮
      if (data?.hasPhone) {
        setLoadingId(t.id)
        try {
          const r = await orchardApi.completeGrowthTask(userId, 'bind_phone')
          if (r.biz_code === 0) {
            Taro.showToast({ title: `绑定成功，+${r.data?.reward ?? 0} 积分`, icon: 'none' })
            load()
          } else {
            Taro.showToast({ title: r.msg || '完成失败', icon: 'none' })
          }
        } finally {
          setLoadingId(null)
        }
      }
      return
    }
  }

  /** getPhoneNumber 授权回调：phone_code → 后端换手机号并绑定 */
  const onGetPhoneNumber = async (e: any) => {
    const code = e?.detail?.code
    if (!code) {
      Taro.showToast({ title: '已取消授权', icon: 'none' })
      return
    }
    setLoadingId('bind_phone')
    try {
      const r = await orchardApi.bindPhone(userId, code)
      if (r.biz_code === 0) {
        Taro.showToast({ title: `绑定成功，+${r.data?.reward ?? 0} 积分`, icon: 'none' })
        load()
      } else {
        Taro.showToast({ title: r.msg || '绑定失败', icon: 'none' })
      }
    } catch (err) {
      Taro.showToast({ title: '网络异常，请重试', icon: 'none' })
    } finally {
      setLoadingId(null)
    }
  }

  /** 企微客服：我已添加，领取奖励 */
  const claimWecomReward = async () => {
    if (!userId || wecomClaiming) return
    setWecomClaiming(true)
    try {
      const r = await orchardApi.completeGrowthTask(userId, 'add_wecom')
      if (r.biz_code === 0) {
        setWecomOpen(false)
        Taro.showToast({ title: `+${r.data?.reward ?? 0} 积分到账`, icon: 'none' })
        load()
      } else {
        Taro.showToast({ title: r.msg || '领取失败', icon: 'none' })
      }
    } finally {
      setWecomClaiming(false)
    }
  }

  const taskDesc = (t: OrchardTask): string => {
    if (t.id === 'group_buy') return `每单 +${t.reward}g，每日最多 ${t.dailyLimit} 单（最高 +${t.reward * t.dailyLimit}g）`
    if (t.id === 'share_friend') return `好友点开分享卡片助力后 +${t.reward}g，每日最多 ${t.dailyLimit} 次（最高 +${t.reward * t.dailyLimit}g）`
    if (t.id === 'invite_friend') return `好友点开分享卡片助力后得补浇卡 ×1，每日最多 ${t.dailyLimit} 张；使用时每周期限 ${data?.cycleMakeupUseLimit ?? 5} 张`
    return t.desc
  }

  const progressLabel = (t: OrchardTask): string => {
    const reachedLimit = t.progress >= t.dailyLimit
    if (t.id === 'invite_friend') {
      return reachedLimit
        ? `今日已得补浇卡 ${t.progress}/${t.dailyLimit} · 共囤 ${data?.makeupCards ?? 0} 张`
        : t.dailyLimit > 1
          ? `等待好友助力 · 今日 ${t.progress}/${t.dailyLimit} 次`
          : `等待好友助力 · 已囤 ${data?.makeupCards ?? 0} 张`
    }
    if (t.id === 'share_friend') {
      return reachedLimit
        ? '今日助力奖励已领完 ✓'
        : t.dailyLimit > 1
          ? `等待好友助力 · 今日 ${t.progress}/${t.dailyLimit} 次`
          : '等待好友点开分享卡片助力'
    }
    if (t.id === 'group_buy') {
      return t.dailyLimit > 1 ? `今日 ${t.progress}/${t.dailyLimit} 次` : reachedLimit ? '今日已完成' : '今日未完成'
    }
    return ''
  }

  const dailyActionText = (t: OrchardTask): string => {
    if (t.id === 'invite_friend') return '去邀请'
    if (t.id === 'share_friend') return '去分享'
    return '去完成'
  }

  const bindPhoneTask = growthTasks.find((t) => t.id === 'bind_phone')
  const showPhoneAuthButton = bindPhoneTask && !bindPhoneTask.done && !data?.hasPhone && isMiniApp

  return (
    <View className="min-h-screen pb-32" style={{ backgroundColor: '#F9FAFB' }}>
      {/* 头部 */}
      <View className="px-4 pt-12 pb-8" style={{ background: 'linear-gradient(180deg, #FFE5EC 0%, #FFF1F2 55%, rgba(249,250,251,0) 100%)' }}>
        <Text className="block text-xs font-black" style={{ color: 'rgba(255,71,87,0.8)', letterSpacing: 2 }}>TODAY&apos;S MISSION</Text>
        <Text className="block text-2xl font-black mt-1" style={{ color: '#1e293b' }}>做任务，赚水滴 🎯</Text>
        <Text className="block text-xs mt-1" style={{ color: 'rgba(71,85,105,0.8)' }}>水滴 24 小时有效，完成后立即浇灌到果树</Text>
      </View>

      {/* 今日已得水滴 */}
      <View className="px-4" style={{ marginTop: -16 }}>
        <View className="bg-white rounded-2xl p-4" style={{ boxShadow: '0 8px 24px -12px rgba(0,0,0,0.12)' }}>
          <View style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Text className="block text-xs font-bold" style={{ color: '#78716c' }}>今日已得水滴</Text>
              <Text className="block text-2xl font-black mt-1" style={{ color: '#FF4757' }}>+{todayDroplets}<Text className="text-sm ml-1" style={{ color: '#fb7185' }}>g</Text></Text>
            </View>
            <Text style={{ fontSize: 36 }}>💧</Text>
          </View>
        </View>
      </View>

      {/* 日常任务 */}
      <View className="px-4 mt-5">
        <SectionTitle emoji="📅" title="日常任务" tag="每日刷新" />
        {dailyTasks.map((t) => {
          const reachedLimit = t.progress >= t.dailyLimit
          return (
            <View key={t.id} className="bg-white rounded-2xl p-4 mb-3" style={{ boxShadow: '0 8px 24px -12px rgba(0,0,0,0.12)' }}>
              <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
                <View className="rounded-xl w-12 h-12 items-center justify-center" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#fffbeb,#fff7ed)', flexShrink: 0 }}>
                  <Text style={{ fontSize: 24 }}>{TASK_EMOJI[t.id]}</Text>
                </View>
                <View className="flex-1 ml-3">
                  <Text className="block text-sm font-black" style={{ color: '#1c1917' }}>{t.title}</Text>
                  <Text className="block text-xs mt-1" style={{ color: '#78716c' }}>{taskDesc(t)}</Text>
                  <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                    <Text className="text-xs font-black" style={{ color: '#FF4757' }}>
                      {t.id === 'invite_friend' ? '+1 补浇卡 🎫' : `+${t.reward}g 水滴`}
                    </Text>
                    <Text className="text-xs ml-2" style={{ color: '#a8a29e', fontSize: 10 }}>· {progressLabel(t)}</Text>
                  </View>
                </View>
                {reachedLimit ? (
                  <View className="rounded-full px-3 py-2" style={{ backgroundColor: '#f0fdf4' }}>
                    <Text className="text-xs font-black" style={{ color: '#16a34a' }}>已完成 ✓</Text>
                  </View>
                ) : (
                  <View
                    className="rounded-full px-4 py-2"
                    style={{ background: 'linear-gradient(135deg,#FF4757,#F43F5E)', boxShadow: '0 6px 16px -6px rgba(255,71,87,0.5)' }}
                    onClick={() => handleDaily(t)}
                  >
                    <Text className="text-xs font-black text-white">{dailyActionText(t)}</Text>
                  </View>
                )}
              </View>
            </View>
          )
        })}
      </View>

      {/* 成长任务 */}
      <View className="px-4 mt-6">
        <SectionTitle emoji="🌱" title="成长任务" tag="一次性" />
        {growthTasks.map((t) => (
          <View key={t.id} className="bg-white rounded-2xl p-4 mb-3" style={{ boxShadow: '0 8px 24px -12px rgba(0,0,0,0.12)' }}>
            <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
              <View className="rounded-xl w-12 h-12 items-center justify-center" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#fffbeb,#fff7ed)', flexShrink: 0 }}>
                <Text style={{ fontSize: 24 }}>{TASK_EMOJI[t.id]}</Text>
              </View>
              <View className="flex-1 ml-3">
                <Text className="block text-sm font-black" style={{ color: '#1c1917' }}>{t.title}</Text>
                <Text className="block text-xs mt-1" style={{ color: '#78716c' }}>
                  {t.id === 'bind_phone' ? '一键绑定登录手机号' : t.id === 'add_wecom' ? '添加客服企业微信' : t.desc}
                </Text>
                <Text className="block text-xs font-black mt-1" style={{ color: '#ea580c' }}>+{t.reward} 积分</Text>
              </View>
              {t.done ? (
                <View className="rounded-full px-3 py-2" style={{ backgroundColor: '#f0fdf4' }}>
                  <Text className="text-xs font-black" style={{ color: '#16a34a' }}>已完成 ✓</Text>
                </View>
              ) : t.id === 'bind_phone' && showPhoneAuthButton ? (
                <Button
                  openType="getPhoneNumber"
                  onGetPhoneNumber={onGetPhoneNumber}
                  className="rounded-full px-4 py-2"
                  style={{ background: 'linear-gradient(135deg,#fbbf24,#f97316)', color: '#fff', fontSize: 12, fontWeight: 900, lineHeight: '20px', boxShadow: '0 6px 16px -6px rgba(249,115,22,0.5)' }}
                >
                  {loadingId === 'bind_phone' ? '绑定中…' : '一键绑定'}
                </Button>
              ) : (
                <View
                  className="rounded-full px-4 py-2"
                  style={{ background: 'linear-gradient(135deg,#fbbf24,#f97316)', boxShadow: '0 6px 16px -6px rgba(249,115,22,0.5)' }}
                  onClick={() => handleGrowth(t)}
                >
                  <Text className="text-xs font-black text-white">{loadingId === t.id ? '处理中…' : '去完成'}</Text>
                </View>
              )}
            </View>
          </View>
        ))}
      </View>

      {/* 积分兑换水滴入口 */}
      <View className="px-4 mt-6">
        <View
          className="bg-white rounded-2xl p-4"
          style={{ boxShadow: '0 8px 24px -12px rgba(0,0,0,0.12)', display: 'flex', flexDirection: 'row', alignItems: 'center' }}
          onClick={() => Taro.navigateTo({ url: '/pages/orchard-exchange/index' })}
        >
          <View className="rounded-xl w-12 h-12 items-center justify-center" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#fbbf24,#f97316)' }}>
            <Text style={{ fontSize: 24 }}>🔁</Text>
          </View>
          <View className="flex-1 ml-3">
            <Text className="block text-sm font-black" style={{ color: '#1c1917' }}>积分兑换水滴</Text>
            <Text className="block text-xs mt-1" style={{ color: '#78716c' }}>积分与膨胀团互通，兑换后立即浇灌</Text>
          </View>
          <Text style={{ color: '#a8a29e' }}>›</Text>
        </View>
      </View>

      <OrchardTabBar active="tasks" />

      {/* 分享助力面板（小程序分享卡片） */}
      <ShareSheet
        visible={shareOpen}
        nickname={shareInfo?.nickname ?? Taro.getStorageSync('nick_name') ?? ''}
        helpedToday={shareInfo?.helpedToday ?? 0}
        inviteLimit={1}
        onClose={() => setShareOpen(false)}
      />

      {/* 企微客服弹窗（复用膨胀团客服功能） */}
      <CustomerServiceModal visible={wecomOpen} onClose={() => { if (!wecomClaiming) setWecomOpen(false) }} />
      {wecomOpen && !growthTasks.find((t) => t.id === 'add_wecom')?.done && (
        <View style={{ position: 'fixed', bottom: 60, left: 0, right: 0, zIndex: 1000, display: 'flex', justifyContent: 'center' }}>
          <View
            className="rounded-full px-6 py-3"
            style={{ background: 'linear-gradient(135deg,#fbbf24,#f97316)', boxShadow: '0 10px 24px -8px rgba(249,115,22,0.6)' }}
            onClick={claimWecomReward}
          >
            <Text className="text-sm font-black text-white">{wecomClaiming ? '核验中…' : '我已添加，领取奖励'}</Text>
          </View>
        </View>
      )}
    </View>
  )
}

function SectionTitle({ emoji, title, tag }: { emoji: string; title: string; tag?: string }) {
  return (
    <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
      <Text className="text-lg">{emoji}</Text>
      <Text className="text-base font-black ml-2" style={{ color: '#1c1917' }}>{title}</Text>
      {tag ? (
        <View className="rounded-full px-2 py-1 ml-auto" style={{ backgroundColor: '#f0f9ff' }}>
          <Text className="text-xs font-bold" style={{ color: '#FF4757', fontSize: 10 }}>{tag}</Text>
        </View>
      ) : null}
    </View>
  )
}
