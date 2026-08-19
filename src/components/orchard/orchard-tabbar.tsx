import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'

export type OrchardTabKey = 'orchard' | 'tasks' | 'coupons' | 'me'

const TABS: Array<{ key: OrchardTabKey; label: string; emoji: string; path: string }> = [
  { key: 'orchard', label: '果园', emoji: '🌳', path: '/pages/orchard/index' },
  { key: 'tasks', label: '任务', emoji: '📋', path: '/pages/orchard-tasks/index' },
  { key: 'coupons', label: '领券', emoji: '🎟️', path: '/pages/orchard-coupons/index' },
  { key: 'me', label: '我的', emoji: '👤', path: '/pages/orchard-me/index' },
]

/** 果园模块内部底部导航（4 个页面间用 redirectTo 切换，避免页面栈堆积） */
export default function OrchardTabBar({ active }: { active: OrchardTabKey }) {
  const handleSwitch = (path: string, key: OrchardTabKey) => {
    if (key === active) return
    Taro.redirectTo({ url: path })
  }

  return (
    <View
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        backgroundColor: '#ffffff',
        borderTop: '1px solid #f5f5f4',
        display: 'flex',
        flexDirection: 'row',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {TABS.map((tab) => {
        const isActive = tab.key === active
        return (
          <View
            key={tab.key}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 8, paddingBottom: 8 }}
            onClick={() => handleSwitch(tab.path, tab.key)}
          >
            <Text style={{ fontSize: 20, lineHeight: '24px', opacity: isActive ? 1 : 0.45 }}>{tab.emoji}</Text>
            <Text
              className="block text-xs"
              style={{
                marginTop: 2,
                color: isActive ? '#0284c7' : '#a8a29e',
                fontWeight: isActive ? 600 : 400,
              }}
            >
              {tab.label}
            </Text>
          </View>
        )
      })}
    </View>
  )
}
