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

/** 多角星/爆炸贴路径（spikes 角数，outerR 外半径，innerR 内半径） */
function starPath(ctx: Taro.CanvasContext, cx: number, cy: number, spikes: number, outerR: number, innerR: number) {
  let rot = (Math.PI / 2) * 3
  const step = Math.PI / spikes
  ctx.beginPath()
  ctx.moveTo(cx, cy - outerR)
  for (let i = 0; i < spikes; i++) {
    ctx.lineTo(cx + Math.cos(rot) * outerR, cy + Math.sin(rot) * outerR)
    rot += step
    ctx.lineTo(cx + Math.cos(rot) * innerR, cy + Math.sin(rot) * innerR)
    rot += step
  }
  ctx.lineTo(cx, cy - outerR)
  ctx.closePath()
}

/** 圆角矩形路径 */
function roundRect(ctx: Taro.CanvasContext, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** 绘制分享海报到指定 canvas（年轻化活力风） */
export async function drawSharePoster(opts: SharePosterOptions): Promise<boolean> {
  const { canvasId, coverUrl, title, subtitle, priceText, qrUrl, brandName = '膨胀团' } = opts
  const ctx = Taro.createCanvasContext(canvasId)

  // 1. 活力渐变背景（粉 → 橙）
  const bg = ctx.createLinearGradient(0, 0, POSTER_W, POSTER_H)
  bg.addColorStop(0, '#FF5E8A')
  bg.addColorStop(0.55, '#FF7A59')
  bg.addColorStop(1, '#FFA53B')
  ctx.setFillStyle(bg as any)
  ctx.fillRect(0, 0, POSTER_W, POSTER_H)

  // 2. 装饰元素：半透明圆斑 + 小星星（年轻化点缀）
  ctx.setFillStyle('rgba(255,255,255,0.14)')
  ctx.beginPath(); ctx.arc(POSTER_W - 30, 40, 46, 0, 2 * Math.PI); ctx.fill()
  ctx.beginPath(); ctx.arc(24, 300, 34, 0, 2 * Math.PI); ctx.fill()
  ctx.beginPath(); ctx.arc(POSTER_W - 16, 360, 20, 0, 2 * Math.PI); ctx.fill()
  ctx.setFillStyle('rgba(255,255,255,0.5)')
  starPath(ctx, 44, 60, 5, 7, 3); ctx.fill()
  starPath(ctx, POSTER_W - 52, 210, 5, 6, 2.5); ctx.fill()
  starPath(ctx, 30, 390, 5, 5, 2); ctx.fill()

  // 3. 顶部品牌条：闪电 + 品牌名
  ctx.setFillStyle('#FFD93D')
  starPath(ctx, 24, 30, 4, 9, 3.5); ctx.fill()
  ctx.setFillStyle('#ffffff')
  ctx.setFontSize(15)
  ctx.setTextAlign('left')
  ctx.fillText(brandName, 40, 36)
  ctx.setFillStyle('rgba(255,255,255,0.85)')
  ctx.setFontSize(10)
  ctx.fillText('年轻就要省着玩', 40, 50)

  // 4. 封面圆角卡片（白边 + 圆角）
  const covX = 16, covY = 64, covW = POSTER_W - 32, covH = 168
  ctx.setFillStyle('#ffffff')
  roundRect(ctx, covX - 4, covY - 4, covW + 8, covH + 8, 16); ctx.fill()
  const coverPath = coverUrl ? await downloadImage(coverUrl) : null
  ctx.save()
  roundRect(ctx, covX, covY, covW, covH, 12); ctx.clip()
  if (coverPath) {
    try {
      const info = await Taro.getImageInfo({ src: coverPath })
      drawCover(ctx, coverPath, info.width, info.height, covX, covY, covW, covH)
    } catch {
      ctx.drawImage(coverPath, covX, covY, covW, covH)
    }
  } else {
    const cg = ctx.createLinearGradient(covX, covY, covX + covW, covY + covH)
    cg.addColorStop(0, '#FF9A9E'); cg.addColorStop(1, '#FECFEF')
    ctx.setFillStyle(cg as any)
    ctx.fillRect(covX, covY, covW, covH)
    ctx.setFillStyle('rgba(255,255,255,0.9)')
    ctx.setFontSize(24); ctx.setTextAlign('center')
    ctx.fillText(brandName, covX + covW / 2, covY + covH / 2)
    ctx.setTextAlign('left')
  }
  ctx.restore()

  // 5. 旋转撞色标签「一起薅羊毛」（盖在封面卡片右下）
  ctx.save()
  ctx.translate(covX + covW - 74, covY + covH - 10)
  ctx.rotate((-4 * Math.PI) / 180)
  ctx.setFillStyle('#FFD93D')
  roundRect(ctx, 0, 0, 92, 26, 13); ctx.fill()
  ctx.setFillStyle('#D4380D')
  ctx.setFontSize(12)
  ctx.setTextAlign('center')
  ctx.fillText('一起薅羊毛', 46, 17)
  ctx.restore()
  ctx.setTextAlign('left')

  // 6. 主标题（白色粗体，最多两行）
  ctx.setFillStyle('#ffffff')
  ctx.setFontSize(19)
  const titleLines = drawTitleLines(ctx, title, 18, covY + covH + 34, POSTER_W - 36)

  // 7. 副标题（半透明白）
  let cursorY = covY + covH + 34 + (titleLines - 1) * 24 + 22
  if (subtitle) {
    ctx.setFillStyle('rgba(255,255,255,0.85)')
    ctx.setFontSize(12)
    const sub = String(subtitle)
    const subText = ctx.measureText(sub).width > POSTER_W - 36 ? sub.slice(0, 18) + '…' : sub
    ctx.fillText(subText, 18, cursorY)
    cursorY += 20
  }

  // 8. 底部白色圆角卡片（太阳码 + 引导文案 + 价格徽章）
  const cardY = POSTER_H - 108, cardH = 86
  ctx.setFillStyle('#ffffff')
  roundRect(ctx, 14, cardY, POSTER_W - 28, cardH, 14); ctx.fill()

  // 价格爆炸贴（黄色星形徽章 + 红字）
  if (priceText) {
    ctx.save()
    ctx.translate(52, cardY + cardH / 2)
    ctx.rotate((-8 * Math.PI) / 180)
    ctx.setFillStyle('#FFD93D')
    starPath(ctx, 0, 0, 12, 34, 27); ctx.fill()
    ctx.setFillStyle('#FF2E4D')
    ctx.setFontSize(15)
    ctx.setTextAlign('center')
    ctx.fillText(String(priceText), 0, 5)
    ctx.restore()
    ctx.setTextAlign('left')
  }

  // 引导文案
  const textX = priceText ? 100 : 26
  ctx.setFillStyle('#1f2937')
  ctx.setFontSize(14)
  ctx.fillText('扫码一起嗨抢', textX, cardY + 32)
  ctx.setFillStyle('#9ca3af')
  ctx.setFontSize(11)
  ctx.fillText('长按识别小程序码', textX, cardY + 52)
  ctx.fillText('手慢无，速来～', textX, cardY + 68)

  // 太阳码（右侧圆形）
  const qrPath = await downloadImage(qrUrl)
  if (qrPath) {
    const qrSize = 62
    const qrX = POSTER_W - 14 - 16 - qrSize
    const qrY = cardY + (cardH - qrSize) / 2
    ctx.save()
    ctx.beginPath()
    ctx.arc(qrX + qrSize / 2, qrY + qrSize / 2, qrSize / 2, 0, 2 * Math.PI)
    ctx.clip()
    ctx.drawImage(qrPath, qrX, qrY, qrSize, qrSize)
    ctx.restore()
  }

  // 9. 最底部 slogan
  ctx.setFillStyle('rgba(255,255,255,0.75)')
  ctx.setFontSize(10)
  ctx.setTextAlign('center')
  ctx.fillText(`${brandName} · 好东西值得分享`, POSTER_W / 2, POSTER_H - 10)
  ctx.setTextAlign('left')

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
