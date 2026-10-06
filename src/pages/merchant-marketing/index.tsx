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
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [fetchingWifi, setFetchingWifi] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [marketingFeatures, setMarketingFeatures] = useState<Record<string, boolean>>({})

  const hasEnabledModule = Object.values(marketingFeatures).some(Boolean)
  const wifiModuleEnabled = !!marketingFeatures.wifi

  useEffect(() => {
    const instance = Taro.getCurrentInstance()
    const id = instance.router?.params?.merchant_id || ''
    setMerchantId(id)
    if (id) {
      loadWifi(id)
      loadMarketingFeatures(id)
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

  const enabled = !!ssid.trim()
  const keywordMatch =
    !searchKeyword.trim() ||
    MODULE_NAME.includes(searchKeyword.trim()) ||
    MODULE_TAG.includes(searchKeyword.trim())

  const handleToggle = async (checked: boolean) => {
    if (!merchantId) return
    if (checked) {
      setDialogOpen(true)
      return
    }
    setSaving(true)
    try {
      const res = await Network.request({
        url: `/api/merchants/${merchantId}/wifi`,
        method: 'PUT',
        data: { wifi_ssid: '', wifi_password: '' },
      })
      console.log('disableWifi res', res)
      setSsid('')
      setPassword('')
      Taro.showToast({ title: '已停用', icon: 'success' })
    } catch (err) {
      console.error('disableWifi err', err)
      Taro.showToast({ title: '停用失败', icon: 'none' })
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
            营销模块管理
          </Text>
          <Text className="block text-sm text-gray-500">
            方可进入配置营销参数
          </Text>
        </View>
        <Text className="block text-xs text-gray-400">
          开启模块后，方可进入配置营销参数
        </Text>
      </View>

      <View className="px-4 pb-3">
        <View className="flex items-center gap-2">
          <View className="flex items-center gap-1 bg-white rounded-lg px-3 py-2 border border-gray-200">
            <Text className="block text-sm text-gray-600">模块状态</Text>
            <ChevronDown size={14} color="#999" />
          </View>
          <View className="flex items-center gap-1 bg-white rounded-lg px-3 py-2 border border-gray-200">
            <Text className="block text-sm text-gray-600">搜索</Text>
            <ChevronDown size={14} color="#999" />
          </View>
          <View className="flex-1 flex items-center gap-1 bg-white rounded-lg px-3 py-2 border border-gray-200">
            <Search size={14} color="#999" />
            <Input
              className="flex-1 text-sm bg-transparent"
              placeholder="搜索营销模块名称"
              value={searchKeyword}
              onInput={(e) => setSearchKeyword(e.detail.value)}
            />
          </View>
        </View>
      </View>

      <View className="px-4 pb-20">
        {!hasEnabledModule ? (
          <View className="flex flex-col items-center justify-center py-20 px-8">
            <View className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
              <Wifi size={28} color="#9ca3af" />
            </View>
            <Text className="block text-base font-bold text-gray-700 mb-2">暂无可用营销模块</Text>
            <Text className="block text-sm text-gray-400 text-center leading-relaxed">
              请联系系统管理员打开该功能后，再进入设置
            </Text>
          </View>
        ) : (
          <>
            <View className="grid grid-cols-2 gap-3">
              {wifiModuleEnabled && keywordMatch && (
                <View
                  className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm"
                  onClick={() => setDialogOpen(true)}
                >
                  <View className="flex items-start justify-between mb-3">
                    <View className="flex items-center gap-2">
                      <View className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center shrink-0">
                        <Wifi size={20} color="#ef4444" />
                      </View>
                      <Text className="block text-base font-bold text-gray-900 leading-tight">
                        {MODULE_NAME}
                      </Text>
                    </View>
                    <View className="shrink-0 ml-2">
                      <Switch
                        checked={enabled}
                        onCheckedChange={handleToggle}
                        disabled={saving || loading}
                      />
                    </View>
                  </View>

                  <View className="mb-3">
                    <Text className="inline-block text-xs font-medium text-red-500 bg-red-50 px-2 py-1 rounded">
                      {MODULE_TAG}
                    </Text>
                  </View>

                  <Text className="block text-xs text-gray-500 leading-relaxed mb-4">
                    {MODULE_DESC}
                  </Text>

                  <View className="flex items-center justify-between">
                    <Text className="block text-xs text-gray-400">
                      {enabled ? '已启用' : '已停用'}
                    </Text>
                    <View
                      className={cn(
                        'px-3 py-1 rounded-full',
                        enabled ? 'bg-red-500' : 'bg-gray-200'
                      )}
                    >
                      <Text
                        className={cn(
                          'block text-xs font-medium',
                          enabled ? 'text-white' : 'text-gray-600'
                        )}
                      >
                        {enabled ? '已启用' : '已停用'}
                      </Text>
                    </View>
                  </View>
                </View>
              )}
            </View>

            {!keywordMatch && (
              <View className="flex items-center justify-center py-20">
                <Text className="block text-sm text-gray-400">未找到匹配模块</Text>
              </View>
            )}
          </>
        )}
      </View>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>门店WiFi链接模块</DialogTitle>
          </DialogHeader>

          <View className="mt-2">
            <Text className="block text-sm font-medium text-gray-800 mb-2">
              WiFi 名称（SSID）
            </Text>
            <View style={{ display: 'flex', flexDirection: 'row', gap: '8px' }}>
              <View className="flex-1 bg-gray-50 rounded-xl px-4 py-3">
                <Input
                  className="w-full bg-transparent"
                  placeholder="请输入 WiFi 名称"
                  value={ssid}
                  onInput={(e) => setSsid(e.detail.value)}
                />
              </View>
              <View
                className="flex items-center gap-1 px-3 py-3 rounded-xl shrink-0"
                style={{
                  background: fetchingWifi
                    ? '#fca5a5'
                    : 'linear-gradient(135deg, #ef4444, #f97316)',
                }}
                onClick={handleFetchCurrentWifi}
              >
                {fetchingWifi ? (
                  <LoaderCircle size={14} color="#fff" />
                ) : (
                  <Wifi size={14} color="#fff" />
                )}
                <Text className="block text-xs font-bold text-white whitespace-nowrap">
                  {fetchingWifi ? '获取中' : '获取当前'}
                </Text>
              </View>
            </View>
          </View>

          <View className="mt-4">
            <Text className="block text-sm font-medium text-gray-800 mb-2">
              WiFi 密码
            </Text>
            <View className="bg-gray-50 rounded-xl px-4 py-3">
              <Input
                className="w-full bg-transparent"
                placeholder="请输入 WiFi 密码（手动填写）"
                value={password}
                onInput={(e) => setPassword(e.detail.value)}
              />
            </View>
          </View>

          <View className="mt-6">
            <Button
              className="w-full bg-red-500 text-white rounded-xl py-3"
              onClick={handleSave}
              disabled={saving}
            >
              <Text className="block text-white font-medium">
                {saving ? '保存中...' : '保存'}
              </Text>
            </Button>
          </View>
        </DialogContent>
      </Dialog>
    </View>
  )
}
