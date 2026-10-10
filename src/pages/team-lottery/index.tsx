import { useState, useEffect, useMemo } from 'react'
import Taro, { useRouter, useShareAppMessage, useDidShow } from '@tarojs/taro'
import { View, Text, Image } from '@tarojs/components'
import { Network } from '@/network'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Crown, Gift, Users, Share2, Copy, Trophy, Sparkles, CircleAlert, ChevronRight, X } from 'lucide-react-taro'
import './index.css'

interface PrizeItem {
  id: string
  name: string
  probability: number
  image_url: string | null
  prize_type?: string
}

interface MerchantInfo {
  id: number
  name: string
  address: string | null
  phone: string | null
  logo: string | null
}

interface PackageInfo {
  id: string
  name: string
  description: string | null
  price: number
  original_price: number | null
  cover_image: string | null
}

interface Member {
  id: string
  user_id: string
  role: 'leader' | 'member'
  nick_name: string | null
  avatar_url: string | null
  joined_at: string
  drew_at: string | null
  is_winner: boolean
  prize_name: string | null
  prize_type?: string | null
  prize_image?: string | null
  redemption_code?: string | null
  refund_amount?: number | null
  discount_rate?: number | null
  discount_cap?: number | null
  product_name?: string | null
}

interface Group {
  id: string
  merchant_id: number
  package_id: string
  order_id: string
  leader_id: string
  status: 'active' | 'full' | 'expired' | 'drawed'
  invite_code: string
  expires_at: string
  created_at: string
  leader_prize_name: string | null
  leader_refunded?: boolean
  members: Member[]
  merchant?: MerchantInfo
  package?: PackageInfo
  leader_prize?: PrizeItem
  member_prizes?: PrizeItem[]
  leader_bonus_prizes?: PrizeItem[]
  leader_bonus_rate?: number
}

interface DrawResult {
  record_id: string
  is_winner: boolean
  prize_id?: string
  prize_name: string
  prize_type: 'coupon' | 'free_meal' | 'product'
  prize_image?: string
  redemption_code?: string
  refund_amount?: number
  refund_status?: string
  discount_rate?: number
  discount_cap?: number
  discount_capped?: boolean
  coupon_amount?: number
  coupon_min_spend?: number
  product_name?: string
  image_url?: string
  expiry_hours?: number
  expiry_date?: string
}

// 盲盒图（与普通抽奖一致，这里用 emoji/渐变块代替）
const BOX_COLORS = [
  ['#ff8a5c', '#ff5e62'],
  ['#ffd166', '#ff9f1c'],
  ['#6bcB77', '#4d96ff'],
  ['#f78fb3', '#c44569'],
  ['#786fa6', '#574b90'],
  ['#f8a5c2', '#cf6a87'],
  ['#63cdda', '#3dc1d3'],
  ['#f19066', '#e15f41'],
  ['#546de5', '#303952'],
]

export default function TeamLotteryPage() {
  const router = useRouter()
  const [packageId, setPackageId] = useState<string>('')
  const [inviteCode, setInviteCode] = useState<string>('')
  const [userId, setUserId] = useState<string>('')
  // 邀请链接场景下 merchant_id 会在拉到预览后动态设置为队伍的 merchant_id
  const [merchantId, setMerchantId] = useState<number>(0)

  const [teamStatus, setTeamStatus] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [orders, setOrders] = useState<any[]>([])
  const [group, setGroup] = useState<Group | null>(null)
  const [codeInput, setCodeInput] = useState('')
  const [creating, setCreating] = useState(false)
  const [joining, setJoining] = useState(false)
  const [toast, setToast] = useState('')
  // 邀请预览的错误态（邀请码无效/队伍已结束）
  const [previewError, setPreviewError] = useState<string>('')
  // 邀请链接预览：仅通过 invite_code 拉到的未加入队伍
  const [previewGroup, setPreviewGroup] = useState<Group | null>(null)

  // 盲盒抽奖状态机
  const [drawStage, setDrawStage] = useState<'idle' | 'select' | 'shaking' | 'bursting' | 'result'>('idle')
  const [selectedBox, setSelectedBox] = useState<number>(-1)
  const [drawResult, setDrawResult] = useState<DrawResult | null>(null)

  // 未登录点邀请链接/开团/入队的拦截提示
  const [loginTip, setLoginTip] = useState('')

  // 初始化：useDidShow 时统一读取 router.params，兼容 iOS 场景参数延迟到达
  useDidShow(() => {
    const params = router.params || ({} as Record<string, unknown>)
    const mid = Number((params as any).merchant_id || 0)
    const pid = String((params as any).package_id || '')
    const code = String((params as any).invite_code || '').toUpperCase()
    const uid = Taro.getStorageSync('user_id') || ''
    setPackageId(pid)
    setInviteCode(code)
    setMerchantId((prev) => {
      if (mid && !prev) return mid
      return prev
    })
    setUserId(uid)
  })

  // 邀请预览：只要 inviteCode 有值就独立触发（不依赖 userId/merchantId 等）
  useEffect(() => {
    if (!inviteCode) return
    let cancelled = false
    const run = async () => {
      setLoading(true)
      setPreviewError('')
      setPreviewGroup(null)
      try {
        const res = await Network.request({ url: `/api/team-lottery/groups/by-code/${inviteCode}` })
        console.log('[TeamLottery] invite preview', inviteCode, res.data)
        if (cancelled) return
        const preview = res.data?.data as Group | null
        if (!preview) {
          setPreviewError(res.data?.msg || '邀请码无效')
        } else {
          setPreviewGroup(preview)
          if (preview.merchant_id && !merchantId) {
            setMerchantId(preview.merchant_id)
          }
          // 如果当前用户已经在队伍里，直接展示队伍
          const uid = Taro.getStorageSync('user_id') || ''
          if (uid && preview.members?.some((m) => m.user_id === uid)) {
            setGroup(preview)
            setPreviewGroup(null)
          }
        }
      } catch (e: any) {
        if (!cancelled) setPreviewError(e?.message || '邀请链接无效')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inviteCode])

  // codeInput 跟随 inviteCode 同步
  useEffect(() => {
    if (inviteCode) setCodeInput(inviteCode)
  }, [inviteCode])

  // 店内组队加载：有 merchantId + userId 时触发（非邀请预览场景）
  useEffect(() => {
    const currentInviteCode = inviteCode
    const uid = userId
    const mid = merchantId
    if (!mid || !uid) return
    // 邀请链接且已经在队伍/预览中，loadAll 不重复覆盖
    if (currentInviteCode && group) return
    loadAll(uid)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [merchantId, userId])

  useShareAppMessage(() => {
    if (!group) {
      return {
        title: teamStatus?.share_title || '快来组队抽盲盒，人人有奖！',
        path: `/pages/team-lottery/index?merchant_id=${merchantId}${packageId ? `&package_id=${packageId}` : ''}`,
        imageUrl: teamStatus?.share_image_url || undefined,
      }
    }
    return {
      title: teamStatus?.share_title || '快来组队抽盲盒，满员即开奖！',
      path: `/pages/team-lottery/index?merchant_id=${merchantId}&package_id=${group.package_id}&invite_code=${group.invite_code}`,
      imageUrl: teamStatus?.share_image_url || undefined,
    }
  })

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  const requireLogin = (action: string): boolean => {
    if (userId) return true
    setLoginTip(action)
    return false
  }

  const goLogin = () => {
    // 登录后需要回到本页并保留参数（含 invite_code）
    const pages = Taro.getCurrentPages()
    const current = pages[pages.length - 1]
    const fullPath = `/${current?.route || 'pages/team-lottery/index'}?merchant_id=${merchantId}${packageId ? `&package_id=${packageId}` : ''}${inviteCode ? `&invite_code=${inviteCode}` : ''}`
    Taro.setStorageSync('login_redirect', fullPath)
    Taro.navigateTo({ url: '/pages/login/index' })
  }

  const loadAll = async (uid: string) => {
    // 仅店内开团/已有队伍的场景使用；邀请链接的预览已由独立 useEffect 处理
    if (!merchantId) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const [statusRes, ordersRes, myGroupsRes] = await Promise.all([
        Network.request({ url: `/api/team-lottery/merchants/${merchantId}/status${packageId ? `?package_id=${packageId}` : ''}` }),
        Network.request({ url: `/api/team-lottery/orders/${uid}/${merchantId}` }),
        Network.request({ url: `/api/team-lottery/my-groups/${uid}` }),
      ])
      console.log('[TeamLottery] status', statusRes.data)
      console.log('[TeamLottery] orders', ordersRes.data)
      console.log('[TeamLottery] myGroups', myGroupsRes.data)
      setTeamStatus(statusRes.data?.data || null)
      setOrders(ordersRes.data?.data || [])

      const groups: Group[] = myGroupsRes.data?.data || []
      const candidates = groups.filter(
        (g) => g.merchant_id === merchantId && g.status !== 'expired' && (!packageId || g.package_id === packageId),
      )
      const active = candidates.find((g) => g.status === 'active') || candidates[0]
      if (active) {
        await loadGroup(active.id, uid)
        // 已在队伍中则清除预览
        setPreviewGroup(null)
        setPreviewError('')
      }
    } catch (e: any) {
      // 静默：网络错误不阻塞页面渲染
      console.warn('[TeamLottery] loadAll error', e)
    } finally {
      setLoading(false)
    }
  }

  // 用户已登录且有邀请预览时，自动尝试加入队伍
  useEffect(() => {
    if (!userId || !previewGroup) return
    // 自己已经是成员则直接进队伍
    if (previewGroup.members?.some((m) => m.user_id === userId)) {
      setGroup(previewGroup)
      setPreviewGroup(null)
      return
    }
    // 已登录但还没进队伍：保持在预览页，用户点按钮再加入
  }, [userId, previewGroup])

  const handleJoinInvite = async () => {
    if (!previewGroup) return
    if (!requireLogin('请登录账号再入队')) return
    setJoining(true)
    try {
      const res = await Network.request({
        url: `/api/team-lottery/groups/${previewGroup.invite_code}/join`,
        method: 'POST',
        data: { user_id: userId },
      })
      console.log('[TeamLottery] join invite', res.data)
      if (res.data?.code === 200 && res.data?.data) {
        setGroup(res.data.data)
        setPreviewGroup(null)
        Taro.showToast({ title: '加入队伍成功', icon: 'success' })
      } else {
        const msg = res.data?.msg || '加入失败'
        Taro.showModal({
          title: '提示',
          content: msg,
          showCancel: msg.includes('订单') || msg.includes('购买') || msg.includes('套餐'),
          confirmText: msg.includes('订单') || msg.includes('购买') || msg.includes('套餐') ? '去购买' : '知道了',
          cancelText: '取消',
          success: (r) => {
            if (r.confirm && (msg.includes('订单') || msg.includes('购买') || msg.includes('套餐'))) {
              Taro.switchTab({ url: '/pages/index/index' })
            }
          },
        })
      }
    } catch (e: any) {
      const msg = e?.message || e?.response?.data?.msg || '加入失败'
      Taro.showModal({
        title: '提示',
        content: msg,
        showCancel: msg.includes('订单') || msg.includes('购买') || msg.includes('套餐'),
        confirmText: msg.includes('订单') || msg.includes('购买') || msg.includes('套餐') ? '去购买' : '知道了',
        cancelText: '取消',
        success: (r) => {
          if (r.confirm && (msg.includes('订单') || msg.includes('购买') || msg.includes('套餐'))) {
            Taro.switchTab({ url: '/pages/index/index' })
          }
        },
      })
    } finally {
      setJoining(false)
    }
  }

  const loadGroup = async (groupId: string, uid: string) => {
    try {
      const res = await Network.request({ url: `/api/team-lottery/groups/${groupId}?user_id=${uid}` })
      console.log('[TeamLottery] group detail', res.data)
      setGroup(res.data?.data || null)
    } catch (e) {
      console.warn('[TeamLottery] loadGroup error', e)
    }
  }

  const createGroup = async () => {
    if (!requireLogin('登录后才能开团哦')) return
    if (!orders.length) {
      showToast('暂无可用订单，购买套餐后即可开团')
      return
    }
    const order = orders[0]
    setCreating(true)
    try {
      const res = await Network.request({
        url: '/api/team-lottery/groups',
        method: 'POST',
        data: {
          merchant_id: merchantId,
          package_id: order.package_id,
          order_id: order.id,
          user_id: userId,
        },
      })
      console.log('[TeamLottery] create', res.data)
      if (res.data?.data) {
        setGroup(res.data.data)
        showToast('组队成功，快去邀请好友吧')
      } else {
        showToast(res.data?.msg || '创建失败')
      }
    } catch (e: any) {
      showToast(e?.message || '创建失败')
    } finally {
      setCreating(false)
    }
  }

  const joinByCode = async (code: string, uid: string, silent = false) => {
    const trimCode = String(code || '').trim().toUpperCase()
    if (!trimCode) {
      if (!silent) showToast('请输入邀请码')
      return
    }
    setJoining(true)
    try {
      const res = await Network.request({
        url: `/api/team-lottery/groups/${trimCode}/join`,
        method: 'POST',
        data: { user_id: uid },
      })
      console.log('[TeamLottery] join', res.data)
      if (res.data?.code === 200 && res.data?.data) {
        setGroup(res.data.data)
        if (!silent) showToast('加入队伍成功')
      } else {
        const msg = res.data?.msg || (res.data as any)?.message || '加入失败，请稍后重试'
        if (!silent) {
          Taro.showModal({
            title: '提示',
            content: msg,
            showCancel: msg.includes('订单') || msg.includes('购买') || msg.includes('套餐'),
            confirmText: msg.includes('订单') || msg.includes('购买') || msg.includes('套餐') ? '去购买' : '知道了',
            cancelText: '取消',
            success: (r) => {
              if (r.confirm && (msg.includes('订单') || msg.includes('购买') || msg.includes('套餐'))) {
                Taro.switchTab({ url: '/pages/index/index' })
              }
            },
          })
        }
      }
    } catch (e: any) {
      const msg = e?.message || '加入失败，请稍后重试'
      if (!silent) {
        Taro.showModal({
          title: '提示',
          content: msg,
          showCancel: msg.includes('订单') || msg.includes('购买') || msg.includes('套餐'),
          confirmText: msg.includes('订单') || msg.includes('购买') || msg.includes('套餐') ? '去购买' : '知道了',
          cancelText: '取消',
          success: (r) => {
            if (r.confirm && (msg.includes('订单') || msg.includes('购买') || msg.includes('套餐'))) {
              Taro.switchTab({ url: '/pages/index/index' })
            }
          },
        })
      }
    } finally {
      setJoining(false)
    }
  }

  // 点击"立即抽奖"：进入盲盒选择界面
  const onStartDraw = () => {
    if (!requireLogin('登录后才能抽奖')) return
    if (!group) return
    const me = group.members.find((m) => m.user_id === userId)
    if (!me || me.drew_at) {
      showToast('你已完成抽奖')
      return
    }
    if (group.status !== 'full') {
      showToast('队伍还未满员，邀请好友成团后再抽')
      return
    }
    if (group.leader_refunded) {
      showToast('团长订单已退款，队伍已解散')
      return
    }
    setSelectedBox(-1)
    setDrawResult(null)
    setDrawStage('select')
  }

  const onBoxClick = async (idx: number) => {
    if (drawStage !== 'select' || !group) return
    setSelectedBox(idx)
    setDrawStage('shaking')
    // 轻微震动反馈
    Taro.vibrateShort && Taro.vibrateShort({ type: 'medium' })

    // 调用后端抽奖（动画期间同时请求，并行）
    const requestPromise = (async () => {
      try {
        const res = await Network.request({
          url: `/api/team-lottery/groups/${group.id}/draw`,
          method: 'POST',
          data: { user_id: userId },
        })
        console.log('[TeamLottery] draw', res.data)
        if (res.data?.data) {
          return res.data.data as DrawResult
        }
        throw new Error(res.data?.msg || (res.data as any)?.message || '抽奖失败')
      } catch (e: any) {
        throw new Error(e?.message || e?.response?.data?.message || '抽奖失败')
      }
    })()

    // 震动 ~1.2s
    await new Promise((r) => setTimeout(r, 1200))
    setDrawStage('bursting')

    try {
      const [result] = await Promise.all([
        requestPromise,
        new Promise((r) => setTimeout(r, 850)), // 爆开动画
      ])
      setDrawResult(result)
      await loadGroup(group.id, userId)
      setDrawStage('result')
    } catch (e: any) {
      setDrawStage('idle')
      setSelectedBox(-1)
      showToast(e?.message || '抽奖失败')
    }
  }

  const closeDrawResult = () => {
    setDrawStage('idle')
    setSelectedBox(-1)
    setDrawResult(null)
  }

  const copyCode = () => {
    if (!group?.invite_code) return
    Taro.setClipboardData({
      data: group.invite_code,
      success: () => {
        Taro.setStorageSync('last_copied_invite_code', group.invite_code)
        Taro.setStorageSync('last_copied_invite_code_at', Date.now())
        showToast(`已复制邀请码 ${group.invite_code}`)
      },
    })
  }

  const pasteCode = async () => {
    try {
      const lastCopied = String(Taro.getStorageSync('last_copied_invite_code') || '').trim().toUpperCase()
      const lastCopiedAt = Number(Taro.getStorageSync('last_copied_invite_code_at') || 0)
      if (lastCopied && Date.now() - lastCopiedAt < 30_000) {
        setCodeInput(lastCopied.slice(0, 8))
        showToast(`已粘贴邀请码 ${lastCopied}`)
        return
      }
      const { data } = await Taro.getClipboardData()
      const code = String(data || '').trim().toUpperCase()
      if (code) {
        setCodeInput(code.slice(0, 8))
        showToast(`已粘贴邀请码 ${code.slice(0, 8)}`)
        return
      }
      if (lastCopied) {
        setCodeInput(lastCopied.slice(0, 8))
        showToast(`已粘贴邀请码 ${lastCopied}`)
        return
      }
      showToast('剪贴板为空，请先复制邀请码')
    } catch {
      showToast('读取剪贴板失败，请手动输入')
    }
  }

  // 当前登录用户在队伍中的成员
  const me = useMemo(() => group?.members.find((m) => m.user_id === userId) || null, [group, userId])
  const teamFailed = !!group?.leader_refunded || group?.status === 'expired'
  const canDraw = group && !teamFailed && group.status === 'full' && me && !me.drew_at
  const alreadyDrewPrize = me?.drew_at ? me : null
  // 当前展示的队伍：已加入的队伍优先，否则展示邀请预览
  const displayGroup = group || previewGroup
  const isPreviewMode = !group && !!previewGroup

  if (loading) {
    return (
      <View className="min-h-screen bg-gradient-to-b from-[#FF6B1A] to-[#ffb347] p-4">
        <Skeleton className="h-48 w-full rounded-2xl mb-4" />
        <Skeleton className="h-32 w-full rounded-2xl mb-4" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </View>
    )
  }

  // 未开启活动：非邀请链接场景才展示；邀请链接即使未启用也先看到队伍再提示
  if (!teamStatus?.enabled && !previewGroup && !inviteCode && !previewError) {
    return (
      <View className="min-h-screen bg-gradient-to-b from-[#FF6B1A] to-[#ffb347] flex items-center justify-center p-6">
        <Card className="w-full rounded-2xl border-0 shadow-xl">
          <CardContent className="p-8 text-center">
            <CircleAlert size={48} color="#FF6B1A" className="mx-auto mb-4" />
            <Text className="block text-lg font-bold text-gray-900 mb-2">该商家暂未开启组队盲盒</Text>
            <Text className="block text-sm text-gray-500 mb-6">去看看其他优惠活动吧</Text>
            <Button onClick={() => Taro.navigateBack()} className="w-full bg-[#FF6B1A] text-white rounded-full">
              返回
            </Button>
          </CardContent>
        </Card>
      </View>
    )
  }

  // 邀请码无效/队伍已结束：给出提示但仍可手动输入邀请码
  const showInviteInvalid = inviteCode && previewError && !previewGroup && !group

  return (
    <View className="min-h-screen bg-gradient-to-b from-[#FF6B1A] via-[#ff8a29] to-[#ffe8c8] p-4 pb-24">
      {/* 未登录提示：仅在非邀请预览场景才弹遮罩；邀请预览的登录按钮在卡片内 */}
      {!userId && !isPreviewMode && (
        <View className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 px-6">
          <View className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl">
            <Text className="block text-center text-lg font-extrabold text-gray-900 mb-2">未登录账号</Text>
            <Text className="block text-center text-sm text-gray-500 mb-5 leading-6">
              {loginTip || '请先登录后再参与组队盲盒抽大奖'}
            </Text>
            <Button onClick={goLogin} className="w-full clay-btn text-white font-bold h-12 rounded-full">
              立即登录
            </Button>
            <View onClick={() => { setLoginTip(''); Taro.navigateBack({ delta: 1, fail() {} }) }} className="mt-3 text-center">
              <Text className="text-sm text-gray-400">返回</Text>
            </View>
          </View>
        </View>
      )}

      {/* 顶部活动区 */}
      <View className="pt-6 pb-4 text-center">
        <View className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white bg-opacity-25 mb-3 overflow-hidden">
          {teamStatus?.logo_image_url ? (
            <Image src={teamStatus?.logo_image_url} className="w-full h-full" mode="aspectFill" />
          ) : (
            <Gift size={36} color="#ffffff" />
          )}
        </View>
        <Text className="clay-title block text-3xl mb-2">{isPreviewMode ? '好友组队邀请' : '组队抽盲盒'}</Text>
        {showInviteInvalid && (
          <Text className="block text-white text-sm font-semibold">邀请链接无效，可使用下方邀请码入队</Text>
        )}
        {!showInviteInvalid && (
          <Text className="block text-white text-opacity-95 text-sm font-semibold">
            {isPreviewMode
              ? `${displayGroup?.members.length || 1} 位好友已在队中，点击加入即可成团`
              : `满 ${teamStatus?.team_size || 2} 人成团 · 队长皇冠加成 · 人人可抽`}
          </Text>
        )}
      </View>

      {/* 队伍卡片 */}
      {displayGroup && (() => {
        const g = displayGroup
        const previewFailed = isPreviewMode && g.status !== 'active'
        return (
        <Card className="clay-card border-0 mb-4 overflow-hidden">
          <CardContent className="p-5">
            <View className="flex items-center justify-between mb-4">
              <View className="flex items-center gap-2">
                <Users size={20} color="#c8410e" />
                <Text className="block text-base font-extrabold text-[#5b2a0c]">
                  {isPreviewMode ? '好友邀请你加入队伍' : '我的队伍'}
                </Text>
              </View>
              <View
                className={`px-3 py-1 rounded-full ${
                  previewFailed
                    ? 'bg-gray-200'
                    : isPreviewMode
                    ? 'bg-blue-100'
                    : teamFailed
                    ? 'bg-gray-200'
                    : g.status === 'drawed'
                    ? 'bg-green-100'
                    : g.status === 'full'
                    ? 'bg-amber-100'
                    : 'bg-orange-100'
                }`}
              >
                <Text
                  className={`block text-xs font-bold ${
                    previewFailed
                      ? 'text-gray-600'
                      : isPreviewMode
                      ? 'text-blue-700'
                      : teamFailed
                      ? 'text-gray-600'
                      : g.status === 'drawed'
                      ? 'text-green-700'
                      : g.status === 'full'
                      ? 'text-amber-700'
                      : 'text-orange-700'
                  }`}
                >
                  {previewFailed
                    ? '队伍已结束'
                    : isPreviewMode
                    ? '等待加入'
                    : teamFailed
                    ? '组队失败'
                    : g.status === 'active'
                    ? '组队中'
                    : g.status === 'full'
                    ? '已满员，快去抽盲盒'
                    : '已开奖'}
                </Text>
              </View>
            </View>

            {/* 成员：头像 + 昵称（团长带皇冠角标） */}
            <View className="flex flex-row items-start justify-center gap-3 mb-5 flex-wrap">
              {Array.from({ length: Math.max(teamStatus?.team_size || 0, g.members.length, 2) }).map((_, idx) => {
                const member = g.members[idx]
                const displayName = member?.nick_name ? (member.nick_name.length > 5 ? member.nick_name.slice(0, 5) + '…' : member.nick_name) : (member ? '微信用户' : '等待加入')
                const initial = displayName.slice(0, 1)
                const isLeader = member?.role === 'leader'
                const isMe = member?.user_id === userId
                return (
                  <View key={idx} className="flex flex-col items-center w-16">
                    <View className="relative w-14 h-14">
                      <View className="w-14 h-14 rounded-full bg-gradient-to-br from-orange-100 to-amber-100 border-[3px] border-white shadow-md overflow-hidden flex items-center justify-center">
                        {member?.avatar_url ? (
                          <Image src={member.avatar_url} className="w-full h-full" mode="aspectFill" />
                        ) : (
                          <Text className="block text-lg font-bold text-[#c8410e]">{member ? initial : '?'}</Text>
                        )}
                      </View>
                      {isLeader && (
                        <View className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-gradient-to-br from-yellow-300 to-amber-500 flex items-center justify-center shadow-md border-2 border-white">
                          <Crown size={12} color="#ffffff" />
                        </View>
                      )}
                      {member?.is_winner && member.drew_at && (
                        <View className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-2 py-[1px] rounded-full bg-red-500">
                          <Text className="block text-[10px] text-white font-bold">中奖</Text>
                        </View>
                      )}
                    </View>
                    <Text className={`block mt-1 text-xs font-semibold truncate max-w-full ${isMe ? 'text-[#c8410e]' : 'text-[#5b2a0c]'}`}>
                      {displayName}{isMe ? '(我)' : ''}
                    </Text>
                  </View>
                )
              })}
            </View>

            {/* 预览模式：未加入队伍 */}
            {isPreviewMode && !previewFailed && (
              <View className="bg-blue-50 rounded-2xl p-4 mb-4">
                <Text className="block text-sm text-blue-700 text-center font-semibold mb-3">
                  队伍还差 {Math.max(0, (teamStatus?.team_size || g.members.length + 1) - g.members.length)} 人成团，加入即可一起抽盲盒
                </Text>
                {!userId ? (
                  <Button
                    onClick={goLogin}
                    className="w-full clay-btn h-12 text-base font-extrabold text-white rounded-full"
                  >
                    登录账号并加入
                  </Button>
                ) : orders.length > 0 ? (
                  <Button
                    onClick={handleJoinInvite}
                    disabled={joining}
                    className="w-full clay-btn h-12 text-base font-extrabold text-white rounded-full"
                  >
                    {joining ? '加入中...' : '🎁 加入队伍'}
                  </Button>
                ) : (
                  <Button
                    onClick={() => {
                      if (packageId) {
                        Taro.navigateTo({ url: `/pages/package-detail/index?id=${packageId}` })
                      } else {
                        Taro.showToast({ title: '请先购买对应套餐', icon: 'none' })
                      }
                    }}
                    className="w-full bg-[#FF6B1A] text-white rounded-full h-12 text-base font-extrabold"
                  >
                    购买套餐后加入
                  </Button>
                )}
              </View>
            )}

            {/* 组队失败提示 */}
            {(teamFailed || previewFailed) && (
              <View className="bg-gray-100 rounded-2xl p-4 mb-4 text-center">
                <Text className="block text-sm text-gray-500 font-semibold">
                  {previewFailed
                    ? (g.status === 'expired' ? '该队伍已过期' : g.leader_refunded ? '团长已退款，队伍已解散' : '该队伍已结束开奖')
                    : teamFailed
                    ? (g.leader_refunded ? '团长已退款，队伍自动解散' : `超过 ${teamStatus?.duration_hours || 24} 小时未成团，队伍已解散`)
                    : ''}
                </Text>
              </View>
            )}

            {/* 邀请码（仅我加入的队伍 + 组队中显示，标注为备用方式） */}
            {!isPreviewMode && g.status === 'active' && !teamFailed && (
              <View className="bg-orange-50 rounded-2xl p-4 mb-4">
                <Text className="block text-xs text-orange-500 mb-1 text-center font-semibold">
                  备用方式：邀请码
                </Text>
                <View className="flex flex-row items-center justify-center gap-3">
                  <Text className="block text-2xl font-extrabold text-[#c8410e] tracking-widest">
                    {g.invite_code}
                  </Text>
                  <View onClick={copyCode} className="p-2 bg-white rounded-full shadow-sm">
                    <Copy size={16} color="#c8410e" />
                  </View>
                </View>
              </View>
            )}

            {/* 团长奖品提示 */}
            {g.leader_prize_name && !teamFailed && !previewFailed && (
              <View className="flex items-center gap-2 bg-amber-50 rounded-xl p-3 mb-4">
                <Trophy size={18} color="#d97706" />
                <Text className="block text-sm text-amber-700">
                  团长专属：<Text className="font-bold">{g.leader_prize_name}</Text>
                </Text>
              </View>
            )}

            {/* 抽奖按钮 / 已开奖信息（仅已加入队伍时显示） */}
            {!isPreviewMode && !teamFailed && (
              <View className="text-center">
                {canDraw ? (
                  <Button
                    onClick={onStartDraw}
                    className="clay-btn w-full h-14 text-lg font-extrabold text-white rounded-full clay-btn-waiting"
                  >
                    🎁 立即抽盲盒
                  </Button>
                ) : alreadyDrewPrize ? (
                  <View className="bg-gradient-to-r from-amber-100 to-orange-100 rounded-2xl p-4">
                    <Text className="block text-sm font-bold text-[#c8410e]">
                      {alreadyDrewPrize.is_winner
                        ? `🎉 恭喜抽中：${alreadyDrewPrize.prize_name || '奖品'}`
                        : '谢谢参与～'}
                    </Text>
                    {alreadyDrewPrize.redemption_code && (
                      <Text className="block text-xs text-amber-700 mt-1">核销码：{alreadyDrewPrize.redemption_code}</Text>
                    )}
                    {alreadyDrewPrize.refund_amount && Number(alreadyDrewPrize.refund_amount) > 0 && (
                      <Text className="block text-xs text-red-600 mt-1">已原路退款 ¥{Number(alreadyDrewPrize.refund_amount).toFixed(2)}</Text>
                    )}
                  </View>
                ) : g.status === 'active' ? (
                  <View className="bg-orange-50 rounded-full py-3 px-4">
                    <Text className="block text-sm font-semibold text-orange-700 text-center">
                      还差 {Math.max(0, (teamStatus?.team_size || 2) - g.members.length)} 人成团，分享给好友一起来抽
                    </Text>
                  </View>
                ) : null}
              </View>
            )}

            {/* 分享按钮（我的队伍 + 组队中显示） */}
            {!isPreviewMode && g.status === 'active' && !teamFailed && (
              <View className="mt-4">
                <Button
                  openType="share"
                  className="w-full bg-[#FF6B1A] text-white rounded-full h-12 text-base font-extrabold border-0"
                >
                  <View className="flex flex-row items-center justify-center gap-2">
                    <Share2 size={18} color="#ffffff" />
                    <Text className="block text-white font-bold">邀请好友组队</Text>
                  </View>
                </Button>
              </View>
            )}
          </CardContent>
        </Card>
        )
      })()}

      {/* 开团/加入入口：无队伍 或 队伍已开奖/失败 且 不在邀请预览中 */}
      {!isPreviewMode && (!group || teamFailed || group.status === 'drawed') && (
        <>
          <Card className="clay-card border-0 mb-4">
            <CardContent className="p-5">
              <View className="flex items-center gap-3 mb-3">
                <Sparkles size={22} color="#c8410e" />
                <Text className="block text-base font-extrabold text-[#5b2a0c]">开团当队长</Text>
              </View>
              {orders.length > 0 ? (
                <>
                  <Text className="block text-sm text-[#7a4a22] mb-4">
                    你有 {orders.length} 笔可用订单，开团邀请好友满员即可抽盲盒，队长必中团长奖
                  </Text>
                  <Button
                    onClick={createGroup}
                    disabled={creating || !userId}
                    className="clay-btn w-full h-12 text-base font-extrabold text-white rounded-full"
                  >
                    {creating ? '创建中...' : userId ? '立即开团' : '登录后开团'}
                  </Button>
                </>
              ) : (
                <>
                  <Text className="block text-sm text-[#7a4a22] mb-4">购买本店套餐支付成功后即可开团</Text>
                  <Button
                    onClick={() => {
                      if (packageId) {
                        Taro.navigateTo({ url: `/pages/package-detail/index?id=${packageId}` })
                      } else {
                        Taro.navigateBack()
                      }
                    }}
                    className="w-full bg-[#FF6B1A] text-white rounded-full h-12 text-base font-extrabold"
                  >
                    去购买套餐
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="clay-card border-0">
            <CardContent className="p-5">
              <View className="flex items-center gap-3 mb-3">
                <ChevronRight size={22} color="#c8410e" />
                <Text className="block text-base font-extrabold text-[#5b2a0c]">输入邀请码加入（备用）</Text>
              </View>
              <Text className="block text-sm text-[#7a4a22] mb-3">好友也可以把邀请码发给你，输入即可加入队伍</Text>
              <View className="bg-orange-50 rounded-2xl px-4 py-3 mb-4 flex flex-row items-center">
                <View style={{ flex: 1 }}>
                  <Input
                    className="w-full bg-transparent text-center text-lg font-extrabold text-[#5b2a0c]"
                    placeholder="请输入邀请码"
                    value={codeInput}
                    onInput={(e) => setCodeInput(String(e.detail.value || '').toUpperCase())}
                    maxlength={8}
                  />
                </View>
                <View
                  onClick={pasteCode}
                  className="ml-2 px-3 py-2 bg-white rounded-full border border-[#ffd6a0] shrink-0"
                >
                  <Text className="block text-xs text-[#c8410e] font-bold">粘贴</Text>
                </View>
              </View>
              <Button
                onClick={() => {
                  if (!requireLogin('登录后才能加入队伍')) return
                  joinByCode(codeInput, userId)
                }}
                disabled={joining || !codeInput || !userId}
                className="w-full border-2 border-[#FF6B1A] text-[#c8410e] rounded-full h-12 text-base font-extrabold bg-white"
              >
                {joining ? '加入中...' : userId ? '加入队伍' : '登录后加入'}
              </Button>
            </CardContent>
          </Card>
        </>
      )}

      {/* 奖品展示 */}
      {teamStatus && (teamStatus?.leader_prize || (teamStatus?.member_prizes && teamStatus?.member_prizes.length > 0)) && (
        <Card className="clay-card border-0 mt-4 mb-4">
          <CardContent className="p-5">
            <View className="flex items-center gap-2 mb-4">
              <Gift size={20} color="#c8410e" />
              <Text className="block text-base font-extrabold text-[#5b2a0c]">盲盒奖池</Text>
            </View>
            {teamStatus?.leader_prize && (
              <View className="mb-4">
                <View className="flex items-center gap-2 mb-2">
                  <Trophy size={16} color="#d97706" />
                  <Text className="block text-sm font-bold text-[#5b2a0c]">团长皇冠奖</Text>
                </View>
                <View className="bg-gradient-to-r from-amber-100 to-orange-100 rounded-2xl p-3 flex items-center gap-3">
                  <View className="w-16 h-16 rounded-xl bg-white overflow-hidden shrink-0 flex items-center justify-center shadow-sm">
                    {teamStatus?.leader_prize.image_url ? (
                      <Image src={teamStatus?.leader_prize.image_url} className="w-full h-full" mode="aspectFill" />
                    ) : (
                      <Trophy size={28} color="#d97706" />
                    )}
                  </View>
                  <View className="flex-1 min-w-0">
                    <Text className="block text-sm font-extrabold text-[#5b2a0c] mb-1">{teamStatus?.leader_prize.name}</Text>
                    <View className="inline-block px-2 py-[2px] bg-amber-500 rounded-full">
                      <Text className="block text-[10px] text-white font-bold">👑 团长必中</Text>
                    </View>
                  </View>
                </View>
              </View>
            )}
            {teamStatus?.member_prizes && teamStatus?.member_prizes.length > 0 && (
              <View>
                <View className="flex items-center gap-2 mb-3">
                  <Users size={16} color="#c8410e" />
                  <Text className="block text-sm font-bold text-[#5b2a0c]">人人有奖池</Text>
                </View>
                <View className="grid grid-cols-3 gap-3">
                  {teamStatus?.member_prizes.map((p) => (
                    <View key={p.id} className="bg-orange-50 rounded-2xl p-3 text-center">
                      <View className="w-14 h-14 rounded-xl bg-white overflow-hidden mx-auto mb-2 flex items-center justify-center shadow-sm">
                        {p.image_url ? <Image src={p.image_url} className="w-full h-full" mode="aspectFill" /> : <Gift size={22} color="#c8410e" />}
                      </View>
                      <Text className="block text-xs text-[#5b2a0c] font-bold truncate mb-1">{p.name}</Text>
                      <Text className="block text-xs text-[#c8410e] font-bold">{p.probability}%</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </CardContent>
        </Card>
      )}

      {/* 推荐套餐 */}
      {teamStatus?.package && (
        <Card className="clay-card border-0 mt-4 mb-4">
          <CardContent className="p-5">
            <View className="flex items-center gap-2 mb-4">
              <Sparkles size={18} color="#c8410e" />
              <Text className="text-base font-extrabold text-[#5b2a0c]">推荐团购套餐</Text>
            </View>
            <View className="flex items-start gap-3">
              <View className="w-20 h-20 rounded-2xl bg-orange-50 overflow-hidden shrink-0 flex items-center justify-center">
                {teamStatus?.package.cover_image ? (
                  <Image src={teamStatus?.package.cover_image} className="w-full h-full" mode="aspectFill" />
                ) : (
                  <Gift size={28} color="#c8410e" />
                )}
              </View>
              <View className="flex-1 min-w-0">
                <Text className="block text-base font-extrabold text-[#5b2a0c] mb-1">{teamStatus?.package.name}</Text>
                {teamStatus?.package.description && (
                  <Text className="block text-xs text-[#7a4a22] leading-5 mb-2">{teamStatus?.package.description}</Text>
                )}
                <View className="flex items-baseline gap-2">
                  <Text className="block text-lg font-extrabold text-[#c8410e]">¥{Number(teamStatus?.package.price || 0).toFixed(2)}</Text>
                  {teamStatus?.package.original_price && Number(teamStatus?.package.original_price) > 0 && (
                    <Text className="block text-xs text-gray-400 line-through">¥{Number(teamStatus?.package.original_price).toFixed(2)}</Text>
                  )}
                </View>
              </View>
            </View>
          </CardContent>
        </Card>
      )}

      {/* 规则 */}
      <View className="mt-6 px-2">
        <Text className="block text-xs text-white text-opacity-90 text-center leading-5 font-semibold">
          1. 分享小程序链接给好友，好友点击授权登录即可自动入队{'\n'}
          2. 也可复制邀请码给好友，在下方「输入邀请码加入」备用入队{'\n'}
          3. 满 {teamStatus?.team_size || displayGroup?.members.length || 2} 人成团后全员可抽盲盒，队长必中团长奖{'\n'}
          4. 队伍 {teamStatus?.duration_hours || 24} 小时内未满员将自动解散
        </Text>
      </View>

      {/* ====== 盲盒选择/抽奖全屏层 ====== */}
      {(drawStage === 'select' || drawStage === 'shaking' || drawStage === 'bursting') && (
        <View className="fixed inset-0 z-40 bg-gradient-to-b from-[#FF6B1A] to-[#ffb347] flex flex-col items-center px-4 py-10">
          <View className="w-full flex justify-end" onClick={() => drawStage === 'select' && setDrawStage('idle')}>
            <View className="w-9 h-9 rounded-full bg-white bg-opacity-25 flex items-center justify-center">
              <X size={20} color="#ffffff" />
            </View>
          </View>
          <Text className="clay-title text-3xl mt-4 mb-2">选一个盲盒</Text>
          <Text className="block text-white text-opacity-90 text-sm font-semibold mb-6">
            {drawStage === 'select' ? '点一下你最有感觉的盒子 🎁' : drawStage === 'shaking' ? '摇一摇，马上揭晓！✨' : '哇～爆爆爆开啦！🎉'}
          </Text>

          <View className="grid grid-cols-3 gap-4 w-full max-w-sm">
            {BOX_COLORS.map((colors, idx) => {
              const isSelected = selectedBox === idx
              const isShaking = isSelected && drawStage === 'shaking'
              const isBurst = isSelected && drawStage === 'bursting'
              return (
                <View
                  key={idx}
                  onClick={() => onBoxClick(idx)}
                  className={`aspect-square relative rounded-[28px] ${isShaking ? 'clay-box-shake' : ''} ${isBurst ? 'clay-box-burst' : 'clay-box-float'}`}
                  style={{
                    background: `linear-gradient(160deg, ${colors[0]} 0%, ${colors[1]} 100%)`,
                    boxShadow: '0 8px 0 rgba(0,0,0,0.18), 0 16px 24px rgba(0,0,0,0.18), inset 0 3px 0 rgba(255,255,255,0.4)',
                    animationDelay: `${idx * 0.12}s`,
                  }}
                >
                  {/* 盒盖 */}
                  <View
                    className={`absolute left-0 right-0 top-0 h-[28%] rounded-t-[28px] ${isBurst ? 'clay-lid' : ''}`}
                    style={{
                      background: `linear-gradient(180deg, ${colors[0]} 0%, ${colors[1]} 100%)`,
                      borderBottom: '3px solid rgba(0,0,0,0.12)',
                    }}
                  />
                  {/* 丝带 */}
                  <View className="absolute left-1/2 top-0 bottom-0 w-[14%] -translate-x-1/2" style={{ background: 'rgba(255,255,255,0.35)' }} />
                  <View className="absolute top-1/2 left-0 right-0 h-[14%] -translate-y-1/2" style={{ background: 'rgba(255,255,255,0.35)' }} />
                  {/* 问号 */}
                  {!isBurst && (
                    <Text className="absolute inset-0 flex items-center justify-center text-white text-4xl font-black drop-shadow-md">?</Text>
                  )}
                  {/* 爆开金光粒子 */}
                  {isBurst && (
                    <>
                      {[0, 1, 2, 3, 4, 5].map((i) => (
                        <View
                          key={i}
                          className="clay-sparkle absolute left-1/2 top-1/2 w-3 h-3 rounded-full"
                          style={{
                            background: i % 2 ? '#fff176' : '#ffd54f',
                            transform: `translate(-50%, -50%) rotate(${i * 60}deg) translateX(-40px)`,
                            animationDelay: `${i * 0.08}s`,
                          }}
                        />
                      ))}
                    </>
                  )}
                </View>
              )
            })}
          </View>
          {drawStage === 'select' && (
            <View className="mt-8 clay-bubble bg-white bg-opacity-25 rounded-full px-6 py-3">
              <Text className="block text-white font-bold text-sm">9 个盲盒，运气就看这一下！</Text>
            </View>
          )}
        </View>
      )}

      {/* ====== 中奖结果弹窗 ====== */}
      {drawStage === 'result' && drawResult && (
        <View className="win-popup-overlay" onClick={closeDrawResult}>
          {/* 彩带 */}
          <View className="win-popup-confetti">
            {Array.from({ length: 24 }).map((_, i) => {
              const colors = ['#ffd166', '#ef476f', '#06d6a0', '#118ab2', '#ff9f1c', '#f78fb3']
              const color = colors[i % colors.length]
              const left = (i * 4.2) % 100
              const delay = (i * 0.12) % 1.5
              const width = 6 + (i % 3) * 3
              return (
                <View
                  key={i}
                  className="clay-confetti absolute"
                  style={{ left: `${left}%`, top: '-20px', width: `${width}px`, height: `${width * 1.6}px`, background: color, borderRadius: '2px', animationDelay: `${delay}s` }}
                />
              )
            })}
          </View>
          <View className="win-popup-wrap" onClick={(e) => e.stopPropagation()}>
            <View className="win-popup-header">
              <Text className="win-popup-title">🎉 恭喜中奖</Text>
              <Text className="win-popup-subtitle">盲盒已开启，看看你抽中了什么</Text>
              {drawResult.prize_type === 'free_meal' && (
                <Text className="win-popup-freemeal">🍗 霸王餐免单 · 全额退款</Text>
              )}
            </View>
            <View className="win-popup-card clay-prize-pop">
              <View className="win-popup-image-wrap">
                {drawResult.image_url || drawResult.prize_image ? (
                  <Image
                    src={drawResult.image_url || drawResult.prize_image || ''}
                    className="w-full h-full"
                    mode="aspectFill"
                  />
                ) : (
                  <Gift size={64} color="#c8410e" />
                )}
              </View>
              <Text className="win-popup-prize-name">{drawResult.prize_name}</Text>
              <Text className="win-popup-prize-desc">
                {drawResult.prize_type === 'coupon' && '折扣券已自动发到你的账户，下单可直接抵扣'}
                {drawResult.prize_type === 'free_meal' && '免单奖励已原路退款，请到店出示核销码'}
                {drawResult.prize_type === 'product' && '请到店出示核销码领取你的奖品'}
              </Text>

              {drawResult.redemption_code && (
                <View className="win-popup-code-row">
                  <Text className="win-popup-code-label">核销码</Text>
                  <Text selectable className="win-popup-code-value">{drawResult.redemption_code}</Text>
                </View>
              )}

              {drawResult.prize_type === 'coupon' && drawResult.coupon_amount && Number(drawResult.coupon_amount) > 0 && (
                <View className="win-popup-refund-row">
                  <Text className="win-popup-refund-label">
                    券面额{drawResult.coupon_min_spend ? `（满${drawResult.coupon_min_spend}可用）` : ''}
                  </Text>
                  <Text className="win-popup-refund-value">¥{Number(drawResult.coupon_amount).toFixed(2)}</Text>
                </View>
              )}

              {drawResult.refund_amount && Number(drawResult.refund_amount) > 0 && (
                <View className="win-popup-refund-row">
                  <Text className="win-popup-refund-label">
                    {drawResult.prize_type === 'free_meal' ? '免单退款' : '返现金额'}
                  </Text>
                  <Text className="win-popup-refund-value">¥{Number(drawResult.refund_amount).toFixed(2)}</Text>
                </View>
              )}

              {drawResult.expiry_date && (
                <Text className="win-popup-tip">奖品有效期至 {drawResult.expiry_date.slice(0, 10)}，请尽快使用</Text>
              )}

              <View className="win-popup-btns">
                <View className="win-popup-btn-secondary" onClick={() => Taro.switchTab({ url: '/pages/lottery-records/index' })}>
                  查看记录
                </View>
                <View className="win-popup-btn-primary" onClick={closeDrawResult}>
                  开心收下
                </View>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* Toast */}
      {toast && (
        <View className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black bg-opacity-75 px-5 py-3 rounded-xl z-[1000]">
          <Text className="block text-white text-sm text-center">{toast}</Text>
        </View>
      )}
    </View>
  )
}
