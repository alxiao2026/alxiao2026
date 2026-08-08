import Taro from '@tarojs/taro'
import { Network } from '@/network'

/**
 * 分享海报绘制与保存
 * - 小程序端：Canvas 绘制 → canvasToTempFilePath → saveImageToPhotosAlbum
 * - H5 端：Canvas API 不可用，降级提示
 *
 * 海报规格：逻辑尺寸 300×480（导出 2 倍 600×960 保证清晰度）
 */

export interface SharePosterOptions {
  canvasId: string
  /** 封面图 URL（可空，空则画品牌渐变底） */
  coverUrl?: string | null
  /** 主标题（商家名/套餐名） */
  title: string
  /** 副标题（套餐名/商家地址等，可空） */
  subtitle?: string
  /** 价格文案（如 ¥19.9，可空） */
  priceText?: string | null
  /** 太阳码图片 URL（后端 /api/share/qrcode 返回） */
  qrUrl: string
  /** 品牌名 */
  brandName?: string
}

const POSTER_W = 300
const POSTER_H = 480
const COVER_H = 250

/** 下载远程图片为本地临时路径（canvas drawImage 需要本地路径） */
async function downloadImage(url: string): Promise<string | null> {
  try {
    const res = await Network.downloadFile({ url })
    console.log('[SharePoster] downloadFile:', url, res.statusCode)
    if (res.tempFilePath) return res.tempFilePath
    return null
  } catch (err) {
    console.error('[SharePoster] 下载图片失败:', url, err)
    return null
  }
}

/** cover 效果绘制：图片等比放大铺满目标区域，居中裁切 */
function drawCover(
  ctx: Taro.CanvasContext,
  imgPath: string,
  imgW: number,
  imgH: number,
  x: number,
  y: number,
  w: number,
  h: number
) {
  const scale = Math.max(w / imgW, h / imgH)
  const sw = w / scale
  const sh = h / scale
  const sx = (imgW - sw) / 2
  const sy = (imgH - sh) / 2
  ctx.save()
  ctx.beginPath()
  ctx.rect(x, y, w, h)
  ctx.clip()
  // drawImage(源图, 源x, 源y, 源宽, 源高, 目标x, 目标y, 目标宽, 目标高)
  ctx.drawImage(imgPath, sx, sy, sw, sh, x, y, w, h)
  ctx.restore()
}

/** 多行文本截断绘制（最多两行，超长省略号） */
function drawTitleLines(ctx: Taro.CanvasContext, text: string, x: number, y: number, maxWidth: number): number {
  const chars = String(text || '').split('')
  const lines: string[] = []
  let current = ''
  for (const ch of chars) {
    if (ctx.measureText(current + ch).width > maxWidth) {
      lines.push(current)
      current = ch
      if (lines.length === 2) break
    } else {
      current += ch
    }
  }
  if (lines.length < 2 && current) lines.push(current)
  if (lines.length === 2 && chars.join('').length > lines[0].length + lines[1].length) {
    // 第二行末尾加省略号
    let last = lines[1]
    while (last.length > 0 && ctx.measureText(last + '…').width > maxWidth) last = last.slice(0, -1)
    lines[1] = last + '…'
  }
  lines.forEach((line, i) => ctx.fillText(line, x, y + i * 24))
  return lines.length
}

/** 绘制分享海报到指定 canvas */
export async function drawSharePoster(opts: SharePosterOptions): Promise<boolean> {
  const { canvasId, coverUrl, title, subtitle, priceText, qrUrl, brandName = '膨胀团' } = opts
  const ctx = Taro.createCanvasContext(canvasId)

  // 1. 白底
  ctx.setFillStyle('#ffffff')
  ctx.fillRect(0, 0, POSTER_W, POSTER_H)

  // 2. 封面图（cover 填充顶部区域）
  if (coverUrl) {
    const coverPath = await downloadImage(coverUrl)
    if (coverPath) {
      try {
        const info = await Taro.getImageInfo({ src: coverPath })
        drawCover(ctx, coverPath, info.width, info.height, 0, 0, POSTER_W, COVER_H)
      } catch {
        ctx.drawImage(coverPath, 0, 0, POSTER_W, COVER_H)
      }
    } else {
      // 封面下载失败 → 品牌渐变底
      const grad = ctx.createLinearGradient(0, 0, POSTER_W, COVER_H)
      grad.addColorStop(0, '#FF6B81')
      grad.addColorStop(1, '#FF4757')
      ctx.setFillStyle(grad as any)
      ctx.fillRect(0, 0, POSTER_W, COVER_H)
    }
  } else {
    const grad = ctx.createLinearGradient(0, 0, POSTER_W, COVER_H)
    grad.addColorStop(0, '#FF6B81')
    grad.addColorStop(1, '#FF4757')
    ctx.setFillStyle(grad as any)
    ctx.fillRect(0, 0, POSTER_W, COVER_H)
    // 品牌水印字
    ctx.setFillStyle('rgba(255,255,255,0.9)')
    ctx.setFontSize(28)
    ctx.setTextAlign('center')
    ctx.fillText(brandName, POSTER_W / 2, COVER_H / 2)
    ctx.setTextAlign('left')
  }

  // 3. 品牌标签
  ctx.setFillStyle('#FF4757')
  ctx.setFontSize(12)
  ctx.fillText(`「${brandName}」`, 16, COVER_H + 28)

  // 4. 主标题（最多两行）
  ctx.setFillStyle('#1f2937')
  ctx.setFontSize(17)
  const titleLines = drawTitleLines(ctx, title, 16, COVER_H + 54, POSTER_W - 32)

  // 5. 副标题
  let cursorY = COVER_H + 54 + (titleLines - 1) * 24 + 26
  if (subtitle) {
    ctx.setFillStyle('#6b7280')
    ctx.setFontSize(12)
    const sub = String(subtitle)
    const subText = ctx.measureText(sub).width > POSTER_W - 32 ? sub.slice(0, 20) + '…' : sub
    ctx.fillText(subText, 16, cursorY)
    cursorY += 22
  }

  // 6. 价格
  if (priceText) {
    ctx.setFillStyle('#FF4757')
    ctx.setFontSize(20)
    ctx.fillText(priceText, 16, POSTER_H - 78)
  }

  // 7. 分隔线
  ctx.setStrokeStyle('#f3f4f6')
  ctx.setLineWidth(1)
  ctx.beginPath()
  ctx.moveTo(16, POSTER_H - 62)
  ctx.lineTo(POSTER_W - 16, POSTER_H - 62)
  ctx.stroke()

  // 8. 太阳码（右下圆形）
  const qrPath = await downloadImage(qrUrl)
  if (qrPath) {
    const qrSize = 52
    const qrX = POSTER_W - 16 - qrSize
    const qrY = POSTER_H - 14 - qrSize
    ctx.save()
    ctx.beginPath()
    ctx.arc(qrX + qrSize / 2, qrY + qrSize / 2, qrSize / 2, 0, 2 * Math.PI)
    ctx.clip()
    ctx.drawImage(qrPath, qrX, qrY, qrSize, qrSize)
    ctx.restore()
  }

  // 9. 底部提示
  ctx.setFillStyle('#9ca3af')
  ctx.setFontSize(11)
  ctx.fillText('长按识别小程序码，立即抢购', 16, POSTER_H - 30)

  return new Promise((resolve) => {
    ctx.draw(false, () => resolve(true))
  })
}

/** 导出海报并保存到相册；返回是否成功 */
export async function saveSharePoster(canvasId: string): Promise<'saved' | 'deny' | 'h5'> {
  const env = Taro.getEnv()
  if (env !== Taro.ENV_TYPE.WEAPP && env !== Taro.ENV_TYPE.TT) {
    return 'h5'
  }
  try {
    const res = await Taro.canvasToTempFilePath({
      canvasId,
      destWidth: POSTER_W * 2,
      destHeight: POSTER_H * 2,
    })
    await Taro.saveImageToPhotosAlbum({ filePath: res.tempFilePath })
    return 'saved'
  } catch (err: any) {
    console.error('[SharePoster] 保存海报失败:', err)
    if (String(err?.errMsg || '').includes('auth') || String(err?.errMsg || '').includes('deny')) {
      return 'deny'
    }
    return 'deny'
  }
}
