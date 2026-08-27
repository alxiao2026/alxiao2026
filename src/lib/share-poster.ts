import Taro from '@tarojs/taro'
import { Network } from '@/network'

/**
 * 分享海报绘制与保存（多模板版）
 * - 小程序端：Canvas 绘制 → canvasToTempFilePath → saveImageToPhotosAlbum
 * - H5 端：Canvas API 不可用，降级提示
 *
 * 海报规格：逻辑尺寸 300×480（导出 2 倍 600×960 保证清晰度）
 *
 * 模板体系（每次生成自动轮换）：
 * 1. billboard 大字报居中：橙黄品牌渐变满底，超大白粗标题居中，价格星形贴纸
 * 2. magazine 杂志左对齐：米白纸感底 + 橙色大色块，标题左对齐大字距，码大且醒目
 * 3. sticker 贴纸倾斜：暖深底 + 多彩贴纸点缀，标题微倾斜白描边，价签贴纸感
 * 4. minimal 极简留白：白底大留白，黑色大标题，小价签，克制干净
 *
 * 文案池：POSTER_TAGLINES 6-8 条，同用户重复生成轮换（storage 计数）
 * 图片下载缓存：cover/qr 同 URL 复用临时路径（元素级缓存）
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

const STORAGE_LAYOUT_KEY = 'poster_layout_idx'
const STORAGE_TAGLINE_KEY = 'poster_tagline_idx'

/** 品牌橙黄渐变（与分享底图同一设计语言） */
const BRAND_GRADIENT = ['#FFB347', '#FF6B35'] as const

/** 海报文案池（变量：{title} 商家名/套餐名、{price} 价格）；全部通过 BANNED_WORDS 合规检查 */
const POSTER_TAGLINES: string[] = [
  '这家店我先冲了，你也别错过',
  '{price}的快乐，就在扫码之间',
  '被安利了别怪我，{title}真好吃',
  '好店不藏私，{title}安排上',
  '今天想请你吃{title}，码在这',
  '刷到的都是缘分，{price}拿下',
  '攒了点好运，分享给你{title}',
  '别翻了，就这家，{price}真香',
]

/** 图片缓存：url → 本地临时路径（同一张封面/太阳码重复生成海报时免二次下载） */
const imgCache = new Map<string, string>()

/** 下载远程图片为本地临时路径（canvas drawImage 需要本地路径），带缓存 */
async function downloadImage(url: string): Promise<string | null> {
  const cached = imgCache.get(url)
  if (cached) return cached
  try {
    const res = await Network.downloadFile({ url })
    console.log('[SharePoster] downloadFile:', url, res.statusCode)
    if (res.tempFilePath) {
      imgCache.set(url, res.tempFilePath)
      return res.tempFilePath
    }
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
  ctx.drawImage(imgPath, sx, sy, sw, sh, x, y, w, h)
  ctx.restore()
}

/** 多行文本截断绘制（最多两行，超长省略号） */
function drawTitleLines(ctx: Taro.CanvasContext, text: string, x: number, y: number, maxWidth: number, lineH = 24): number {
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
    let last = lines[1]
    while (last.length > 0 && ctx.measureText(last + '…').width > maxWidth) last = last.slice(0, -1)
    lines[1] = last + '…'
  }
  lines.forEach((line, i) => ctx.fillText(line, x, y + i * lineH))
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

/** 轻噪点质感：随机小白点撒在指定区域（低成本模拟印刷噪点） */
function drawNoise(ctx: Taro.CanvasContext, seed: number, area: [number, number, number, number]) {
  const [x, y, w, h] = area
  ctx.setFillStyle('rgba(255,255,255,0.06)')
  for (let i = 0; i < 90; i++) {
    // 伪随机（seed 派生），同一模板每次生成噪点位置稳定
    const r1 = Math.abs(Math.sin(seed + i * 12.9898)) % 1
    const r2 = Math.abs(Math.sin(seed + i * 78.233)) % 1
    ctx.fillRect(x + r1 * w, y + r2 * h, 1, 1)
  }
}

/** 轮换取下一个模板下标（storage 计数，同用户重复生成轮换） */
function nextIdx(storageKey: string, total: number): number {
  const cur = Number(Taro.getStorageSync(storageKey) || 0)
  const idx = cur % total
  Taro.setStorageSync(storageKey, cur + 1)
  return idx
}

/** 取一条海报文案（变量替换 + 轮换） */
function pickTagline(title: string, priceText?: string | null): string {
  const idx = nextIdx(STORAGE_TAGLINE_KEY, POSTER_TAGLINES.length)
  return POSTER_TAGLINES[idx]
    .replace('{title}', title.slice(0, 8))
    .replace('{price}', priceText || '超值')
}

/** 下载封面图（缓存复用），返回本地路径或 null */
async function loadCover(coverUrl?: string | null): Promise<string | null> {
  if (!coverUrl) return null
  return downloadImage(coverUrl)
}

/** 绘制太阳码（圆形裁切 + 白底描边） */
function drawQrCode(ctx: Taro.CanvasContext, qrPath: string | null, x: number, y: number, size: number) {
  if (!qrPath) return
  ctx.setFillStyle('#ffffff')
  ctx.beginPath()
  ctx.arc(x + size / 2, y + size / 2, size / 2 + 3, 0, 2 * Math.PI)
  ctx.fill()
  ctx.save()
  ctx.beginPath()
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, 2 * Math.PI)
  ctx.clip()
  ctx.drawImage(qrPath, x, y, size, size)
  ctx.restore()
}

/* ============ 模板 1：billboard 大字报居中 ============ */
async function drawBillboard(ctx: Taro.CanvasContext, opts: SharePosterOptions, coverPath: string | null, qrPath: string | null, tagline: string) {
  const { title, priceText, brandName = '膨胀团' } = opts

  // 橙黄品牌渐变满底
  const bg = ctx.createLinearGradient(0, 0, POSTER_W, POSTER_H)
  bg.addColorStop(0, BRAND_GRADIENT[0])
  bg.addColorStop(1, BRAND_GRADIENT[1])
  ctx.setFillStyle(bg as any)
  ctx.fillRect(0, 0, POSTER_W, POSTER_H)
  drawNoise(ctx, 1, [0, 0, POSTER_W, POSTER_H])

  // 大圆斑 + 星星点缀（贴纸感）
  ctx.setFillStyle('rgba(255,255,255,0.16)')
  ctx.beginPath(); ctx.arc(POSTER_W - 28, 44, 52, 0, 2 * Math.PI); ctx.fill()
  ctx.beginPath(); ctx.arc(20, 240, 30, 0, 2 * Math.PI); ctx.fill()
  ctx.setFillStyle('rgba(255,255,255,0.55)')
  starPath(ctx, 40, 52, 5, 8, 3.2); ctx.fill()
  starPath(ctx, POSTER_W - 46, 200, 5, 6, 2.5); ctx.fill()

  // 顶部品牌条
  ctx.setFillStyle('#FFEFD6')
  starPath(ctx, 24, 26, 4, 8, 3); ctx.fill()
  ctx.setFillStyle('#ffffff')
  ctx.setFontSize(14)
  ctx.setTextAlign('left')
  ctx.fillText(brandName, 38, 31)
  ctx.setFontSize(9)
  ctx.setFillStyle('rgba(255,255,255,0.8)')
  ctx.fillText('年轻就要省着玩', 38, 44)

  // 封面圆角卡（居中）
  const covW = POSTER_W - 48, covH = 168, covX = 24, covY = 58
  ctx.setFillStyle('#ffffff')
  roundRect(ctx, covX - 4, covY - 4, covW + 8, covH + 8, 16); ctx.fill()
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
    cg.addColorStop(0, '#FFD3A5'); cg.addColorStop(1, '#FFF6E9')
    ctx.setFillStyle(cg as any)
    ctx.fillRect(covX, covY, covW, covH)
    ctx.setFillStyle('#FF6B35')
    ctx.setFontSize(22); ctx.setTextAlign('center')
    ctx.fillText(brandName, covX + covW / 2, covY + covH / 2)
  }
  ctx.restore()

  // 价格星形贴纸（盖在封面右下，倾斜）
  if (priceText) {
    ctx.save()
    ctx.translate(covX + covW - 42, covY + covH - 4)
    ctx.rotate((-10 * Math.PI) / 180)
    ctx.setFillStyle('#FFD93D')
    starPath(ctx, 0, 0, 12, 34, 27); ctx.fill()
    ctx.setFillStyle('#FF2E4D')
    ctx.setFontSize(14)
    ctx.setTextAlign('center')
    ctx.fillText(String(priceText), 0, 5)
    ctx.restore()
  }
  ctx.setTextAlign('left')

  // 大字报主标题（居中超大）
  ctx.setFillStyle('#ffffff')
  ctx.setFontSize(24)
  ctx.setTextAlign('center')
  const titleLines = drawTitleLines(ctx, title, POSTER_W / 2, covY + covH + 40, POSTER_W - 56, 28)
  ctx.setFontSize(12)
  ctx.setFillStyle('rgba(255,255,255,0.88)')
  ctx.fillText(tagline, POSTER_W / 2, covY + covH + 40 + titleLines * 28 + 16)

  // 底部：太阳码居中 + 引导
  const qrSize = 74
  drawQrCode(ctx, qrPath, POSTER_W / 2 - qrSize / 2, POSTER_H - qrSize - 52, qrSize)
  ctx.setFillStyle('#ffffff')
  ctx.setFontSize(11)
  ctx.setTextAlign('center')
  ctx.fillText('长按识别小程序码', POSTER_W / 2, POSTER_H - 18)
  ctx.setTextAlign('left')
}

/* ============ 模板 2：magazine 杂志左对齐 ============ */
async function drawMagazine(ctx: Taro.CanvasContext, opts: SharePosterOptions, coverPath: string | null, qrPath: string | null, tagline: string) {
  const { title, priceText, brandName = '膨胀团' } = opts

  // 米白纸感底
  ctx.setFillStyle('#FAF6F0')
  ctx.fillRect(0, 0, POSTER_W, POSTER_H)
  drawNoise(ctx, 2, [0, 0, POSTER_W, POSTER_H])

  // 顶部橙色大色块（斜切）
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(POSTER_W, 0)
  ctx.lineTo(POSTER_W, 64)
  ctx.lineTo(0, 84)
  ctx.closePath()
  const og = ctx.createLinearGradient(0, 0, POSTER_W, 84)
  og.addColorStop(0, BRAND_GRADIENT[1])
  og.addColorStop(1, BRAND_GRADIENT[0])
  ctx.setFillStyle(og as any)
  ctx.fill()
  ctx.restore()

  // 品牌条（色块上）
  ctx.setFillStyle('#ffffff')
  ctx.setFontSize(15)
  ctx.setTextAlign('left')
  ctx.fillText(brandName, 18, 34)
  ctx.setFontSize(9)
  ctx.setFillStyle('rgba(255,255,255,0.85)')
  ctx.fillText('SHOPPING GUIDE · 省着玩', 18, 50)

  // 封面图（大，左对齐）
  const covX = 16, covY = 104, covW = POSTER_W - 32, covH = 190
  if (coverPath) {
    try {
      const info = await Taro.getImageInfo({ src: coverPath })
      drawCover(ctx, coverPath, info.width, info.height, covX, covY, covW, covH)
    } catch {
      ctx.drawImage(coverPath, covX, covY, covW, covH)
    }
  } else {
    const cg = ctx.createLinearGradient(covX, covY, covX + covW, covY + covH)
    cg.addColorStop(0, '#FF6B35'); cg.addColorStop(1, '#FFB347')
    ctx.setFillStyle(cg as any)
    ctx.fillRect(covX, covY, covW, covH)
    ctx.setFillStyle('#ffffff')
    ctx.setFontSize(22); ctx.setTextAlign('center')
    ctx.fillText(brandName, covX + covW / 2, covY + covH / 2)
    ctx.setTextAlign('left')
  }

  // 标题：黑色大字左对齐 + 橙色下划粗条
  ctx.setFillStyle('#1F1F1F')
  ctx.setFontSize(20)
  const titleLines = drawTitleLines(ctx, title, 18, covY + covH + 34, POSTER_W - 70, 26)
  const underlineY = covY + covH + 34 + (titleLines - 1) * 26 + 10
  ctx.setFillStyle(BRAND_GRADIENT[1])
  roundRect(ctx, 18, underlineY, 92, 5, 2.5); ctx.fill()

  // 杂志感 tagline（小号灰 + 竖线装饰）
  const tagY = underlineY + 22
  ctx.setFillStyle(BRAND_GRADIENT[1])
  ctx.fillRect(18, tagY - 10, 3, 14)
  ctx.setFillStyle('#6B6B6B')
  ctx.setFontSize(11)
  const tagText = ctx.measureText(tagline).width > POSTER_W - 90 ? tagline.slice(0, 16) + '…' : tagline
  ctx.fillText(tagText, 27, tagY)

  // 价格：大字价格（左下）
  if (priceText) {
    ctx.setFillStyle(BRAND_GRADIENT[1])
    ctx.setFontSize(30)
    ctx.fillText(String(priceText), 18, POSTER_H - 66)
    ctx.setFontSize(9)
    ctx.setFillStyle('#9A9A9A')
    ctx.fillText('到手价 · 长按识别右侧码进店', 18, POSTER_H - 52)
  }

  // 太阳码：右下大尺寸（醒目）
  drawQrCode(ctx, qrPath, POSTER_W - 88, POSTER_H - 108, 72)
  ctx.setFillStyle('#9A9A9A')
  ctx.setFontSize(9)
  ctx.setTextAlign('center')
  ctx.fillText('小程序直达', POSTER_W - 52, POSTER_H - 28)
  ctx.setTextAlign('left')
}

/* ============ 模板 3：sticker 贴纸倾斜 ============ */
async function drawSticker(ctx: Taro.CanvasContext, opts: SharePosterOptions, coverPath: string | null, qrPath: string | null, tagline: string) {
  const { title, priceText, brandName = '膨胀团' } = opts

  // 暖深底
  ctx.setFillStyle('#2E2721')
  ctx.fillRect(0, 0, POSTER_W, POSTER_H)
  drawNoise(ctx, 3, [0, 0, POSTER_W, POSTER_H])

  // 多彩圆斑（贴纸氛围）
  ctx.setFillStyle('rgba(255,179,71,0.25)')
  ctx.beginPath(); ctx.arc(POSTER_W - 36, 60, 44, 0, 2 * Math.PI); ctx.fill()
  ctx.setFillStyle('rgba(255,217,61,0.18)')
  ctx.beginPath(); ctx.arc(30, 210, 36, 0, 2 * Math.PI); ctx.fill()
  ctx.setFillStyle('rgba(255,255,255,0.4)')
  starPath(ctx, POSTER_W - 30, 160, 5, 7, 3); ctx.fill()
  starPath(ctx, 36, 40, 5, 6, 2.5); ctx.fill()

  // 顶部品牌贴纸（白底贴纸倾斜）
  ctx.save()
  ctx.translate(POSTER_W / 2, 34)
  ctx.rotate((-3 * Math.PI) / 180)
  ctx.setFillStyle('#FFD93D')
  roundRect(ctx, -58, -16, 116, 30, 15); ctx.fill()
  ctx.setFillStyle('#2E2721')
  ctx.setFontSize(13)
  ctx.setTextAlign('center')
  ctx.fillText(brandName + ' · 省着玩', 0, 4)
  ctx.restore()
  ctx.setTextAlign('left')

  // 封面贴纸卡（白边大圆角）
  const covX = 26, covY = 62, covW = POSTER_W - 52, covH = 160
  ctx.setFillStyle('#ffffff')
  roundRect(ctx, covX - 6, covY - 6, covW + 12, covH + 12, 22); ctx.fill()
  ctx.save()
  roundRect(ctx, covX, covY, covW, covH, 16); ctx.clip()
  if (coverPath) {
    try {
      const info = await Taro.getImageInfo({ src: coverPath })
      drawCover(ctx, coverPath, info.width, info.height, covX, covY, covW, covH)
    } catch {
      ctx.drawImage(coverPath, covX, covY, covW, covH)
    }
  } else {
    const cg = ctx.createLinearGradient(covX, covY, covX + covW, covY + covH)
    cg.addColorStop(0, '#FF6B35'); cg.addColorStop(1, '#FFD93D')
    ctx.setFillStyle(cg as any)
    ctx.fillRect(covX, covY, covW, covH)
    ctx.setFillStyle('#2E2721')
    ctx.setFontSize(20); ctx.setTextAlign('center')
    ctx.fillText(brandName, covX + covW / 2, covY + covH / 2)
  }
  ctx.restore()

  // 标题：白描边贴纸字（微倾斜）
  ctx.save()
  ctx.translate(POSTER_W / 2, covY + covH + 40)
  ctx.rotate((-2 * Math.PI) / 180)
  ctx.setFontSize(21)
  ctx.setTextAlign('center')
  const shortTitle = String(title || '').slice(0, 12)
  ctx.setStrokeStyle('#2E2721')
  ctx.setLineWidth(5)
  ctx.strokeText(shortTitle, 0, 0)
  ctx.setFillStyle('#FFD93D')
  ctx.fillText(shortTitle, 0, 0)
  ctx.restore()

  // tagline 白色小字
  ctx.setFillStyle('rgba(255,255,255,0.85)')
  ctx.setFontSize(11)
  ctx.setTextAlign('center')
  const tagText = ctx.measureText(tagline).width > POSTER_W - 60 ? tagline.slice(0, 16) + '…' : tagline
  ctx.fillText(tagText, POSTER_W / 2, covY + covH + 64)

  // 价格贴纸（黄底价签 + 绳结感小圆）
  if (priceText) {
    ctx.save()
    ctx.translate(POSTER_W / 2, POSTER_H - 148)
    ctx.rotate((4 * Math.PI) / 180)
    ctx.setFillStyle('#FF2E4D')
    roundRect(ctx, -46, -17, 92, 34, 8); ctx.fill()
    ctx.setFillStyle('#ffffff')
    ctx.setFontSize(16)
    ctx.setTextAlign('center')
    ctx.fillText(String(priceText), 0, 5)
    ctx.restore()
  }

  // 太阳码 + 引导
  const qrSize = 70
  drawQrCode(ctx, qrPath, POSTER_W / 2 - qrSize / 2, POSTER_H - qrSize - 42, qrSize)
  ctx.setFillStyle('rgba(255,255,255,0.8)')
  ctx.setFontSize(10)
  ctx.setTextAlign('center')
  ctx.fillText('扫码进店 · 手慢无', POSTER_W / 2, POSTER_H - 16)
  ctx.setTextAlign('left')
}

/* ============ 模板 4：minimal 极简留白 ============ */
async function drawMinimal(ctx: Taro.CanvasContext, opts: SharePosterOptions, coverPath: string | null, qrPath: string | null, tagline: string) {
  const { title, priceText, brandName = '膨胀团' } = opts

  // 白底
  ctx.setFillStyle('#ffffff')
  ctx.fillRect(0, 0, POSTER_W, POSTER_H)

  // 顶部细橙条（唯一颜色点缀）
  ctx.setFillStyle(BRAND_GRADIENT[1])
  ctx.fillRect(0, 0, POSTER_W, 6)
  ctx.setFontSize(10)
  ctx.setFillStyle('#B3541E')
  ctx.setTextAlign('right')
  ctx.fillText(brandName, POSTER_W - 16, 24)
  ctx.setTextAlign('left')

  // 封面图：宽幅大图（占上方大头）
  const covX = 0, covY = 40, covW = POSTER_W, covH = 240
  if (coverPath) {
    try {
      const info = await Taro.getImageInfo({ src: coverPath })
      drawCover(ctx, coverPath, info.width, info.height, covX, covY, covW, covH)
    } catch {
      ctx.drawImage(coverPath, covX, covY, covW, covH)
    }
  } else {
    const cg = ctx.createLinearGradient(covX, covY, covX + covW, covY + covH)
    cg.addColorStop(0, '#FFF3E0'); cg.addColorStop(1, '#FFD3A5')
    ctx.setFillStyle(cg as any)
    ctx.fillRect(covX, covY, covW, covH)
    ctx.setFillStyle('#B3541E')
    ctx.setFontSize(24); ctx.setTextAlign('center')
    ctx.fillText(brandName, POSTER_W / 2, covY + covH / 2)
    ctx.setTextAlign('left')
  }

  // 黑色大标题（左对齐，克制）
  ctx.setFillStyle('#111111')
  ctx.setFontSize(22)
  const titleLines = drawTitleLines(ctx, title, 20, covY + covH + 36, POSTER_W - 40, 27)

  // tagline：小灰字
  ctx.setFillStyle('#8A8A8A')
  ctx.setFontSize(11)
  const tagText = ctx.measureText(tagline).width > POSTER_W - 40 ? tagline.slice(0, 16) + '…' : tagline
  ctx.fillText(tagText, 20, covY + covH + 36 + titleLines * 27 + 10)

  // 价格：极简价签（黑字 + 细线框）
  if (priceText) {
    const px = 20, py = POSTER_H - 108
    ctx.setStrokeStyle('#111111')
    ctx.setLineWidth(1)
    ctx.setFontSize(20)
    const pw = ctx.measureText(String(priceText)).width + 24
    roundRect(ctx, px, py - 24, pw, 34, 4); ctx.stroke()
    ctx.setFillStyle('#111111')
    ctx.fillText(String(priceText), px + 12, py)
  }

  // 太阳码：右下（白底已白，加细边）
  drawQrCode(ctx, qrPath, POSTER_W - 92, POSTER_H - 118, 74)
  ctx.setFillStyle('#8A8A8A')
  ctx.setFontSize(9)
  ctx.setTextAlign('center')
  ctx.fillText('长按进店', POSTER_W - 55, POSTER_H - 32)
  ctx.setTextAlign('left')
}

/** 排版模板注册表（新增模板往这里加即可） */
const POSTER_LAYOUTS: Array<{
  id: string
  desc: string
  draw: (ctx: Taro.CanvasContext, opts: SharePosterOptions, coverPath: string | null, qrPath: string | null, tagline: string) => Promise<void>
}> = [
  { id: 'billboard', desc: '大字报居中：品牌渐变满底 + 超大白标题 + 星形价格贴纸', draw: drawBillboard },
  { id: 'magazine', desc: '杂志左对齐：米白纸感 + 斜切橙色块 + 黑字橙下划线', draw: drawMagazine },
  { id: 'sticker', desc: '贴纸倾斜：暖深底 + 白描边贴纸字 + 红价签倾斜', draw: drawSticker },
  { id: 'minimal', desc: '极简留白：白底大留白 + 黑字 + 细线价签', draw: drawMinimal },
]

/** 当前海报模板信息（组件可展示「第 N 版 / 模板名」；不触发轮换） */
export function currentPosterLayout(): { index: number; id: string; desc: string; total: number } {
  const cur = Number(Taro.getStorageSync(STORAGE_LAYOUT_KEY) || 0)
  const layout = POSTER_LAYOUTS[cur % POSTER_LAYOUTS.length]
  return { index: cur % POSTER_LAYOUTS.length + 1, id: layout.id, desc: layout.desc, total: POSTER_LAYOUTS.length }
}

/**
 * 保存海报到相册：Canvas → 临时文件 → 相册（小程序端）；H5 提示长按保存
 */
export async function saveSharePoster(canvasId: string): Promise<boolean> {
  if (Taro.getEnv() === Taro.ENV_TYPE.WEAPP || Taro.getEnv() === Taro.ENV_TYPE.TT) {
    try {
      const res = await Taro.canvasToTempFilePath({ canvasId } as any)
      await Taro.saveImageToPhotosAlbum({ filePath: res.tempFilePath })
      Taro.showToast({ title: '海报已存相册', icon: 'success' })
      return true
    } catch (err: any) {
      console.error('[SharePoster] 保存失败:', err)
      Taro.showToast({ title: err?.errMsg?.includes('auth') ? '请授权相册后重试' : '保存失败，请重试', icon: 'none' })
      return false
    }
  }
  Taro.showToast({ title: '请在小程序内长按图片保存', icon: 'none' })
  return false
}

/** 绘制分享海报到指定 canvas（每次调用自动轮换排版模板与文案） */
export async function drawSharePoster(opts: SharePosterOptions): Promise<boolean> {
  const { canvasId, coverUrl, qrUrl, title, priceText } = opts
  const ctx = Taro.createCanvasContext(canvasId)

  // 轮换选择模板 + 文案（同用户重复生成轮换）
  const layoutIdx = nextIdx(STORAGE_LAYOUT_KEY, POSTER_LAYOUTS.length)
  const layout = POSTER_LAYOUTS[layoutIdx]
  const tagline = pickTagline(title, priceText)
  console.log('[SharePoster] layout:', layout.id, 'tagline:', tagline)

  // 元素缓存：cover/qr 复用下载
  const [coverPath, qrPath] = await Promise.all([loadCover(coverUrl), downloadImage(qrUrl)])

  await layout.draw(ctx, opts, coverPath, qrPath, tagline)

  return new Promise((resolve) => {
    ctx.draw(false, () => resolve(true))
  })
}
