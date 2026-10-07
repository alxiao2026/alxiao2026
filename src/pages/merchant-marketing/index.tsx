import { useState, useEffect } from 'react'
import Taro from '@tarojs/taro'
import { View, Text } from '@tarojs/components'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Network } from '@/network'
import { Wifi, LoaderCircle, Search, ChevronDown } from 'lucide-react-taro'
import { cn } from '@/lib/utils'

interface WifiInfo {
  ssid?: string
  password?: string
}

const MODULE_NAME = '门店WiFi链接模块'
const MODULE_TAG = '门店WiFi'
const MODULE_DESC = '配置后消费者在商家页可一键连接店内 WiFi；手机连上店内 WiFi 时点「获取当前」可自动填入名称，密码需手动输入'

export default function MerchantMarketingPage() {
  const [merchantId, setMerchantId] = useState('')
  const [ssid, setSsid] = useState('')
  const [password, setPassword] = useState('')
  const [, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [fetchingWifi, setFetchingWifi] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [marketingFeatures, setMarketingFeatures] = useState<Record<string, boolean>>({})
  const [from, setFrom] = useState('')

  const wifiModuleEnabled = !!marketingFeatures.wifi
  const isAdmin = from === 'merchant-admin'

  useEffect(() => {
    const instance = Taro.getCurrentInstance()
    const id = instance.router?.params?.merchant_id || ''
    const fromParam = instance.router?.params?.from || ''
    setMerchantId(id)
    setFrom(fromParam)
    if (id) {
      loadWifi(id)
      loadMarketingFeatures(id)
    }
    Taro.setNavigationBarTitle({
      title: fromParam === 'merchant-admin' ? '商家营销模块管理' : '营销模块管理',
    })
  }, [])

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

  const loadWifi = async (id: string) => {
    setLoading(true)
    try {
      const res = await Network.request({
        url: `/api/merchants/${id}/wifi`,
        method: 'GET',
      })
      console.log('loadWifi res', res)
      const data: WifiInfo = res?.data?.data || {}
      setSsid(data.ssid || '')
      setPassword(data.password || '')
    } catch (err) {
      console.error('loadWifi err', err)
      Taro.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  const keywordMatch =
    !searchKeyword.trim() ||
    MODULE_NAME.includes(searchKeyword.trim()) ||
    MODULE_TAG.includes(searchKeyword.trim())

  const canFetchWifi =
    Taro.getEnv() === Taro.ENV_TYPE.WEAPP || Taro.getEnv() === Taro.ENV_TYPE.TT

  const handleCardClick = () => {
    if (!wifiModuleEnabled && !isAdmin) {
      Taro.showToast({
        title: '请联系系统管理员打开该功能后，再进入设置',
        icon: 'none',
        duration: 2500,
      })
      return
    }
    setDialogOpen(true)
  }

  const handleToggleModule = async (checked: boolean) => {
    if (!merchantId || !isAdmin) return
    setSaving(true)
    try {
      const next = { ...marketingFeatures, wifi: checked }
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

  const handleFetchCurrentWifi = async () => {
    const env = Taro.getEnv()
    if (env !== Taro.ENV_TYPE.WEAPP && env !== Taro.ENV_TYPE.TT) {
      Taro.showToast({
        title: '当前端无法自动获取，请手动输入 WiFi 名称',
        icon: 'none',
      })
      return
    }
    if (fetchingWifi) return
    setFetchingWifi(true)
    try {
      await Taro.startWifi()
      const res = (await Taro.getConnectedWifi()) as any
      const currentSsid = res?.wifi?.SSID || ''
      if (currentSsid) {
        setSsid(currentSsid)
        Taro.showToast({ title: '已获取当前 WiFi', icon: 'success' })
      } else {
        Taro.showToast({ title: '未检测到已连接的 WiFi', icon: 'none' })
      }
    } catch (e: any) {
      console.error('[MerchantMarketing] 获取当前 WiFi 失败:', e)
      if (e?.errCode === 12005 || e?.errCode === 12010) {
        Taro.showToast({
          title: '手机未连接 WiFi，请先连接店内 WiFi',
          icon: 'none',
        })
      } else {
        Taro.showToast({ title: '获取 WiFi 失败，请手动输入', icon: 'none' })
      }
    } finally {
      setFetchingWifi(false)
    }
  }

  const handleSave = async () => {
    if (!merchantId) return
    setSaving(true)
    try {
      const res = await Network.request({
        url: `/api/merchants/${merchantId}/wifi`,
        method: 'PUT',
        data: {
          wifi_ssid: ssid.trim(),
          wifi_password: password.trim(),
        },
      })
      console.log('saveWifi res', res)
      Taro.showToast({ title: '保存成功', icon: 'success' })
      setDialogOpen(false)
    } catch (err) {
      console.error('saveWifi err', err)
      Taro.showToast({ title: '保存失败', icon: 'none' })
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

      <View className="px-4 pb-20">
        {keywordMatch && (
          <View
            className={cn(
              'bg-white rounded-2xl p-4 border border-gray-100 shadow-sm',
              !wifiModuleEnabled && 'opacity-70'
            )}
            onClick={handleCardClick}
          >
            <View className="flex items-start justify-between mb-3">
              <View className="flex items-center gap-2">
                <View
                  className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center',
                    wifiModuleEnabled ? 'bg-red-50' : 'bg-gray-100'
                  )}
                >
                  <Wifi size={20} color={wifiModuleEnabled ? '#ef4444' : '#9ca3af'} />
                </View>
                <Text
                  className={cn(
                    'block text-base font-bold',
                    wifiModuleEnabled ? 'text-gray-900' : 'text-gray-500'
                  )}
                >
                  {MODULE_NAME}
                </Text>
              </View>
              <Switch
                checked={wifiModuleEnabled}
                disabled={!isAdmin || saving}
                onCheckedChange={isAdmin ? handleToggleModule : undefined}
              />
            </View>
            <View className="mb-3">
              <Text
                className={cn(
                  'inline-block text-xs font-medium px-2 py-1 rounded',
                  wifiModuleEnabled ? 'text-red-500 bg-red-50' : 'text-gray-500 bg-gray-100'
                )}
              >
                {MODULE_TAG}
              </Text>
            </View>
            <Text className="block text-xs text-gray-500 leading-relaxed mb-4">
              {MODULE_DESC}
            </Text>
            <View className="flex items-center justify-between">
              <Text className="block text-xs text-gray-400">
                {wifiModuleEnabled ? '已启用' : '未启用'}
              </Text>
              <View
                className={cn(
                  'px-3 py-1 rounded-full',
                  wifiModuleEnabled ? 'bg-red-500' : 'bg-gray-200'
                )}
              >
                <Text
                  className={cn(
                    'text-xs font-medium',
                    wifiModuleEnabled ? 'text-white' : 'text-gray-600'
                  )}
                >
                  {wifiModuleEnabled ? '已启用' : '未启用'}
                </Text>
              </View>
            </View>
          </View>
        )}
      </View>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>门店WiFi链接模块</DialogTitle>
          </DialogHeader>
          <View className="py-2">
            <View className="bg-red-50 rounded-xl p-3 mb-4">
              <View className="flex flex-row items-center mb-1">
                <Wifi size={16} color="#ef4444" />
                <Text className="block text-sm font-medium text-gray-800 ml-1">店内免费 WiFi</Text>
                <View className="ml-2 px-2 py-1 bg-red-500 rounded">
                  <Text className="text-xs font-bold text-white">FREE</Text>
                </View>
              </View>
              <Text className="block text-xs text-gray-500 leading-relaxed">
                配置后消费者在商家页可一键连接店内 WiFi；手机连上店内 WiFi 时点「获取当前」可自动填入名称，密码需手动输入
              </Text>
            </View>

            <View className="mb-4">
              <Text className="block text-sm font-medium text-gray-800 mb-2">WiFi 名称（SSID）</Text>
              <View className="flex items-center gap-2">
                <View className="flex-1 bg-gray-50 rounded-xl px-4 py-3">
                  <Input
                    className="w-full bg-transparent border-0 focus-visible:ring-0 p-0"
                    placeholder="请输入 WiFi 名称"
                    value={ssid}
                    onInput={(e) => setSsid(e.detail.value)}
                  />
                </View>
                <Button
                  size="sm"
                  className={cn('shrink-0', canFetchWifi ? 'bg-red-500' : 'bg-gray-300')}
                  onClick={handleFetchCurrentWifi}
                  disabled={!canFetchWifi || fetchingWifi}
                >
                  {fetchingWifi ? (
                    <LoaderCircle size={16} color="#fff" className="animate-spin mr-1" />
                  ) : (
                    <Wifi size={16} color="#fff" className="mr-1" />
                  )}
                  <Text className="text-white text-sm">
                    {canFetchWifi ? '获取当前' : '小程序可用'}
                  </Text>
                </Button>
              </View>
            </View>

            <View className="mb-4">
              <Text className="block text-sm font-medium text-gray-800 mb-2">WiFi 密码</Text>
              <View className="bg-gray-50 rounded-xl px-4 py-3">
                <Input
                  className="w-full bg-transparent border-0 focus-visible:ring-0 p-0"
                  placeholder="请输入 WiFi 密码"
                  value={password}
                  onInput={(e) => setPassword(e.detail.value)}
                />
              </View>
              <Text className="block text-xs text-gray-400 mt-2">留空 WiFi 名称则商家页不展示连接入口</Text>
            </View>

            <Button
              className="w-full bg-red-500"
              onClick={handleSave}
              disabled={saving}
            >
              <Text className="text-white">{saving ? '保存中...' : '保存'}</Text>
            </Button>
          </View>
        </DialogContent>
      </Dialog>
    </View>
  )
}
