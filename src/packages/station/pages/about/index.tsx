import { useRef, useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { View, Text, ScrollView } from '@tarojs/components'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { MapPin, Clock, Info, MessageSquare, Package, ScanLine, ShieldCheck } from 'lucide-react-taro'
import { DEPLOY, loadStats, loadStationConfig, saveFeedback, type StationConfig } from '../../lib/station-config'

/**
 * 我的驿站 / 关于页
 * - 驿站介绍、地址、营业时间、扫码次数统计（模拟数据）、意见反馈入口
 * - 隐藏入口：连点 5 次顶部标题唤起口令弹窗，口令见 DEPLOY.ADMIN_PASSWORD（默认 8888）
 */
const TITLE_TAP_THRESHOLD = 5
const TAP_RESET_MS = 2500

const StationAboutPage = () => {
  const [station] = useState<StationConfig>(() => loadStationConfig())
  const [stats, setStats] = useState(() => loadStats())
  const [feedback, setFeedback] = useState('')
  const [showAdminDialog, setShowAdminDialog] = useState(false)
  const [password, setPassword] = useState('')
  const tapCountRef = useRef(0)
  const lastTapRef = useRef(0)

  useDidShow(() => {
    setStats(loadStats())
  })

  /** 连点 5 次标题唤起管理入口（2.5 秒内连点） */
  const handleTitleTap = () => {
    const now = Date.now()
    if (now - lastTapRef.current > TAP_RESET_MS) {
      tapCountRef.current = 0
    }
    lastTapRef.current = now
    tapCountRef.current += 1
    if (tapCountRef.current >= TITLE_TAP_THRESHOLD) {
      tapCountRef.current = 0
      setShowAdminDialog(true)
      Taro.vibrateShort({ type: 'light' }).catch(() => undefined)
    }
  }

  /** 校验口令并进入管理配置页（口令集中配置于 DEPLOY.ADMIN_PASSWORD，上线前修改） */
  const handlePasswordConfirm = () => {
    if (password === DEPLOY.ADMIN_PASSWORD) {
      setShowAdminDialog(false)
      setPassword('')
      Taro.navigateTo({ url: '/packages/station/pages/admin/index' })
    } else {
      Taro.showToast({ title: '口令错误', icon: 'none' })
    }
  }

  const handleSubmitFeedback = () => {
    const content = feedback.trim()
    if (!content) {
      Taro.showToast({ title: '请先填写反馈内容', icon: 'none' })
      return
    }
    // ▶▶ 预留 API：POST /api/station/feedback（接入后端后替换本地存储）
    saveFeedback(content)
    setFeedback('')
    Taro.showToast({ title: '已收到，感谢反馈', icon: 'success' })
  }

  const statRow = (icon: React.ReactNode, label: string, value: string) => (
    <View className="flex-1 flex flex-col items-center">
      <View className="w-9 h-9 rounded-full bg-[#FFF3E5] flex items-center justify-center">{icon}</View>
      <Text className="block text-xl font-bold text-gray-800 mt-2">{value}</Text>
      <Text className="block text-xs text-gray-400 mt-1">{label}</Text>
    </View>
  )

  return (
    <View className="flex flex-col h-screen bg-gray-50">
      <ScrollView className="flex-1" scrollY>
        {/* 顶部标题（隐藏管理入口：连点 5 次） */}
        <View className="px-5 pt-6 pb-8 bg-gradient-to-b from-[#FFB347] to-[#FF6B35] flex flex-col items-center">
          <View onClick={handleTitleTap}>
            <Text className="block text-xl font-bold text-white">{station.name}</Text>
          </View>
          <Text className="block text-xs text-white mt-2" style={{ opacity: 0.8 }}>
            驿站编码 {station.code}
          </Text>
        </View>

        {/* 驿站信息卡片 */}
        <View className="px-4 -mt-4">
          <View className="bg-white rounded-3xl p-5 shadow-md">
            <View className="flex flex-row items-center gap-2">
              <Info size={14} color="#FF6B35" />
              <Text className="block text-sm font-bold text-gray-800">驿站介绍</Text>
            </View>
            <Text className="block text-xs text-gray-600 leading-5 mt-3">{station.intro}</Text>

            <View className="h-px bg-gray-100 my-4" />

            <View className="flex flex-row items-center gap-2">
              <MapPin size={13} color="#9CA3AF" />
              <Text className="block text-xs text-gray-500 flex-1">{station.address}</Text>
            </View>
            <View className="flex flex-row items-center gap-2 mt-3">
              <Clock size={13} color="#9CA3AF" />
              <Text className="block text-xs text-gray-500">营业时间 {station.businessHours}</Text>
            </View>
          </View>
        </View>

        {/* 扫码/查件统计（模拟数据） */}
        <View className="px-4 mt-4">
          <View className="bg-white rounded-3xl py-5 shadow-md flex flex-row">
            {statRow(<ScanLine size={16} color="#FF6B35" />, '今日查件', String(stats.todayQueries))}
            {statRow(<Package size={16} color="#FF6B35" />, '累计查件', String(stats.totalQueries))}
            {statRow(<ShieldCheck size={16} color="#FF6B35" />, '累计服务包裹', String(stats.totalPackages))}
          </View>
          <Text className="block text-xs text-gray-300 text-center mt-2">统计为演示数据</Text>
        </View>

        {/* 意见反馈 */}
        <View className="px-4 mt-4 pb-10">
          <View className="bg-white rounded-3xl p-5 shadow-md">
            <View className="flex flex-row items-center gap-2">
              <MessageSquare size={14} color="#FF6B35" />
              <Text className="block text-sm font-bold text-gray-800">意见反馈</Text>
            </View>
            {/* Textarea 样式跨端规范：外层 View 承载样式，Textarea 透明 */}
            <View className="bg-gray-50 rounded-2xl p-4 mt-3">
              <Textarea
                style={{ width: '100%', minHeight: '80px', backgroundColor: 'transparent' }}
                placeholder="说说您在使用驿站查件时遇到的问题或建议…"
                value={feedback}
                onInput={(e) => setFeedback(e.detail.value)}
                maxlength={200}
              />
            </View>
            <Button
              className="w-full h-auto py-3 mt-3 rounded-full bg-[#FF6B35] text-white"
              onClick={handleSubmitFeedback}
            >
              <Text>提交反馈</Text>
            </Button>
          </View>
        </View>
      </ScrollView>

      {/* 管理入口口令弹窗（连点 5 次标题唤起） */}
      <Dialog open={showAdminDialog} onOpenChange={setShowAdminDialog}>
        <DialogContent className="bg-white rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-center text-base font-semibold text-gray-900">驿站管理</DialogTitle>
          </DialogHeader>
          <View className="mt-3">
            <Text className="block text-xs text-gray-400 mb-2">请输入管理口令</Text>
            <View className="bg-gray-50 rounded-xl px-4 py-3">
              <Input
                className="w-full bg-transparent"
                type="number"
                password
                placeholder="4 位管理口令"
                value={password}
                onInput={(e) => setPassword(e.detail.value)}
              />
            </View>
          </View>
          <View className="flex flex-row gap-3 mt-5">
            <View className="flex-1">
              <Button variant="outline" className="w-full rounded-full" onClick={() => setShowAdminDialog(false)}>
                <Text>取消</Text>
              </Button>
            </View>
            <View className="flex-1">
              <Button className="w-full rounded-full bg-[#FF6B35] text-white" onClick={handlePasswordConfirm}>
                <Text>进入管理</Text>
              </Button>
            </View>
          </View>
        </DialogContent>
      </Dialog>
    </View>
  )
}

export default StationAboutPage
