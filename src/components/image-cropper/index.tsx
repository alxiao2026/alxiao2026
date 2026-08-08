import { useEffect, useRef, useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Image, Canvas, MovableArea, MovableView } from '@tarojs/components'

interface ImageCropperProps {
  /** 是否显示 */
  visible: boolean
  /** 待裁剪图片的本地临时路径（小程序 tempFilePath / H5 blob URL） */
  imagePath: string
  /** 裁剪比例：宽/高，如 3/2、4/3、1 */
  aspectRatio: number
  /** 标题提示 */
  title?: string
  /** 确认裁剪，回传裁剪后的本地临时路径（H5 为 dataURL） */
  onConfirm: (croppedPath: string) => void
  onCancel: () => void
}

const CANVAS_ID = 'image-cropper-canvas'
/** 输出图片宽度（px），高度按裁剪比例换算，保证清晰度 */
const OUT_WIDTH = 1200

/**
 * 图片裁剪预览组件：上传前弹出预览窗，可拖动、双指缩放调节显示区域，
 * 确认后按固定比例裁剪导出。小程序/H5 双端可用。
 */
export function ImageCropper({ visible, imagePath, aspectRatio, title, onConfirm, onCancel }: ImageCropperProps) {
  const sysRef = useRef(Taro.getSystemInfoSync())
  const areaW = sysRef.current.windowWidth
  const areaH = sysRef.current.windowHeight

  const frameW = Math.round(areaW * 0.86)
  const frameH = Math.round(frameW / aspectRatio)
  const frameX = Math.round((areaW - frameW) / 2)
  const frameY = Math.max(80, Math.round((areaH - frameH) / 2) - 40)

  const outH = Math.round(OUT_WIDTH / aspectRatio)

  const [viewSize, setViewSize] = useState({ w: areaW, h: areaW })
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [scale, setScale] = useState(1)
  const [minScale, setMinScale] = useState(1)
  const [ready, setReady] = useState(false)
  const [cutting, setCutting] = useState(false)
  const imgRef = useRef({ w: 0, h: 0 })

  useEffect(() => {
    if (!visible || !imagePath) return
    setReady(false)
    Taro.getImageInfo({
      src: imagePath,
      success: (info) => {
        imgRef.current = { w: info.width, h: info.height }
        const w = areaW
        const h = Math.round((areaW * info.height) / info.width)
        // 初始缩放：保证图片完整覆盖裁剪框
        const ms = Math.max(frameW / w, frameH / h)
        setViewSize({ w, h })
        setMinScale(ms)
        setScale(ms)
        setPos({ x: 0, y: Math.round((areaH - h) / 2) })
        setReady(true)
      },
      fail: () => {
        Taro.showToast({ title: '图片读取失败', icon: 'none' })
        onCancel()
      },
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, imagePath])

  const handleConfirm = () => {
    if (cutting || !ready) return
    setCutting(true)
    const { w: iw, h: ih } = imgRef.current
    const { w: vw } = viewSize
    // movable-view 缩放以中心为基准：由布局 x/y 推算缩放后的实际左上角
    const cx = pos.x + viewSize.w / 2
    const cy = pos.y + viewSize.h / 2
    const left = cx - (viewSize.w * scale) / 2
    const top = cy - (viewSize.h * scale) / 2
    // 裁剪框映射到缩放后图片的显示坐标，再换算到原图像素坐标
    const ratio = iw / vw
    const sx = Math.max(0, Math.round(((frameX - left) / scale) * ratio))
    const sy = Math.max(0, Math.round(((frameY - top) / scale) * ratio))
    const sw = Math.min(iw - sx, Math.round((frameW / scale) * ratio))
    const sh = Math.min(ih - sy, Math.round((frameH / scale) * ratio))

    if (sw < 10 || sh < 10) {
      setCutting(false)
      Taro.showToast({ title: '裁剪区域过小', icon: 'none' })
      return
    }

    const ctx = Taro.createCanvasContext(CANVAS_ID)
    ctx.clearRect(0, 0, OUT_WIDTH, outH)
    // drawImage(图源, dx, dy, dWidth, dHeight, sx, sy, sWidth, sHeight)
    ctx.drawImage(imagePath, 0, 0, OUT_WIDTH, outH, sx, sy, sw, sh)
    ctx.draw(false, () => {
      setTimeout(() => {
        Taro.canvasToTempFilePath({
          canvasId: CANVAS_ID,
          width: OUT_WIDTH,
          height: outH,
          destWidth: OUT_WIDTH,
          destHeight: outH,
          success: (res) => {
            setCutting(false)
            onConfirm(res.tempFilePath)
          },
          fail: () => {
            setCutting(false)
            Taro.showToast({ title: '裁剪失败，请重试', icon: 'none' })
          },
        })
      }, 120)
    })
  }

  if (!visible) return null

  return (
    <View
      className="fixed inset-0 z-[999] bg-black"
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999 }}
    >
      {/* 标题 */}
      <View className="absolute top-0 left-0 right-0 z-20 pt-4 pb-2 flex items-center justify-center">
        <Text className="text-white text-sm">{title || '拖动图片调整显示区域'}</Text>
      </View>

      {/* 可拖动缩放区域 */}
      <MovableArea style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}>
        {ready && (
          <MovableView
            direction="all"
            scale
            scaleMin={minScale}
            scaleMax={5}
            scaleValue={scale}
            x={pos.x}
            y={pos.y}
            outOfBounds
            damping={30}
            friction={1.2}
            style={{ width: `${viewSize.w}px`, height: `${viewSize.h}px` }}
            onChange={(e: any) => setPos({ x: e.detail.x, y: e.detail.y })}
            onScale={(e: any) => setScale(e.detail.scale)}
          >
            <Image src={imagePath} style={{ width: '100%', height: '100%' }} mode="aspectFill" />
          </MovableView>
        )}
      </MovableArea>

      {/* 镂空蒙层：上下左右四块半透明遮罩，中间为裁剪框 */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: `${frameY}px`, backgroundColor: 'rgba(0,0,0,0.55)', zIndex: 10, pointerEvents: 'none' }} />
      <View style={{ position: 'absolute', top: `${frameY + frameH}px`, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.55)', zIndex: 10, pointerEvents: 'none' }} />
      <View style={{ position: 'absolute', top: `${frameY}px`, left: 0, width: `${frameX}px`, height: `${frameH}px`, backgroundColor: 'rgba(0,0,0,0.55)', zIndex: 10, pointerEvents: 'none' }} />
      <View style={{ position: 'absolute', top: `${frameY}px`, right: 0, width: `${frameX}px`, height: `${frameH}px`, backgroundColor: 'rgba(0,0,0,0.55)', zIndex: 10, pointerEvents: 'none' }} />
      {/* 裁剪框白边 */}
      <View
        style={{
          position: 'absolute',
          top: `${frameY}px`,
          left: `${frameX}px`,
          width: `${frameW}px`,
          height: `${frameH}px`,
          border: '2px solid rgba(255,255,255,0.9)',
          borderRadius: '8px',
          zIndex: 11,
          pointerEvents: 'none',
          boxSizing: 'border-box',
        }}
      />

      {/* 底部操作栏 */}
      <View className="absolute bottom-0 left-0 right-0 z-20 flex flex-row gap-4 px-6 pb-8">
        <View className="flex-1" onClick={onCancel}>
          <View className="w-full py-3 rounded-full bg-white bg-opacity-15 flex items-center justify-center">
            <Text className="text-white text-base">取消</Text>
          </View>
        </View>
        <View className="flex-1" onClick={handleConfirm}>
          <View className="w-full py-3 rounded-full bg-gradient-to-r from-[#FF6B9D] to-[#FF4757] flex items-center justify-center">
            <Text className="text-white text-base font-semibold">{cutting ? '裁剪中...' : '确认使用'}</Text>
          </View>
        </View>
      </View>

      {/* 离屏 Canvas 用于裁剪导出 */}
      <Canvas
        canvasId={CANVAS_ID}
        style={{ position: 'fixed', left: '-9999px', top: '-9999px', width: `${OUT_WIDTH}px`, height: `${outH}px` }}
      />
    </View>
  )
}
