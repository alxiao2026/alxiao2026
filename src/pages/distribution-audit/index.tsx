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
  level3_rate: number
  min_withdraw: number
  bind_expire_days: number
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
  const [configForm, setConfigForm] = useState({ level1: '10', level2: '5', level3: '2', minWithdraw: '10', bindExpireDays: '0' })
  const [savingConfig, setSavingConfig] = useState(false)

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
          level1: String(Number(c.level1_rate)),
          level2: String(Number(c.level2_rate)),
          level3: String(Number(c.level3_rate)),
          minWithdraw: String(Number(c.min_withdraw)),
          bindExpireDays: String(Number(c.bind_expire_days ?? 0)),
        })
      }
    } catch (err) {
      console.error('[分销配置] 加载失败:', err)
    }
  }

  useDidShow(() => {
    fetchList(tab === 'config' ? undefined : tab === 'all' ? undefined : tab)
    fetchConfig()
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
    const l1 = parseFloat(configForm.level1) || 0
    const l2 = parseFloat(configForm.level2) || 0
    const l3 = parseFloat(configForm.level3) || 0
    const minW = parseFloat(configForm.minWithdraw) || 0
    const bindDays = parseInt(configForm.bindExpireDays, 10) || 0
    if (l1 < 0 || l2 < 0 || l3 < 0 || l1 > 100 || l2 > 100 || l3 > 100) {
      Taro.showToast({ title: '佣金比例需在 0-100 之间', icon: 'none' })
      return
    }
    if (bindDays < 0) {
      Taro.showToast({ title: '绑定有效天数不能为负数', icon: 'none' })
      return
    }
    if (l1 + l2 + l3 > 50) {
      Taro.showModal({ title: '提示', content: `三级佣金合计 ${l1 + l2 + l3}%，超过 50% 可能导致亏损，确认保存？`, success: (r) => { if (r.confirm) doSave(l1, l2, l3, minW, bindDays) } })
      return
    }
    doSave(l1, l2, l3, minW, bindDays)
  }

  const doSave = async (l1: number, l2: number, l3: number, minW: number, bindDays: number) => {
    setSavingConfig(true)
    try {
      const res = await Network.request({
        url: '/api/distribution/config',
        method: 'PUT',
        data: { level1_rate: l1, level2_rate: l2, level3_rate: l3, min_withdraw: minW, bind_expire_days: bindDays },
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
              <View className="bg-white rounded-2xl p-4 shadow-sm">
                <View className="flex flex-row items-center gap-2 mb-4">
                  <Settings size={16} color="#6B7280" />
                  <Text className="block text-base font-semibold text-gray-900">三级佣金比例</Text>
                </View>

                {([
                  { key: 'level1' as const, label: '一级佣金（直推）', desc: '好友下单，推荐人得' },
                  { key: 'level2' as const, label: '二级佣金（间推）', desc: '好友的好友下单得' },
                  { key: 'level3' as const, label: '三级佣金', desc: '第三代好友下单得' },
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

                <View className="mb-4">
                  <Text className="block text-sm font-medium text-gray-800 mb-1">最低提现金额（元）</Text>
                  <View className="bg-gray-50 rounded-lg">
                    <Input
                      type="digit"
                      value={configForm.minWithdraw}
                      onInput={(e) => setConfigForm({ ...configForm, minWithdraw: e.detail.value })}
                      className="w-full px-3 py-2 text-sm bg-transparent"
                    />
                  </View>
                </View>

                {/* 绑定有效天数 */}
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
                <Text className="block text-xs text-gray-400 mb-4">下级绑定关系超过该天数后自动失效，不再参与分佣；填 0 表示永久有效</Text>

                {config && (
                  <View className="bg-blue-50 rounded-lg p-3 mb-4">
                    <Text className="block text-xs text-blue-700">
                      当前：一级 {Number(config.level1_rate)}% · 二级 {Number(config.level2_rate)}% · 三级 {Number(config.level3_rate)}% · 最低提现 ¥{Number(config.min_withdraw)} · 绑定 {Number(config.bind_expire_days) === 0 ? '永久' : `${Number(config.bind_expire_days)} 天`}
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
