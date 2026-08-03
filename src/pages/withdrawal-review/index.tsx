import { useEffect, useState, useCallback } from 'react'
import { View, Text, Image } from '@tarojs/components'
import Taro, { usePullDownRefresh, useReachBottom } from '@tarojs/taro'
import { Banknote, CircleCheck, CircleX, Store, Clock, CreditCard, Upload, X } from 'lucide-react-taro'
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
import { Input } from '@/components/ui/input'

interface WithdrawalRecord {
  id: string
  merchant_id: number
  merchant_name?: string
  amount: number
  status: string
  requested_at: string
  updated_at: string
  bank_account_name?: string
  bank_card_no?: string
  bank_name?: string
  bank_branch?: string
  payment_proof_image?: string
  payment_transaction_no?: string
  payment_proof_note?: string
}

type TabType = 'pending' | 'all'

export default function WithdrawalReview() {
  const [activeTab, setActiveTab] = useState<TabType>('pending')
  const [records, setRecords] = useState<WithdrawalRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [rejectTarget, setRejectTarget] = useState<WithdrawalRecord | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  // 打款凭证弹窗
  const [payTarget, setPayTarget] = useState<WithdrawalRecord | null>(null)
  const [proofImage, setProofImage] = useState('')
  const [transactionNo, setTransactionNo] = useState('')
  const [proofNote, setProofNote] = useState('')
  const [uploadingProof, setUploadingProof] = useState(false)

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

  /** 打开打款凭证弹窗（强制上传打款记录后才能确认） */
  const handleMarkPaid = (record: WithdrawalRecord) => {
    setPayTarget(record)
    setProofImage('')
    setTransactionNo('')
    setProofNote('')
  }

  /** 上传打款凭证图片 */
  const pickProofImage = async () => {
    try {
      const res = await Taro.chooseImage({ count: 1, sizeType: ['compressed'] })
      const filePath = res.tempFilePaths?.[0]
      if (!filePath) return
      setUploadingProof(true)
      const uploadRes = await Network.uploadFile({ url: '/api/upload', filePath, name: 'file' })
      const body = typeof uploadRes.data === 'string' ? JSON.parse(uploadRes.data) : uploadRes.data
      console.log('[withdrawal-review] 凭证上传响应:', body)
      const url = body?.data?.url
      if (!url) throw new Error(body?.msg || body?.message || '上传失败')
      setProofImage(url)
    } catch (e: any) {
      if (e?.errMsg?.includes('cancel')) return
      Taro.showToast({ title: e?.message || '上传失败，请重试', icon: 'none' })
    } finally {
      setUploadingProof(false)
    }
  }

  /** 提交确认打款（强制凭证关卡） */
  const submitMarkPaid = async () => {
    if (!payTarget) return
    if (!proofImage && !transactionNo.trim() && !proofNote.trim()) {
      Taro.showToast({ title: '请上传凭证图片，或填写打款单号/说明', icon: 'none' })
      return
    }
    setProcessing(true)
    try {
      const res = await Network.request({
        url: `/api/settlement/withdrawals/${payTarget.id}/mark-paid`,
        method: 'POST',
        data: {
          admin_user_id: getAdminUserId(),
          payment_proof_image: proofImage || undefined,
          payment_transaction_no: transactionNo.trim() || undefined,
          payment_proof_note: proofNote.trim() || undefined,
        },
      })
      const body = res.data as any
      if (res.statusCode >= 400 || body?.code !== 200) {
        throw new Error(body?.message || body?.msg || '操作失败')
      }
      Taro.showToast({ title: '已确认打款', icon: 'success' })
      setPayTarget(null)
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

                {/* 商家收款银行卡（打款参照） */}
                {record.bank_card_no ? (
                  <View className="bg-gray-50 rounded-xl p-3 mb-3">
                    <View className="flex flex-row items-center mb-1">
                      <CreditCard size={14} color="#FF4757" />
                      <Text className="text-xs font-medium text-gray-700 ml-1">收款银行卡</Text>
                    </View>
                    <Text className="block text-sm text-gray-800">
                      {record.bank_name || '银行卡'}{record.bank_branch ? ` · ${record.bank_branch}` : ''}
                    </Text>
                    <Text className="block text-sm text-gray-800 mt-1">
                      {record.bank_card_no}（{record.bank_account_name || '未填写户名'}）
                    </Text>
                  </View>
                ) : record.status === 'pending' ? (
                  <View className="bg-yellow-50 rounded-xl p-3 mb-3">
                    <Text className="block text-xs text-yellow-700">
                      该商家暂未填写收款银行卡，请先联系商家在「商家管理 → 资质与收款」中完善
                    </Text>
                  </View>
                ) : null}

                {/* 已到账：展示打款凭证 */}
                {record.status === 'success' &&
                  (record.payment_proof_image || record.payment_transaction_no || record.payment_proof_note) && (
                    <View className="bg-green-50 rounded-xl p-3 mb-3">
                      <Text className="block text-xs font-medium text-green-700 mb-1">打款凭证</Text>
                      {record.payment_proof_image ? (
                        <Image
                          src={record.payment_proof_image}
                          className="w-20 h-20 rounded-lg bg-white"
                          mode="aspectFill"
                          onClick={() =>
                            Taro.previewImage({
                              urls: [record.payment_proof_image as string],
                              current: record.payment_proof_image,
                            })
                          }
                        />
                      ) : null}
                      {record.payment_transaction_no ? (
                        <Text className="block text-xs text-gray-600 mt-1">
                          打款单号：{record.payment_transaction_no}
                        </Text>
                      ) : null}
                      {record.payment_proof_note ? (
                        <Text className="block text-xs text-gray-600 mt-1">
                          说明：{record.payment_proof_note}
                        </Text>
                      ) : null}
                    </View>
                  )}

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

      {/* 打款凭证弹窗（强制关卡：先上传打款记录，再确认打款） */}
      <Dialog open={!!payTarget} onOpenChange={(open) => !open && setPayTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认打款</DialogTitle>
          </DialogHeader>
          <View className="py-2">
            <Text className="block text-sm text-gray-600 mb-3">
              向「{payTarget?.merchant_name || `商家${payTarget?.merchant_id}`}」打款 ¥
              {Number(payTarget?.amount || 0).toFixed(2)}，请先上传打款记录
            </Text>

            {/* 收款银行卡参照 */}
            {payTarget?.bank_card_no ? (
              <View className="bg-gray-50 rounded-xl p-3 mb-3">
                <View className="flex flex-row items-center mb-1">
                  <CreditCard size={14} color="#FF4757" />
                  <Text className="text-xs font-medium text-gray-700 ml-1">收款银行卡</Text>
                </View>
                <Text className="block text-sm text-gray-800">
                  {payTarget.bank_name || '银行卡'}
                  {payTarget.bank_branch ? ` · ${payTarget.bank_branch}` : ''}
                </Text>
                <Text className="block text-sm text-gray-800 mt-1">
                  {payTarget.bank_card_no}（{payTarget.bank_account_name || '未填写户名'}）
                </Text>
              </View>
            ) : (
              <View className="bg-yellow-50 rounded-xl p-3 mb-3">
                <Text className="block text-xs text-yellow-700">
                  商家未填写收款银行卡，请线下确认收款方式后再打款
                </Text>
              </View>
            )}

            {/* 凭证图片上传 */}
            <Text className="block text-sm font-medium text-gray-700 mb-2">打款凭证截图</Text>
            {proofImage ? (
              <View className="relative mb-3">
                <Image
                  src={proofImage}
                  className="w-full h-40 rounded-xl bg-gray-100"
                  mode="aspectFit"
                  onClick={() => Taro.previewImage({ urls: [proofImage], current: proofImage })}
                />
                <View
                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black bg-opacity-50 flex items-center justify-center"
                  onClick={() => setProofImage('')}
                >
                  <X size={14} color="#ffffff" />
                </View>
              </View>
            ) : (
              <View
                className="h-28 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 flex flex-col items-center justify-center mb-3"
                onClick={pickProofImage}
              >
                {uploadingProof ? (
                  <Text className="block text-sm text-gray-400">上传中...</Text>
                ) : (
                  <>
                    <Upload size={24} color="#9ca3af" />
                    <Text className="block text-xs text-gray-400 mt-1">上传转账截图</Text>
                  </>
                )}
              </View>
            )}

            {/* 打款单号 */}
            <Text className="block text-sm font-medium text-gray-700 mb-2">打款单号</Text>
            <View className="mb-3">
              <Input
                className="w-full"
                placeholder="银行转账流水号 / 微信转账单号"
                value={transactionNo}
                onInput={(e) => setTransactionNo(e.detail.value)}
              />
            </View>

            {/* 文字说明 */}
            <Text className="block text-sm font-medium text-gray-700 mb-2">文字说明</Text>
            <View className="bg-gray-50 rounded-xl p-3 mb-2">
              <Textarea
                style={{ width: '100%', minHeight: '60px', backgroundColor: 'transparent' }}
                placeholder="如：已于 14:30 通过招行转账至商家工行卡"
                value={proofNote}
                onInput={(e) => setProofNote(e.detail.value)}
                maxlength={200}
              />
            </View>
            <Text className="block text-xs text-gray-400">
              凭证截图、打款单号、文字说明至少提供一项，提交后状态将变为「已到账」
            </Text>
          </View>
          <DialogFooter>
            <View className="flex flex-row gap-3 w-full">
              <View className="flex-1">
                <Button variant="outline" className="w-full" onClick={() => setPayTarget(null)}>
                  <Text>取消</Text>
                </Button>
              </View>
              <View className="flex-1">
                <Button
                  className="w-full"
                  disabled={processing || uploadingProof}
                  onClick={submitMarkPaid}
                >
                  <Text>{processing ? '提交中...' : '确认打款'}</Text>
                </Button>
              </View>
            </View>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
