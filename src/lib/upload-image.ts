import Taro from '@tarojs/taro'
import { Network } from '@/network'

export const isMiniAppEnv = () => {
  const env = Taro.getEnv()
  return env === Taro.ENV_TYPE.WEAPP || env === Taro.ENV_TYPE.TT
}

/** H5 端选择图片（返回 File 与本地预览 URL） */
export function chooseImageH5(): Promise<{ file: File; localUrl: string } | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.style.display = 'none'
    document.body.appendChild(input)
    input.onchange = (e: any) => {
      const file = e.target.files?.[0]
      input.remove()
      if (!file) return resolve(null)
      resolve({ file, localUrl: URL.createObjectURL(file) })
    }
    // 部分浏览器取消选择不触发任何事件，这里不做额外处理（用户可再次点击）
    input.click()
  })
}

/** dataURL 转 File（H5 裁剪结果上传用） */
export function dataUrlToFile(dataUrl: string, filename = 'crop.jpg'): File {
  const arr = dataUrl.split(',')
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg'
  const bstr = atob(arr[1])
  let n = bstr.length
  const u8arr = new Uint8Array(n)
  while (n--) u8arr[n] = bstr.charCodeAt(n)
  return new File([u8arr], filename, { type: mime })
}

/** 把上传失败的原始错误转成用户可读提示（便于真机定位问题） */
export function getUploadFailTip(error: any): string {
  const msg = String(error?.errMsg || error?.message || error || '').toLowerCase()
  if (!msg) return '上传失败，请检查网络后重试'
  if (/domain|url not in|合法域名/.test(msg)) return '上传通道受限，已自动切换备用通道'
  if (/cancel|取消/.test(msg)) return ''
  if (/timeout|超时/.test(msg)) return '网络超时，请检查网络后重试'
  if (/exceed|too large|过大|大小/.test(msg)) return '图片过大，请压缩后重试'
  if (/file|not exist|no such|不存在|读取/.test(msg)) return '图片读取失败，请重新选择'
  return '上传失败，请检查网络后重试'
}

/** base64 上传：走 request 通道，返回具体失败原因便于真机定位 */
async function uploadViaBase64(localPath: string): Promise<{ url: string | null; errDetail: string }> {
  // 1) 压缩到 800KB 内（base64 后约 1.1MB，确保 wx.request body 不超限）
  let path = localPath
  try {
    const info: any = await Taro.getFileInfo({ filePath: localPath })
    let size = info?.size || 0
    console.log('[Upload] 原图:', (size / 1024).toFixed(0), 'KB')
    if (size > 800 * 1024) {
      for (const q of [60, 40, 25, 15]) {
        try {
          const c = await Taro.compressImage({ src: path, quality: q })
          const ci: any = await Taro.getFileInfo({ filePath: c.tempFilePath })
          path = c.tempFilePath
          size = ci?.size || 0
          console.log(`[Upload] 压缩 q=${q}:`, (size / 1024).toFixed(0), 'KB')
          if (size <= 800 * 1024) break
        } catch (ce: any) {
          console.warn('[Upload] compressImage 失败:', ce?.errMsg || ce)
          break
        }
      }
    }
  } catch (e: any) {
    console.warn('[Upload] getFileInfo 失败，尝试用原图:', e?.errMsg || e)
    path = localPath
  }

  // 2) 读取文件为 base64
  let base64 = ''
  try {
    const fs = Taro.getFileSystemManager()
    const readRes: any = await new Promise((resolve, reject) => {
      fs.readFile({ filePath: path, encoding: 'base64', success: resolve, fail: reject })
    })
    base64 = (readRes?.data as string) || ''
    console.log('[Upload] base64 长度:', base64.length)
  } catch (e: any) {
    const m = e?.errMsg || e?.message || String(e)
    console.error('[Upload] readFile 失败:', m)
    return { url: null, errDetail: `读取文件失败:${m}` }
  }
  if (!base64) return { url: null, errDetail: '读取文件内容为空' }

  // 3) 分片上传（每片约 350KB base64 字符，确保单个 wx.request body 不超限）
  const CHUNK = 350 * 1024
  const total = Math.ceil(base64.length / CHUNK)
  const uploadId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const filename = /\.png$/i.test(path) ? 'upload.png' : 'upload.jpg'
  console.log(`[Upload] 分片上传: ${total} 片`)
  try {
    for (let i = 0; i < total; i++) {
      const chunk = base64.slice(i * CHUNK, (i + 1) * CHUNK)
      const res = await Network.request({
        url: '/api/upload/base64-chunk',
        method: 'POST',
        timeout: 60000,
        data: { uploadId, index: i, total, chunk, filename }
      })
      const body: any = res.data
      if (res.statusCode !== 200 || body?.code !== 200) {
        console.error(`[Upload] 分片${i}失败:`, res.statusCode, body?.msg)
        return { url: null, errDetail: `分片${i + 1}/${total}上传失败:${body?.msg || res.statusCode}` }
      }
      if (i === total - 1) {
        console.log('[Upload] 分片合并完成:', body.data?.url)
        if (body.data?.url) return { url: body.data.url, errDetail: '' }
        return { url: null, errDetail: '上传完成但未返回图片地址' }
      }
    }
    return { url: null, errDetail: '分片上传未完成' }
  } catch (e: any) {
    const m = e?.errMsg || e?.message || String(e)
    console.error('[Upload] 分片上传请求失败:', m)
    return { url: null, errDetail: `请求失败:${m}` }
  }
}

/**
 * 小程序端统一上传（全路径覆盖 + 自我诊断）
 * 优先 uploadFile（小程序调试模式下不校验合法域名，multipart 高效，适合大文件）；
 * 失败自动走 base64 + request 通道（强制压缩到 800KB 内）；
 * 最终失败会带回具体原因（读取文件失败/请求失败/上传返回错误等），便于真机定位。
 */
export async function uploadMiniAppImage(localPath: string): Promise<{ url: string | null; errorMsg?: string }> {
  const rawDomain = (typeof PROJECT_DOMAIN !== 'undefined' && PROJECT_DOMAIN) || ''
  const host = rawDomain.replace(/^https?:\/\//, '') || '空域名'
  console.log('[Upload] 开始上传:', localPath, '域名:', host)

  // 1) 优先 uploadFile 直传（收集具体错误用于诊断）
  let directErr = ''
  try {
    const res = await Network.uploadFile({ url: '/api/upload', filePath: localPath, name: 'file', timeout: 60000 })
    console.log('[Upload] uploadFile statusCode:', res.statusCode)
    if (res.statusCode === 200) {
      try {
        const body: any = JSON.parse(res.data)
        if (body?.code === 200 && body.data?.url) return { url: body.data.url }
        directErr = `200但业务失败:${body?.msg || '无msg'}`
      } catch {
        directErr = '200但返回非JSON'
      }
    } else {
      directErr = `HTTP${res.statusCode}`
    }
  } catch (e: any) {
    directErr = e?.errMsg || e?.message || String(e)
  }
  console.warn('[Upload] 直传失败:', directErr)

  // 2) base64 分片降级（整体兜底，防异常逃逸吞掉真实错误）
  let chunkErr = ''
  try {
    const { url, errDetail } = await uploadViaBase64(localPath)
    if (url) return { url }
    chunkErr = errDetail || '分片未知失败'
  } catch (e: any) {
    chunkErr = `异常:${e?.errMsg || e?.message || String(e)}`
  }
  console.warn('[Upload] 分片失败:', chunkErr)

  const errorMsg = `域名:${host}\n直传:${directErr}\n分片:${chunkErr}`
  return { url: null, errorMsg }
}

/** 上传失败诊断弹窗：完整展示域名与两条通道的真实错误，便于真机截图反馈定位 */
export function showUploadFailModal(detail: string, title = '上传失败') {
  Taro.showModal({
    title: `${title}·请截图反馈`,
    content: detail || '未知原因',
    showCancel: false,
    confirmText: '知道了'
  })
}

/**
 * 上传本地图片到对象存储
 * @param localPath 小程序 tempFilePath / H5 dataURL / H5 blob URL
 * @param h5File H5 端原始 File（未裁剪时直接上传原图）；裁剪后传裁剪结果转换的 File
 * @returns 上传后的 URL，失败返回 null
 */
export async function uploadLocalImage(localPath: string, h5File?: File): Promise<string | null> {
  Taro.showLoading({ title: '上传中...', mask: true })
  try {
    if (isMiniAppEnv()) {
      // 小程序端：优先 uploadFile 直传，失败自动降级 base64 通道（绕开真机域名白名单限制）
      const { url, errorMsg } = await uploadMiniAppImage(localPath)
      Taro.hideLoading()
      if (url) return url
      if (errorMsg) Taro.showToast({ title: errorMsg, icon: 'none' })
      return null
    }
    // H5 端
    let file = h5File
    if (!file) {
      file = localPath.startsWith('data:') ? dataUrlToFile(localPath) : undefined
    }
    if (!file) {
      Taro.hideLoading()
      Taro.showToast({ title: '文件读取失败', icon: 'none' })
      return null
    }
    const fd = new FormData()
    fd.append('file', file)
    const response = await fetch('/api/upload', { method: 'POST', body: fd })
    const data = await response.json()
    Taro.hideLoading()
    if (data.code === 200 && data.data?.url) return data.data.url
    Taro.showToast({ title: '上传失败', icon: 'none' })
    return null
  } catch (error) {
    console.error('上传图片失败:', error)
    Taro.hideLoading()
    Taro.showToast({ title: '上传失败', icon: 'none' })
    return null
  }
}
