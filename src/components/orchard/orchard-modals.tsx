import { View, Text } from '@tarojs/components'
import { Button } from '@/components/ui/button'

/** 通用底部遮罩弹层容器 */
function Overlay({ children, onClose }: { children: React.ReactNode; onClose?: () => void }) {
  return (
    <View
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 200,
        backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <View
        className="bg-white rounded-3xl mx-6 w-full max-w-sm overflow-hidden"
        style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </View>
    </View>
  )
}

/** 浇水结果弹窗：签到/三餐/补浇成功后展示 */
export function WaterResultModal({
  visible,
  gained,
  streak,
  becameMature,
  onClose,
  onGoHarvest,
}: {
  visible: boolean
  gained: number
  streak: number
  becameMature: boolean
  onClose: () => void
  onGoHarvest?: () => void
}) {
  if (!visible) return null
  return (
    <Overlay onClose={onClose}>
      <View className="p-6 flex flex-col items-center">
        <Text style={{ fontSize: 56 }}>{becameMature ? '🌟' : '💧'}</Text>
        <Text className="block text-xl font-bold mt-3" style={{ color: '#1c1917' }}>
          {becameMature ? '果树成熟啦！' : `+${gained}g 水滴`}
        </Text>
        <Text className="block text-sm mt-2" style={{ color: '#78716c' }}>
          {becameMature ? '快去收获你的果树吧' : streak > 1 ? `已连续浇水 ${streak} 天，继续保持哦` : '明天也要记得来浇水哦'}
        </Text>
        <View className="w-full mt-5">
          {becameMature && onGoHarvest ? (
            <Button className="w-full rounded-full" style={{ backgroundColor: '#f97316' }} onClick={onGoHarvest}>
              <Text className="text-white font-semibold">🌳 去收获</Text>
            </Button>
          ) : null}
          <Button className="w-full rounded-full mt-2" variant={becameMature ? 'outline' : 'default'} style={becameMature ? {} : { backgroundColor: '#0284c7' }} onClick={onClose}>
            <Text className={becameMature ? 'font-semibold' : 'text-white font-semibold'}>{becameMature ? '稍后' : '好的'}</Text>
          </Button>
        </View>
      </View>
    </Overlay>
  )
}

/** 收获结果弹窗 */
export function HarvestModal({
  visible,
  treeIndex,
  availableTrees,
  onClose,
  onGoCoupons,
}: {
  visible: boolean
  treeIndex: number
  availableTrees: number
  onClose: () => void
  onGoCoupons: () => void
}) {
  if (!visible) return null
  return (
    <Overlay onClose={onClose}>
      <View className="p-6 flex flex-col items-center">
        <Text style={{ fontSize: 56 }}>🎉</Text>
        <Text className="block text-xl font-bold mt-3" style={{ color: '#1c1917' }}>收获第 {treeIndex} 棵果树！</Text>
        <Text className="block text-sm mt-2 text-center" style={{ color: '#78716c' }}>
          果树已存入库存（共 {availableTrees} 棵）{'\n'}可以去兑换优惠券啦
        </Text>
        <View className="w-full mt-5">
          <Button className="w-full rounded-full" style={{ backgroundColor: '#f97316' }} onClick={onGoCoupons}>
            <Text className="text-white font-semibold">🎟️ 去兑券</Text>
          </Button>
          <Button className="w-full rounded-full mt-2" variant="outline" onClick={onClose}>
            <Text className="font-semibold">继续种树</Text>
          </Button>
        </View>
      </View>
    </Overlay>
  )
}

/** 补浇弹窗：选择补浇方式（补浇卡 / 积分） */
export function MakeupModal({
  visible,
  date,
  makeupCards,
  makeupCostPoints,
  points,
  cycleMakeupUsed,
  cycleMakeupUseLimit,
  onConfirm,
  onClose,
}: {
  visible: boolean
  date: string
  makeupCards: number
  makeupCostPoints: number
  points: number
  cycleMakeupUsed: number
  cycleMakeupUseLimit: number
  onConfirm: (method: 'card' | 'points') => void
  onClose: () => void
}) {
  if (!visible) return null
  const cycleLeft = cycleMakeupUseLimit - cycleMakeupUsed
  const canUseCard = makeupCards > 0 && cycleLeft > 0
  const canUsePoints = points >= makeupCostPoints && cycleLeft > 0
  return (
    <Overlay onClose={onClose}>
      <View className="p-6">
        <Text className="block text-lg font-bold text-center" style={{ color: '#1c1917' }}>💧 补浇 {date}</Text>
        <Text className="block text-sm text-center mt-2" style={{ color: '#78716c' }}>
          本周期还可补浇 {cycleLeft} 次（限 {cycleMakeupUseLimit} 次/树）
        </Text>
        <View className="mt-5">
          <Button
            className="w-full rounded-2xl mb-3"
            style={{ backgroundColor: canUseCard ? '#0284c7' : '#e7e5e4' }}
            disabled={!canUseCard}
            onClick={() => onConfirm('card')}
          >
            <Text className="font-semibold" style={{ color: canUseCard ? '#fff' : '#a8a29e' }}>
              🎫 用补浇卡（剩 {makeupCards} 张）
            </Text>
          </Button>
          <Button
            className="w-full rounded-2xl"
            style={{ backgroundColor: canUsePoints ? '#f59e0b' : '#e7e5e4' }}
            disabled={!canUsePoints}
            onClick={() => onConfirm('points')}
          >
            <Text className="font-semibold" style={{ color: canUsePoints ? '#fff' : '#a8a29e' }}>
              🪙 用 {makeupCostPoints} 积分（现有 {points}）
            </Text>
          </Button>
          <Button className="w-full rounded-full mt-4" variant="outline" onClick={onClose}>
            <Text className="font-semibold">取消</Text>
          </Button>
        </View>
      </View>
    </Overlay>
  )
}
