import { useEffect, useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { Network } from '@/network'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent } from '@/components/ui/card'
import { Wifi, ChevronRight } from 'lucide-react-taro'

interface MarketingConfig {
  merchant_id: number
  merchant_name: string
  wifi_ssid: string
  wifi_password: string
  features: {
    wifi: boolean
  }
}

export default function MarketingManagePage() {
  const router = useRouter()
  const merchantId = Number(router.params.merchantId)

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [config, setConfig] = useState<MarketingConfig | null>(null)
  const [wifiEnabled, setWifiEnabled] = useState(false)
  const [wifiSsid, setWifiSsid] = useState('')
  const [wifiPassword, setWifiPassword] = useState('')

  const fetchConfig = async () => {
    if (!merchantId) return
    setLoading(true)
    try {
      const res = await Network.request({
        url: `/api/merchants/${merchantId}/marketing`,
        method: 'GET',
      })
      console.log('[marketing] config:', JSON.stringify(res.data))
      const payload = res.data?.data
      if (payload) {
        setConfig(payload)
        setWifiEnabled(payload.features?.wifi !== false)
        setWifiSsid(payload.wifi_ssid || '')
        setWifiPassword(payload.wifi_password || '')
      }
    } catch (err) {
      console.error('[marketing] fetch failed:', err)
      Taro.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchConfig()
  }, [merchantId])

  const handleSave = async () => {
    if (!merchantId) return
    setSaving(true)
    try {
      await Network.request({
        url: `/api/merchants/${merchantId}/marketing`,
        method: 'PUT',
        data: {
          features: { wifi: wifiEnabled },
          wifi_ssid: wifiSsid,
          wifi_password: wifiPassword,
        },
      })
      Taro.showToast({ title: '保存成功', icon: 'success' })
    } catch (err) {
      console.error('[marketing] save failed:', err)
      Taro.showToast({ title: '保存失败', icon: 'none' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <View className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Text className="text-gray-500">加载中...</Text>
      </View>
    )
  }

  return (
    <View className="min-h-screen bg-gray-50 p-4">
      {/* 顶部商家名称 */}
      <View className="mb-4">
        <Text className="block text-sm text-gray-500">当前门店</Text>
        <Text className="block text-lg font-bold text-gray-900 mt-1">
          {config?.merchant_name || '--'}
        </Text>
      </View>

      {/* WiFi 营销功能 */}
      <Card className="bg-white border border-gray-200 mb-4">
        <CardContent className="p-4">
          <View className="flex flex-row items-center justify-between">
            <View className="flex flex-row items-center gap-3">
              <View className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
                <Wifi size={20} color="#FF4757" />
              </View>
              <View>
                <Text className="block text-base font-semibold text-gray-800">
                  店内免费 WiFi
                </Text>
                <Text className="block text-xs text-gray-500 mt-1">
                  开启后在商家详情页展示连网入口
                </Text>
              </View>
            </View>
            <Switch
              checked={wifiEnabled}
              onCheckedChange={setWifiEnabled}
            />
          </View>

          {wifiEnabled && (
            <View className="mt-4 pt-4 border-t border-gray-100 space-y-4">
              <View>
                <Text className="block text-sm font-medium text-gray-800 mb-2">
                  WiFi 名称（SSID）
                </Text>
                <View className="bg-gray-50 rounded-xl px-4 py-3">
                  <Input
                    className="w-full bg-transparent"
                    placeholder="如：PengZhangTuan-5G"
                    value={wifiSsid}
                    onInput={(e) => setWifiSsid(e.detail.value)}
                    maxlength={32}
                  />
                </View>
              </View>
              <View>
                <Text className="block text-sm font-medium text-gray-800 mb-2">
                  WiFi 密码
                </Text>
                <View className="bg-gray-50 rounded-xl px-4 py-3">
                  <Input
                    className="w-full bg-transparent"
                    placeholder="请输入 WiFi 密码"
                    value={wifiPassword}
                    onInput={(e) => setWifiPassword(e.detail.value)}
                    maxlength={64}
                  />
                </View>
              </View>
            </View>
          )}
        </CardContent>
      </Card>

      {/* 更多营销功能占位 */}
      <Card className="bg-white border border-gray-200 mb-4 opacity-60">
        <CardContent className="p-4">
          <View className="flex flex-row items-center justify-between">
            <View className="flex flex-row items-center gap-3">
              <View className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center">
                <Text className="text-orange-500 text-lg">券</Text>
              </View>
              <View>
                <Text className="block text-base font-semibold text-gray-800">
                  优惠券营销
                </Text>
                <Text className="block text-xs text-gray-500 mt-1">
                  即将上线
                </Text>
              </View>
            </View>
            <ChevronRight size={18} color="#ccc" />
          </View>
        </CardContent>
      </Card>

      {/* 保存按钮 */}
      <View className="fixed left-0 right-0 p-4 bg-white border-t border-gray-200" style={{ bottom: 0 }}>
        <Button
          className="w-full bg-[#FF4757]"
          onClick={handleSave}
          disabled={saving}
        >
          <Text className="text-white text-base font-medium">
            {saving ? '保存中...' : '保存配置'}
          </Text>
        </Button>
      </View>

      {/* 底部占位，避免被固定按钮遮挡 */}
      <View style={{ height: 80 }} />
    </View>
  )
}
