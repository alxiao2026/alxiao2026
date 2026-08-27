import { View, Text, ScrollView, Swiper, SwiperItem } from '@tarojs/components'
import { useState } from 'react'
import Taro, { useDidShow, useShareAppMessage, useShareTimeline } from '@tarojs/taro'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ChevronRight, MapPin, Clock, Store, Megaphone, Users } from 'lucide-react-taro'
import { buildStationShare, trackShare } from '@/lib/share'
import {
  DEPLOY,
  MAX_GROUP_BUYS,
  MOCK_ADS,
  getPeakStatus,
  loadGroupBuys,
  loadStationConfig,
  type GroupBuyItem,
  type QueryType,
  type StationConfig,
} from '../../lib/station-config'
import './index.css'

/**
 * 驿站首页（独立分包 · 快递查件流量入口）
 * - 不使用主包 Network / 账号体系 / 全局状态，数据全部来自本地存储
 * - 查件入口 → 确认弹窗 → 过渡页（倒计时 + 跳转官方小程序 + 复制链接兜底）
 * - 入口位置：系统管理员账号的「管理后台」菜单（pages/admin，roleCode===2 可见），
 *   普通用户与商家账号不展示入口
 */
const StationHomePage = () => {
  const [station, setStation] = useState<StationConfig>(() => loadStationConfig())
  const [groupBuys, setGroupBuys] = useState<GroupBuyItem[]>(() =>
    loadGroupBuys(loadStationConfig().code).slice(0, MAX_GROUP_BUYS)
  )
  const [confirmType, setConfirmType] = useState<QueryType | null>(null)
  const [currentAd, setCurrentAd] = useState(0)

  const peak = getPeakStatus()
  const cainiaoAvailable = !!station.cainiaoStationId

  // 页面每次显示时刷新（管理页修改驿站信息/团购后返回即生效）
  useDidShow(() => {
    const cfg = loadStationConfig()
    setStation(cfg)
    setGroupBuys(loadGroupBuys(cfg.code).slice(0, MAX_GROUP_BUYS))
  })

  /** 小程序分享卡片：驿站查件工具场景，文案带驿站名（主推团购钩子由附近好店数据驱动） */
  useShareAppMessage(() => {
    const share = buildStationShare(station.name, groupBuys[0]?.title, 'share')
    trackShare('station', station.code, { page: 'packages/station/pages/home/index', template: share.title })
    return {
      title: share.title,
      path: '/packages/station/pages/home/index',
      imageUrl: share.imageUrl,
    }
  })

  useShareTimeline(() => {
    const share = buildStationShare(station.name, groupBuys[0]?.title, 'square')
    return {
      title: share.title,
      query: '',
      imageUrl: share.imageUrl,
    }
  })

  const handleQueryClick = (type: QueryType) => {
    if (type === 'cainiao' && !cainiaoAvailable) {
      // 降级逻辑：未配置菜鸟 stationId（如预设驿站 C072042627）时引导使用拼多多渠道
      Taro.showToast({ title: '该驿站暂未开通菜鸟查询，可先用拼多多查件', icon: 'none' })
      return
    }
    setConfirmType(type)
  }

  const handleConfirmJump = () => {
    const type = confirmType
    setConfirmType(null)
    Taro.navigateTo({ url: `/packages/station/pages/transition/index?type=${type}` })
  }

  /** 对接主包真实团购详情路由（本分包唯一业务出口） */
  const openGroupBuyDetail = (id: string) => {
    Taro.navigateTo({ url: `${DEPLOY.GROUP_BUY_DETAIL_PATH}?id=${id}` })
  }

  return (
    <View className="min-h-screen bg-gray-50">
      <ScrollView className="flex-1" scrollY>
        {/* ===== 头部：驿站名 + 今日取件高峰提示 ===== */}
        <View className="px-5 pt-5 pb-20 bg-gradient-to-b from-[#FFB347] to-[#FF6B35]">
          <View className="flex flex-row items-center gap-2">
            <MapPin size={16} color="#ffffff" />
            <Text className="block text-lg font-bold text-white">{station.name}</Text>
          </View>
          <View
            className="mt-3 rounded-full px-3 py-2 flex flex-row items-center self-start"
            style={{ backgroundColor: 'rgba(255,255,255,0.25)' }}
          >
            <Users size={12} color="#ffffff" />
            <Text className="text-xs text-white ml-2">{peak.text}</Text>
          </View>
          <View className="mt-3 flex flex-row items-center">
            <Clock size={11} color="rgba(255,255,255,0.85)" />
            <Text className="text-xs text-white ml-1" style={{ opacity: 0.85 }}>
              编码 {station.code} · 营业 {station.businessHours}
            </Text>
          </View>
        </View>

        {/* ===== 广告轮播（3 张模拟广告，自动轮播 + 指示器） ===== */}
        <View className="px-4 -mt-12 station-float-in">
          <View className="bg-white rounded-3xl p-3 shadow-lg">
            <View className="rounded-2xl overflow-hidden">
              <Swiper
                className="h-36"
                autoplay
                circular
                interval={3500}
                duration={500}
                onChange={(e) => setCurrentAd(e.detail.current)}
              >
                {MOCK_ADS.map((ad) => (
                  <SwiperItem key={ad.id}>
                    <View
                      className="w-full h-full px-4 py-3 flex flex-row items-center justify-between"
                      style={{ background: ad.gradient }}
                    >
                      <View className="flex-1 min-w-0">
                        <Text className="text-xs text-white" style={{ opacity: 0.85 }}>
                          {ad.brand} · 广告
                        </Text>
                        <Text className="block text-base font-bold text-white mt-1">{ad.title}</Text>
                        <Text className="block text-xs text-white mt-1" style={{ opacity: 0.8 }}>
                          {ad.subtitle}
                        </Text>
                      </View>
                      <Text className="text-4xl flex-shrink-0">{ad.emoji}</Text>
                    </View>
                  </SwiperItem>
                ))}
              </Swiper>
            </View>
            {/* 指示器 */}
            <View className="flex flex-row justify-center items-center gap-2 mt-3">
              {MOCK_ADS.map((ad, i) => (
                <View
                  key={ad.id}
                  className={`h-2 rounded-full transition-all ${i === currentAd ? 'w-4 bg-[#FF6B35]' : 'w-2 bg-gray-200'}`}
                />
              ))}
            </View>
          </View>
        </View>

        {/* ▶▶ 预留：微信流量主 banner 广告位（部署时替换上方模拟轮播）
            1. 小程序后台开通「流量主」→ 广告位管理 → 创建 banner 广告位
            2. 将 DEPLOY.BANNER_AD_UNIT_ID（lib/station-config.ts）替换为真实广告位 id
            3. 用 Taro 原生 <Ad unit-id={DEPLOY.BANNER_AD_UNIT_ID} /> 组件渲染真实广告 */}

        {/* ===== 核心查件入口（呼吸动效 + 确认弹窗） ===== */}
        <View className="px-4 mt-5">
          <Text className="block text-sm font-bold text-gray-800 mb-3">快捷查件</Text>
          <Button
            className="station-breathe w-full h-auto py-5 px-5 rounded-3xl flex flex-row items-center justify-start gap-0 shadow-lg"
            style={{ background: 'linear-gradient(135deg, #FF8A3D 0%, #FF6B35 100%)' }}
            onClick={() => handleQueryClick('pdd')}
          >
            <Text className="text-4xl flex-shrink-0">📦</Text>
            <View className="ml-4 flex-1 min-w-0 text-left">
              <Text className="block text-lg font-bold text-white">查拼多多包裹</Text>
              <Text className="block text-xs text-white mt-1" style={{ opacity: 0.85 }}>
                拼多多渠道 · 输入手机号秒查
              </Text>
            </View>
            <ChevronRight size={20} color="rgba(255,255,255,0.9)" />
          </Button>

          {/* 菜鸟渠道：未配置 stationId 时降级置灰（如预设驿站 C072042627） */}
          <Button
            className={`w-full h-auto py-5 px-5 mt-3 rounded-3xl flex flex-row items-center justify-start gap-0 ${cainiaoAvailable ? 'station-breathe shadow-lg' : ''}`}
            style={
              cainiaoAvailable
                ? { background: 'linear-gradient(135deg, #FFB347 0%, #F5951D 100%)' }
                : { backgroundColor: '#F1F2F4' }
            }
            onClick={() => handleQueryClick('cainiao')}
          >
            <Text className="text-4xl flex-shrink-0" style={cainiaoAvailable ? undefined : { opacity: 0.5 }}>
              🚚
            </Text>
            <View className="ml-4 flex-1 min-w-0 text-left">
              <Text className={`block text-lg font-bold ${cainiaoAvailable ? 'text-white' : 'text-gray-400'}`}>
                查菜鸟包裹
              </Text>
              <Text
                className={`block text-xs mt-1 ${cainiaoAvailable ? 'text-white' : 'text-gray-400'}`}
                style={cainiaoAvailable ? { opacity: 0.85 } : undefined}
              >
                {cainiaoAvailable ? '菜鸟渠道 · 淘系包裹一键查' : '该驿站暂未开通，建议用拼多多查件'}
              </Text>
            </View>
            {cainiaoAvailable && <ChevronRight size={20} color="rgba(255,255,255,0.9)" />}
          </Button>
        </View>

        {/* ===== 附近好店（团购导流，对接主包套餐详情） ===== */}
        <View className="px-4 mt-7">
          <View className="flex flex-row items-center gap-2 mb-3">
            <Store size={16} color="#FF6B35" />
            <Text className="block text-base font-bold text-gray-800">附近好店</Text>
            <Text className="block text-xs text-gray-400 ml-1">取件顺手团一单</Text>
            <View
              className="flex flex-row items-center ml-auto"
              onClick={() => Taro.navigateTo({ url: '/packages/station/pages/nearby-shops/index' })}
            >
              <Text className="block text-xs text-[#FF6B35]">更多好店</Text>
              <ChevronRight size={12} color="#FF6B35" />
            </View>
          </View>
          <View className="flex flex-row gap-3">
            {groupBuys.slice(0, 2).map((item) => (
              <View
                key={item.id}
                className="flex-1 bg-white rounded-2xl p-3 shadow-sm min-w-0"
                onClick={() => openGroupBuyDetail(item.id)}
              >
                <Text className="block text-sm font-bold text-gray-800 truncate">{item.title}</Text>
                <View className="flex flex-row items-center mt-2">
                  <Badge className="bg-[#FFF3E5] border-transparent px-2 py-1">
                    <Text className="text-xs font-semibold text-[#FF6B35]">{item.tag}</Text>
                  </Badge>
                </View>
                <View className="flex flex-row items-baseline gap-1 mt-2">
                  <Text className="text-xs text-[#FF6B35] font-bold">¥</Text>
                  <Text className="text-lg font-bold text-[#FF6B35]">{item.price}</Text>
                  <Text className="text-xs text-gray-300 line-through ml-1">¥{item.originalPrice}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* ===== 底部：广告声明 + 反馈入口 ===== */}
        <View className="mt-8 pb-10 flex flex-col items-center gap-3">
          <View className="flex flex-row items-center gap-1">
            <Megaphone size={12} color="#9CA3AF" />
            <Text className="text-xs text-gray-400">广告由 {station.name} 提供支持</Text>
          </View>
          <View className="flex flex-row items-center gap-5">
            <Text
              className="text-xs text-[#FF6B35]"
              onClick={() => Taro.navigateTo({ url: '/packages/station/pages/about/index' })}
            >
              意见反馈
            </Text>
            <View className="w-px h-3 bg-gray-200" />
            <Text
              className="text-xs text-gray-500"
              onClick={() => Taro.navigateTo({ url: '/packages/station/pages/about/index' })}
            >
              我的驿站
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* ===== 查件确认弹窗 ===== */}
      <Dialog open={confirmType !== null} onOpenChange={(open) => { if (!open) setConfirmType(null) }}>
        <DialogContent className="bg-white rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-center text-base font-semibold text-gray-900">确认跳转</DialogTitle>
          </DialogHeader>
          <View className="mt-3 flex flex-col items-center">
            <Text className="block text-sm text-gray-600 text-center">
              {confirmType === 'cainiao'
                ? '即将打开菜鸟裹裹小程序，可在其中查询取件码'
                : '即将打开拼多多小程序，可在其中查询包裹'}
            </Text>
            <Text className="block text-xs text-gray-400 text-center mt-2">
              将跳转官方小程序 · {station.name}（{station.code}）
            </Text>
          </View>
          <View className="flex flex-row gap-3 mt-5">
            <View className="flex-1">
              <Button variant="outline" className="w-full rounded-full" onClick={() => setConfirmType(null)}>
                <Text>取消</Text>
              </Button>
            </View>
            <View className="flex-1">
              <Button className="w-full rounded-full bg-[#FF6B35] text-white" onClick={handleConfirmJump}>
                <Text>确认跳转</Text>
              </Button>
            </View>
          </View>
        </DialogContent>
      </Dialog>
    </View>
  )
}

export default StationHomePage
