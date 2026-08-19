import { View, Text, Button as TaroButton } from '@tarojs/components'
import Taro from '@tarojs/taro'

/**
 * 分享面板：转发给好友呈现为「小程序分享卡片」
 * 通过 Button open-type="share" 触发页面 onShareAppMessage
 */
export default function ShareSheet({
  visible,
  nickname,
  helpedToday,
  inviteLimit,
  onClose,
}: {
  visible: boolean
  nickname: string
  helpedToday: number
  inviteLimit: number
  onClose: () => void
}) {
  if (!visible) return null
  const env = Taro.getEnv()
  const isMiniApp = env === Taro.ENV_TYPE.WEAPP || env === Taro.ENV_TYPE.TT

  return (
    <View
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 200,
        backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <View
        className="bg-white w-full rounded-t-3xl overflow-hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <View className="p-6">
          <Text className="block text-lg font-bold text-center" style={{ color: '#1c1917' }}>邀请好友助力</Text>

          {/* 分享卡片预览 */}
          <View className="mt-5 mx-2 rounded-2xl p-4" style={{ backgroundColor: '#f0f9ff', border: '1px solid #bae6fd' }}>
            <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ fontSize: 40 }}>🍊</Text>
              <View className="ml-3 flex-1">
                <Text className="block text-sm font-bold" style={{ color: '#0c4a6e' }}>
                  {nickname || '好友'} 的果园
                </Text>
                <Text className="block text-xs mt-1" style={{ color: '#0369a1' }}>
                  快来帮 TA 浇水，一起种出真果树！
                </Text>
              </View>
            </View>
            <View className="mt-3 pt-3" style={{ borderTop: '1px dashed #bae6fd' }}>
              <Text className="block text-xs" style={{ color: '#78716c' }}>
                好友点开分享卡片 → 进入助力页 → 点「帮 TA 助力」即算成功
              </Text>
            </View>
          </View>

          <View className="mt-4 rounded-2xl p-4" style={{ backgroundColor: '#fffbeb' }}>
            <Text className="block text-xs" style={{ color: '#92400e' }}>
              🎁 每成功邀请 1 位好友助力，你得 1 张补浇卡 + 好友得水滴；今日已被助力 {helpedToday}/{inviteLimit} 次
            </Text>
          </View>

          <View className="mt-5">
            {isMiniApp ? (
              <TaroButton
                openType="share"
                className="w-full rounded-full"
                style={{ backgroundColor: '#f97316', color: '#fff', fontWeight: 600, lineHeight: '44px' }}
              >
                📤 发送给好友
              </TaroButton>
            ) : (
              <TaroButton
                className="w-full rounded-full"
                style={{ backgroundColor: '#e7e5e4', color: '#78716c', fontWeight: 600, lineHeight: '44px' }}
                onClick={() => Taro.showToast({ title: '请在小程序中分享', icon: 'none' })}
              >
                📤 发送给好友（仅小程序）
              </TaroButton>
            )}
            <TaroButton
              className="w-full rounded-full mt-3"
              style={{ backgroundColor: '#f5f5f4', color: '#57534e', fontWeight: 500, lineHeight: '40px' }}
              onClick={onClose}
            >
              取消
            </TaroButton>
          </View>
        </View>
      </View>
    </View>
  )
}
