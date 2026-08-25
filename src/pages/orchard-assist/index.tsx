import { useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { orchardApi } from '@/lib/orchard-api'
import { ensureLogin } from '@/lib/silent-login'

type HelpState = 'idle' | 'submitting' | 'success' | 'error'

/** 好友助力落地页：好友点开小程序分享卡片后进入，点「帮 TA 助力」才算一次成功助力 */
export default function OrchardAssistPage() {
  const router = useRouter()
  const shareId = router.params.from ?? ''
  const ownerName = decodeURIComponent(router.params.name || '好友')
  const [state, setState] = useState<HelpState>('idle')
  const [errMsg, setErrMsg] = useState('')

  const invalid = !shareId

  const goOrchard = () => Taro.switchTab({ url: '/pages/tuantuan/index' })

  const handleHelp = async () => {
    if (state === 'submitting' || state === 'success') return
    let helperUserId = ''
    try {
      helperUserId = await ensureLogin()
    } catch (e) {
      console.error('[OrchardAssist] 静默登录失败:', e)
      Taro.showToast({ title: '登录失败，请稍后重试', icon: 'none' })
      return
    }
    if (helperUserId === shareId) {
      setState('error')
      setErrMsg('不能给自己助力哦')
      return
    }
    setState('submitting')
    try {
      const r = await orchardApi.submitHelp(shareId, helperUserId, '好友')
      if (r.biz_code === 0) {
        setState('success')
      } else {
        setState('error')
        setErrMsg(r.msg || '助力失败，请稍后再试')
      }
    } catch (e) {
      setState('error')
      setErrMsg('网络异常，请稍后再试')
    }
  }

  return (
    <View className="min-h-screen pb-10" style={{ backgroundColor: '#FFF8EE' }}>
      {/* 沉浸式天空舞台 */}
      <View
        className="relative overflow-hidden px-4 pt-14 pb-24"
        style={{ background: 'linear-gradient(180deg, #FF4757 0%, #FF6B6B 35%, #FFA07A 62%, #FFE5EC 88%, #F9FAFB 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
      >
        <Text className="absolute" style={{ top: 32, left: 32, fontSize: 32 }}>☀️</Text>
        <Text className="absolute" style={{ top: 64, right: 40, fontSize: 28, opacity: 0.9 }}>☁️</Text>
        <Text className="absolute" style={{ top: 112, left: 64, fontSize: 22, opacity: 0.7 }}>☁️</Text>
        <Text className="absolute" style={{ right: 32, top: 144, fontSize: 16 }}>✨</Text>

        <View className="relative mt-2 rounded-full px-3 py-1" style={{ backgroundColor: 'rgba(255,255,255,0.3)' }}>
          <Text className="font-black text-white" style={{ fontSize: 11 }}>💌 好友助力邀请</Text>
        </View>
        <Text className="relative mt-5" style={{ fontSize: 64 }}>🌳</Text>
        <Text className="relative block text-2xl font-black text-white mt-3 text-center" style={{ textShadow: '0 2px 6px rgba(2,132,199,0.5)' }}>
          {ownerName} 的果树等你浇水！
        </Text>
        <Text className="relative block mt-1 font-bold text-center" style={{ fontSize: 13, color: 'rgba(255,255,255,0.9)' }}>
          帮 TA 助力一次，TA 就能收获水滴和补浇卡～
        </Text>
      </View>

      {/* 操作卡片区 */}
      <View className="px-4 relative" style={{ marginTop: -48, zIndex: 10 }}>
        <View className="bg-white rounded-3xl p-5" style={{ boxShadow: '0 8px 24px -12px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {invalid ? (
            <>
              <Text style={{ fontSize: 36 }}>🥀</Text>
              <Text className="block font-black mt-2" style={{ fontSize: 15, color: '#1c1917' }}>链接无效</Text>
              <Text className="block text-xs mt-1 text-center" style={{ color: '#78716c' }}>这个助力链接缺少了参数，让好友重新发一次吧</Text>
            </>
          ) : state === 'success' ? (
            <>
              <Text style={{ fontSize: 44 }}>🎉</Text>
              <Text className="block text-lg font-black mt-2" style={{ color: '#1c1917' }}>助力成功！</Text>
              <Text className="block text-xs mt-1 text-center" style={{ color: '#78716c', lineHeight: '18px' }}>
                你帮 {ownerName} 的果树浇了水，{'\n'}TA 回到果园就能收到奖励啦～
              </Text>
              <View className="rounded-2xl p-3 mt-4 w-full" style={{ backgroundColor: '#f0fdf4' }}>
                <Text className="block font-black text-center" style={{ fontSize: 13, color: '#16a34a' }}>🌱 想拥有自己的果树吗？</Text>
                <Text className="block text-center mt-1" style={{ fontSize: 11, color: '#78716c' }}>每天浇水种果树，成熟可兑换真实优惠券</Text>
                <View className="rounded-full py-3 mt-3" style={{ background: 'linear-gradient(90deg,#22c55e,#10b981)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={goOrchard}>
                  <Text className="text-sm font-black text-white">我也要种果树 🌰</Text>
                </View>
              </View>
            </>
          ) : state === 'error' ? (
            <>
              <Text style={{ fontSize: 36 }}>😅</Text>
              <Text className="block font-black mt-2 text-center" style={{ fontSize: 15, color: '#1c1917' }}>{errMsg}</Text>
              <View className="rounded-full py-3 mt-4 w-full" style={{ background: 'linear-gradient(90deg,#22c55e,#10b981)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={goOrchard}>
                <Text className="text-sm font-black text-white">去逛逛果园 🌳</Text>
              </View>
            </>
          ) : (
            <>
              <View style={{ display: 'flex', flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                {['💧', '🌱', '🍊'].map((e) => <Text key={e} style={{ fontSize: 24 }}>{e}</Text>)}
              </View>
              <Text className="block font-black text-center" style={{ fontSize: 15, color: '#1c1917' }}>点一下，帮 {ownerName} 的果树浇水</Text>
              <Text className="block mt-1 text-center" style={{ fontSize: 11, color: '#78716c' }}>每天只能帮同一位好友助力 1 次哦</Text>
              <View
                className="rounded-full py-4 mt-4 w-full"
                style={{ background: 'linear-gradient(90deg,#FF4757,#FFA502)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: state === 'submitting' ? 0.6 : 1, boxShadow: '0 8px 20px -8px rgba(255,71,87,0.5)' }}
                onClick={handleHelp}
              >
                <Text className="text-base font-black text-white">{state === 'submitting' ? '助力中…' : '💧 帮 TA 助力'}</Text>
              </View>
              <View className="py-2 mt-2" onClick={goOrchard}>
                <Text className="font-bold" style={{ fontSize: 11, color: '#78716c' }}>我也要去种果树 ›</Text>
              </View>
            </>
          )}
        </View>

        <Text className="block text-center mt-4" style={{ fontSize: 10, color: '#78716c' }}>🌳 果园养成 · 每天浇水，种出真优惠</Text>
      </View>
    </View>
  )
}
