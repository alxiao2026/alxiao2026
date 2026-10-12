import { useState, useEffect, useMemo, useRef } from 'react'
import Taro, { useRouter, useShareAppMessage, useDidShow, useLoad } from '@tarojs/taro'
import { View, Text, Image } from '@tarojs/components'
import { Network } from '@/network'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Crown, Gift, Users, Share2, Trophy, Sparkles, CircleAlert } from 'lucide-react-taro'
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
  is_leader?: boolean
  nick_name: string | null
  avatar_url: string | null
  joined_at: string
  drew_at: string | null
  is_winner: boolean
  prize_id?: string | null
  prize_name: string | null
  prize_type?: string | null
  prize_image?: string | null
  redemption_code?: string | null
  refund_amount?: number | null
  refund_status?: string | null
  coupon_code?: string | null
  discount_rate?: number | null
  discount_cap?: number | null
  product_name?: string | null
}

interface Group {
  id: string
  merchant_id: number
  package_id: string
  order_id?: string
  leader_order_id?: string
  leader_id?: string
  leader_user_id?: string
  is_leader?: boolean
  is_member?: boolean
  status: 'active' | 'full' | 'expired' | 'drawed'
  invite_code: string
  expires_at: string
  created_at: string
  current_count?: number
  team_size?: number
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


export default function TeamLotteryPage() {
  const router = useRouter()
  const [packageId, setPackageId] = useState<string>('')
  const [inviteCode, setInviteCode] = useState<string>('')
  const [userId, setUserId] = useState<string>('')
  const [orderId, setOrderId] = useState<string>('')
  // 邀请链接场景下 merchant_id 会在拉到预览后动态设置为队伍的 merchant_id
  const [merchantId, setMerchantId] = useState<number>(0)

  const [teamStatus, setTeamStatus] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [orders, setOrders] = useState<any[]>([])
  const [group, setGroup] = useState<Group | null>(null)
  const [creating, setCreating] = useState(false)
  const [joining, setJoining] = useState(false)
  const [toast, setToast] = useState('')
  // 邀请预览的错误态（邀请码无效/队伍已结束）
  const [previewError, setPreviewError] = useState<string>('')
  // 邀请链接预览：仅通过 invite_code 拉到的未加入队伍
  const [previewGroup, setPreviewGroup] = useState<Group | null>(null)

  // 盲盒动画统一在 lottery/index 页实现，本页仅展示队伍状态

  // 未登录点邀请链接/开团/入队的拦截提示
  const [loginTip, setLoginTip] = useState('')

  // 同时支持 merchant_id/merchantId、package_id/packageId、order_id/orderId 两种命名风格
  const applyParams = (raw: Record<string, any>) => {
    const params = raw || {}
    const mid = Number(params.merchant_id || params.merchantId || 0)
    const pid = String(params.package_id || params.packageId || '')
    const code = String(params.invite_code || params.inviteCode || '').toUpperCase()
    const oid = String(params.order_id || params.orderId || '')
    let uid = Taro.getStorageSync('user_id') || ''
    // 冷启动直接进入本页（未经首页）时，兜底生成游客 user_id，确保入队/登录态判断正确
    if (!uid) {
      uid = `user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      Taro.setStorageSync('user_id', uid)
    }
    if (pid) setPackageId((prev) => prev || pid)
    // 分享进入时 invite_code 只在有值时更新，避免 onShow 空参数把它覆盖掉
    if (code) setInviteCode((prev) => prev || code)
    if (oid) setOrderId((prev) => prev || oid)
    setMerchantId((prev) => {
      if (mid && !prev) return mid
      return prev
    })
    setUserId(uid)
  }

  // onLoad 一定带 query（含分享卡片进入的 invite_code），冷启动/分享进入都从这里读参数
  useLoad((options) => {
    // 微信分享卡片冷启动：useLoad 的 options 与 getEnterOptionsSync().query 可能不一致，合并兜底，确保 invite_code 必被解析
    let enterQuery: Record<string, any> = {}
    try {
      const enter = (Taro as any).getEnterOptionsSync?.()
      enterQuery = enter?.query || {}
    } catch (e) {}
    applyParams({ ...enterQuery, ...(options || {}) })
  })

  // 从登录页/盲盒页返回后重新读取并刷新（兼容 iOS 参数延迟到达）
  useDidShow(() => {
    applyParams(router.params || ({} as Record<string, unknown>))
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
        const uid = Taro.getStorageSync('user_id') || ''
        const res = await Network.request({ url: `/api/team-lottery/groups/by-code/${inviteCode}${uid ? `?user_id=${encodeURIComponent(uid)}` : ''}` })
        const preview = res.data?.data as Group | null
        const memberIds = (preview?.members || []).map((m) => m.user_id)
        console.log('[TeamLottery] invite preview inviteCode=', inviteCode, 'uid=', uid, 'memberIds=', JSON.stringify(memberIds), 'alreadyIn=', uid ? memberIds.includes(uid) : false)
        if (cancelled) return
        if (!preview) {
          setPreviewError(res.data?.msg || '邀请码无效')
        } else {
          setPreviewGroup(preview)
          if (preview.merchant_id && !merchantId) {
            setMerchantId(preview.merchant_id)
          }
          // 如果当前用户已经在队伍里，直接展示队伍
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

  // 店内组队加载：有 merchantId + userId 时触发（仅店内开团/无邀请码场景）
  useEffect(() => {
    const currentInviteCode = inviteCode
    const uid = userId
    const mid = merchantId
    if (!mid || !uid) return
    // 邀请链接场景：队伍预览完全由 inviteCode 的 useEffect 负责，
    // 绝不能跑 loadAll 用 my-groups 把自己（或旧）队伍覆盖成"团长页面"，导致好友看不到"加入队伍"按钮
    if (currentInviteCode) return
    loadAll(uid)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [merchantId, userId])

  // 分享数据用 ref 保存并在每次渲染时同步，避免 useShareAppMessage 闭包捕获到过期的
  // group/inviteCode（Taro 分享回调闭包陷阱），导致分享链接丢失 invite_code，
  // 好友打开后无法进入"加入队伍"预览页
  const shareDataRef = useRef<{ inviteCode: string; packageId: string; merchantId: number }>({
    inviteCode: '',
    packageId: '',
    merchantId: 0,
  })
  shareDataRef.current = {
    inviteCode: inviteCode || group?.invite_code || previewGroup?.invite_code || '',
    packageId: group?.package_id || previewGroup?.package_id || packageId,
    merchantId: merchantId || group?.merchant_id || previewGroup?.merchant_id || 0,
  }
  // 持久化最新 invite_code 到 storage：微信端分享时若遇 group 异步加载的时序问题，
  // 分享回调可从 storage 兜底，确保分享链接必带邀请码（好友才能进入"加入队伍"预览）
  if (shareDataRef.current.inviteCode) {
    try { Taro.setStorageSync('team_share_invite_code', shareDataRef.current.inviteCode) } catch (e) {}
  }

  useShareAppMessage(() => {
    const share = shareDataRef.current
    // ref 优先；若分享瞬间 group 尚未加载导致 inviteCode 为空，从 storage 兜底最近一次邀请码
    let invite = share.inviteCode
    if (!invite) {
      try { invite = Taro.getStorageSync('team_share_invite_code') || '' } catch (e) { invite = '' }
    }
    const qs = [`merchant_id=${share.merchantId}`]
    if (share.packageId) qs.push(`package_id=${share.packageId}`)
    if (invite) qs.push(`invite_code=${invite}`)
    const path = `/pages/team-lottery/index?${qs.join('&')}`
    console.log('[TeamLottery] onShareAppMessage build path =', path, JSON.stringify(share), 'invite=', invite)
    return {
      title: teamStatus?.share_title || '快来组队抽盲盒，满员即开奖！',
      path,
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
    const fullPath = `/${current?.route || 'pages/team-lottery/index'}?merchant_id=${merchantId}${packageId ? `&package_id=${packageId}` : ''}${orderId ? `&order_id=${orderId}` : ''}${inviteCode ? `&invite_code=${inviteCode}` : ''}`
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
      // 若带了 order_id 则优先按订单查询对应的队伍（每笔订单对应一个队伍）
      let foundByOrder = false
      if (orderId) {
        try {
          const ogRes = await Network.request({ url: `/api/team-lottery/by-order/${orderId}?user_id=${uid}` })
          console.log('[TeamLottery] by-order', ogRes.data)
          if (ogRes.data?.data) {
            setGroup(ogRes.data.data)
            setPreviewGroup(null)
            setPreviewError('')
            foundByOrder = true
          }
        } catch (e) {
          console.warn('[TeamLottery] by-order error', e)
        }
      }

      const [statusRes, ordersRes, myGroupsRes] = await Promise.all([
        Network.request({ url: `/api/team-lottery/merchants/${merchantId}/status${packageId ? `?package_id=${packageId}` : ''}` }),
        Network.request({ url: `/api/team-lottery/orders/${uid}/${merchantId}` }),
        Network.request({ url: `/api/team-lottery/my-groups/${uid}?merchant_id=${merchantId}` }),
      ])
      console.log('[TeamLottery] status', statusRes.data)
      console.log('[TeamLottery] orders', ordersRes.data)
      console.log('[TeamLottery] myGroups', myGroupsRes.data)
      setTeamStatus(statusRes.data?.data || null)
      setOrders(ordersRes.data?.data || [])

      // 指定订单场景下：若该订单尚未入队/开团，则不兜底跳到旧队伍，让用户在新订单上开团
      // 只有在没有指定订单（店内入口/邀请码入队）时才用旧队伍兜底
      if (!group && !foundByOrder && !orderId) {
        const groups: Group[] = myGroupsRes.data?.data || []
        const candidates = groups.filter(
          (g) => g.merchant_id === merchantId && g.status !== 'expired' && (!packageId || g.package_id === packageId),
        )
        const active = candidates.find((g) => g.status === 'active' || g.status === 'full') || candidates[0]
        if (active) {
          await loadGroup(active.id, uid)
          setPreviewGroup(null)
          setPreviewError('')
        }
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
        const newGroup = res.data.data as Group
        setGroup(newGroup)
        setPreviewGroup(null)
        Taro.showToast({ title: '加入队伍成功', icon: 'success' })
        // 满员后非团长自动跳到盲盒页抽奖
        if (newGroup.status === 'full' && newGroup.is_leader === false) {
          setTimeout(() => {
            Taro.navigateTo({ url: `/pages/lottery/index?team_group_id=${newGroup.id}` })
          }, 800)
        }
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
    // 优先用 URL 传入的 order_id 对应的订单（新订单场景），否则兜底用 orders 列表第一个可用订单
    let order = orders.find((o) => o.id === orderId)
    if (!order && orders.length) {
      // 有指定订单但 orders 列表没匹配到（可能还没加载完）时，用该 orderId 构造临时对象
      order = orderId
        ? ({ id: orderId, package_id: packageId, merchant_id: merchantId, total_amount: 0, status: 'paid' } as any)
        : orders[0]
    }
    if (!order) {
      showToast('暂无可用订单，购买套餐后即可开团')
      return
    }
    setCreating(true)
    try {
      const res = await Network.request({
        url: '/api/team-lottery/groups',
        method: 'POST',
        data: {
          merchant_id: merchantId,
          package_id: order.package_id || packageId,
          order_id: order.id,
          user_id: userId,
        },
      })
      console.log('[TeamLottery] create', res.data)
      if (res.data?.data) {
        setGroup(res.data.data)
        // 同步 inviteCode state，确保分享链接一定能带上邀请码（兜底）
        if (res.data.data.invite_code) setInviteCode(res.data.data.invite_code)
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

  // 满员后队员点"立即开盲盒"：跳转到膨胀盲盒页，复用盲盒动画
  const onStartDraw = () => {
    if (!requireLogin('登录后才能抽奖')) return
    if (!group) return
    const me = group.members.find((m) => m.user_id === userId)
    if (!me) {
      showToast('你不是队伍成员')
      return
    }
    if (me.drew_at || me.prize_id) {
      showToast('你已完成抽奖，可在中奖记录查看')
      return
    }
    if (group.is_leader) {
      showToast('团长奖励已自动发放，可在中奖记录查看')
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
    // 跳转到普通盲盒页，带 team_group_id 参数走组队模式
    Taro.navigateTo({
      url: `/pages/lottery/index?team_group_id=${group.id}`,
    })
  }

  // 当前登录用户在队伍中的成员
  // 邀请预览优先：只要通过邀请链接看到"自己尚未加入"的队伍，就展示加入队伍卡片
  // （即使本人在其他队伍有活跃组队，也不能用旧队伍卡片顶掉好友的邀请）
  const isMemberOfPreview = !!previewGroup && !!userId && !!previewGroup.members?.some((m) => m.user_id === userId)
  const isPreviewMode = !!previewGroup && !isMemberOfPreview
  // 当前展示的队伍：邀请预览（未加入）优先，其次已加入的队伍
  const displayGroup = isPreviewMode ? previewGroup : group
  const me = useMemo(() => displayGroup?.members.find((m) => m.user_id === userId) || null, [displayGroup, userId])
  const teamFailed = !!displayGroup && !isPreviewMode && (!!displayGroup.leader_refunded || displayGroup.status === 'expired')
  // 满员后团长不参与抽奖（团长奖已自动发放），只有未抽过奖的队员可以抽
  const canDraw = !!displayGroup && !isPreviewMode && !teamFailed && displayGroup.status === 'full' && !!me && !me.drew_at && !displayGroup.is_leader
  const alreadyDrewPrize = me?.drew_at ? me : null
  // 团长已自动获奖
  const leaderPrizeReady = !!displayGroup && !isPreviewMode && displayGroup.is_leader && displayGroup.status === 'full'

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

  // 邀请链接无效/队伍已结束
  const showInviteInvalid = inviteCode && !!previewError && !previewGroup && !group

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
          <Text className="block text-white text-sm font-semibold">邀请链接无效或队伍已结束</Text>
        )}
        {!showInviteInvalid && (
          <Text className="block text-white text-opacity-95 text-sm font-semibold">
            {isPreviewMode
              ? `${displayGroup?.members.length || 1} 位好友已在队中，点击加入即可成团`
              : `满 ${displayGroup?.team_size || teamStatus?.team_size || 2} 人成团 · 队长皇冠加成 · 人人可抽`}
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
              {Array.from({ length: Math.max(g.team_size || 0, g.members.length, 2) }).map((_, idx) => {
                const member = g.members[idx]
                const displayName = member?.nick_name ? (member.nick_name.length > 5 ? member.nick_name.slice(0, 5) + '…' : member.nick_name) : (member ? '微信用户' : '等待加入')
                const initial = displayName.slice(0, 1)
                const isLeader = member?.role === 'leader' || member?.is_leader
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
                  队伍还差 {Math.max(0, (g.team_size || g.members.length + 1) - g.members.length)} 人成团，加入即可一起抽盲盒
                </Text>
                {!userId ? (
                  <Button
                    onClick={goLogin}
                    className="w-full clay-btn h-12 text-base font-extrabold text-white rounded-full"
                  >
                    登录账号并加入
                  </Button>
                ) : (
                  <Button
                    onClick={handleJoinInvite}
                    disabled={joining}
                    className="w-full clay-btn h-12 text-base font-extrabold text-white rounded-full"
                  >
                    {joining ? '加入中...' : '🎁 加入队伍'}
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

            {/* 团长奖品提示 */}
            {g.leader_prize_name && !teamFailed && !previewFailed && (
              <View className="flex items-center gap-2 bg-amber-50 rounded-xl p-3 mb-4">
                <Trophy size={18} color="#d97706" />
                <Text className="block text-sm text-amber-700">
                  团长专属：<Text className="font-bold">{g.leader_prize_name}</Text>
                </Text>
              </View>
            )}

            {/* 抽奖按钮 / 团长奖 / 已开奖信息（仅已加入队伍时显示） */}
            {!isPreviewMode && !teamFailed && (
              <View className="text-center">
                {canDraw ? (
                  <Button
                    onClick={onStartDraw}
                    className="clay-btn w-full h-14 text-lg font-extrabold text-white rounded-full clay-btn-waiting"
                  >
                    🎁 立即开盲盒
                  </Button>
                ) : leaderPrizeReady ? (
                  <View className="bg-gradient-to-r from-amber-100 to-yellow-100 rounded-2xl p-4">
                    <Text className="block text-sm font-bold text-[#c8410e]">
                      👑 成团成功，团长奖已发放
                    </Text>
                    {me?.prize_name ? (
                      <>
                        <Text className="block text-sm text-[#c8410e] mt-1">
                          获得：{me.prize_name}
                        </Text>
                        {me.redemption_code && (
                          <Text className="block text-xs text-amber-700 mt-1">核销码：{me.redemption_code}</Text>
                        )}
                        {me.refund_amount && Number(me.refund_amount) > 0 && (
                          <Text className="block text-xs text-red-600 mt-1">已原路退款 ¥{Number(me.refund_amount).toFixed(2)}</Text>
                        )}
                      </>
                    ) : (
                      <Text className="block text-xs text-amber-700 mt-1">奖品已自动到账，请到「中奖记录」查看</Text>
                    )}
                  </View>
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
                      还差 {Math.max(0, (g.team_size || teamStatus?.team_size || 2) - g.members.length)} 人成团，分享给好友一起来抽
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

      {/* 开团/加入入口：无队伍 或 队伍已开奖/失败 且 不在邀请预览中；邀请的队伍已结束也允许自己开团 */}
      {(!isPreviewMode && (!group || teamFailed || group.status === 'drawed')) ||
      (isPreviewMode && !!previewGroup && previewGroup.status !== 'active') ? (
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
        </>
      ) : null}

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
          1. 团长下单后即可发起组队，好友无需下单、免费入队抽一次奖{'\n'}
          2. 分享邀请链接给好友，好友点击授权登录即可加入队伍{'\n'}
          3. 满 {displayGroup?.team_size || teamStatus?.team_size || 2} 人成团后团长直接获得团长奖，队员点击「立即开盲盒」抽盲盒{'\n'}
          4. 队伍 {teamStatus?.duration_hours || 24} 小时内未满员将自动解散
        </Text>
      </View>

      {/* Toast */}
      {toast && (
        <View className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black bg-opacity-75 px-5 py-3 rounded-xl z-[1000]">
          <Text className="block text-white text-sm text-center">{toast}</Text>
        </View>
      )}
    </View>
  )
}
