import { useState, useEffect } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { View, Text } from '@tarojs/components'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Network } from '@/network'
import { Wifi, Search, ChevronDown, Users, Gift } from 'lucide-react-taro'
import { cn } from '@/lib/utils'

interface MarketingModule {
  key: string
  name: string
  tag: string
  description: string
  icon: typeof Wifi
}

const MODULES: MarketingModule[] = [
  {
    key: 'wifi',
    name: '门店WiFi链接模块',
    tag: '门店WiFi',
    description: '配置后消费者在商家页可一键连接店内 WiFi；手机连上店内 WiFi 时点「获取当前」可自动填入名称，密码需手动输入',
    icon: Wifi,
  },
  {
    key: 'community',
    name: '社群营销配置',
    tag: '社群营销',
    description: '在订单详情页展示加群/加店长引导卡片，可配置主标题、副标题、按钮文案与社群二维码',
    icon: Users,
  },
  {
    key: 'team_lottery',
    name: '组队抽奖营销模块',
    tag: '组队抽奖',
    description: '消费者下单后可发起组队，邀请好友加入，满员后全员免费抽奖，团长必得奖品',
    icon: Gift,
  },
]

export default function MerchantMarketingPage() {
  const [merchantId, setMerchantId] = useState('')
  const [from, setFrom] = useState('')
  const [saving, setSaving] = useState(false)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [marketingFeatures, setMarketingFeatures] = useState<Record<string, boolean>>({})

  const isAdmin = from === 'merchant-admin'

  useEffect(() => {
    const instance = Taro.getCurrentInstance()
    const id = instance.router?.params?.merchant_id || ''
    const fromParam = instance.router?.params?.from || ''
    setMerchantId(id)
    setFrom(fromParam)
    if (id) {
      loadMarketingFeatures(id)
    }
    Taro.setNavigationBarTitle({
      title: fromParam === 'merchant-admin' ? '商家营销模块管理' : '营销模块管理',
    })
  }, [])

  useDidShow(() => {
    if (merchantId) {
      loadMarketingFeatures(merchantId)
    }
  })

  const loadMarketingFeatures = async (id: string) => {
    try {
      const res = await Network.request({
        url: `/api/merchants/${id}/marketing-features`,
        method: 'GET',
      })
      console.log('loadMarketingFeatures res', res)
      const features = res?.data?.data || {}
      setMarketingFeatures(features as Record<string, boolean>)
    } catch (err) {
      console.error('loadMarketingFeatures err', err)
    }
  }

  const filteredModules = MODULES.filter((m) => {
    const keyword = searchKeyword.trim()
    if (!keyword) return true
    return m.name.includes(keyword) || m.tag.includes(keyword)
  })

  const handleCardClick = (moduleKey: string) => {
    const enabled = !!marketingFeatures[moduleKey]
    if (!enabled && !isAdmin) {
      Taro.showToast({
        title: '请联系系统管理员打开该功能后，再进入设置',
        icon: 'none',
        duration: 2500,
      })
      return
    }
    Taro.navigateTo({
      url: `/pages/marketing-config/index?module=${moduleKey}&merchant_id=${merchantId}&from=${from}`,
    })
  }

  const handleToggleModule = async (moduleKey: string, checked: boolean) => {
    if (!merchantId || !isAdmin) return
    setSaving(true)
    try {
      const next = { ...marketingFeatures, [moduleKey]: checked }
      await Network.request({
        url: `/api/merchants/${merchantId}/marketing-features`,
        method: 'PUT',
        data: { features: next },
      })
      setMarketingFeatures(next)
      Taro.showToast({ title: checked ? '已启用' : '已停用', icon: 'success' })
    } catch (err) {
      console.error('toggle module err', err)
      Taro.showToast({ title: '操作失败', icon: 'none' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <View className="min-h-screen bg-gray-50">
      <View className="px-4 pt-5 pb-3">
        <View className="flex items-baseline gap-2 mb-1">
          <Text className="block text-xl font-bold text-gray-900">
            {isAdmin ? '商家营销模块管理' : '营销模块管理'}
          </Text>
        </View>
        <Text className="block text-xs text-gray-400">开启模块后，方可进入配置营销参数</Text>
      </View>

      <View className="px-4 pb-3">
        <View className="flex items-center gap-2">
          <View className="flex items-center gap-1 bg-white rounded-lg px-3 py-2 border border-gray-200">
            <Text className="text-sm text-gray-600">模块状态</Text>
            <ChevronDown size={14} color="#999" />
          </View>
          <View className="flex items-center gap-1 bg-white rounded-lg px-3 py-2 border border-gray-200">
            <Text className="text-sm text-gray-600">搜索</Text>
            <ChevronDown size={14} color="#999" />
          </View>
          <View className="flex-1 flex items-center gap-1 bg-white rounded-lg px-3 py-2 border border-gray-200">
            <Search size={14} color="#999" />
            <Input
              className="flex-1 text-sm border-0 focus-visible:ring-0"
              placeholder="搜索营销模块名称"
              value={searchKeyword}
              onInput={(e) => setSearchKeyword(e.detail.value)}
            />
          </View>
        </View>
      </View>

      <View className="px-4 pb-20 flex flex-col gap-3">
        {filteredModules.map((module) => {
          const enabled = !!marketingFeatures[module.key]
          const Icon = module.icon
          return (
            <View
              key={module.key}
              className={cn(
                'bg-white rounded-2xl p-4 border border-gray-100 shadow-sm',
                !enabled && 'opacity-70'
              )}
              onClick={() => handleCardClick(module.key)}
            >
              <View className="flex items-start justify-between mb-3">
                <View className="flex items-center gap-2">
                  <View
                    className={cn(
                      'w-10 h-10 rounded-full flex items-center justify-center',
                      enabled ? 'bg-red-50' : 'bg-gray-100'
                    )}
                  >
                    <Icon size={20} color={enabled ? '#ef4444' : '#9ca3af'} />
                  </View>
                  <Text
                    className={cn(
                      'block text-base font-bold',
                      enabled ? 'text-gray-900' : 'text-gray-500'
                    )}
                  >
                    {module.name}
                  </Text>
                </View>
                <View
                  onClick={(e) => {
                    e.stopPropagation()
                    if (!isAdmin) {
                      Taro.showToast({
                        title: '模块启用状态由系统管理员控制',
                        icon: 'none',
                        duration: 2000,
                      })
                    }
                  }}
                >
                  <Switch
                    checked={enabled}
                    disabled={!isAdmin || saving}
                    onCheckedChange={isAdmin ? (checked) => handleToggleModule(module.key, checked) : undefined}
                  />
                </View>
              </View>
              <View className="mb-3">
                <Text
                  className={cn(
                    'inline-block text-xs font-medium px-2 py-1 rounded',
                    enabled ? 'text-red-500 bg-red-50' : 'text-gray-500 bg-gray-100'
                  )}
                >
                  {module.tag}
                </Text>
              </View>
              <Text className="block text-xs text-gray-500 leading-relaxed mb-4">
                {module.description}
              </Text>
              <View className="flex items-center justify-between">
                <Text className="block text-xs text-gray-400">
                  {enabled ? '已启用' : '未启用'}
                </Text>
                <View
                  className={cn(
                    'px-3 py-1 rounded-full',
                    enabled ? 'bg-red-500' : 'bg-gray-200'
                  )}
                >
                  <Text
                    className={cn(
                      'text-xs font-medium',
                      enabled ? 'text-white' : 'text-gray-600'
                    )}
                  >
                    {enabled ? '已启用' : '未启用'}
                  </Text>
                </View>
              </View>
            </View>
          )
        })}
      </View>
    </View>
  )
}
