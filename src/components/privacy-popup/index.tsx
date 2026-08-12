import { useState, useEffect, useRef } from 'react'
import { View, Text, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'

type PrivacyResolve = (res: { event: 'agree' | 'disagree'; buttonId?: string }) => void

/**
 * 微信隐私协议授权弹窗
 * 当小程序使用隐私接口（chooseMedia / chooseImage / getLocation 等）时，
 * 微信会触发 onNeedPrivacyAuthorization 回调，此时弹出此组件让用户同意隐私协议。
 */
export default function PrivacyPopup() {
  const [visible, setVisible] = useState(false)
  const resolveRef = useRef<PrivacyResolve>(() => {})

  useEffect(() => {
    if (Taro.getEnv() !== Taro.ENV_TYPE.WEAPP) return
    const taroAny = Taro as any
    if (typeof taroAny.onNeedPrivacyAuthorization !== 'function') return

    taroAny.onNeedPrivacyAuthorization((resolve: PrivacyResolve) => {
      setVisible(true)
      resolveRef.current = resolve
    })
  }, [])

  const handleAgree = () => {
    setVisible(false)
    resolveRef.current({ event: 'agree', buttonId: 'agree-btn' })
  }

  const handleDisagree = () => {
    setVisible(false)
    resolveRef.current({ event: 'disagree' })
  }

  const openContract = () => {
    const taroAny = Taro as any
    if (typeof taroAny.openPrivacyContract === 'function') {
      taroAny.openPrivacyContract()
    }
  }

  if (!visible) return null

  return (
    <View style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 99999,
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}
    >
      <View style={{
        backgroundColor: '#fff', borderRadius: '16px', padding: '24px',
        margin: '0 40px', width: '300px'
      }}
      >
        <Text style={{ fontSize: '17px', fontWeight: '600', display: 'block', marginBottom: '12px', textAlign: 'center' }}>
          隐私保护提示
        </Text>
        <Text style={{ fontSize: '14px', color: '#666', lineHeight: '1.6', display: 'block', marginBottom: '20px' }}>
          在使用本服务前，请仔细阅读
          <Text style={{ color: '#FF4757' }} onClick={openContract}>《用户隐私保护指引》</Text>
          。如您同意，请点击「同意」开始使用。
        </Text>
        <View style={{ display: 'flex', flexDirection: 'row', gap: '12px' }}>
          <View style={{ flex: 1 }}>
            <Button onClick={handleDisagree} style={{ borderRadius: '8px' }}>拒绝</Button>
          </View>
          <View style={{ flex: 1 }}>
            <Button
              id="agree-btn"
              openType="agreePrivacyAuthorization"
              onClick={handleAgree}
              type="primary"
              style={{ borderRadius: '8px', backgroundColor: '#FF4757' }}
            >
              同意
            </Button>
          </View>
        </View>
      </View>
    </View>
  )
}
