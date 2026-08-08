import { useEffect, useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Canvas } from '@tarojs/components'
import { Network } from '@/network'
import { Button } from '@/components/ui/button'
import { drawSharePoster, saveSharePoster } from '@/lib/share-poster'
import { X, Download, Loader } from 'lucide-react-taro'

interface SharePosterModalProps {
  visible: boolean
  onClose: () => void
  /** 封面图 URL */
  coverUrl?: string | null
  /** 主标题（商家名/套餐名） */
  title: string
  /** 副标题 */
  subtitle?: string
  /** 价格文案（可空） */
  priceText?: string | null
  /** 太阳码 scene（如 merchantId=5） */
  scene: string
  /** 太阳码落地页路径（如 pages/merchant/index） */
  page: string
}

let canvasSeq = 0

export default function SharePosterModal({
  visible,
  onClose,
  coverUrl,
  title,
  subtitle,
  priceText,
  scene,
  page,
}: SharePosterModalProps) {
  const [canvasId] = useState(() => `sharePoster_${++canvasSeq}`)
  const [drawing, setDrawing] = useState(false)
  const [ready, setReady] = useState(false)
  const [saving, setSaving] = useState(false)
  const isMiniApp = [Taro.ENV_TYPE.WEAPP as string, Taro.ENV_TYPE.TT as string].includes(Taro.getEnv())

  useEffect(() => {
    if (!visible) {
      setReady(false)
      return
    }
    if (!isMiniApp) return

    const generate = async () => {
      setDrawing(true)
      try {
        console.log('[SharePoster] 请求太阳码:', { scene, page })
        const res = await Network.request({
          url: '/api/share/qrcode',
          method: 'POST',
          data: { scene, page },
        })
        console.log('[SharePoster] 太阳码响应:', res.data)
        const qrUrl = res.data?.data?.url || res.data?.url
        if (!qrUrl) throw new Error('太阳码生成失败')

        // 等 Canvas 渲染完成后再绘制
        setTimeout(async () => {
          await drawSharePoster({
            canvasId,
            coverUrl,
            title,
            subtitle,
            priceText,
            qrUrl,
          })
          setReady(true)
          setDrawing(false)
        }, 300)
      } catch (err: any) {
        console.error('[SharePoster] 海报生成失败:', err)
        setDrawing(false)
        Taro.showToast({ title: err?.message || '海报生成失败，请稍后重试', icon: 'none' })
        onClose()
      }
    }
    generate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible])

  const handleSave = async () => {
    if (saving || !ready) return
    setSaving(true)
    const result = await saveSharePoster(canvasId)
    setSaving(false)
    if (result === 'saved') {
      Taro.showToast({ title: '海报已保存到相册', icon: 'success' })
      onClose()
    } else if (result === 'deny') {
      Taro.showModal({
        title: '需要相册权限',
        content: '请在设置中允许保存图片到相册',
        confirmText: '去设置',
        success: (r) => {
          if (r.confirm) Taro.openSetting().catch(() => undefined)
        },
      })
    } else {
      Taro.showToast({ title: 'H5 端请截图保存海报', icon: 'none' })
    }
  }

  if (!visible) return null

  return (
    <View style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 300 }}>
      {/* 遮罩 */}
      <View
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)' }}
        onClick={onClose}
      />
      {/* 内容 */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <View className="bg-white rounded-2xl p-4 w-full max-w-xs flex flex-col items-center">
          <View className="w-full flex flex-row items-center justify-between mb-3">
            <Text className="block text-base font-semibold text-gray-900">分享海报</Text>
            <View onClick={onClose} className="p-1">
              <X size={18} color="#6b7280" />
            </View>
          </View>

          {isMiniApp ? (
            <View className="rounded-xl overflow-hidden bg-gray-50 flex items-center justify-center" style={{ width: '100%', minHeight: '320px' }}>
              {drawing && (
                <View style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  <Loader size={24} color="#9ca3af" />
                  <Text className="block text-xs text-gray-400">海报生成中…</Text>
                </View>
              )}
              {/* Canvas 尺寸需与 share-poster.ts 中逻辑尺寸一致（300×480） */}
              <Canvas
                canvasId={canvasId}
                id={canvasId}
                style={{ width: '300px', height: '480px', maxWidth: '100%' }}
              />
            </View>
          ) : (
            <View className="w-full bg-gray-50 rounded-xl py-10 flex items-center justify-center">
              <Text className="block text-sm text-gray-500 text-center">H5 端请使用右上角浏览器分享{'\n'}或在小程序中生成分享海报</Text>
            </View>
          )}

          {isMiniApp && (
            <View className="w-full mt-4">
              <Button
                onClick={handleSave}
                disabled={!ready || saving}
                className="w-full bg-[#FF4757] text-white rounded-full"
              >
                <View className="flex flex-row items-center justify-center gap-2">
                  <Download size={15} color="#ffffff" />
                  <Text className="text-white text-sm font-medium">{saving ? '保存中…' : '保存海报到相册'}</Text>
                </View>
              </Button>
              <Text className="block text-xs text-gray-400 text-center mt-2">保存后可发朋友圈或发给好友</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  )
}
