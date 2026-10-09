import { useState, useEffect } from 'react'
import Taro, { useRouter, useShareAppMessage, useDidShow } from '@tarojs/taro'
import { View, Text, Image } from '@tarojs/components'
import { Network } from '@/network'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Gift, Users, Share2, Copy, Trophy, Sparkles, CircleAlert, ChevronRight } from 'lucide-react-taro'

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

interface TeamStatus {
  enabled: boolean
  team_size: number
  duration_hours: number
  share_title: string
  share_desc: string
  share_image_url: string | null
  logo_image_url: string | null
  merchant?: MerchantInfo
  package?: PackageInfo
  leader_prize?: PrizeItem
  member_prizes?: PrizeItem[]
  leader_bonus_prizes?: PrizeItem[]
  leader_bonus_rate?: number
}

interface Member {
  id: string
  user_id: string
  role: 'leader' | 'member'
  nickname: string | null
  avatar_url: string | null
  joined_at: string
  drew_at: string | null
  is_winner: boolean
  prize_name: string | null
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
  members: Member[]
  merchant?: MerchantInfo
  package?: PackageInfo
  leader_prize?: PrizeItem
  member_prizes?: PrizeItem[]
  leader_bonus_prizes?: PrizeItem[]
  leader_bonus_rate?: number
}

interface Order {
  id: string
  package_id: string
  package_name: string
  status: string
  paid_at: string | null
}

export default function TeamLotteryPage() {
  const router = useRouter()
  const merchantId = Number(router.params.merchant_id || 0)
  const packageId = String(router.params.package_id || '')
  const inviteCode = String(router.params.invite_code || '')
  const [userId, setUserId] = useState<string>('')

  const [status, setStatus] = useState<TeamStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [orders, setOrders] = useState<Order[]>([])
  const [group, setGroup] = useState<Group | null>(null)
  const [codeInput, setCodeInput] = useState(inviteCode)
  const [creating, setCreating] = useState(false)
  const [joining, setJoining] = useState(false)
  const [drawing, setDrawing] = useState(false)
  const [toast, setToast] = useState('')

  useEffect(() => {
    if (merchantId && userId) {
      loadAll(userId)
    } else if (merchantId && !userId) {
      setLoading(false)
    }
  }, [merchantId, userId])

  useDidShow(() => {
    const uid = Taro.getStorageSync('user_id') || ''
    setUserId(uid)
  })

  useShareAppMessage(() => {
    if (!group) return { title: '组队抽奖' }
    return {
      title: status?.share_title || '快来组队抽奖，人人都能抽奖品！',
      path: `/pages/team-lottery/index?merchant_id=${merchantId}&package_id=${packageId}&invite_code=${group.invite_code}`,
      imageUrl: status?.share_image_url || undefined,
    }
  })

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  const loadAll = async (uid: string) => {
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
      setStatus(statusRes.data?.data || null)
      setOrders(ordersRes.data?.data || [])

      const groups: Group[] = myGroupsRes.data?.data || []
      const active = groups.find(
        (g) => g.merchant_id === merchantId && g.status !== 'expired' && (!packageId || g.package_id === packageId),
      )
      if (active) {
        await loadGroup(active.id, uid)
      } else if (inviteCode && !group) {
        await joinByCode(inviteCode, uid)
      }
    } finally {
      setLoading(false)
    }
  }

  const loadGroup = async (groupId: string, uid: string) => {
    const res = await Network.request({ url: `/api/team-lottery/groups/${groupId}?user_id=${uid}` })
    console.log('[TeamLottery] group detail', res.data)
    setGroup(res.data?.data || null)
  }

  const createGroup = async () => {
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

  const joinByCode = async (code: string, uid: string) => {
    if (!code) return
    setJoining(true)
    try {
      const res = await Network.request({
        url: `/api/team-lottery/groups/${code}/join`,
        method: 'POST',
        data: { user_id: uid },
      })
      console.log('[TeamLottery] join', res.data)
      if (res.data?.data) {
        setGroup(res.data.data)
        showToast('加入队伍成功')
      } else {
        showToast(res.data?.msg || (res.data as any)?.message || '加入失败，请稍后重试')
      }
    } catch (e: any) {
      showToast(e?.message || '加入失败，请稍后重试')
    } finally {
      setJoining(false)
    }
  }

  const drawPrize = async () => {
    if (!group) return
    setDrawing(true)
    try {
      const res = await Network.request({
        url: `/api/team-lottery/groups/${group.id}/draw`,
        method: 'POST',
        data: { user_id: userId },
      })
      console.log('[TeamLottery] draw', res.data)
      if (res.data?.data) {
        await loadGroup(group.id, userId)
        showToast(`恭喜获得 ${res.data.data.prize_name || '奖品'}`)
      } else {
        showToast(res.data?.msg || '抽奖失败')
      }
    } catch (e: any) {
      showToast(e?.message || '抽奖失败')
    } finally {
      setDrawing(false)
    }
  }

  const copyCode = () => {
    if (!group?.invite_code) return
    Taro.setClipboardData({ data: group.invite_code })
    showToast('邀请码已复制')
  }

  const pasteCode = async () => {
    try {
      const { data } = await Taro.getClipboardData()
      const code = String(data || '').trim().toUpperCase()
      if (!code) {
        showToast('剪贴板为空，请先复制邀请码')
        return
      }
      setCodeInput(code.slice(0, 8))
      showToast('已粘贴邀请码')
    } catch {
      showToast('读取剪贴板失败，请手动输入')
    }
  }

  if (loading) {
    return (
      <View className="min-h-screen bg-gradient-to-b from-[#FF4757] to-[#ff6b81] p-4">
        <Skeleton className="h-48 w-full rounded-2xl mb-4" />
        <Skeleton className="h-32 w-full rounded-2xl mb-4" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </View>
    )
  }

  if (!status?.enabled) {
    return (
      <View className="min-h-screen bg-gradient-to-b from-[#FF4757] to-[#ff6b81] flex items-center justify-center p-6">
        <Card className="w-full rounded-2xl border-0 shadow-xl">
          <CardContent className="p-8 text-center">
            <CircleAlert size={48} color="#FF4757" className="mx-auto mb-4" />
            <Text className="block text-lg font-bold text-gray-900 mb-2">该商家暂未开启组队抽奖</Text>
            <Text className="block text-sm text-gray-500 mb-6">去看看其他优惠活动吧</Text>
            <Button onClick={() => Taro.navigateBack()} className="w-full bg-[#FF4757] text-white rounded-full">
              返回
            </Button>
          </CardContent>
        </Card>
      </View>
    )
  }

  return (
    <View className="min-h-screen bg-gradient-to-b from-[#FF4757] via-[#ff5e6e] to-[#ffe4e7] p-4 pb-24">
      <Dialog open={!userId}>
        <DialogContent className="sm:max-w-[320px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-center text-lg">请先登录</DialogTitle>
            <DialogDescription className="text-center text-sm text-gray-500">登录后即可参与组队抽奖</DialogDescription>
          </DialogHeader>
          <Button onClick={() => Taro.navigateTo({ url: '/pages/login/index' })} className="w-full bg-[#FF4757] text-white rounded-full mt-2">
            去登录
          </Button>
        </DialogContent>
      </Dialog>

      {/* 顶部活动区 */}
      <View className="pt-8 pb-6 text-center">
        <View className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white bg-opacity-20 backdrop-blur mb-4 overflow-hidden">
          {status.logo_image_url ? (
            <Image src={status.logo_image_url} className="w-full h-full" mode="aspectFill" />
          ) : (
            <Gift size={36} color="#ffffff" />
          )}
        </View>
        <Text className="block text-2xl font-extrabold text-white mb-2">组队免费抽奖</Text>
        <Text className="block text-white text-opacity-90 text-sm">
          满 {status.team_size} 人成团，团长和团员都能抽奖，团长必中团长奖品
        </Text>
      </View>

      {/* 队伍卡片 */}
      {group ? (
        <Card className="rounded-2xl border-0 shadow-xl mb-4 overflow-hidden">
          <CardContent className="p-5">
            <View className="flex items-center justify-between mb-4">
              <View className="flex items-center gap-2">
                <Users size={20} color="#FF4757" />
                <Text className="block text-base font-bold text-gray-900">我的队伍</Text>
              </View>
              <View
                className={`px-3 py-1 rounded-full ${
                  group.status === 'full' || group.status === 'drawed'
                    ? 'bg-green-100'
                    : group.status === 'expired'
                    ? 'bg-gray-100'
                    : 'bg-orange-100'
                }`}
              >
                <Text
                  className={`block text-xs font-semibold ${
                    group.status === 'full' || group.status === 'drawed'
                      ? 'text-green-600'
                      : group.status === 'expired'
                      ? 'text-gray-600'
                      : 'text-orange-600'
                  }`}
                >
                  {group.status === 'active' && '组队中'}
                  {group.status === 'full' && '已满员'}
                  {group.status === 'drawed' && '已开奖'}
                  {group.status === 'expired' && '已过期'}
                </Text>
              </View>
            </View>

            {/* 成员头像 */}
            <View className="flex flex-row items-center justify-center gap-3 mb-5 flex-wrap">
              {Array.from({ length: status.team_size }).map((_, idx) => {
                const member = group.members[idx]
                const displayName = member?.nickname || (member?.role === 'leader' ? '团长' : '团员')
                const initial = displayName.slice(0, 1)
                return (
                  <View key={idx} className="flex flex-col items-center">
                    <View className="w-12 h-12 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 border-2 border-white shadow overflow-hidden flex items-center justify-center">
                      {member?.avatar_url ? (
                        <Image src={member.avatar_url} className="w-full h-full" mode="aspectFill" />
                      ) : (
                        <Text className="block text-base font-bold text-gray-400">{initial}</Text>
                      )}
                    </View>
                    <View
                      className={`mt-1 px-2 py-1 rounded ${
                        member?.role === 'leader' ? 'bg-yellow-400' : 'bg-gray-200'
                      }`}
                    >
                      <Text className={`block text-xs font-bold ${member?.role === 'leader' ? 'text-white' : 'text-gray-600'}`}>
                        {member?.role === 'leader' ? '团长' : '团员'}
                      </Text>
                    </View>
                  </View>
                )
              })}
            </View>

            {/* 邀请码 */}
            {group.status === 'active' && (
              <View className="bg-gray-50 rounded-xl p-4 mb-4">
                <Text className="block text-xs text-gray-500 mb-1 text-center">邀请码</Text>
                <View className="flex flex-row items-center justify-center gap-3">
                  <Text className="block text-2xl font-extrabold text-[#FF4757] tracking-widest">
                    {group.invite_code}
                  </Text>
                  <View onClick={copyCode} className="p-2 bg-white rounded-full shadow-sm">
                    <Copy size={16} color="#FF4757" />
                  </View>
                </View>
              </View>
            )}

            {/* 团长奖品 */}
            {group.leader_prize_name && (
              <View className="flex items-center gap-2 bg-yellow-50 rounded-xl p-3 mb-4">
                <Trophy size={18} color="#f59e0b" />
                <Text className="block text-sm text-yellow-700">
                  团长奖品：<Text className="font-bold">{group.leader_prize_name}</Text>
                </Text>
              </View>
            )}

            {/* 抽奖按钮 */}
            {(group.status === 'full' || group.status === 'drawed') && (
              <View className="text-center">
                {group.members.find((m) => m.user_id === userId && !m.drew_at) ? (
                  <Button
                    onClick={drawPrize}
                    disabled={drawing}
                    className="w-full bg-gradient-to-r from-[#FF4757] to-[#ff6b81] text-white rounded-full h-12 text-base font-bold"
                  >
                    {drawing ? '抽奖中...' : '立即抽奖'}
                  </Button>
                ) : (
                  <View className="bg-green-50 rounded-full py-3">
                    <Text className="block text-sm font-semibold text-green-600">
                      {group.members.find((m) => m.user_id === userId)?.is_winner
                        ? `已获得 ${group.members.find((m) => m.user_id === userId)?.prize_name || '奖品'}`
                        : '已完成抽奖'}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* 分享按钮 */}
            {group.status === 'active' && (
              <View className="mt-4">
                <Button
                  openType="share"
                  className="w-full bg-[#FF4757] text-white rounded-full h-12 text-base font-bold border-0"
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
      ) : (
        <>
          {/* 开团资格 */}
          <Card className="rounded-2xl border-0 shadow-xl mb-4">
            <CardContent className="p-5">
              <View className="flex items-center gap-3 mb-3">
                <Sparkles size={22} color="#FF4757" />
                <Text className="block text-base font-bold text-gray-900">开团资格</Text>
              </View>
              {orders.length > 0 ? (
                <>
                  <Text className="block text-sm text-gray-600 mb-4">
                    你有 {orders.length} 个可用订单，购买套餐支付成功后即可开团当团长
                  </Text>
                  <Button
                    onClick={createGroup}
                    disabled={creating}
                    className="w-full bg-gradient-to-r from-[#FF4757] to-[#ff6b81] text-white rounded-full h-12 text-base font-bold"
                  >
                    {creating ? '创建中...' : '立即开团'}
                  </Button>
                </>
              ) : (
                <>
                  <Text className="block text-sm text-gray-600 mb-4">暂无可用订单，购买本店套餐支付成功后才可开团</Text>
                  <Button
                    onClick={() => {
                      if (packageId) {
                        Taro.navigateTo({ url: `/pages/package-detail/index?id=${packageId}` })
                      } else {
                        Taro.navigateBack()
                      }
                    }}
                    className="w-full bg-[#FF4757] text-white rounded-full h-12 text-base font-bold"
                  >
                    去购买套餐
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          {/* 加入队伍 */}
          <Card className="rounded-2xl border-0 shadow-xl">
            <CardContent className="p-5">
              <View className="flex items-center gap-3 mb-3">
                <ChevronRight size={22} color="#FF4757" />
                <Text className="block text-base font-bold text-gray-900">加入队伍</Text>
              </View>
              <Text className="block text-sm text-gray-600 mb-3">输入好友分享的邀请码，加入队伍一起抽奖</Text>
              <View className="bg-gray-50 rounded-xl px-4 py-3 mb-4 flex flex-row items-center">
                <View style={{ flex: 1 }}>
                  <Input
                    className="w-full bg-transparent text-center text-lg font-bold text-gray-900"
                    placeholder="请输入邀请码"
                    value={codeInput}
                    onInput={(e) => setCodeInput(String(e.detail.value || '').toUpperCase())}
                    maxlength={8}
                  />
                </View>
                <View
                  onClick={pasteCode}
                  className="ml-2 px-3 py-2 bg-white rounded-full border border-[#FFD6DC] shrink-0"
                >
                  <Text className="block text-xs text-[#FF4757]">粘贴</Text>
                </View>
              </View>
              <Button
                onClick={() => joinByCode(codeInput, userId)}
                disabled={joining || !codeInput}
                variant="outline"
                className="w-full border-[#FF4757] text-[#FF4757] rounded-full h-12 text-base font-bold"
              >
                {joining ? '加入中...' : '加入队伍'}
              </Button>
            </CardContent>
          </Card>
        </>
      )}

      {/* 奖品展示 */}
      {(status.leader_prize || (status.member_prizes && status.member_prizes.length > 0)) && (
        <Card className="rounded-2xl border-0 shadow-xl mb-4">
          <CardContent className="p-5">
            <View className="flex items-center gap-2 mb-4">
              <Gift size={20} color="#FF4757" />
              <Text className="block text-base font-bold text-gray-900">奖品展示</Text>
            </View>
            {status.leader_prize && (
              <View className="mb-4">
                <View className="flex items-center gap-2 mb-2">
                  <Trophy size={16} color="#f59e0b" />
                  <Text className="block text-sm font-bold text-gray-900">团长必中奖品</Text>
                </View>
                <View className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-xl p-3 flex items-center gap-3">
                  <View className="w-16 h-16 rounded-lg bg-white overflow-hidden shrink-0 flex items-center justify-center shadow-sm">
                    {status.leader_prize.image_url ? (
                      <Image src={status.leader_prize.image_url} className="w-full h-full" mode="aspectFill" />
                    ) : (
                      <Trophy size={28} color="#f59e0b" />
                    )}
                  </View>
                  <View className="flex-1 min-w-0">
                    <Text className="block text-sm font-bold text-gray-900 mb-1">{status.leader_prize.name}</Text>
                    <View className="inline-block px-2 py-1 bg-yellow-400 rounded">
                      <Text className="block text-xs text-white font-bold">团长必中</Text>
                    </View>
                  </View>
                </View>
              </View>
            )}
            {status.member_prizes && status.member_prizes.length > 0 && (
              <View>
                <View className="flex items-center gap-2 mb-3">
                  <Users size={16} color="#3B82F6" />
                  <Text className="block text-sm font-bold text-gray-900">团员奖品池</Text>
                </View>
                <View className="grid grid-cols-3 gap-3">
                  {status.member_prizes.map((p) => (
                    <View key={p.id} className="bg-gray-50 rounded-xl p-3 text-center">
                      <View className="w-12 h-12 rounded-lg bg-white overflow-hidden mx-auto mb-2 flex items-center justify-center shadow-sm">
                        {p.image_url ? <Image src={p.image_url} className="w-full h-full" mode="aspectFill" /> : <Gift size={22} color="#3B82F6" />}
                      </View>
                      <Text className="block text-xs text-gray-900 font-bold truncate mb-1">{p.name}</Text>
                      <Text className="block text-xs text-[#3B82F6]">{p.probability}%</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </CardContent>
        </Card>
      )}

      {/* 推荐团购套餐 */}
      {status.package && (
        <Card className="rounded-2xl border-0 shadow-xl mb-4">
          <CardContent className="p-5">
            <View className="flex items-center gap-2 mb-4">
              <Sparkles size={18} color="#FF4757" />
              <Text className="text-base font-bold text-gray-900">推荐更多团购套餐</Text>
            </View>
            <View className="flex items-start gap-3">
              <View className="w-20 h-20 rounded-xl bg-gray-100 overflow-hidden shrink-0 flex items-center justify-center">
                {status.package.cover_image ? (
                  <Image src={status.package.cover_image} className="w-full h-full" mode="aspectFill" />
                ) : (
                  <Gift size={28} color="#9CA3AF" />
                )}
              </View>
              <View className="flex-1 min-w-0">
                <Text className="block text-base font-bold text-gray-900 mb-1">{status.package.name}</Text>
                {status.package.description && (
                  <Text className="block text-xs text-gray-500 leading-5 mb-2">{status.package.description}</Text>
                )}
                <View className="flex items-baseline gap-2">
                  <Text className="block text-lg font-bold text-[#FF4757]">¥{Number(status.package.price || 0).toFixed(2)}</Text>
                  {status.package.original_price && Number(status.package.original_price) > 0 && (
                    <Text className="block text-xs text-gray-400 line-through">¥{Number(status.package.original_price).toFixed(2)}</Text>
                  )}
                </View>
              </View>
            </View>
          </CardContent>
        </Card>
      )}

      {/* 规则说明 */}
      <View className="mt-6 px-2">
        <Text className="block text-xs text-white text-opacity-80 text-center leading-5">
          1. 购买本店套餐支付成功后可开团{'\n'}
          2. 邀请好友加入队伍，满 {status.team_size} 人即可开奖{'\n'}
          3. 成团后所有成员（含团长）均可抽奖一次，团长必中团长奖品{'\n'}
          4. 队伍 {status.duration_hours} 小时内未满员将自动解散
        </Text>
      </View>

      {/* Toast */}
      {toast && (
        <View className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black bg-opacity-70 px-5 py-3 rounded-xl z-50">
          <Text className="block text-white text-sm text-center">{toast}</Text>
        </View>
      )}
    </View>
  )
}
