import { useCallback, useEffect, useState } from 'react'
import { View, Text, Image } from '@tarojs/components'
import Taro, { useDidShow, useShareAppMessage } from '@tarojs/taro'
import { Button } from '@/components/ui/button'
import AppTabBar from '@/components/app-tab-bar'
import ShareSheet from '@/components/orchard/share-sheet'
import WaterCalendar from '@/components/orchard/water-calendar'
import { WaterResultModal, HarvestModal, MakeupModal } from '@/components/orchard/orchard-modals'
import {
  orchardApi,
  type OrchardProfile, type OrchardCalendarCell, type OrchardShareInfo,
} from '@/lib/orchard-api'
import { ensureLogin } from '@/lib/silent-login'

/** 阶段兜底：与后端 STAGE_DEFS（1500 基准）完全一致，正常情况直接消费后端 stageThresholds */
const STAGE_EMOJIS = ['🌰', '🌱', '🪴', '🌸', '🍊', '🌟']
const STAGE_NAMES = ['种子', '发芽', '小树', '开花', '结果', '成熟']
const FALLBACK_THRESHOLDS = [0, 100, 300, 600, 1000, 1500]

/** 里程碑轨道填充百分比（图标等距，分段线性映射） */
function trackFillPct(g: number, thresholds: number[]): number {
  const last = thresholds.length - 1
  if (g <= 0) return 0
  if (g >= thresholds[last]) return 100
  for (let i = 0; i < last; i++) {
    if (g <= thresholds[i + 1]) {
      return ((i + (g - thresholds[i]) / (thresholds[i + 1] - thresholds[i])) / last) * 100
    }
  }
  return 100
}

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** 团团 Tab：果园模块首页（底部导航由主 TabBar 提供） */
export default function TuantuanPage() {
  const [profile, setProfile] = useState<OrchardProfile | null>(null)
  const [shareInfo, setShareInfo] = useState<OrchardShareInfo | null>(null)
  const [calendarCells, setCalendarCells] = useState<(OrchardCalendarCell | null)[][]>([])
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date()
    return { y: d.getFullYear(), m: d.getMonth() + 1 }
  })
  const [watering, setWatering] = useState(false)
  const [lastWater, setLastWater] = useState<{ gained: number; streak: number; becameMature: boolean } | null>(null)
  const [showHarvest, setShowHarvest] = useState(false)
  const [harvestResult, setHarvestResult] = useState<{ treeIndex: number; availableTrees: number } | null>(null)
  const [makeupDate, setMakeupDate] = useState<string | null>(null)
  const [showShare, setShowShare] = useState(false)
  const [plusG, setPlusG] = useState<{ text: string; key: number } | null>(null)
  const [userId, setUserId] = useState('')
  const [loadError, setLoadError] = useState(false)

  const loadProfile = useCallback(async () => {
    if (!userId) return
    try {
      const res = await orchardApi.profile(userId)
      if (res.code === 200 && res.data) {
        setProfile(res.data)
        setLoadError(false)
        // 头像昵称同步到本地缓存（与膨胀团账号一致）
        if (res.data.nickname) Taro.setStorageSync('nick_name', res.data.nickname)
      }
    } catch (e) {
      console.error('[Orchard] profile 加载失败:', e)
      setLoadError(true)
    }
  }, [userId])

  const loadCalendar = useCallback(async () => {
    if (!userId) return
    try {
      const res = await orchardApi.calendar(userId, calendarMonth.y, calendarMonth.m)
      if (res.code === 200 && res.data) setCalendarCells(res.data.cells)
    } catch (e) {
      console.error('[Orchard] calendar 加载失败:', e)
    }
  }, [userId, calendarMonth])

  const loadShareInfo = useCallback(async () => {
    if (!userId) return
    try {
      const res = await orchardApi.shareInfo(userId)
      if (res.code === 200 && res.data) setShareInfo(res.data)
    } catch (e) {
      console.error('[Orchard] shareInfo 加载失败:', e)
    }
  }, [userId])

  // 拉取果园全部数据（档案 + 日历 + 分享信息 + 助力结算）
  const loadAll = useCallback((uid: string) => {
    loadProfile()
    loadCalendar()
    loadShareInfo()
    orchardApi.settleHelps(uid).then((r) => {
      if (r.data && r.data.settled > 0) {
        Taro.showToast({ title: `好友助力到账 +${r.data.droplets}g`, icon: 'none' })
        loadProfile()
      }
    }).catch(() => undefined)
  }, [loadProfile, loadCalendar, loadShareInfo])

  // 静默登录：登录成功后拿到 userId 再加载数据
  const initLogin = useCallback(() => {
    ensureLogin()
      .then((id) => {
        setUserId(id)
        setLoadError(false)
      })
      .catch((e) => {
        console.error('[Orchard] 静默登录失败:', e)
        setLoadError(true)
      })
  }, [])

  // 进入果园：未登录先静默登录，已登录直接拉数据
  useDidShow(() => {
    if (!userId) {
      initLogin()
      return
    }
    loadAll(userId)
  })

  // 静默登录成功后触发首次加载
  useEffect(() => {
    if (userId) loadAll(userId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  useEffect(() => { loadCalendar() }, [loadCalendar])

  /** 小程序分享卡片：邀请好友助力 */
  useShareAppMessage(() => {
    const name = profile?.nickname || Taro.getStorageSync('nick_name') || '好友'
    return {
      title: `快来帮 ${name} 浇水，一起种出真果树！`,
      path: `/pages/orchard-assist/index?from=${userId}&name=${encodeURIComponent(name)}`,
    }
  })

  const tree = profile?.tree
  const growth = tree?.growth ?? 0
  const fullGrowth = profile?.config.treeFullGrowth ?? 1500
  const thresholds = tree?.stageThresholds?.length === 6 ? tree.stageThresholds : FALLBACK_THRESHOLDS
  const stage = tree?.stage ?? 0
  const stageImage = tree?.stageImage || ''
  const stageImages = tree?.stageImages || []
  const stageName = tree?.stageName || STAGE_NAMES[stage] || ''
  const isMature = tree?.isMature ?? false
  const isTodayWatered = tree?.wateredToday ?? false
  const nextThreshold = thresholds[Math.min(5, stage + 1)]
  const toNextStage = Math.max(0, nextThreshold - growth)
  const nextStageName = tree?.nextStageName || STAGE_NAMES[Math.min(5, stage + 1)] || ''

  const now = new Date()
  const dateStr = `${now.getMonth() + 1}月${now.getDate()}日 周${'日一二三四五六'[now.getDay()]}`
  const hour = now.getHours()
  const greeting = hour < 6 ? '夜深啦' : hour < 11 ? '早上好鸭' : hour < 14 ? '中午好鸭' : hour < 18 ? '下午好鸭' : '晚上好鸭'

  const showPlusG = (gained: number) => {
    setPlusG({ text: `+${gained}g`, key: Date.now() })
    setTimeout(() => setPlusG(null), 1500)
  }

  const handleDailyWater = async () => {
    if (!userId || watering) return
    if (isTodayWatered) {
      Taro.showToast({ title: '今天已经浇过水啦，明天再来～', icon: 'none' })
      return
    }
    setWatering(true)
    try {
      const res = await orchardApi.dailyWater(userId)
      if (res.biz_code === 0 && res.data) {
        showPlusG(res.data.gained)
        setLastWater({ gained: res.data.gained, streak: res.data.streak, becameMature: res.data.becameMature })
        loadProfile(); loadCalendar()
      } else {
        Taro.showToast({ title: res.msg || '浇水失败', icon: 'none' })
      }
    } catch (e) {
      Taro.showToast({ title: '网络异常，请重试', icon: 'none' })
    } finally {
      setWatering(false)
    }
  }

  const handleClaimMeal = async (slot: 'morning' | 'noon' | 'evening') => {
    if (!userId) return
    try {
      const res = await orchardApi.claimMeal(userId, slot)
      if (res.biz_code === 0 && res.data) {
        showPlusG(res.data.gained)
        setLastWater({ gained: res.data.gained, streak: tree?.currentStreak ?? 0, becameMature: res.data.becameMature })
        loadProfile()
      } else {
        Taro.showToast({ title: res.msg || '领取失败', icon: 'none' })
      }
    } catch (e) {
      Taro.showToast({ title: '网络异常，请重试', icon: 'none' })
    }
  }

  const handleHarvest = async () => {
    if (!userId) return
    try {
      const res = await orchardApi.harvest(userId)
      if (res.biz_code === 0 && res.data) {
        setShowHarvest(false)
        setHarvestResult({ treeIndex: res.data.treeIndex, availableTrees: res.data.availableTrees })
        loadProfile()
      } else {
        Taro.showToast({ title: res.msg || '收获失败', icon: 'none' })
      }
    } catch (e) {
      Taro.showToast({ title: '网络异常，请重试', icon: 'none' })
    }
  }

  const handleMakeup = async (method: 'card' | 'points') => {
    if (!userId || !makeupDate) return
    try {
      const res = await orchardApi.rewater(userId, makeupDate, method)
      if (res.biz_code === 0) {
        Taro.showToast({ title: method === 'card' ? '已使用补浇卡补浇成功 🌱' : '积分补浇成功', icon: 'none' })
        setMakeupDate(null)
        loadProfile(); loadCalendar()
      } else {
        Taro.showToast({ title: res.msg || '补浇失败', icon: 'none' })
      }
    } catch (e) {
      Taro.showToast({ title: '网络异常，请重试', icon: 'none' })
    }
  }

  const hintText = isMature
    ? '🎉 果树成熟啦，快点上方按钮收获优惠券！'
    : toNextStage > 0
      ? `再浇 ${toNextStage}g 就能升级「${STAGE_EMOJIS[Math.min(5, stage + 1)]} ${nextStageName}」啦`
      : '继续浇水，让小树快快长大～'

  const meals = profile?.meals

  // 加载失败兜底：提供重试入口，避免页面假死
  if (loadError && !profile) {
    return (
      <View className="min-h-screen flex flex-col items-center justify-center px-8" style={{ backgroundColor: '#F9FAFB' }}>
        <Text style={{ fontSize: 56 }}>🌳</Text>
        <Text className="block text-base font-bold mt-4" style={{ color: '#374151' }}>果园加载失败</Text>
        <Text className="block text-sm mt-2 text-center" style={{ color: '#9CA3AF' }}>网络似乎开了个小差，请检查网络后重试</Text>
        <Button
          className="mt-6 rounded-full px-8"
          style={{ backgroundColor: '#FF4757', color: '#fff' }}
          onClick={() => { setLoadError(false); if (userId) { loadAll(userId) } else { initLogin() } }}
        >
          重新加载
        </Button>
      </View>
    )
  }

  return (
    <View className="min-h-screen pb-32" style={{ backgroundColor: '#F9FAFB' }}>
      {/* ============ 沉浸式果园舞台（融入膨胀团红金主题） ============ */}
      <View
        className="relative overflow-hidden px-4 pt-12 pb-6"
        style={{ background: 'linear-gradient(180deg, #FF4757 0%, #FF6B6B 38%, #FFA07A 62%, #FFE5EC 88%, #F9FAFB 100%)' }}
      >
        {/* 天气 + 云朵装饰 */}
        <View style={{ position: 'absolute', top: 4, right: 8, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Text style={{ fontSize: 40 }}>{hour >= 6 && hour < 18 ? '☀️' : '🌙'}</Text>
        </View>
        <Text style={{ position: 'absolute', top: 8, left: 12, fontSize: 32, opacity: 0.9 }}>☁️</Text>
        <Text style={{ position: 'absolute', top: 4, right: 88, fontSize: 24, opacity: 0.6 }}>☁️</Text>
        <Text style={{ position: 'absolute', top: 16, left: '54%', fontSize: 22 }}>🎈</Text>

        {/* 头部：问候 + 数据胶囊 */}
        <View style={{ position: 'relative', display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View>
            <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
              <Text className="text-xs font-bold" style={{ color: 'rgba(255,255,255,0.85)', letterSpacing: 2 }}>MY ORCHARD</Text>
              <View className="rounded-full px-2 py-1 ml-2" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
                <Text className="text-xs font-bold" style={{ color: 'rgba(255,255,255,0.8)' }}>{dateStr}</Text>
              </View>
            </View>
            <Text className="block text-2xl font-black mt-1" style={{ color: '#fff', textShadow: '0 2px 8px rgba(194,24,51,0.45)' }}>
              {greeting}，来给果树{'\n'}浇水吧！
            </Text>
          </View>
          <View style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', paddingTop: 4 }}>
            <View className="rounded-full px-3 py-1 mb-1" style={{ backgroundColor: 'rgba(255,255,255,0.9)', display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
              <Text className="text-sm">💧</Text>
              <Text className="text-sm font-black ml-1" style={{ color: '#FF4757' }}>{growth}g</Text>
            </View>
            <View className="rounded-full px-3 py-1" style={{ backgroundColor: 'rgba(255,255,255,0.9)', display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
              <Text className="text-sm">🪙</Text>
              <Text className="text-sm font-black ml-1" style={{ color: '#F59E0B' }}>{profile?.points ?? 0}</Text>
            </View>
          </View>
        </View>

        {/* 贴纸徽章行 */}
        <View style={{ position: 'relative', marginTop: 12, display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
          <View className="rounded-full px-3 py-1" style={{ backgroundColor: 'rgba(255,255,255,0.95)' }}>
            <Text className="text-xs font-black" style={{ color: '#FF4757' }}>🌳 第 {(tree?.harvested ?? 0) + 1} 棵</Text>
          </View>
          <View className="rounded-full px-3 py-1 ml-2" style={{ background: 'linear-gradient(135deg,#FFA502,#F97316)' }}>
            <Text className="text-xs font-black text-white">{STAGE_EMOJIS[stage]} {stageName}</Text>
          </View>
          <View className="rounded-full px-3 py-1 ml-auto" style={{ background: 'linear-gradient(135deg,#FBBF24,#F97316)' }}>
            <Text className="text-xs font-black text-white">🔥 连浇 {tree?.currentStreak ?? 0} 天</Text>
          </View>
        </View>

        {/* 果树舞台 */}
        <View className="relative mt-1" style={{ height: 320 }}>
          {/* 暖金地面（融入膨胀团金色调） */}
          <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 56 }}>
            <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 44, background: 'linear-gradient(180deg, rgba(255,213,140,0) 0%, rgba(255,183,77,0.5) 45%, rgba(255,165,2,0.75) 100%)', borderRadius: '50% 50% 0 0 / 60% 60% 0 0' }} />
            <Text style={{ position: 'absolute', bottom: 6, left: 24, fontSize: 20 }}>🌼</Text>
            <Text style={{ position: 'absolute', bottom: 8, right: 32, fontSize: 20 }}>🌷</Text>
            <Text style={{ position: 'absolute', bottom: 2, left: '30%', fontSize: 16 }}>🍀</Text>
            <Text style={{ position: 'absolute', bottom: 12, right: '26%', fontSize: 16 }}>🐝</Text>
          </View>

          {/* 左贴纸：已浇水滴 */}
          <View className="bg-white rounded-2xl px-3 py-2" style={{ position: 'absolute', left: 0, top: 56, border: '2px solid #fecdd3', boxShadow: '0 10px 24px -10px rgba(255,71,87,0.45)', transform: 'rotate(-3deg)' }}>
            <Text className="block text-xs font-black" style={{ color: '#fb7185', letterSpacing: 1 }}>已浇水滴</Text>
            <Text className="block text-2xl font-black mt-1" style={{ color: '#FF4757' }}>{growth}<Text className="text-xs" style={{ color: '#fb7185' }}>g</Text></Text>
          </View>

          {/* 右贴纸：距升级 */}
          <View className="bg-white rounded-2xl px-3 py-2" style={{ position: 'absolute', right: 0, top: 56, border: '2px solid #fde68a', boxShadow: '0 10px 24px -10px rgba(249,115,22,0.45)', transform: 'rotate(3deg)' }}>
            <Text className="block text-xs font-black text-right" style={{ color: '#f97316', letterSpacing: 1 }}>距升级</Text>
            {isMature ? (
              <Text className="block text-sm font-black mt-1" style={{ color: '#d97706' }}>🌟 已成熟</Text>
            ) : (
              <Text className="block text-2xl font-black mt-1" style={{ color: '#f97316' }}>{toNextStage}<Text className="text-xs" style={{ color: '#fb923c' }}>g</Text></Text>
            )}
          </View>

          {/* 果树（芭芭农场风格树图，按阶段变大） */}
          <View style={{ position: 'absolute', bottom: 112, left: 0, right: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {stageImage ? (
              <Image
                src={stageImage}
                mode="aspectFit"
                style={{
                  width: 172 + stage * 12,
                  height: 172 + stage * 12,
                  borderRadius: '50%',
                  border: '3px solid rgba(255,255,255,0.95)',
                  backgroundColor: '#E8F7E9',
                  boxShadow: '0 14px 30px -12px rgba(194,24,51,0.45)',
                }}
              />
            ) : (
              <Text style={{ fontSize: 64 + stage * 16, lineHeight: '1.1' }}>{STAGE_EMOJIS[stage]}</Text>
            )}
            {plusG && (
              <Text key={plusG.key} style={{ position: 'absolute', top: 0, left: '50%', fontSize: 28, fontWeight: 900, color: '#FF4757', textShadow: '0 2px 0 #fff, 0 4px 10px rgba(255,71,87,0.4)' }}>
                {plusG.text}
              </Text>
            )}
            {isMature && (
              <View
                className="rounded-full px-4 py-2"
                style={{ position: 'absolute', top: -8, left: '50%', transform: 'translateX(-50%)', background: 'linear-gradient(135deg,#FBBF24,#F97316)', boxShadow: '0 8px 20px -6px rgba(249,115,22,0.6)' }}
                onClick={() => setShowHarvest(true)}
              >
                <Text className="text-xs font-black text-white">🎁 点击收获优惠券</Text>
              </View>
            )}
          </View>

          {/* 浇水按钮：融入舞台，红橙渐变（膨胀团主色） */}
          <View style={{ position: 'absolute', bottom: 14, left: 0, right: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <View
              style={{
                width: 92, height: 92, borderRadius: 46, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                background: isTodayWatered ? 'linear-gradient(135deg,#4ade80,#16a34a)' : 'linear-gradient(135deg,#FF4757 0%,#FFA502 100%)',
                boxShadow: isTodayWatered ? '0 12px 26px -8px rgba(22,163,74,0.55)' : '0 12px 26px -8px rgba(255,71,87,0.6)',
                border: '3px solid rgba(255,255,255,0.9)',
                opacity: watering ? 0.8 : 1,
              }}
              onClick={handleDailyWater}
            >
              <Text style={{ fontSize: 26, lineHeight: '1' }}>{isTodayWatered ? '✅' : '💧'}</Text>
              <Text className="text-sm font-black text-white mt-1">{isTodayWatered ? '已浇水' : watering ? '浇水中…' : '浇水'}</Text>
              <Text className="text-xs font-bold" style={{ color: 'rgba(255,255,255,0.9)' }}>{isTodayWatered ? '明天再来' : `+${profile?.config.dailyWater ?? 20}g`}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* 浇水提示（紧贴舞台，同页面底色无割裂） */}
      <View className="flex flex-col items-center px-4 mt-1">
        <Text className="block text-xs font-bold" style={{ color: '#78716c' }}>
          {isTodayWatered ? '今天的水滴已到账，去做任务继续攒水吧 👉' : `每天第一次浇水 +${profile?.config.dailyWater ?? 20}g，点上方按钮浇树～`}
        </Text>
      </View>

      {/* ============ 成长里程碑轨道 ============ */}
      <View className="px-4 mt-5">
        <View className="bg-white rounded-3xl px-4 pt-4 pb-4" style={{ boxShadow: '0 8px 24px -12px rgba(0,0,0,0.12)' }}>
          <View style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text className="text-xs font-black" style={{ color: 'rgba(255,71,87,0.7)', letterSpacing: 2 }}>成长进度</Text>
            <Text className="text-xs font-black" style={{ color: '#FF4757' }}>{growth}<Text style={{ color: '#FFA502' }}>/{fullGrowth}g</Text></Text>
          </View>
          <View className="relative mx-3 mt-5" style={{ height: 62 }}>
            <View style={{ position: 'absolute', left: 0, right: 0, top: 15, height: 10, borderRadius: 5, backgroundColor: '#f5f5f4' }} />
            <View style={{ position: 'absolute', left: 0, top: 15, height: 10, borderRadius: 5, width: `${trackFillPct(growth, thresholds)}%`, background: 'linear-gradient(90deg,#FF4757 0%,#FFA502 60%,#FBBF24 100%)' }} />
            {thresholds.map((th, i) => {
              const pct = (i / (thresholds.length - 1)) * 100
              const reached = growth >= th
              const isNext = !reached && (i === 0 || growth >= thresholds[i - 1])
              const nodeImg = stageImages[i]
              return (
                <View key={i} style={{ position: 'absolute', top: 0, left: `${pct}%`, transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <View
                    style={{
                      width: 32, height: 32, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                      backgroundColor: reached || isNext ? '#fff' : '#fafaf9',
                      border: reached ? '2px solid #FF4757' : isNext ? '2px solid #FFA502' : '2px solid #e7e5e4',
                      opacity: reached || isNext ? 1 : 0.6,
                    }}
                  >
                    {nodeImg ? (
                      <Image src={nodeImg} mode="aspectFill" style={{ width: 26, height: 26 }} />
                    ) : (
                      <Text className="text-sm">{STAGE_EMOJIS[i]}</Text>
                    )}
                  </View>
                  <Text className="text-xs font-black mt-1" style={{ color: reached ? '#FF4757' : isNext ? '#d97706' : '#a8a29e', fontSize: 10 }}>{th}g</Text>
                </View>
              )
            })}
          </View>
          <Text className="block text-center text-xs font-bold mt-3" style={{ color: '#78716c' }}>{hintText}</Text>
        </View>
      </View>

      {/* ============ 三餐领水 ============ */}
      <View className="px-4 mt-5">
        <SectionTitle emoji="🍱" title="干饭领水滴" subtitle={`一日三餐 · 每顿 +${profile?.config.mealWater ?? 10}g`} />
        <View style={{ display: 'flex', flexDirection: 'row', gap: 10 }}>
          {meals?.slots.map((s) => {
            const claimed = meals.claimed[s.key]
            const active = meals.currentSlot === s.key && !claimed
            const meta = { morning: { g: 'linear-gradient(135deg,#FFA502,#F97316)' }, noon: { g: 'linear-gradient(135deg,#FF4757,#F43F5E)' }, evening: { g: 'linear-gradient(135deg,#FB7185,#FF4757)' } }[s.key]
            return (
              <View
                key={s.key}
                className="flex-1 rounded-3xl p-3 items-center"
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  background: active ? meta.g : claimed ? '#ecfdf5' : '#fff',
                  border: claimed ? '2px solid #a7f3d0' : '2px solid #f5f5f4',
                }}
                onClick={() => handleClaimMeal(s.key)}
              >
                <Text style={{ fontSize: 28 }}>{s.emoji}</Text>
                <Text className="block text-xs font-black mt-1" style={{ color: claimed ? '#047857' : active ? '#fff' : '#1c1917' }}>{s.label}</Text>
                <Text className="block text-xs font-bold mt-1" style={{ color: claimed ? '#34d399' : active ? 'rgba(255,255,255,0.9)' : '#78716c', fontSize: 10 }}>{s.range}</Text>
                <View className="rounded-full px-2 py-1 mt-2" style={{ backgroundColor: claimed ? '#10b981' : active ? 'rgba(255,255,255,0.25)' : '#f5f5f4' }}>
                  <Text className="text-xs font-black" style={{ color: claimed || active ? '#fff' : '#78716c', fontSize: 10 }}>
                    {claimed ? '已领 ✓' : active ? `领取 +${s.water}g` : '未到点'}
                  </Text>
                </View>
              </View>
            )
          })}
        </View>
      </View>

      {/* ============ 种植战绩 ============ */}
      <View className="px-4 mt-5" style={{ display: 'flex', flexDirection: 'row', gap: 12 }}>
        <View className="flex-1 bg-white rounded-3xl p-4 relative overflow-hidden" style={{ boxShadow: '0 8px 24px -12px rgba(0,0,0,0.12)' }}>
          <Text style={{ position: 'absolute', right: -6, top: -6, fontSize: 36, opacity: 0.15 }}>🌳</Text>
          <Text className="block text-xs font-black" style={{ color: 'rgba(255,71,87,0.7)', letterSpacing: 1 }}>已收获果树</Text>
          <Text className="block text-3xl font-black mt-1" style={{ color: '#FF4757' }}>{tree?.harvested ?? 0}<Text className="text-sm font-bold ml-1" style={{ color: '#fb7185' }}>棵</Text></Text>
          <Text className="block text-xs mt-1" style={{ color: '#78716c' }}>种成果树就能换券哦</Text>
        </View>
        <View className="flex-1 bg-white rounded-3xl p-4 relative overflow-hidden" style={{ boxShadow: '0 8px 24px -12px rgba(0,0,0,0.12)' }}>
          <Text style={{ position: 'absolute', right: -6, top: -6, fontSize: 36, opacity: 0.15 }}>🔥</Text>
          <Text className="block text-xs font-black" style={{ color: 'rgba(217,119,6,0.7)', letterSpacing: 1 }}>最长连浇</Text>
          <Text className="block text-3xl font-black mt-1" style={{ color: '#f59e0b' }}>{tree?.maxStreak ?? 0}<Text className="text-sm font-bold ml-1" style={{ color: '#fbbf24' }}>天</Text></Text>
          <Text className="block text-xs mt-1" style={{ color: '#78716c' }}>坚持浇水不断档～</Text>
        </View>
      </View>

      {/* ============ 浇水日历 ============ */}
      <View className="px-4 mt-5">
        <SectionTitle emoji="📅" title="浇水日历" subtitle="漏浇的日子点一下就能补" />
        <View className="bg-white rounded-3xl p-4" style={{ boxShadow: '0 8px 24px -12px rgba(0,0,0,0.12)' }}>
          <View style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text className="text-sm font-black" style={{ color: '#1c1917' }}>{calendarMonth.y} 年 {calendarMonth.m} 月</Text>
            <View style={{ display: 'flex', flexDirection: 'row', gap: 8 }}>
              <Text className="text-xs" style={{ color: '#FF4757' }} onClick={() => setCalendarMonth((p) => p.m === 1 ? { y: p.y - 1, m: 12 } : { y: p.y, m: p.m - 1 })}>◀ 上月</Text>
              <Text className="text-xs" style={{ color: '#FF4757' }} onClick={() => setCalendarMonth((p) => p.m === 12 ? { y: p.y + 1, m: 1 } : { y: p.y, m: p.m + 1 })}>下月 ▶</Text>
            </View>
          </View>
          <WaterCalendar cells={calendarCells} onSelectMissed={(date) => { if (date < todayStr()) setMakeupDate(date) }} />
        </View>
      </View>

      {/* ============ 快捷入口（任务/助力/领券/我的果园） ============ */}
      <View className="px-4 mt-5" style={{ display: 'flex', flexDirection: 'row', gap: 10 }}>
        {[
          { emoji: '📋', title: '做任务攒水', desc: '团购·分享·邀请', bg: 'linear-gradient(135deg,#FF4757,#F43F5E)', onClick: () => Taro.navigateTo({ url: '/pages/orchard-tasks/index' }) },
          { emoji: '🎟️', title: '领券中心', desc: '果树兑换满减券', bg: 'linear-gradient(135deg,#FFA502,#F97316)', onClick: () => Taro.navigateTo({ url: '/pages/orchard-coupons/index' }) },
          { emoji: '👤', title: '我的果园', desc: '战绩·明细·规则', bg: 'linear-gradient(135deg,#FB7185,#FF4757)', onClick: () => Taro.navigateTo({ url: '/pages/orchard-me/index' }) },
        ].map((it) => (
          <View key={it.title} className="flex-1 rounded-3xl p-3" style={{ background: it.bg }} onClick={it.onClick}>
            <Text className="block text-2xl">{it.emoji}</Text>
            <Text className="block text-sm font-black text-white mt-1">{it.title}</Text>
            <Text className="block mt-1" style={{ fontSize: 10, color: 'rgba(255,255,255,0.85)' }}>{it.desc}</Text>
          </View>
        ))}
      </View>
      <View className="px-4 mt-3">
        <View className="rounded-3xl p-4" style={{ background: 'linear-gradient(135deg,#fbbf24,#f97316)', display: 'flex', flexDirection: 'row', alignItems: 'center' }} onClick={() => setShowShare(true)}>
          <Text className="text-2xl">📤</Text>
          <View className="ml-3 flex-1">
            <Text className="block text-sm font-black text-white">邀请好友助力</Text>
            <Text className="block text-xs mt-1" style={{ color: 'rgba(255,255,255,0.85)' }}>好友点开分享卡片助力，你得补浇卡 🎫</Text>
          </View>
          <Text className="text-white font-black">›</Text>
        </View>
      </View>

      {/* ============ 玩法规则 ============ */}
      <View className="px-4 mt-5">
        <SectionTitle emoji="📖" title="玩法规则" />
        <View className="bg-white rounded-3xl p-4" style={{ boxShadow: '0 8px 24px -12px rgba(0,0,0,0.12)' }}>
          <Text className="block text-xs leading-relaxed" style={{ color: '#78716c' }}>1. 每日签到浇水 +{profile?.config.dailyWater ?? 20}g，水滴立即浇灌到当前果树；{'\n'}2. 三餐时段（7-9 / 12-14 / 19-21 点）各可领 {profile?.config.mealWater ?? 10}g 水滴；{'\n'}3. 完成任务（团购下单 / 分享好友）可继续获得水滴；{'\n'}4. 积分获取：小程序消费核销后返积分（1 元 = 1 积分），可在「积分兑换水滴」中兑换；{'\n'}5. 果树成长：{thresholds.map((th, i) => (th > 0 ? `${STAGE_NAMES[i]}(${th}g)` : STAGE_NAMES[i])).join('→')}；{'\n'}6. 成熟后收获果树入库，用库存果树兑换优惠券，兑换后重新种下一棵；{'\n'}7. 漏浇可补浇：补浇卡每周期限用 {profile?.config.cycleMakeupUseLimit ?? 5} 张，也可用 {profile?.config.makeupCostPoints ?? 50} 积分补浇。</Text>
        </View>
      </View>

      {/* 弹窗 */}
      <WaterResultModal
        visible={!!lastWater}
        gained={lastWater?.gained ?? 0}
        streak={lastWater?.streak ?? 0}
        becameMature={lastWater?.becameMature ?? false}
        onClose={() => setLastWater(null)}
        onGoHarvest={() => { setLastWater(null); setShowHarvest(true) }}
      />

      {/* 收获确认 */}
      {showHarvest && (
        <View style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 200, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowHarvest(false)}>
          <View className="bg-white rounded-3xl mx-6 w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <View className="flex flex-col items-center">
              <Text style={{ fontSize: 56 }}>🌟</Text>
              <Text className="block text-xl font-bold mt-3" style={{ color: '#1c1917' }}>收获这棵果树？</Text>
              <Text className="block text-sm mt-2 text-center" style={{ color: '#78716c' }}>收获后果树入库，可兑换优惠券，{'\n'}并开始种植下一棵</Text>
              <View className="w-full mt-5">
                <Button className="w-full rounded-full" style={{ backgroundColor: '#f97316' }} onClick={handleHarvest}>
                  <Text className="text-white font-semibold">🎁 确认收获</Text>
                </Button>
                <Button className="w-full rounded-full mt-2" variant="outline" onClick={() => setShowHarvest(false)}>
                  <Text className="font-semibold">再想想</Text>
                </Button>
              </View>
            </View>
          </View>
        </View>
      )}

      <HarvestModal
        visible={!!harvestResult}
        treeIndex={harvestResult?.treeIndex ?? 1}
        availableTrees={harvestResult?.availableTrees ?? 0}
        onClose={() => setHarvestResult(null)}
        onGoCoupons={() => { setHarvestResult(null); Taro.navigateTo({ url: '/pages/orchard-coupons/index' }) }}
      />

      <MakeupModal
        visible={!!makeupDate}
        date={makeupDate ?? ''}
        makeupCards={tree?.makeupCards ?? 0}
        makeupCostPoints={profile?.config.makeupCostPoints ?? 50}
        points={profile?.points ?? 0}
        cycleMakeupUsed={tree?.cycleMakeupUsed ?? 0}
        cycleMakeupUseLimit={profile?.config.cycleMakeupUseLimit ?? 5}
        onConfirm={handleMakeup}
        onClose={() => setMakeupDate(null)}
      />

      <ShareSheet
        visible={showShare}
        nickname={profile?.nickname ?? ''}
        helpedToday={shareInfo?.helpedToday ?? 0}
        inviteLimit={profile?.config.taskInviteLimit ?? 1}
        onClose={() => setShowShare(false)}
      />

      {/* 底部导航（首页/团团/我的） */}
      <AppTabBar current="/pages/tuantuan/index" />
    </View>
  )
}

function SectionTitle({ emoji, title, subtitle }: { emoji: string; title: string; subtitle?: string }) {
  return (
    <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
      <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
        <View className="bg-white rounded-2xl w-8 h-8 items-center justify-center" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px -6px rgba(0,0,0,0.1)' }}>
          <Text className="text-lg">{emoji}</Text>
        </View>
        <Text className="text-lg font-black ml-2" style={{ color: '#1c1917' }}>{title}</Text>
      </View>
      {subtitle ? <Text className="text-xs font-bold" style={{ color: '#78716c' }}>{subtitle}</Text> : null}
    </View>
  )
}
