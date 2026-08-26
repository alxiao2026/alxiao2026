import { useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { View, Text, ScrollView } from '@tarojs/components'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ChevronRight, MapPin, Store, TicketPercent } from 'lucide-react-taro'
import {
  DEPLOY,
  MAX_GROUP_BUYS,
  loadGroupBuys,
  loadStationConfig,
  type GroupBuyItem,
} from '../../lib/station-config'

/**
 * 附近好店（本分包唯一对接膨胀团主包业务的页面）
 * - 团购卡片列表（最多 5 条），点击跳转主包真实套餐详情页 /pages/package-detail/index?id={团购ID}
 * - ▶▶ 部署说明：团购ID当前为 mock（gb-001 等），需在管理配置页替换为主包真实套餐ID；
 *   若主包详情路由变更，只需修改 lib/station-config.ts 中 DEPLOY.GROUP_BUY_DETAIL_PATH
 */
const StationNearbyShopsPage = () => {
  const [groupBuys, setGroupBuys] = useState<GroupBuyItem[]>([])
  const [stationName, setStationName] = useState('')

  useDidShow(() => {
    const station = loadStationConfig()
    setStationName(station.name)
    setGroupBuys(loadGroupBuys(station.code).slice(0, MAX_GROUP_BUYS))
  })

  const openDetail = (item: GroupBuyItem) => {
    Taro.navigateTo({ url: `${DEPLOY.GROUP_BUY_DETAIL_PATH}?id=${item.id}` })
  }

  return (
    <View className="flex flex-col h-screen bg-gray-50">
      <ScrollView className="flex-1" scrollY>
        <View className="px-5 pt-5 pb-6 bg-gradient-to-b from-[#FFB347] to-[#FF6B35]">
          <View className="flex flex-row items-center gap-2">
            <Store size={16} color="#ffffff" />
            <Text className="block text-lg font-bold text-white">附近好店</Text>
          </View>
          <View className="flex flex-row items-center mt-2">
            <MapPin size={11} color="rgba(255,255,255,0.85)" />
            <Text className="text-xs text-white ml-1" style={{ opacity: 0.85 }}>
              {stationName} · 取件顺手团一单
            </Text>
          </View>
        </View>

        <View className="px-4 -mt-3 pb-10 flex flex-col gap-3">
          {groupBuys.map((item) => (
            <View
              key={item.id}
              className="bg-white rounded-3xl p-4 shadow-md flex flex-row items-center"
              onClick={() => openDetail(item)}
            >
              <View className="flex-1 min-w-0">
                <View className="flex flex-row items-center gap-2">
                  <Text className="block text-base font-bold text-gray-800 truncate flex-1">{item.title}</Text>
                  <Badge className="bg-[#FFF3E5] border-transparent px-2 py-1 flex-shrink-0">
                    <Text className="text-xs font-semibold text-[#FF6B35]">{item.tag}</Text>
                  </Badge>
                </View>
                <View className="flex flex-row items-center gap-1 mt-2">
                  <TicketPercent size={11} color="#9CA3AF" />
                  <Text className="text-xs text-gray-400 truncate">{item.description}</Text>
                </View>
                <View className="flex flex-row items-baseline gap-1 mt-2">
                  <Text className="text-xs text-[#FF6B35] font-bold">¥</Text>
                  <Text className="text-xl font-bold text-[#FF6B35]">{item.price}</Text>
                  <Text className="text-xs text-gray-300 line-through ml-1">¥{item.originalPrice}</Text>
                  <Text className="text-xs text-[#FF6B35] ml-2">
                    已省 ¥{(item.originalPrice - item.price).toFixed(1)}
                  </Text>
                </View>
              </View>
              <View className="flex-shrink-0 ml-3">
                <Button className="rounded-full h-auto py-2 px-4 bg-[#FF6B35] text-white" onClick={() => openDetail(item)}>
                  <View className="flex flex-row items-center">
                    <Text className="text-xs text-white">去抢购</Text>
                    <ChevronRight size={12} color="#ffffff" />
                  </View>
                </Button>
              </View>
            </View>
          ))}

          {groupBuys.length === 0 && (
            <View className="bg-white rounded-3xl py-12 shadow-md flex flex-col items-center">
              <Store size={28} color="#D1D5DB" />
              <Text className="block text-sm text-gray-400 mt-3">附近暂无好店团购</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  )
}

export default StationNearbyShopsPage
