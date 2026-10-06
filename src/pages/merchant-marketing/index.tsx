import { useState, useEffect } from 'react'
import Taro from '@tarojs/taro'
import { View, Text } from '@tarojs/components'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Network } from '@/network'
import { Wifi, LoaderCircle } from 'lucide-react-taro'

declare const wx: any

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
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [fetchingWifi, setFetchingWifi] = useState(false)
  const [marketingFeatures, setMarketingFeatures] = useState<Record<string, boolean>>({})
  const [featuresLoaded, setFeaturesLoaded] = useState(false)

  const wifiModuleEnabled = !!marketingFeatures.wifi

  useEffect(() => {
    const instance = Taro.getCurrentInstance()
    const id = instance.router?.params?.merchant_id || ''
    setMerchantId(id)
    if (id) {
      loadMarketingFeatures(id)
      loadWifi(id)
    }
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
    } finally {
      setFeaturesLoaded(true)
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

  const handleFetchCurrentWifi = async () => {
    const env = Taro.getEnv()
    if (env !== Taro.ENV_TYPE.WEAPP && env !== Taro.ENV_TYPE.TT) {
      Taro.showToast({
        title: '当前端无法自动获取，请手动输入 WiFi 名称',
        icon: 'none',
      })
      return
    }
    setFetchingWifi(true)
    try {
      const res = await wx.getWifiInfo()
      console.log('getWifiInfo res', res)
      const wifiName = res?.wifi?.SSID || ''
      if (wifiName) {
        setSsid(wifiName)
        Taro.showToast({ title: `已获取：${wifiName}`, icon: 'none' })
      } else {
        Taro.showToast({ title: '未获取到 WiFi 名称', icon: 'none' })
      }
    } catch (err) {
      console.error('getWifiInfo err', err)
      Taro.showToast({ title: '获取失败，请手动输入', icon: 'none' })
    } finally {
      setFetchingWifi(false)
    }
  }

  const handleSave = async () => {
    if (!merchantId) return
    if (!wifiModuleEnabled) {
      Taro.showToast({ title: '该营销模块未启用，无法保存', icon: 'none' })
      return
    }
    setSaving(true)
    try {
      const res = await Network.request({
        url: `/api/merchants/${merchantId}/wifi`,
        method: 'PUT',
        data: { wifi_ssid: ssid.trim(), wifi_password: password.trim() },
      })
      console.log('saveWifi res', res)
      Taro.showToast({ title: '保存成功', icon: 'success' })
    } catch (err) {
      console.error('saveWifi err', err)
      Taro.showToast({ title: '保存失败', icon: 'none' })
    } finally {
      setSaving(false)
    }
  }

  if (featuresLoaded && !wifiModuleEnabled) {
    return (
      <View className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-8">
        <View className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center mb-4">
          <Wifi size={32} color="#999999" />
        </View>
        <Text className="block text-base font-bold text-gray-800 mb-2 text-center">营销模块未启用</Text>
        <Text className="block text-sm text-gray-500 text-center leading-relaxed">
          暂无可用营销模块，请联系系统管理员打开该功能后，再进入设置
        </Text>
      </View>
    )
  }

  return (
    <View className="min-h-screen bg-gray-50">
      <View className="px-4 pt-5 pb-3">
        <View className="flex items-baseline gap-2 mb-1">
          <Text className="block text-xl font-bold text-gray-900">营销模块管理</Text>
          <Text className="block text-sm text-gray-500">配置已启用的营销模块参数</Text>
        </View>
        <Text className="block text-xs text-gray-400">仅系统管理员开启模块后，方可进入配置</Text>
      </View>

      <View className="px-4 pb-6">
        <View className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm mb-4">
          <View className="flex items-start gap-3 mb-3">
            <View className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
              <Wifi size={20} color="#FF4757" />
            </View>
            <View className="flex-1">
              <View className="flex items-center gap-2 mb-1">
                <Text className="block text-base font-bold text-gray-900">{MODULE_NAME}</Text>
                <Text className="block text-xs font-medium text-red-500 bg-red-50 px-2 py-1 rounded">{MODULE_TAG}</Text>
              </View>
              <Text className="block text-xs text-gray-500 leading-relaxed">{MODULE_DESC}</Text>
            </View>
          </View>

          {loading ? (
            <View className="flex items-center justify-center py-8">
              <LoaderCircle className="animate-spin mr-2" size={20} color="#999999" />
              <Text className="block text-sm text-gray-500">加载中...</Text>
            </View>
          ) : (
            <>
              <View className="mb-4">
                <Text className="block text-sm font-medium text-gray-700 mb-2">WiFi 名称（SSID）</Text>
                <View className="flex items-center gap-2">
                  <View className="flex-1 bg-gray-50 rounded-lg px-3 py-3">
                    <Input
                      className="w-full bg-transparent text-sm"
                      placeholder="请输入 WiFi 名称"
                      value={ssid}
                      onInput={(e) => setSsid(e.detail.value)}
                    />
                  </View>
                  <Button
                    size="sm"
                    className="bg-red-500 text-white px-3 py-2 h-auto rounded-lg"
                    onClick={handleFetchCurrentWifi}
                    disabled={fetchingWifi}
                  >
                    {fetchingWifi ? (
                      <LoaderCircle className="animate-spin mr-1" size={14} color="#ffffff" />
                    ) : (
                      <Wifi className="mr-1" size={14} color="#ffffff" />
                    )}
                    <Text className="block text-sm">获取当前</Text>
                  </Button>
                </View>
              </View>

              <View className="mb-6">
                <Text className="block text-sm font-medium text-gray-700 mb-2">WiFi 密码</Text>
                <View className="bg-gray-50 rounded-lg px-3 py-3">
                  <Input
                    className="w-full bg-transparent text-sm"
                    placeholder="请输入 WiFi 密码"
                    value={password}
                    onInput={(e) => setPassword(e.detail.value)}
                  />
                </View>
                <Text className="block text-xs text-gray-400 mt-1">留空 WiFi 名称则商家页不展示连接入口</Text>
              </View>

              <Button
                className="w-full bg-red-500 text-white py-3 h-auto rounded-xl"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <LoaderCircle className="animate-spin mr-1" size={16} color="#ffffff" />
                ) : null}
                <Text className="block text-base font-medium">保存</Text>
              </Button>
            </>
          )}
        </View>
      </View>
    </View>
  )
}
