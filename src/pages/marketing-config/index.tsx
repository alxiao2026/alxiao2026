import { useState, useEffect } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Image } from '@tarojs/components'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Network } from '@/network'
import { Wifi, LoaderCircle, Users, ImagePlus, RefreshCw, Gift, ChevronLeft } from 'lucide-react-taro'
import { cn } from '@/lib/utils'
import { uploadLocalImage, chooseImageH5, isMiniAppEnv, ensurePrivacyAuthorized } from '@/lib/upload-image'

interface WifiInfo {
  ssid?: string
  password?: string
  enabled?: boolean
}

interface CommunityConfig {
  enabled: boolean
  title: string
  subtitle: string
  button_text: string
  qrcode_url: string | null
}

interface PrizeOption {
  id: string
  name: string
  prize_type: string
  stock: number
  coupon_amount: number
  coupon_min_spend: number
  product_name: string
  product_value: number
  image_url?: string | null
}

interface TeamLotteryConfig {
  enabled: boolean
  team_size: number
  duration_hours: number
  leader_prize_id: string | null
  member_prize_ids: string[]
  share_title: string
  share_desc: string
  share_image_url: string | null
  logo_image_url: string | null
}

const DEFAULT_COMMUNITY: CommunityConfig = {
  enabled: false,
  title: '加店长领券享88折',
  subtitle: '进群抽免单，天天享9折',
  button_text: '长按识别二维码加店长',
  qrcode_url: null,
}

const DEFAULT_TEAM_LOTTERY: TeamLotteryConfig = {
  enabled: false,
  team_size: 3,
  duration_hours: 24,
  leader_prize_id: null,
  member_prize_ids: [],
  share_title: '组队抽大奖',
  share_desc: '我组了个队，快来一起免费抽奖',
  share_image_url: null,
  logo_image_url: null,
}

const MODULE_META: Record<string, { name: string; icon: typeof Wifi; color: string }> = {
  wifi: { name: '门店WiFi链接模块', icon: Wifi, color: '#ef4444' },
  community: { name: '社群营销配置', icon: Users, color: '#ef4444' },
  team_lottery: { name: '组队抽奖营销配置', icon: Gift, color: '#ef4444' },
}

export default function MarketingConfigPage() {
  const [merchantId, setMerchantId] = useState('')
  const [moduleKey, setModuleKey] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)

  // wifi
  const [ssid, setSsid] = useState('')
  const [password, setPassword] = useState('')
  const [wifiEnabled, setWifiEnabled] = useState(false)
  const [fetchingWifi, setFetchingWifi] = useState(false)

  // community
  const [communityConfig, setCommunityConfig] = useState<CommunityConfig>({ ...DEFAULT_COMMUNITY })
  const [communityUploading, setCommunityUploading] = useState(false)

  // team lottery
  const [teamLotteryConfig, setTeamLotteryConfig] = useState<TeamLotteryConfig>({ ...DEFAULT_TEAM_LOTTERY })
  const [teamLotteryPrizes, setTeamLotteryPrizes] = useState<PrizeOption[]>([])
  const [teamLotteryUploading, setTeamLotteryUploading] = useState(false)

  useEffect(() => {
    const instance = Taro.getCurrentInstance()
    const id = instance.router?.params?.merchant_id || ''
    const moduleParam = instance.router?.params?.module || ''
    setMerchantId(id)
    setModuleKey(moduleParam)
    if (id && moduleParam) {
      loadModuleData(id, moduleParam)
    }
    Taro.setNavigationBarTitle({
      title: MODULE_META[moduleParam]?.name || '营销参数配置',
    })
  }, [])

  const loadModuleData = async (id: string, key: string) => {
    setLoading(true)
    try {
      if (key === 'wifi') {
        const res = await Network.request({ url: `/api/merchants/${id}/wifi`, method: 'GET' })
        console.log('loadWifi res', res)
        const data: WifiInfo = res?.data?.data || {}
        setSsid(data.ssid || '')
        setPassword(data.password || '')
        setWifiEnabled(!!data.enabled)
      } else if (key === 'community') {
        const res = await Network.request({ url: `/api/merchants/${id}/community-marketing`, method: 'GET' })
        console.log('loadCommunityConfig res', res)
        const data = res?.data?.data
        if (data) {
          setCommunityConfig({
            enabled: !!data.enabled,
            title: data.title || DEFAULT_COMMUNITY.title,
            subtitle: data.subtitle || DEFAULT_COMMUNITY.subtitle,
            button_text: data.button_text || DEFAULT_COMMUNITY.button_text,
            qrcode_url: data.qrcode_url || null,
          })
        }
      } else if (key === 'team_lottery') {
        const [configRes, prizesRes] = await Promise.all([
          Network.request({ url: `/api/team-lottery/config/${id}`, method: 'GET' }),
          Network.request({ url: `/api/team-lottery/prizes/${id}`, method: 'GET' }),
        ])
        console.log('loadTeamLotteryConfig res', configRes)
        console.log('loadTeamLotteryPrizes res', prizesRes)
        const data = configRes?.data?.data
        if (data) {
          setTeamLotteryConfig({
            enabled: !!data.enabled,
            team_size: Number(data.team_size) || 3,
            duration_hours: Number(data.duration_hours) || 24,
            leader_prize_id: data.leader_prize_id || null,
            member_prize_ids: Array.isArray(data.member_prize_ids) ? data.member_prize_ids : [],
            share_title: data.share_title || DEFAULT_TEAM_LOTTERY.share_title,
            share_desc: data.share_desc || DEFAULT_TEAM_LOTTERY.share_desc,
            share_image_url: data.share_image_url || null,
            logo_image_url: data.logo_image_url || null,
          })
        }
        const list = prizesRes?.data?.data || []
        setTeamLotteryPrizes(list as PrizeOption[])
      }
    } catch (err) {
      console.error('loadModuleData err', err)
      Taro.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  const canFetchWifi =
    Taro.getEnv() === Taro.ENV_TYPE.WEAPP || Taro.getEnv() === Taro.ENV_TYPE.TT

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
      console.error('[MarketingConfig] 获取当前 WiFi 失败:', e)
      if (e?.errCode === 12005 || e?.errCode === 12010) {
        Taro.showToast({ title: '手机未连接 WiFi，请先连接店内 WiFi', icon: 'none' })
      } else {
        Taro.showToast({ title: '获取 WiFi 失败，请手动输入', icon: 'none' })
      }
    } finally {
      setFetchingWifi(false)
    }
  }

  const handleChooseCommunityQrcode = async () => {
    if (communityUploading) return
    setCommunityUploading(true)
    try {
      let url: string | null = null
      if (isMiniAppEnv()) {
        await ensurePrivacyAuthorized()
        const choose = await Taro.chooseMedia({ count: 1, mediaType: ['image'], sizeType: ['compressed'], sourceType: ['album', 'camera'] })
        const path = choose.tempFiles?.[0]?.tempFilePath
        if (path) url = await uploadLocalImage(path)
      } else {
        const picked = await chooseImageH5()
        if (picked) url = await uploadLocalImage(picked.localUrl, picked.file)
      }
      if (url) {
        setCommunityConfig((prev) => ({ ...prev, qrcode_url: url }))
        Taro.showToast({ title: '二维码已上传', icon: 'success' })
      }
    } catch {
      // 用户取消选择
    } finally {
      setCommunityUploading(false)
    }
  }

  const handleChooseTeamLotteryShareImage = async () => {
    if (teamLotteryUploading) return
    setTeamLotteryUploading(true)
    try {
      let url: string | null = null
      if (isMiniAppEnv()) {
        await ensurePrivacyAuthorized()
        const choose = await Taro.chooseMedia({ count: 1, mediaType: ['image'], sizeType: ['compressed'], sourceType: ['album', 'camera'] })
        const path = choose.tempFiles?.[0]?.tempFilePath
        if (path) url = await uploadLocalImage(path)
      } else {
        const picked = await chooseImageH5()
        if (picked) url = await uploadLocalImage(picked.localUrl, picked.file)
      }
      if (url) {
        setTeamLotteryConfig((prev) => ({ ...prev, share_image_url: url }))
        Taro.showToast({ title: '分享图已上传', icon: 'success' })
      }
    } catch {
      // 用户取消选择
    } finally {
      setTeamLotteryUploading(false)
    }
  }

  const handleChooseTeamLotteryLogoImage = async () => {
    if (teamLotteryUploading) return
    setTeamLotteryUploading(true)
    try {
      let url: string | null = null
      if (isMiniAppEnv()) {
        await ensurePrivacyAuthorized()
        const choose = await Taro.chooseMedia({ count: 1, mediaType: ['image'], sizeType: ['compressed'], sourceType: ['album', 'camera'] })
        const path = choose.tempFiles?.[0]?.tempFilePath
        if (path) url = await uploadLocalImage(path)
      } else {
        const picked = await chooseImageH5()
        if (picked) url = await uploadLocalImage(picked.localUrl, picked.file)
      }
      if (url) {
        setTeamLotteryConfig((prev) => ({ ...prev, logo_image_url: url }))
        Taro.showToast({ title: 'Logo 已上传', icon: 'success' })
      }
    } catch {
      // 用户取消选择
    } finally {
      setTeamLotteryUploading(false)
    }
  }

  const handleSave = async () => {
    if (!merchantId || !moduleKey) return
    setSaving(true)
    try {
      if (moduleKey === 'wifi') {
        await Network.request({
          url: `/api/merchants/${merchantId}/wifi`,
          method: 'PUT',
          data: { wifi_ssid: ssid.trim(), wifi_password: password.trim(), enabled: wifiEnabled },
        })
      } else if (moduleKey === 'community') {
        await Network.request({
          url: `/api/merchants/${merchantId}/community-marketing`,
          method: 'PUT',
          data: {
            enabled: communityConfig.enabled,
            title: communityConfig.title.trim(),
            subtitle: communityConfig.subtitle.trim(),
            button_text: communityConfig.button_text.trim(),
            qrcode_url: communityConfig.qrcode_url,
          },
        })
      } else if (moduleKey === 'team_lottery') {
        await Network.request({
          url: `/api/team-lottery/config/${merchantId}`,
          method: 'PUT',
          data: {
            enabled: teamLotteryConfig.enabled,
            team_size: teamLotteryConfig.team_size,
            duration_hours: teamLotteryConfig.duration_hours,
            leader_prize_id: teamLotteryConfig.leader_prize_id,
            member_prize_ids: teamLotteryConfig.member_prize_ids,
            share_title: teamLotteryConfig.share_title.trim(),
            share_desc: teamLotteryConfig.share_desc.trim(),
            share_image_url: teamLotteryConfig.share_image_url,
            logo_image_url: teamLotteryConfig.logo_image_url,
          },
        })
      }
      Taro.showToast({ title: '保存成功', icon: 'success' })
      setTimeout(() => Taro.navigateBack(), 800)
    } catch (err) {
      console.error('save err', err)
      Taro.showToast({ title: '保存失败', icon: 'none' })
    } finally {
      setSaving(false)
    }
  }

  const renderHeader = () => {
    const meta = moduleKey ? MODULE_META[moduleKey] : null
    const Icon = meta?.icon || Wifi
    return (
      <View className="bg-white px-4 pt-3 pb-4 border-b border-gray-100">
        <View className="flex items-center gap-2 mb-2">
          <View className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
            <Icon size={20} color={meta?.color || '#ef4444'} />
          </View>
          <View>
            <Text className="block text-lg font-bold text-gray-900">{meta?.name || '营销参数配置'}</Text>
            <Text className="block text-xs text-gray-400">配置完成后点击底部按钮保存</Text>
          </View>
        </View>
      </View>
    )
  }

  return (
    <View className="min-h-screen bg-gray-50 flex flex-col">
      <View className="flex items-center gap-2 px-4 py-3 bg-white border-b border-gray-100">
        <View onClick={() => Taro.navigateBack()}>
          <ChevronLeft size={24} color="#374151" />
        </View>
        <Text className="block text-base font-bold text-gray-900">
          {MODULE_META[moduleKey || '']?.name || '营销参数配置'}
        </Text>
      </View>

      {loading ? (
        <View className="flex-1 flex items-center justify-center">
          <LoaderCircle size={32} color="#ef4444" className="animate-spin" />
        </View>
      ) : (
        <>
          <View className="flex-1 overflow-y-auto">
            {renderHeader()}

            <View className="p-4 pb-24">
              {moduleKey === 'wifi' && (
                <>
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
                    <Text className="block text-sm font-medium text-gray-800 mb-2">启用门店 WiFi</Text>
                    <View className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
                      <Text className="text-sm text-gray-600">在商家页展示连接 WiFi 入口</Text>
                      <Switch checked={wifiEnabled} onCheckedChange={(checked) => setWifiEnabled(checked)} />
                    </View>
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
                        <Text className="text-white text-sm">{canFetchWifi ? '获取当前' : '小程序可用'}</Text>
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
                </>
              )}

              {moduleKey === 'community' && (
                <>
                  <View className="bg-red-50 rounded-xl p-3 mb-4">
                    <View className="flex flex-row items-center mb-1">
                      <Users size={16} color="#ef4444" />
                      <Text className="block text-sm font-medium text-gray-800 ml-1">社群营销配置</Text>
                      <View className="ml-2 px-2 py-1 bg-red-500 rounded">
                        <Text className="text-xs font-bold text-white">HOT</Text>
                      </View>
                    </View>
                    <Text className="block text-xs text-gray-500 leading-relaxed">
                      在订单详情页展示加群/加店长引导卡片，配置后用户可在订单详情页长按识别二维码加群
                    </Text>
                  </View>

                  <View className="mb-4">
                    <Text className="block text-sm font-medium text-gray-800 mb-2">启用社群营销</Text>
                    <View className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
                      <Text className="text-sm text-gray-600">在订单详情页展示加群/加店长引导卡片</Text>
                      <Switch
                        checked={communityConfig.enabled}
                        onCheckedChange={(checked) => setCommunityConfig((prev) => ({ ...prev, enabled: checked }))}
                      />
                    </View>
                  </View>

                  <View className="mb-4">
                    <Text className="block text-sm font-medium text-gray-800 mb-2">主标题</Text>
                    <View className="bg-gray-50 rounded-xl px-4 py-3">
                      <Input
                        className="w-full bg-transparent border-0 focus-visible:ring-0 p-0"
                        placeholder="如：加店长领券享88折"
                        value={communityConfig.title}
                        onInput={(e) => setCommunityConfig((prev) => ({ ...prev, title: e.detail.value }))}
                      />
                    </View>
                  </View>

                  <View className="mb-4">
                    <Text className="block text-sm font-medium text-gray-800 mb-2">副标题</Text>
                    <View className="bg-gray-50 rounded-xl px-4 py-3">
                      <Input
                        className="w-full bg-transparent border-0 focus-visible:ring-0 p-0"
                        placeholder="如：进群抽免单，天天享9折"
                        value={communityConfig.subtitle}
                        onInput={(e) => setCommunityConfig((prev) => ({ ...prev, subtitle: e.detail.value }))}
                      />
                    </View>
                  </View>

                  <View className="mb-4">
                    <Text className="block text-sm font-medium text-gray-800 mb-2">按钮文案</Text>
                    <View className="bg-gray-50 rounded-xl px-4 py-3">
                      <Input
                        className="w-full bg-transparent border-0 focus-visible:ring-0 p-0"
                        placeholder="如：长按识别二维码加店长"
                        value={communityConfig.button_text}
                        onInput={(e) => setCommunityConfig((prev) => ({ ...prev, button_text: e.detail.value }))}
                      />
                    </View>
                  </View>

                  <View className="mb-4">
                    <Text className="block text-sm font-medium text-gray-800 mb-1">社群二维码</Text>
                    <Text className="block text-xs text-gray-400 mb-3">建议上传清晰的正方形二维码图片，用户长按识别加群</Text>
                    <View className="flex flex-row items-center gap-4">
                      {communityConfig.qrcode_url ? (
                        <View className="rounded-xl overflow-hidden bg-gray-50 p-2 border border-gray-100">
                          <Image
                            src={communityConfig.qrcode_url}
                            className="w-32 h-32"
                            mode="aspectFit"
                            onError={(e: any) => console.warn('[MarketingConfig] 二维码加载失败:', e?.detail?.errMsg || e)}
                          />
                        </View>
                      ) : (
                        <View className="w-32 h-32 rounded-xl bg-gray-50 border border-dashed border-gray-200 flex items-center justify-center">
                          <Text className="text-xs text-gray-300">未上传</Text>
                        </View>
                      )}
                      <View className="flex-1">
                        <Button className="w-full bg-red-500" disabled={communityUploading} onClick={handleChooseCommunityQrcode}>
                          <View className="flex flex-row items-center justify-center gap-1">
                            {communityUploading ? (
                              <LoaderCircle size={16} color="#fff" className="animate-spin" />
                            ) : communityConfig.qrcode_url ? (
                              <RefreshCw size={16} color="#fff" />
                            ) : (
                              <ImagePlus size={16} color="#fff" />
                            )}
                            <Text className="text-white text-sm">
                              {communityUploading ? '上传中...' : communityConfig.qrcode_url ? '重新上传' : '上传二维码'}
                            </Text>
                          </View>
                        </Button>
                      </View>
                    </View>
                  </View>
                </>
              )}

              {moduleKey === 'team_lottery' && (
                <>
                  <View className="bg-red-50 rounded-xl p-3 mb-4">
                    <View className="flex flex-row items-center mb-1">
                      <Gift size={16} color="#ef4444" />
                      <Text className="block text-sm font-medium text-gray-800 ml-1">组队抽奖营销</Text>
                      <View className="ml-2 px-2 py-1 bg-red-500 rounded">
                        <Text className="text-xs font-bold text-white">NEW</Text>
                      </View>
                    </View>
                    <Text className="block text-xs text-gray-500 leading-relaxed">
                      消费者下单支付成功后可发起组队，邀请好友加入，满员后全员免费抽奖，团长必得奖品
                    </Text>
                  </View>

                  <View className="mb-4">
                    <Text className="block text-sm font-medium text-gray-800 mb-2">启用组队抽奖</Text>
                    <View className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
                      <Text className="text-sm text-gray-600">在套餐详情页展示组队抽奖入口</Text>
                      <Switch
                        checked={teamLotteryConfig.enabled}
                        onCheckedChange={(checked) => setTeamLotteryConfig((prev) => ({ ...prev, enabled: checked }))}
                      />
                    </View>
                  </View>

                  <View className="mb-4">
                    <Text className="block text-sm font-medium text-gray-800 mb-2">成团人数</Text>
                    <View className="flex flex-row gap-2">
                      {[3, 5].map((n) => (
                        <View
                          key={n}
                          onClick={() => setTeamLotteryConfig((prev) => ({ ...prev, team_size: n }))}
                          className={cn(
                            'px-4 py-2 rounded-lg border text-sm',
                            teamLotteryConfig.team_size === n
                              ? 'bg-red-500 border-red-500 text-white'
                              : 'bg-white border-gray-200 text-gray-600'
                          )}
                        >
                          <Text className={teamLotteryConfig.team_size === n ? 'text-white' : 'text-gray-600'}>{n}人团</Text>
                        </View>
                      ))}
                      <View className="flex-1 flex flex-row items-center bg-gray-50 rounded-lg px-3 py-2">
                        <Input
                          className="w-full bg-transparent border-0 focus-visible:ring-0 p-0 text-sm"
                          type="number"
                          placeholder="自定义"
                          value={String(teamLotteryConfig.team_size)}
                          onInput={(e) => {
                            const v = parseInt(e.detail.value, 10)
                            setTeamLotteryConfig((prev) => ({
                              ...prev,
                              team_size: Number.isNaN(v) || v < 2 ? 2 : v > 20 ? 20 : v,
                            }))
                          }}
                        />
                        <Text className="text-sm text-gray-500 ml-1">人</Text>
                      </View>
                    </View>
                  </View>

                  <View className="mb-4">
                    <Text className="block text-sm font-medium text-gray-800 mb-2">组队有效期</Text>
                    <View className="flex flex-row items-center bg-gray-50 rounded-xl px-4 py-3">
                      <Input
                        className="flex-1 bg-transparent border-0 focus-visible:ring-0 p-0"
                        type="number"
                        value={String(teamLotteryConfig.duration_hours)}
                        onInput={(e) => {
                          const v = parseInt(e.detail.value, 10)
                          setTeamLotteryConfig((prev) => ({
                            ...prev,
                            duration_hours: Number.isNaN(v) || v < 1 ? 1 : v > 72 ? 72 : v,
                          }))
                        }}
                      />
                      <Text className="text-sm text-gray-500 ml-2">小时</Text>
                    </View>
                  </View>

                  <View className="mb-4">
                    <Text className="block text-sm font-medium text-gray-800 mb-2">团长奖品（必得）</Text>
                    <Text className="block text-xs text-gray-400 mb-2">队伍满员后自动发放给团长</Text>
                    <View className="border border-gray-100 rounded-xl">
                      {teamLotteryPrizes.length === 0 ? (
                        <View className="p-4">
                          <Text className="block text-xs text-gray-400">该商家暂无可选奖品，请先去奖品管理添加</Text>
                        </View>
                      ) : (
                        teamLotteryPrizes.map((p) => (
                          <View
                            key={p.id}
                            onClick={() => setTeamLotteryConfig((prev) => ({ ...prev, leader_prize_id: p.id }))}
                            className={cn(
                              'flex items-center justify-between px-4 py-3 border-b border-gray-50 last:border-0',
                              teamLotteryConfig.leader_prize_id === p.id ? 'bg-red-50' : 'bg-white'
                            )}
                          >
                            <View>
                              <Text className={cn('block text-sm', teamLotteryConfig.leader_prize_id === p.id ? 'text-red-600 font-medium' : 'text-gray-800')}>
                                {p.name}
                              </Text>
                              <Text className="block text-xs text-gray-400">
                                {p.prize_type === 'coupon'
                                  ? `券额 ¥${p.coupon_amount} / 最低消费 ¥${p.coupon_min_spend}`
                                  : p.prize_type === 'product'
                                    ? `实物 ${p.product_name || p.name}`
                                    : '其他'}
                                · 库存 {p.stock}
                              </Text>
                            </View>
                            <View
                              className={cn(
                                'w-5 h-5 rounded-full border-2 flex items-center justify-center',
                                teamLotteryConfig.leader_prize_id === p.id ? 'border-red-500 bg-red-500' : 'border-gray-300'
                              )}
                            >
                              {teamLotteryConfig.leader_prize_id === p.id && <View className="w-2 h-2 rounded-full bg-white" />}
                            </View>
                          </View>
                        ))
                      )}
                    </View>
                  </View>

                  <View className="mb-4">
                    <Text className="block text-sm font-medium text-gray-800 mb-2">队员奖品池</Text>
                    <Text className="block text-xs text-gray-400 mb-2">满员后队员可从中随机抽取一个奖品</Text>
                    <View className="border border-gray-100 rounded-xl">
                      {teamLotteryPrizes.length === 0 ? (
                        <View className="p-4">
                          <Text className="block text-xs text-gray-400">该商家暂无可选奖品，请先去奖品管理添加</Text>
                        </View>
                      ) : (
                        teamLotteryPrizes.map((p) => {
                          const checked = teamLotteryConfig.member_prize_ids.includes(p.id)
                          return (
                            <View
                              key={p.id}
                              onClick={() =>
                                setTeamLotteryConfig((prev) => ({
                                  ...prev,
                                  member_prize_ids: checked
                                    ? prev.member_prize_ids.filter((id) => id !== p.id)
                                    : [...prev.member_prize_ids, p.id],
                                }))
                              }
                              className={cn(
                                'flex items-center justify-between px-4 py-3 border-b border-gray-50 last:border-0',
                                checked ? 'bg-red-50' : 'bg-white'
                              )}
                            >
                              <View>
                                <Text className={cn('block text-sm', checked ? 'text-red-600 font-medium' : 'text-gray-800')}>
                                  {p.name}
                                </Text>
                                <Text className="block text-xs text-gray-400">
                                  {p.prize_type === 'coupon'
                                    ? `券额 ¥${p.coupon_amount} / 最低消费 ¥${p.coupon_min_spend}`
                                    : p.prize_type === 'product'
                                      ? `实物 ${p.product_name || p.name}`
                                      : '其他'}
                                  · 库存 {p.stock}
                                </Text>
                              </View>
                              <View
                                className={cn(
                                  'w-5 h-5 rounded border-2 flex items-center justify-center',
                                  checked ? 'border-red-500 bg-red-500' : 'border-gray-300'
                                )}
                              >
                                {checked && <Text className="text-white text-xs">✓</Text>}
                              </View>
                            </View>
                          )
                        })
                      )}
                    </View>
                  </View>

                  <View className="mb-4">
                    <Text className="block text-sm font-medium text-gray-800 mb-2">分享标题</Text>
                    <View className="bg-gray-50 rounded-xl px-4 py-3">
                      <Input
                        className="w-full bg-transparent border-0 focus-visible:ring-0 p-0"
                        placeholder="如：组队抽大奖"
                        value={teamLotteryConfig.share_title}
                        onInput={(e) => setTeamLotteryConfig((prev) => ({ ...prev, share_title: e.detail.value }))}
                      />
                    </View>
                  </View>

                  <View className="mb-4">
                    <Text className="block text-sm font-medium text-gray-800 mb-2">分享描述</Text>
                    <View className="bg-gray-50 rounded-xl px-4 py-3">
                      <Input
                        className="w-full bg-transparent border-0 focus-visible:ring-0 p-0"
                        placeholder="如：我组了个队，快来一起免费抽奖"
                        value={teamLotteryConfig.share_desc}
                        onInput={(e) => setTeamLotteryConfig((prev) => ({ ...prev, share_desc: e.detail.value }))}
                      />
                    </View>
                  </View>

                  <View className="mb-4">
                    <Text className="block text-sm font-medium text-gray-800 mb-1">页面 Logo 图</Text>
                    <Text className="block text-xs text-gray-400 mb-3">建议上传正方形 Logo，展示在组队抽奖页面顶部</Text>
                    <View className="flex flex-row items-center gap-4">
                      {teamLotteryConfig.logo_image_url ? (
                        <View className="rounded-xl overflow-hidden bg-gray-50 p-2 border border-gray-100">
                          <Image
                            src={teamLotteryConfig.logo_image_url}
                            className="w-16 h-16 rounded-lg"
                            mode="aspectFill"
                            onError={(e: any) => console.warn('[MarketingConfig] Logo 加载失败:', e?.detail?.errMsg || e)}
                          />
                        </View>
                      ) : (
                        <View className="w-16 h-16 rounded-xl bg-gray-50 border border-dashed border-gray-200 flex items-center justify-center">
                          <Text className="text-xs text-gray-300">未上传</Text>
                        </View>
                      )}
                      <View className="flex-1">
                        <Button className="w-full bg-red-500" disabled={teamLotteryUploading} onClick={handleChooseTeamLotteryLogoImage}>
                          <View className="flex flex-row items-center justify-center gap-1">
                            {teamLotteryUploading ? (
                              <LoaderCircle size={16} color="#fff" className="animate-spin" />
                            ) : teamLotteryConfig.logo_image_url ? (
                              <RefreshCw size={16} color="#fff" />
                            ) : (
                              <ImagePlus size={16} color="#fff" />
                            )}
                            <Text className="block text-white text-sm">{teamLotteryConfig.logo_image_url ? '更换 Logo' : '上传 Logo'}</Text>
                          </View>
                        </Button>
                      </View>
                    </View>
                  </View>

                  <View className="mb-4">
                    <Text className="block text-sm font-medium text-gray-800 mb-1">分享封面图</Text>
                    <Text className="block text-xs text-gray-400 mb-3">建议上传 5:4 比例营销图，分享卡片展示效果更佳</Text>
                    <View className="flex flex-row items-center gap-4">
                      {teamLotteryConfig.share_image_url ? (
                        <View className="rounded-xl overflow-hidden bg-gray-50 p-2 border border-gray-100">
                          <Image
                            src={teamLotteryConfig.share_image_url}
                            className="w-32 h-24"
                            mode="aspectFit"
                            onError={(e: any) => console.warn('[MarketingConfig] 分享图加载失败:', e?.detail?.errMsg || e)}
                          />
                        </View>
                      ) : (
                        <View className="w-32 h-24 rounded-xl bg-gray-50 border border-dashed border-gray-200 flex items-center justify-center">
                          <Text className="text-xs text-gray-300">未上传</Text>
                        </View>
                      )}
                      <View className="flex-1">
                        <Button className="w-full bg-red-500" disabled={teamLotteryUploading} onClick={handleChooseTeamLotteryShareImage}>
                          <View className="flex flex-row items-center justify-center gap-1">
                            {teamLotteryUploading ? (
                              <LoaderCircle size={16} color="#fff" className="animate-spin" />
                            ) : teamLotteryConfig.share_image_url ? (
                              <RefreshCw size={16} color="#fff" />
                            ) : (
                              <ImagePlus size={16} color="#fff" />
                            )}
                            <Text className="text-white text-sm">
                              {teamLotteryUploading ? '上传中...' : teamLotteryConfig.share_image_url ? '重新上传' : '上传封面'}
                            </Text>
                          </View>
                        </Button>
                      </View>
                    </View>
                  </View>
                </>
              )}
            </View>
          </View>

          <View className="fixed left-0 right-0 bottom-0 bg-white border-t border-gray-100 p-4 pb-safe">
            <Button className="w-full bg-red-500" onClick={handleSave} disabled={saving}>
              <Text className="text-white">{saving ? '保存中...' : '保存'}</Text>
            </Button>
          </View>
        </>
      )}
    </View>
  )
}
