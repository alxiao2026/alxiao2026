import { useState, useEffect } from 'react'
import Taro from '@tarojs/taro'
import { View, Text } from '@tarojs/components'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Network } from '@/network'
import { Wifi, LoaderCircle } from 'lucide-react-taro'

interface WifiInfo {
  ssid?: string
  password?: string
}

export default function MerchantMarketingPage() {
  const [merchantId, setMerchantId] = useState<string>('')
  const [ssid, setSsid] = useState('')
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [fetchingWifi, setFetchingWifi] = useState(false)

  useEffect(() => {
    const instance = Taro.getCurrentInstance()
    const id = instance.router?.params?.merchant_id || ''
    setMerchantId(id)
    if (id) {
      loadWifi(id)
    }
  }, [])

  const loadWifi = async (id: string) => {
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
    }
  }

  const handleFetchCurrentWifi = async () => {
    const env = Taro.getEnv()
    if (env !== Taro.ENV_TYPE.WEAPP && env !== Taro.ENV_TYPE.TT) {
      Taro.showToast({ title: '当前端无法自动获取，请手动输入 WiFi 名称', icon: 'none' })
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
        Taro.showToast({ title: '手机未连接 WiFi，请先连接店内 WiFi', icon: 'none' })
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
    } catch (err) {
      console.error('saveWifi err', err)
      Taro.showToast({ title: '保存失败', icon: 'none' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <View className="min-h-screen bg-gray-50">
      <View className="p-4">
        <View className="bg-white rounded-2xl p-4 border border-gray-100">
          <View className="flex items-center mb-3">
            <Wifi size={20} color="#FF4757" />
            <Text className="block text-base font-semibold text-gray-800 ml-2">门店 WiFi 管理</Text>
          </View>
          <Text className="block text-xs text-gray-500 mb-4">
            配置后消费者在商家页可一键连接店内 WiFi；留空 WiFi 名称则商家页不展示连接入口
          </Text>

          <View className="mb-4">
            <Text className="block text-sm font-medium text-gray-800 mb-2">WiFi 名称（SSID）</Text>
            <View className="flex items-center gap-2">
              <View className="flex-1 bg-gray-50 rounded-xl px-4 py-3">
                <Input
                  className="w-full bg-transparent"
                  placeholder="请输入 WiFi 名称"
                  value={ssid}
                  onInput={(e) => setSsid(e.detail.value)}
                />
              </View>
              <View
                className="flex items-center gap-1 px-3 py-3 rounded-xl"
                style={{ background: fetchingWifi ? '#FFB3BD' : 'linear-gradient(135deg, #FF4757, #FF7A59)' }}
                onClick={handleFetchCurrentWifi}
              >
                {fetchingWifi ? <LoaderCircle size={14} color="#fff" /> : <Wifi size={14} color="#fff" />}
                <Text className="text-xs font-bold text-white">{fetchingWifi ? '获取中' : '获取当前'}</Text>
              </View>
            </View>
          </View>

          <View className="mb-2">
            <Text className="block text-sm font-medium text-gray-800 mb-2">WiFi 密码</Text>
            <View className="bg-gray-50 rounded-xl px-4 py-3">
              <Input
                className="w-full bg-transparent"
                placeholder="请输入 WiFi 密码（手动填写）"
                value={password}
                onInput={(e) => setPassword(e.detail.value)}
              />
            </View>
          </View>
        </View>
      </View>

      <View style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '12px', backgroundColor: '#fff', borderTop: '1px solid #e5e5e5', zIndex: 50 }}>
        <Button
          className="w-full bg-[#FF4757] text-white rounded-xl py-3"
          onClick={handleSave}
          disabled={saving}
        >
          <Text className="text-white font-medium">{saving ? '保存中...' : '保存'}</Text>
        </Button>
      </View>
    </View>
  )
}
