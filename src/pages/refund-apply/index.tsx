import { useState, useEffect, useCallback } from 'react'
import { View, Text, ScrollView, Image } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { Network } from '@/network'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Minus, Plus, ChevronRight, CircleCheck, CircleX, ShieldCheck } from 'lucide-react-taro'
import './index.css'

interface OrderInfo {
  id: string
  package_name: string
  package_image: string | null
  price: string
  status: string
  quantity: number
  expire_date: string | null
  pay_amount?: string | null
}

interface RefundableInfo {
  order_status: string
  quantity: number
  verified_count: number
  refunded_quantity: number
  refundable_quantity: number
  pay_amount: number
  unit_pay: number
  rebate_amount: number
  already_refunded: number
}

const REFUND_REASONS = [
  '买多了，用不完',
  '买错了，选错套餐',
  '计划有变，不去了',
  '商家无法接待',
  '其他原因',
]

export default function RefundApplyPage() {
  const router = useRouter()
  const { id } = router.params

  const [order, setOrder] = useState<OrderInfo | null>(null)
  const [refundable, setRefundable] = useState<RefundableInfo | null>(null)
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [refundQty, setRefundQty] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [showReasonSheet, setShowReasonSheet] = useState(false)
  const [result, setResult] = useState<{ success: boolean; msg: string } | null>(null)

  const loadData = useCallback(async () => {
    try {
      const [orderRes, refundableRes] = await Promise.all([
        Network.request({ url: `/api/orders/${id}`, method: 'GET' }),
        Network.request({ url: `/api/payment/refundable/${id}`, method: 'GET' }),
      ])
      console.log('[RefundApply] 订单响应:', orderRes.data)
      console.log('[RefundApply] 可退信息响应:', refundableRes.data)
      const orderData = (orderRes.data as any)?.data || orderRes.data
      const refundableData = (refundableRes.data as any)?.data || refundableRes.data
      setOrder(orderData)
      setRefundable(refundableData)
      if (refundableData?.refundable_quantity > 0) {
        setRefundQty(refundableData.refundable_quantity)
      }
    } catch (err) {
      console.error('[RefundApply] 加载失败:', err)
      Taro.showToast({ title: '加载失败', icon: 'none' })
    }
  }, [id])

  useEffect(() => {
    loadData()
  }, [loadData])

  /** 退款金额预览（与后端金额引擎一致） */
  const calcPreview = () => {
    if (!refundable) return { amount: 0, note: '' }
    const { pay_amount, unit_pay, rebate_amount, already_refunded, refundable_quantity } = refundable
    const isFullRefund = refundQty === refundable_quantity
    let amount: number
    if (isFullRefund) {
      amount = Math.round(Math.max(pay_amount - rebate_amount - already_refunded, 0) * 100) / 100
    } else {
      amount = Math.round(unit_pay * refundQty * 100) / 100
      amount = Math.min(amount, Math.round((pay_amount - already_refunded) * 100) / 100)
    }

    const lines: string[] = []
    if (isFullRefund && rebate_amount > 0) {
      lines.push(`实付 ¥${pay_amount.toFixed(2)} − 已返还折扣 ¥${rebate_amount.toFixed(2)}${already_refunded > 0 ? ` − 此前已退 ¥${already_refunded.toFixed(2)}` : ''}`)
      lines.push('中奖金额已退至原账户，全额退款时扣除')
      lines.push('中奖折扣权益随退款作废，不可恢复')
    } else {
      lines.push(`按实付均价退款：¥${unit_pay.toFixed(2)} × ${refundQty} 份`)
      if (rebate_amount > 0) {
        lines.push('中奖折扣权益随退款作废，不可恢复')
      }
    }
    return { amount, note: lines.join('\n') }
  }

  const preview = calcPreview()

  const handleSubmit = async () => {
    if (submitting) return
    if (!reason) {
      Taro.showToast({ title: '请选择退款原因', icon: 'none' })
      return
    }
    setSubmitting(true)
    try {
      const userId = Taro.getStorageSync('user_id')
      console.log('[RefundApply] 提交退款:', { order_id: id, refund_quantity: refundQty, reason })
      const res = await Network.request({
        url: '/api/payment/refund',
        method: 'POST',
        data: {
          order_id: id,
          user_id: userId,
          reason,
          note: note.trim() || undefined,
          refund_quantity: refundQty,
        },
      })
      console.log('[RefundApply] 退款响应:', res.data)
      const data = (res.data as any)?.data || res.data
      setResult({ success: true, msg: data?.message || '退款成功，金额将原路返回' })
    } catch (err: any) {
      console.error('[RefundApply] 退款失败:', err)
      setResult({ success: false, msg: err?.data?.message || err?.message || '退款失败，请稍后重试' })
    } finally {
      setSubmitting(false)
    }
  }

  const maxQty = refundable?.refundable_quantity || 1

  return (
    <View className="min-h-screen bg-gray-100 pb-32">
      {/* 顶部渐变装饰背景 */}
      <View className="absolute top-0 left-0 right-0 h-40 bg-gradient-to-b from-[#FF4757] to-[#FF6B81]" />

      <ScrollView scrollY className="relative">
        {/* 商品信息卡片 */}
        <View className="mx-4 mt-4 bg-white rounded-2xl shadow-sm overflow-hidden">
          <View className="p-4 flex flex-row gap-3">
            {order?.package_image ? (
              <Image src={order.package_image} className="w-20 h-20 rounded-xl flex-shrink-0" mode="aspectFill" />
            ) : (
              <View className="w-20 h-20 rounded-xl bg-gray-100 flex-shrink-0" />
            )}
            <View className="flex-1 min-w-0">
              <Text className="block text-base font-semibold text-gray-900 leading-6" numberOfLines={2}>{order?.package_name || ''}</Text>
              <View className="flex flex-row items-baseline gap-1 mt-2">
                <Text className="block text-xs text-[#FF4757]">¥</Text>
                <Text className="block text-lg font-bold text-[#FF4757]">{refundable?.unit_pay?.toFixed(2) ?? order?.price ?? ''}</Text>
                <Text className="block text-xs text-gray-400">/份</Text>
              </View>
            </View>
          </View>
          {order?.expire_date && (
            <View className="mx-4 mb-4 bg-orange-50 rounded-xl px-3 py-2 flex flex-row items-center gap-2">
              <ShieldCheck size={15} color="#FF9F43" />
              <Text className="block text-xs text-[#B88230]">{order.expire_date}（含）前未使用订单将自动退款</Text>
            </View>
          )}
        </View>

        {/* 退款信息卡片 */}
        <View className="mx-4 mt-3 bg-white rounded-2xl shadow-sm px-4">
          {/* 退款原因 */}
          <View
            className="flex flex-row items-center justify-between py-4 border-b border-gray-50"
            onClick={() => setShowReasonSheet(true)}
          >
            <View className="flex flex-row items-center gap-1">
              <Text className="block text-sm font-medium text-gray-800">退款原因</Text>
              <Text className="block text-sm text-[#FF4757]">*</Text>
            </View>
            <View className="flex flex-row items-center gap-1">
              <Text className={`block text-sm ${reason ? 'text-gray-800' : 'text-gray-400'}`}>
                {reason || '请至少选择一项'}
              </Text>
              <ChevronRight size={16} color="#CCCCCC" />
            </View>
          </View>

          {/* 退款份数 */}
          <View className="flex flex-row items-center justify-between py-4 border-b border-gray-50">
            <Text className="block text-sm font-medium text-gray-800">退款份数</Text>
            <View className="flex flex-row items-center gap-3">
              <Button
                variant="outline"
                size="icon"
                className="w-7 h-7 rounded-lg border-gray-200"
                disabled={refundQty <= 1}
                onClick={() => setRefundQty((q) => Math.max(1, q - 1))}
              >
                <Minus size={14} color={refundQty <= 1 ? '#CCCCCC' : '#333333'} />
              </Button>
              <Text className="block text-base font-semibold text-gray-900 w-6 text-center">{refundQty}</Text>
              <Button
                variant="outline"
                size="icon"
                className="w-7 h-7 rounded-lg border-gray-200"
                disabled={refundQty >= maxQty}
                onClick={() => setRefundQty((q) => Math.min(maxQty, q + 1))}
              >
                <Plus size={14} color={refundQty >= maxQty ? '#CCCCCC' : '#333333'} />
              </Button>
            </View>
          </View>
          {refundable && refundable.quantity > 1 && (
            <View className="py-2 border-b border-gray-50">
              <Text className="block text-xs text-gray-400">
                共 {refundable.quantity} 份{refundable.verified_count > 0 ? `，已核销 ${refundable.verified_count} 份` : ''}{refundable.refunded_quantity > 0 ? `，已退 ${refundable.refunded_quantity} 份` : ''}，本次最多可退 {refundable.refundable_quantity} 份
              </Text>
            </View>
          )}

          {/* 退款方式 */}
          <View className="flex flex-row items-center justify-between py-4">
            <Text className="block text-sm font-medium text-gray-800">退款方式</Text>
            <Text className="block text-sm text-gray-800">原路退回</Text>
          </View>
        </View>

        {/* 退款金额卡片 */}
        <View className="mx-4 mt-3 bg-white rounded-2xl shadow-sm p-4">
          <View className="flex flex-row items-center justify-between">
            <Text className="block text-sm font-medium text-gray-800">退款金额</Text>
            <View className="flex flex-row items-baseline">
              <Text className="block text-sm font-bold text-[#FF4757]">¥</Text>
              <Text className="block text-2xl font-bold text-[#FF4757]">{preview.amount.toFixed(2)}</Text>
            </View>
          </View>
          {/* 金额注明：解释为什么是这个金额 */}
          <View className="mt-3 bg-red-50 rounded-xl px-3 py-2">
            {preview.note.split('\n').map((line, idx) => (
              <Text key={idx} className="block text-xs text-[#C0392B] leading-5">{line}</Text>
            ))}
          </View>
        </View>

        {/* 退款说明卡片 */}
        <View className="mx-4 mt-3 bg-white rounded-2xl shadow-sm p-4">
          <Text className="block text-sm font-medium text-gray-800 mb-3">退款说明</Text>
          <View className="bg-gray-50 rounded-xl p-3">
            <Textarea
              className="w-full bg-transparent text-sm"
              style={{ minHeight: '80px' }}
              placeholder="请输入退款说明（选填）"
              maxlength={500}
              value={note}
              onInput={(e) => setNote(e.detail.value)}
            />
          </View>
          <Text className="block text-xs text-gray-300 text-right mt-1">{note.length}/500</Text>
        </View>

        {/* 提示 */}
        <View className="mx-4 mt-4 mb-6">
          <Text className="block text-xs text-gray-400 text-center">申请退款后不可取消，钱款预期1-3个自然日到账</Text>
        </View>
      </ScrollView>

      {/* 底部提交栏 */}
      <View
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          display: 'flex', flexDirection: 'row', alignItems: 'center',
          padding: '12px 16px', backgroundColor: '#fff',
          borderTop: '1px solid #f0f0f0', zIndex: 100,
        }}
      >
        <View style={{ flex: 1 }} className="flex flex-row items-baseline gap-1">
          <Text className="block text-xs text-gray-500">退款金额</Text>
          <Text className="block text-sm font-bold text-[#FF4757]">¥</Text>
          <Text className="block text-xl font-bold text-[#FF4757]">{preview.amount.toFixed(2)}</Text>
        </View>
        <View style={{ width: 140, flexShrink: 0 }}>
          <Button
            className="w-full h-11 rounded-full bg-gradient-to-r from-[#FF4757] to-[#FF6B81] border-0 shadow-lg"
            disabled={submitting}
            onClick={handleSubmit}
          >
            <Text className="block text-base font-semibold text-white">{submitting ? '提交中...' : '提交'}</Text>
          </Button>
        </View>
      </View>

      {/* 退款原因选择弹层 */}
      {showReasonSheet && (
        <View
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.55)', zIndex: 1000,
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          }}
          onClick={() => setShowReasonSheet(false)}
        >
          <View
            className="refund-sheet w-full bg-white rounded-t-3xl px-5 pt-5 pb-8"
            onClick={(e) => e.stopPropagation()}
          >
            <Text className="block text-base font-bold text-gray-900 text-center mb-4">选择退款原因</Text>
            <View className="flex flex-col gap-2.5">
              {REFUND_REASONS.map((r) => {
                const active = reason === r
                return (
                  <View
                    key={r}
                    className={`rounded-2xl px-4 py-4 flex flex-row items-center justify-between ${active ? 'bg-gradient-to-r from-[#FFF0F1] to-[#FFF5F6] border border-[#FFCDD2]' : 'bg-gray-50 border border-transparent'}`}
                    onClick={() => {
                      setReason(r)
                      setShowReasonSheet(false)
                    }}
                  >
                    <Text className={`block text-sm ${active ? 'font-semibold text-[#FF4757]' : 'text-gray-700'}`}>{r}</Text>
                    {active && <CircleCheck size={18} color="#FF4757" />}
                  </View>
                )
              })}
            </View>
          </View>
        </View>
      )}

      {/* 退款结果弹层（活泼风格） */}
      {result && (
        <View
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.55)', zIndex: 1100,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <View className="refund-pop relative mx-8 w-full max-w-sm rounded-3xl bg-white px-6 pb-6 pt-10 flex flex-col items-center overflow-visible">
            {/* 彩色撒花装饰 */}
            <View className="absolute rounded-full" style={{ top: 28, left: 36, width: 10, height: 10, backgroundColor: '#FFD666' }} />
            <View className="absolute rounded-full" style={{ top: 52, left: 20, width: 7, height: 7, backgroundColor: '#69C0FF' }} />
            <View className="absolute rounded-full" style={{ top: 36, right: 40, width: 8, height: 8, backgroundColor: '#95DE64' }} />
            <View className="absolute rounded-full" style={{ top: 64, right: 24, width: 6, height: 6, backgroundColor: '#FF85C0' }} />

            {result.success ? (
              <View className="refund-badge relative flex items-center justify-center rounded-full" style={{ width: 88, height: 88, background: 'linear-gradient(135deg, #52C41A 0%, #95DE64 100%)', boxShadow: '0 8px 24px rgba(82,196,26,0.3)' }}>
                <View className="absolute rounded-full" style={{ width: 112, height: 112, backgroundColor: 'rgba(149,222,100,0.15)' }} />
                <CircleCheck size={44} color="#FFFFFF" strokeWidth={2.5} />
              </View>
            ) : (
              <View className="refund-badge relative flex items-center justify-center rounded-full" style={{ width: 88, height: 88, background: 'linear-gradient(135deg, #FF4D4F 0%, #FF7875 100%)', boxShadow: '0 8px 24px rgba(255,77,79,0.3)' }}>
                <View className="absolute rounded-full" style={{ width: 112, height: 112, backgroundColor: 'rgba(255,120,117,0.15)' }} />
                <CircleX size={44} color="#FFFFFF" strokeWidth={2.5} />
              </View>
            )}

            <Text className="block text-xl font-bold text-gray-900 mt-5">{result.success ? '退款成功' : '退款失败'}</Text>
            <Text className="block text-sm text-gray-500 mt-2 text-center">{result.msg}</Text>

            <Button
              className={`w-full h-12 rounded-full mt-6 border-0 shadow-lg ${result.success ? 'bg-gradient-to-r from-[#52C41A] to-[#73D13D]' : 'bg-gradient-to-r from-[#FF4D4F] to-[#FF7875]'}`}
              onClick={() => {
                setResult(null)
                if (result.success) {
                  Taro.navigateBack()
                }
              }}
            >
              <Text className="block text-base font-semibold text-white">知道了</Text>
            </Button>
          </View>
        </View>
      )}
    </View>
  )
}
