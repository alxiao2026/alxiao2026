import { useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { View, Text, ScrollView } from '@tarojs/components'
import { Network } from '@/network'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { HandCoins, Settings, CircleCheck, CircleX, Clock } from 'lucide-react-taro'

interface WithdrawItem {
  id: string
  user_id: string
  amount: number
  status: string
  reject_reason: string | null
  created_at: string
  processed_at: string | null
}

interface DistConfig {
  enabled: boolean
  level1_rate: number
  level2_rate: number
  merchant_rate: number
  pool_rate: number
  platform_rate: number
  cooling_days: number
  min_withdraw: number
  bind_expire_days: number
}

interface FundsOverview {
  pending_amount: number
  settled_amount: number
  revoked_amount: number
  pending_count: number
}

const fmt = (n: number) => (Math.round(Number(n) * 100) / 100).toFixed(2)

function formatTime(iso?: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

export default function DistributionAudit() {
  const [tab, setTab] = useState('pending')
  const [list, setList] = useState<WithdrawItem[]>([])
  const [loading, setLoading] = useState(true)
  const [config, setConfig] = useState<DistConfig | null>(null)
  const [configForm, setConfigForm] = useState({ merchant: '70', pool: '20', platform: '10', level1: '60', level2: '40', coolingDays: '7', minWithdraw: '1', bindExpireDays: '0' })
  const [savingConfig, setSavingConfig] = useState(false)
  const [funds, setFunds] = useState<FundsOverview | null>(null)

  const fetchList = async (status?: string) => {
    setLoading(true)
    try {
      const url = status ? `/api/distribution/admin/withdraws?status=${status}` : '/api/distribution/admin/withdraws'
      const res = await Network.request({ url })
      console.log('[分销审核] 列表:', res.data)
      setList(res.data?.data || [])
    } catch (err) {
      console.error('[分销审核] 加载失败:', err)
      Taro.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  const fetchConfig = async () => {
    try {
      const res = await Network.request({ url: '/api/distribution/config' })
      console.log('[分销配置]:', res.data)
      const c = res.data?.data
      if (c) {
        setConfig(c)
        setConfigForm({
          merchant: String(Number(c.merchant_rate ?? 70)),
          pool: String(Number(c.pool_rate ?? 20)),
          platform: String(Number(c.platform_rate ?? 10)),
          level1: String(Number(c.level1_rate)),
          level2: String(Number(c.level2_rate)),
          coolingDays: String(Number(c.cooling_days ?? 7)),
          minWithdraw: String(Number(c.min_withdraw)),
          bindExpireDays: String(Number(c.bind_expire_days ?? 0)),
        })
      }
    } catch (err) {
      console.error('[分销配置] 加载失败:', err)
    }
  }

  const fetchFunds = async () => {
    try {
      const res = await Network.request({ url: '/api/distribution/admin/funds' })
      console.log('[分销资金]:', res.data)
      setFunds(res.data?.data || null)
    } catch (err) {
      console.error('[分销资金] 加载失败:', err)
    }
  }

  useDidShow(() => {
    fetchList(tab === 'config' ? undefined : tab === 'all' ? undefined : tab)
    fetchConfig()
    fetchFunds()
  })

  const handleTabChange = (v: string) => {
    setTab(v)
    if (v !== 'config') fetchList(v === 'all' ? undefined : v)
  }

  const handleAudit = (item: WithdrawItem, action: 'approve' | 'reject') => {
    if (action === 'reject') {
      Taro.showModal({
        title: '驳回提现',
        content: `驳回 ${item.user_id} 的 ¥${fmt(item.amount)} 提现申请？金额将退回账户余额`,
        confirmText: '确认驳回',
        confirmColor: '#EF4444',
        success: (r) => { if (r.confirm) doAudit(item.id, action, '审核未通过') },
      })
      return
    }
    Taro.showModal({
      title: '通过提现',
      content: `确认向 ${item.user_id} 打款 ¥${fmt(item.amount)}？`,
      confirmText: '确认通过',
      success: (r) => { if (r.confirm) doAudit(item.id, action) },
    })
  }

  const doAudit = async (id: string, action: 'approve' | 'reject', reason?: string) => {
    try {
      const res = await Network.request({
        url: `/api/distribution/admin/withdraws/${id}/audit`,
        method: 'POST',
        data: { action, reject_reason: reason },
      })
      console.log('[分销审核] 审核结果:', res.data)
      Taro.showToast({ title: action === 'approve' ? '已通过' : '已驳回', icon: 'success' })
      fetchList(tab === 'all' ? undefined : tab)
    } catch (err: any) {
      Taro.showToast({ title: err?.data?.message || '操作失败', icon: 'none' })
    }
  }

  const handleSaveConfig = async () => {
    const merchant = parseFloat(configForm.merchant) || 0
    const pool = parseFloat(configForm.pool) || 0
    const platform = parseFloat(configForm.platform) || 0
    const l1 = parseFloat(configForm.level1) || 0
    const l2 = parseFloat(configForm.level2) || 0
    const coolingDays = parseInt(configForm.coolingDays, 10) || 0
    const minW = parseFloat(configForm.minWithdraw) || 0
    const bindDays = parseInt(configForm.bindExpireDays, 10) || 0
    if (Math.round(merchant + pool + platform) !== 100) {
      Taro.showToast({ title: '商家/分销池/平台合计须为 100%', icon: 'none' })
      return
    }
    if (Math.round(l1 + l2) !== 100) {
      Taro.showToast({ title: '一级 + 二级瓜分比例合计须为 100%', icon: 'none' })
      return
    }
    if (coolingDays < 0 || bindDays < 0) {
      Taro.showToast({ title: '天数不能为负数', icon: 'none' })
      return
    }
    doSave({ merchant, pool, platform, l1, l2, coolingDays, minW, bindDays })
  }

  const doSave = async (p: { merchant: number; pool: number; platform: number; l1: number; l2: number; coolingDays: number; minW: number; bindDays: number }) => {
    setSavingConfig(true)
    try {
      const res = await Network.request({
        url: '/api/distribution/config',
        method: 'PUT',
        data: {
          merchant_rate: p.merchant,
          pool_rate: p.pool,
          platform_rate: p.platform,
          level1_rate: p.l1,
          level2_rate: p.l2,
          cooling_days: p.coolingDays,
          min_withdraw: p.minW,
          bind_expire_days: p.bindDays,
        },
      })
      console.log('[分销配置] 保存:', res.data)
      Taro.showToast({ title: '配置已保存', icon: 'success' })
      fetchConfig()
    } catch (err: any) {
      Taro.showToast({ title: err?.data?.message || '保存失败', icon: 'none' })
    } finally {
      setSavingConfig(false)
    }
  }

  const statusMeta = (status: string) => {
    if (status === 'approved') return { text: '已打款', color: '#10B981', icon: <CircleCheck size={14} color="#10B981" /> }
    if (status === 'rejected') return { text: '已驳回', color: '#EF4444', icon: <CircleX size={14} color="#EF4444" /> }
    return { text: '待审核', color: '#F59E0B', icon: <Clock size={14} color="#F59E0B" /> }
  }

  return (
    <View className="min-h-screen bg-gray-50">
      <Tabs value={tab} onValueChange={handleTabChange}>
        <View className="bg-white px-4 pt-3 pb-1 sticky top-0 z-10">
          <TabsList className="w-full bg-gray-100 rounded-xl">
            <TabsTrigger value="pending" className="flex-1 text-xs">待审核</TabsTrigger>
            <TabsTrigger value="all" className="flex-1 text-xs">全部</TabsTrigger>
            <TabsTrigger value="config" className="flex-1 text-xs">分销配置</TabsTrigger>
          </TabsList>
        </View>

        {['pending', 'all'].map((statusKey) => (
          <TabsContent key={statusKey} value={statusKey}>
            <ScrollView scrollY className="h-screen">
              <View className="px-4 pt-3 pb-10">
                {loading ? (
                  <View className="flex flex-col gap-3">
                    {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}
                  </View>
                ) : list.length === 0 ? (
                  <View className="py-20 flex flex-col items-center">
                    <HandCoins size={36} color="#D1D5DB" />
                    <Text className="block text-sm text-gray-400 mt-3">{statusKey === 'pending' ? '暂无待审核提现' : '暂无提现记录'}</Text>
                  </View>
                ) : (
                  list.map((item) => {
                    const meta = statusMeta(item.status)
                    return (
                      <View key={item.id} className="bg-white rounded-2xl p-4 mb-3 shadow-sm">
                        <View className="flex flex-row items-center justify-between mb-2">
                          <Text className="block text-lg font-bold text-gray-900">¥{fmt(item.amount)}</Text>
                          <View className="flex flex-row items-center gap-1">
                            {meta.icon}
                            <Text className="text-xs font-medium" style={{ color: meta.color }}>{meta.text}</Text>
                          </View>
                        </View>
                        <Text className="block text-xs text-gray-500 mb-1">申请人：{item.user_id}</Text>
                        <Text className="block text-xs text-gray-400">
                          申请时间：{formatTime(item.created_at)}
                          {item.processed_at ? ` · 处理：${formatTime(item.processed_at)}` : ''}
                        </Text>
                        {item.status === 'rejected' && item.reject_reason ? (
                          <Text className="block text-xs text-red-500 mt-1">驳回原因：{item.reject_reason}</Text>
                        ) : null}
                        {item.status === 'pending' && (
                          <View className="flex flex-row gap-3 mt-3">
                            <View className="flex-1">
                              <Button onClick={() => handleAudit(item, 'approve')} className="w-full bg-green-500 text-white rounded-full">
                                <Text className="text-white text-sm">通过并打款</Text>
                              </Button>
                            </View>
                            <View className="flex-1">
                              <Button onClick={() => handleAudit(item, 'reject')} className="w-full bg-white border border-red-300 text-red-500 rounded-full">
                                <Text className="text-red-500 text-sm">驳回</Text>
                              </Button>
                            </View>
                          </View>
                        )}
                      </View>
                    )
                  })
                )}
              </View>
            </ScrollView>
          </TabsContent>
        ))}

        <TabsContent value="config">
          <ScrollView scrollY className="h-screen">
            <View className="px-4 pt-3 pb-10">
              {/* 资金看板 */}
              {funds && (
                <View className="rounded-2xl p-4 mb-3" style={{ background: 'linear-gradient(135deg,#1A1A2E,#16213E)' }}>
                  <Text className="block text-xs text-amber-300 mb-3">分销激励池资金（每单 {Number(config?.pool_rate ?? 20)}% 注入）</Text>
                  <View className="flex flex-row">
                    <View className="flex-1">
                      <Text className="block text-lg font-bold text-amber-400">¥{fmt(funds.pending_amount)}</Text>
                      <Text className="block text-xs text-gray-400 mt-1">待入账({funds.pending_count})</Text>
                    </View>
                    <View className="flex-1">
                      <Text className="block text-lg font-bold text-green-400">¥{fmt(funds.settled_amount)}</Text>
                      <Text className="block text-xs text-gray-400 mt-1">已结算</Text>
                    </View>
                    <View className="flex-1">
                      <Text className="block text-lg font-bold text-red-400">¥{fmt(funds.revoked_amount)}</Text>
                      <Text className="block text-xs text-gray-400 mt-1">退款回收</Text>
                    </View>
                  </View>
                </View>
              )}

              {/* 订单分账比例 */}
              <View className="bg-white rounded-2xl p-4 shadow-sm mb-3">
                <View className="flex flex-row items-center gap-2 mb-1">
                  <Settings size={16} color="#6B7280" />
                  <Text className="block text-base font-semibold text-gray-900">订单分账比例</Text>
                </View>
                <Text className="block text-xs text-gray-400 mb-4">每笔订单实付在三方的分配，合计须为 100%</Text>
                {([
                  { key: 'merchant' as const, label: '商家基础收入', desc: '核销后划转给商家' },
                  { key: 'pool' as const, label: '分销激励池', desc: '分给两级种草官' },
                  { key: 'platform' as const, label: '平台服务费', desc: '平台另出团长战队奖与伯乐奖' },
                ]).map((row) => (
                  <View key={row.key} className="mb-4">
                    <Text className="block text-sm font-medium text-gray-800 mb-1">{row.label}</Text>
                    <View className="flex flex-row items-center gap-2">
                      <View className="flex-1 bg-gray-50 rounded-lg">
                        <Input
                          type="digit"
                          value={configForm[row.key]}
                          onInput={(e) => setConfigForm({ ...configForm, [row.key]: e.detail.value })}
                          className="w-full px-3 py-2 text-sm bg-transparent"
                        />
                      </View>
                      <Text className="text-sm text-gray-500">%</Text>
                    </View>
                    <Text className="block text-xs text-gray-400 mt-1">{row.desc}</Text>
                  </View>
                ))}
              </View>

              {/* 激励池瓜分（两级） */}
              <View className="bg-white rounded-2xl p-4 shadow-sm mb-3">
                <Text className="block text-base font-semibold text-gray-900 mb-1">激励池瓜分（两级）</Text>
                <Text className="block text-xs text-gray-400 mb-4">激励池在一、二级种草官之间的分配，合计须为 100%</Text>
                {([
                  { key: 'level1' as const, label: '一级种草官（直推）', desc: '好友下单，推荐人得' },
                  { key: 'level2' as const, label: '二级种草官（间推）', desc: '好友的好友下单得' },
                ]).map((row) => (
                  <View key={row.key} className="mb-4">
                    <Text className="block text-sm font-medium text-gray-800 mb-1">{row.label}</Text>
                    <View className="flex flex-row items-center gap-2">
                      <View className="flex-1 bg-gray-50 rounded-lg">
                        <Input
                          type="digit"
                          value={configForm[row.key]}
                          onInput={(e) => setConfigForm({ ...configForm, [row.key]: e.detail.value })}
                          className="w-full px-3 py-2 text-sm bg-transparent"
                        />
                      </View>
                      <Text className="text-sm text-gray-500">%</Text>
                    </View>
                    <Text className="block text-xs text-gray-400 mt-1">{row.desc}</Text>
                  </View>
                ))}
              </View>

              {/* 结算与提现规则 */}
              <View className="bg-white rounded-2xl p-4 shadow-sm">
                <Text className="block text-base font-semibold text-gray-900 mb-4">结算与提现规则</Text>
                <View className="flex items-center gap-3 mb-4">
                  <Text className="text-sm text-gray-700 w-24">佣金冷静期</Text>
                  <View className="flex-1 bg-gray-50 rounded-lg">
                    <Input
                      type="number"
                      value={configForm.coolingDays}
                      onInput={(e) => setConfigForm({ ...configForm, coolingDays: e.detail.value })}
                      className="w-full px-3 py-2 text-sm bg-transparent"
                    />
                  </View>
                  <Text className="text-sm text-gray-500">天</Text>
                </View>
                <View className="flex items-center gap-3 mb-4">
                  <Text className="text-sm text-gray-700 w-24">最低提现</Text>
                  <View className="flex-1 bg-gray-50 rounded-lg">
                    <Input
                      type="digit"
                      value={configForm.minWithdraw}
                      onInput={(e) => setConfigForm({ ...configForm, minWithdraw: e.detail.value })}
                      className="w-full px-3 py-2 text-sm bg-transparent"
                    />
                  </View>
                  <Text className="text-sm text-gray-500">元</Text>
                </View>
                <View className="flex items-center gap-3 mb-2">
                  <Text className="text-sm text-gray-700 w-24">绑定有效期</Text>
                  <View className="flex-1 bg-gray-50 rounded-lg">
                    <Input
                      type="number"
                      value={configForm.bindExpireDays}
                      onInput={(e) => setConfigForm({ ...configForm, bindExpireDays: e.detail.value })}
                      placeholder="0 表示永久"
                      className="w-full px-3 py-2 text-sm bg-transparent"
                    />
                  </View>
                  <Text className="text-sm text-gray-500">天</Text>
                </View>
                <Text className="block text-xs text-gray-400 mb-4">绑定关系超过该天数自动失效，不再参与分佣；填 0 表示永久有效</Text>

                {config && (
                  <View className="bg-blue-50 rounded-lg p-3 mb-4">
                    <Text className="block text-xs text-blue-700">
                      当前：商家 {Number(config.merchant_rate)}% · 池 {Number(config.pool_rate)}% · 平台 {Number(config.platform_rate)}%｜一级 {Number(config.level1_rate)}% · 二级 {Number(config.level2_rate)}%｜冷静期 {Number(config.cooling_days)} 天 · 最低提现 ¥{Number(config.min_withdraw)}
                    </Text>
                  </View>
                )}

                <Button onClick={handleSaveConfig} disabled={savingConfig} className="w-full bg-[#FF4757] text-white rounded-full">
                  <Text className="text-white text-sm font-medium">{savingConfig ? '保存中...' : '保存配置'}</Text>
                </Button>
              </View>
            </View>
          </ScrollView>
        </TabsContent>
      </Tabs>
    </View>
  )
}
