import { useEffect, useState, useCallback } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { usePullDownRefresh, useReachBottom } from '@tarojs/taro'
import { Banknote, CircleCheck, CircleX, Store, Clock } from 'lucide-react-taro'
import { Network } from '@/network'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'

interface WithdrawalRecord {
  id: string
  merchant_id: number
  merchant_name?: string
  amount: number
  status: string
  requested_at: string
  updated_at: string
}

type TabType = 'pending' | 'all'

export default function WithdrawalReview() {
  const [activeTab, setActiveTab] = useState<TabType>('pending')
  const [records, setRecords] = useState<WithdrawalRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [rejectTarget, setRejectTarget] = useState<WithdrawalRecord | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  const getAdminUserId = () =>
    Taro.getStorageSync('user_id') || Taro.getStorageSync('userInfo')?.user_id || ''

  const fetchRecords = useCallback(async (tab: TabType) => {
    setLoading(true)
    try {
      const adminUserId = getAdminUserId()
      const query = tab === 'pending' ? '&status=pending' : ''
      const res = await Network.request({
        url: `/api/settlement/withdrawals?admin_user_id=${encodeURIComponent(adminUserId)}${query}`,
      })
      console.log('[withdrawal-review] 列表响应:', res.data)
      const data = (res.data as any)?.data
      setRecords(Array.isArray(data) ? data : [])
    } catch (e: any) {
      console.error('[withdrawal-review] 加载失败:', e)
      Taro.showToast({ title: e?.message || '加载失败', icon: 'none' })
      setRecords([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRecords(activeTab)
  }, [activeTab, fetchRecords])

  usePullDownRefresh(async () => {
    await fetchRecords(activeTab)
    Taro.stopPullDownRefresh()
  })

  useReachBottom(() => {
    // 记录量小，暂不分页
  })

  const handleMarkPaid = async (record: WithdrawalRecord) => {
    const confirm = await Taro.showModal({
      title: '确认打款',
      content: `确认已向「${record.merchant_name || `商家${record.merchant_id}`}」打款 ¥${Number(record.amount).toFixed(2)} 吗？`,
      confirmText: '已打款',
      cancelText: '再想想',
    })
    if (!confirm.confirm) return

    setProcessing(true)
    try {
      const res = await Network.request({
        url: `/api/settlement/withdrawals/${record.id}/mark-paid`,
        method: 'POST',
        data: { admin_user_id: getAdminUserId() },
      })
      const body = res.data as any
      if (res.statusCode >= 400 || body?.code !== 200) {
        throw new Error(body?.message || body?.msg || '操作失败')
      }
      Taro.showToast({ title: '已确认打款', icon: 'success' })
      fetchRecords(activeTab)
    } catch (e: any) {
      Taro.showToast({ title: e?.message || '操作失败', icon: 'none' })
    } finally {
      setProcessing(false)
    }
  }

  const handleReject = async () => {
    if (!rejectTarget) return
    setProcessing(true)
    try {
      const res = await Network.request({
        url: `/api/settlement/withdrawals/${rejectTarget.id}/reject`,
        method: 'POST',
        data: {
          admin_user_id: getAdminUserId(),
          reason: rejectReason.trim() || undefined,
        },
      })
      const body = res.data as any
      if (res.statusCode >= 400 || body?.code !== 200) {
        throw new Error(body?.message || body?.msg || '操作失败')
      }
      Taro.showToast({ title: '已拒绝并退回余额', icon: 'success' })
      setRejectTarget(null)
      setRejectReason('')
      fetchRecords(activeTab)
    } catch (e: any) {
      Taro.showToast({ title: e?.message || '操作失败', icon: 'none' })
    } finally {
      setProcessing(false)
    }
  }

  const formatTime = (time?: string) => {
    if (!time) return '-'
    return time.replace('T', ' ').slice(0, 16)
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="border-yellow-500 text-yellow-600">待审核</Badge>
      case 'success':
        return <Badge variant="outline" className="border-green-500 text-green-600">已到账</Badge>
      case 'rejected':
        return <Badge variant="outline" className="border-red-500 text-red-600">已拒绝</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <View className="min-h-screen bg-gray-50 pb-6">
      {/* Tab 切换 */}
      <View className="bg-white px-4 pt-4 pb-3 flex flex-row gap-3">
        <View className="flex-1">
          <Button
            variant={activeTab === 'pending' ? 'default' : 'outline'}
            className="w-full"
            onClick={() => setActiveTab('pending')}
          >
            <Text>待审核</Text>
          </Button>
        </View>
        <View className="flex-1">
          <Button
            variant={activeTab === 'all' ? 'default' : 'outline'}
            className="w-full"
            onClick={() => setActiveTab('all')}
          >
            <Text>全部记录</Text>
          </Button>
        </View>
      </View>

      <View className="px-4 pt-4 flex flex-col gap-3">
        {loading ? (
          <>
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-28 w-full rounded-xl" />
          </>
        ) : records.length === 0 ? (
          <Card>
            <CardContent className="p-8 flex flex-col items-center">
              <Banknote size={40} color="#9ca3af" />
              <Text className="block text-sm text-gray-400 mt-3 text-center">
                {activeTab === 'pending' ? '暂无待审核的提现申请' : '暂无提现记录'}
              </Text>
            </CardContent>
          </Card>
        ) : (
          records.map((record) => (
            <Card key={record.id}>
              <CardContent className="p-4">
                <View className="flex flex-row items-center justify-between mb-2">
                  <View className="flex flex-row items-center">
                    <Store size={16} color="#6b7280" />
                    <Text className="text-sm font-medium text-gray-800 ml-1">
                      {record.merchant_name || `商家${record.merchant_id}`}
                    </Text>
                  </View>
                  {getStatusBadge(record.status)}
                </View>

                <Text className="block text-2xl font-bold text-gray-900 mb-2">
                  ¥{Number(record.amount).toFixed(2)}
                </Text>

                <View className="flex flex-row items-center mb-3">
                  <Clock size={13} color="#9ca3af" />
                  <Text className="text-xs text-gray-400 ml-1">
                    申请时间：{formatTime(record.requested_at)}
                  </Text>
                </View>

                {record.status === 'pending' && (
                  <View className="flex flex-row gap-3 pt-3 border-t border-gray-100">
                    <View className="flex-1">
                      <Button
                        variant="outline"
                        className="w-full border-red-300 text-red-600"
                        disabled={processing}
                        onClick={() => {
                          setRejectTarget(record)
                          setRejectReason('')
                        }}
                      >
                        <CircleX size={16} color="#dc2626" />
                        <Text className="ml-1">拒绝</Text>
                      </Button>
                    </View>
                    <View className="flex-1">
                      <Button
                        className="w-full"
                        disabled={processing}
                        onClick={() => handleMarkPaid(record)}
                      >
                        <CircleCheck size={16} color="#ffffff" />
                        <Text className="ml-1">确认打款</Text>
                      </Button>
                    </View>
                  </View>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </View>

      {/* 拒绝原因弹窗 */}
      <Dialog open={!!rejectTarget} onOpenChange={(open) => !open && setRejectTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>拒绝提现申请</DialogTitle>
          </DialogHeader>
          <View className="py-2">
            <Text className="block text-sm text-gray-600 mb-3">
              拒绝「{rejectTarget?.merchant_name || `商家${rejectTarget?.merchant_id}`}」的提现申请
              ¥{Number(rejectTarget?.amount || 0).toFixed(2)}，金额将退回商家余额。
            </Text>
            <View className="bg-gray-50 rounded-xl p-3">
              <Textarea
                style={{ width: '100%', minHeight: '80px', backgroundColor: 'transparent' }}
                placeholder="拒绝原因（选填，将通知商家）"
                value={rejectReason}
                onInput={(e) => setRejectReason(e.detail.value)}
                maxlength={200}
              />
            </View>
          </View>
          <DialogFooter>
            <View className="flex flex-row gap-3 w-full">
              <View className="flex-1">
                <Button variant="outline" className="w-full" onClick={() => setRejectTarget(null)}>
                  <Text>取消</Text>
                </Button>
              </View>
              <View className="flex-1">
                <Button
                  className="w-full bg-red-600"
                  disabled={processing}
                  onClick={handleReject}
                >
                  <Text>确认拒绝</Text>
                </Button>
              </View>
            </View>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </View>
  )
}
