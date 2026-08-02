import { View, Text } from '@tarojs/components'
import { Minus, Plus } from 'lucide-react-taro'
import { Button } from '@/components/ui/button'

interface RevokeDialogProps {
  visible: boolean
  /** 当前已核销份数（可撤销上限） */
  maxQty: number
  /** 套餐名称（可选展示） */
  packageName?: string
  /** 当前选择的撤销份数 */
  qty: number
  loading?: boolean
  onQtyChange: (qty: number) => void
  onCancel: () => void
  onConfirm: () => void
}

/**
 * 撤销核销份数选择弹窗（加减步进器）
 * 供商家端订单管理页 / 核销结果页复用
 */
export function RevokeDialog({
  visible,
  maxQty,
  packageName,
  qty,
  loading = false,
  onQtyChange,
  onCancel,
  onConfirm,
}: RevokeDialogProps) {
  if (!visible) return null

  const canMinus = qty > 1
  const canPlus = qty < maxQty
  const remain = maxQty - qty

  return (
    <View style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 200 }}>
      {/* 遮罩 */}
      <View
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)' }}
        onClick={onCancel}
      />
      {/* 弹窗卡片 */}
      <View
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl p-6 w-72"
      >
        <Text className="block text-lg font-bold text-gray-800 text-center">撤销核销</Text>
        {packageName && (
          <Text className="block text-sm text-gray-500 text-center mt-1">{packageName}</Text>
        )}
        <Text className="block text-sm text-gray-500 text-center mt-1">
          该订单已核销 {maxQty} 份
        </Text>

        {/* 份数步进器 */}
        <View className="flex items-center justify-center gap-6 my-5">
          <View
            className={`w-10 h-10 rounded-full flex items-center justify-center ${canMinus ? 'bg-red-50' : 'bg-gray-100'}`}
            onClick={() => canMinus && onQtyChange(qty - 1)}
          >
            <Minus size={20} color={canMinus ? '#ef4444' : '#d1d5db'} />
          </View>
          <View className="w-16 items-center">
            <Text className="block text-2xl font-bold text-gray-800 text-center">{qty}</Text>
            <Text className="block text-xs text-gray-400 text-center">撤销份数</Text>
          </View>
          <View
            className={`w-10 h-10 rounded-full flex items-center justify-center ${canPlus ? 'bg-red-50' : 'bg-gray-100'}`}
            onClick={() => canPlus && onQtyChange(qty + 1)}
          >
            <Plus size={20} color={canPlus ? '#ef4444' : '#d1d5db'} />
          </View>
        </View>

        {/* 动态提示 */}
        <View className="bg-amber-50 rounded-xl p-3 mb-5">
          <Text className="block text-xs text-amber-700 leading-relaxed">
            撤销 {qty} 份后，该 {qty} 份将恢复待使用（可重新核销或退款）
            {remain > 0 ? `，剩余 ${remain} 份保持已核销` : '，本单全部恢复待使用'}。
          </Text>
        </View>

        {/* 操作按钮 */}
        <View className="flex gap-3">
          <View className="flex-1">
            <Button
              className="w-full bg-gray-100 text-gray-600 rounded-xl"
              onClick={onCancel}
            >
              <Text>取消</Text>
            </Button>
          </View>
          <View className="flex-1">
            <Button
              className="w-full bg-red-500 text-white rounded-xl"
              disabled={loading}
              onClick={onConfirm}
            >
              <Text>{loading ? '撤销中...' : '确定撤销'}</Text>
            </Button>
          </View>
        </View>
      </View>
    </View>
  )
}
