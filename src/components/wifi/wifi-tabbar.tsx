import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { House, Signal, UserRound } from 'lucide-react-taro'

interface Props {
  active: 'home' | 'nearby'
  /** 商家上下文，切换 tab 时透传 */
  merchantId?: string | number
  merchantName?: string
}

/** WiFi 模块底部导航：首页 / 附近 / 我的（我的跳转膨胀团个人中心） */
export default function WifiTabBar({ active, merchantId, merchantName }: Props) {
  const query = `merchantId=${merchantId ?? ''}&name=${encodeURIComponent(merchantName || '')}`

  const go = (tab: 'home' | 'nearby' | 'mine') => {
    if (tab === 'mine') {
      Taro.switchTab({ url: '/pages/user-center/index' }).catch(() => Taro.navigateTo({ url: '/pages/user-center/index' }))
      return
    }
    if (tab === active) return
    const url = tab === 'home' ? `/pages/wifi/index?${query}` : `/pages/wifi-nearby/index?${query}`
    Taro.redirectTo({ url }).catch(() => Taro.navigateTo({ url }))
  }

  const items: Array<{ key: 'home' | 'nearby' | 'mine'; label: string; icon: 'house' | 'signal' | 'user' }> = [
    { key: 'home', label: '首页', icon: 'house' },
    { key: 'nearby', label: '附近', icon: 'signal' },
    { key: 'mine', label: '我的', icon: 'user' },
  ]

  return (
    <View
      style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
        display: 'flex', flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center',
        paddingTop: 8, paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 8px)',
        backgroundColor: 'rgba(255,255,255,0.96)',
        borderTopLeftRadius: 24, borderTopRightRadius: 24,
        boxShadow: '0 -6px 24px rgba(255,71,87,0.10)',
      }}
    >
      {items.map((it) => {
        const isActive = it.key === active
        const color = isActive ? '#FF4757' : '#B6BCC7'
        return (
          <View
            key={it.key}
            className="wifi-ripple"
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '2px 20px', borderRadius: 16 }}
            onClick={() => go(it.key)}
          >
            {it.icon === 'house' && <House size={22} color={color} strokeWidth={isActive ? 2.5 : 2} />}
            {it.icon === 'signal' && <Signal size={22} color={color} strokeWidth={isActive ? 2.5 : 2} />}
            {it.icon === 'user' && <UserRound size={22} color={color} strokeWidth={isActive ? 2.5 : 2} />}
            <Text className="text-xs" style={{ color, fontWeight: isActive ? 700 : 400, marginTop: 2 }}>{it.label}</Text>
          </View>
        )
      })}
    </View>
  )
}
