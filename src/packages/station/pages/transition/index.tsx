import { useEffect, useRef, useState } from 'react'
import Taro, { useLoad } from '@tarojs/taro'
import { View, Text } from '@tarojs/components'
import { Button } from '@/components/ui/button'
import { Link2, Copy, Check } from 'lucide-react-taro'
import {
  QUERY_TYPE_LABEL,
  buildCainiaoUrl,
  buildPddUrl,
  getMiniProgramTarget,
  loadStationConfig,
  recordQuery,
  type QueryType,
} from '../../lib/station-config'
import './index.css'

/**
 * 跳转过渡页：2 秒倒计时自动跳转 + 全屏插屏广告模拟 + 3 秒解锁跳过 + 复制链接兜底
 *
 * ▶▶ 跳转方案（微信审核可过的正式形态：跳官方小程序，不用 web-view）：
 * 倒计时结束调用 Taro.navigateToMiniProgram 跳转拼多多 / 菜鸟裹裹官方小程序。
 * appId / path 集中配置于 lib/station-config.ts 的 DEPLOY：
 *   - PDD_MINI_PROGRAM_APP_ID      已联网核实（微信开放社区等多来源交叉验证）
 *   - CAINIAO_MINI_PROGRAM_APP_ID  暂留空占位（未搜到可靠公开值）→ 自动降级为复制链接兜底
 *   - path 均留空 = 跳对方小程序首页（查件相关 path 未公开，查到后可填入直达）
 * 兜底出口：跳转失败 / appId 未配置 / H5 预览时，引导用户「复制链接」在浏览器打开对应查件 H5。
 *
 * ▶▶ 流量主插屏广告：
 *   开通流量主后将 DEPLOY.INTERSTITIAL_AD_UNIT_ID（lib/station-config.ts）替换为真实广告位 id，
 *   并使用 Taro.createInterstitialAd({ adUnitId }) 创建插屏广告，替代下方模拟大图。
 */

/** 过渡页自动跳转倒计时（秒） */
const AUTO_JUMP_SECONDS = 2
/** 「跳过广告」按钮解锁倒计时（秒） */
const SKIP_UNLOCK_SECONDS = 3
/** 跳转防连点间隔（毫秒） */
const JUMP_DEBOUNCE_MS = 800

const StationTransitionPage = () => {
  const [queryType, setQueryType] = useState<QueryType>('pdd')
  const [countdown, setCountdown] = useState(AUTO_JUMP_SECONDS)
  const [skipCountdown, setSkipCountdown] = useState(SKIP_UNLOCK_SECONDS)
  const [copied, setCopied] = useState(false)
  const [targetUrl, setTargetUrl] = useState('')
  /** 自动跳转是否已触发（防止倒计时 effect 重复触发） */
  const autoJumpedRef = useRef(false)
  /** 跳转防连点时间戳 */
  const lastJumpRef = useRef(0)

  const isMiniProgramEnv = [Taro.ENV_TYPE.WEAPP, Taro.ENV_TYPE.TT].includes(Taro.getEnv() as any)
  const label = QUERY_TYPE_LABEL[queryType]

  useLoad((options) => {
    const type = options?.type === 'cainiao' ? 'cainiao' : 'pdd'
    const station = loadStationConfig()
    setQueryType(type)
    const url = type === 'cainiao'
      ? buildCainiaoUrl(station.cainiaoStationId)
      : buildPddUrl(station.code)
    setTargetUrl(url)
  })

  /**
   * 统一跳转出口：navigateToMiniProgram 跳官方小程序
   * appId 未配置 / H5 预览 / 跳转失败 → 降级引导「复制链接」兜底
   */
  const doJump = () => {
    const now = Date.now()
    if (now - lastJumpRef.current < JUMP_DEBOUNCE_MS) return
    lastJumpRef.current = now
    recordQuery()

    const target = getMiniProgramTarget(queryType)

    // appId 未配置（如菜鸟裹裹留空占位）→ 引导复制链接兜底
    if (!target.appId) {
      Taro.showToast({ title: `${label}小程序跳转暂未配置，可复制链接在浏览器打开`, icon: 'none' })
      return
    }

    // H5 开发预览无 navigateToMiniProgram 能力 → 引导复制链接兜底
    if (!isMiniProgramEnv) {
      Taro.showToast({ title: 'H5 预览不支持跳小程序，可复制链接在浏览器打开', icon: 'none' })
      return
    }

    Taro.navigateToMiniProgram({
      appId: target.appId,
      // path 为空 = 跳对方小程序首页（查件相关 path 未公开，配置后可直达）
      ...(target.path ? { path: target.path } : {}),
      fail: () => {
        Taro.showToast({ title: '跳转失败，可复制链接在浏览器打开查件', icon: 'none' })
      },
    })
  }

  // 自动跳转倒计时：结束即跳官方小程序
  useEffect(() => {
    if (countdown <= 0) {
      if (!autoJumpedRef.current) {
        autoJumpedRef.current = true
        doJump()
      }
      return
    }
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [countdown])

  // 跳过按钮解锁倒计时
  useEffect(() => {
    if (skipCountdown <= 0) return
    const timer = setTimeout(() => setSkipCountdown((c) => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [skipCountdown])

  /** 复制链接兜底（跳转小程序失败 / appId 未配置 / 用户偏好浏览器时使用） */
  const handleCopyLink = () => {
    if (!targetUrl) return
    Taro.setClipboardData({
      data: targetUrl,
      success: () => {
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      },
    })
  }

  return (
    <View className="flex flex-col w-full min-h-screen bg-black">
      {/* ===== 插屏广告模拟（全屏大图 + 品牌名） ===== */}
      <View className="flex-1 flex flex-col items-center justify-center px-6 station-ad-pulse">
        <View
          className="w-full aspect-square rounded-3xl flex flex-col items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #FFB347 0%, #FF6B35 100%)' }}
        >
          <Text className="text-6xl">📦</Text>
          <Text className="block text-3xl font-bold text-white mt-6">驿站联盟</Text>
          <Text className="block text-sm text-white mt-2" style={{ opacity: 0.8 }}>
            广告 · {label}查件由本驿站提供支持
          </Text>
        </View>
        {/* ▶▶ 流量主插屏广告位：替换 DEPLOY.INTERSTITIAL_AD_UNIT_ID 后用 createInterstitialAd 渲染 */}
      </View>

      {/* ===== 底部：跳转文案 + 复制链接兜底 ===== */}
      <View className="px-6 pb-10 pt-4 flex flex-col items-center">
        <View className="flex flex-row items-center gap-2">
          <Link2 size={14} color="rgba(255,255,255,0.7)" />
          <Text className="text-sm text-white">
            {countdown > 0 ? `正在为您跳转${label}查件页面…（${countdown}s）` : `正在打开${label}官方小程序…`}
          </Text>
        </View>

        {/* 复制链接兜底：跳转失败 / appId 未配置 / 偏好浏览器时使用 */}
        <View className="mt-4 w-full bg-white rounded-2xl p-4">
          <Text className="block text-xs text-gray-400 mb-2">查件链接（跳转失败时复制到浏览器打开）</Text>
          <Text className="block text-xs text-gray-700 break-all">{targetUrl}</Text>
          <View className="mt-3">
            <Button variant="outline" className="w-full h-auto py-3 rounded-full" onClick={handleCopyLink}>
              {copied ? (
                <View className="flex flex-row items-center justify-center">
                  <Check size={14} color="#2FB86B" />
                  <Text className="text-xs text-[#2FB86B] ml-1">已复制</Text>
                </View>
              ) : (
                <View className="flex flex-row items-center justify-center">
                  <Copy size={14} color="#FF6B35" />
                  <Text className="text-xs text-[#FF6B35] ml-1">复制链接（浏览器打开查件）</Text>
                </View>
              )}
            </Button>
          </View>
        </View>

        {/* 跳过广告按钮：3 秒解锁 → 立即跳官方小程序 */}
        <View className="mt-4">
          {skipCountdown > 0 ? (
            <View className="rounded-full px-4 py-2" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}>
              <Text className="text-xs text-white" style={{ opacity: 0.5 }}>
                跳过广告（{skipCountdown}s）
              </Text>
            </View>
          ) : (
            <View
              className="rounded-full px-4 py-2 border"
              style={{ borderColor: 'rgba(255,255,255,0.4)' }}
              onClick={doJump}
            >
              <Text className="text-xs text-white">跳过广告</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  )
}

export default StationTransitionPage
