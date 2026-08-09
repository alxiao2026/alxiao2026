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

/** base64 兜底上传：走 request 通道，绕开真机 uploadFile 域名白名单限制 */
async function uploadViaBase64(localPath: string): Promise<string | null> {
  try {
    console.log('[Upload] base64 降级：读取文件', localPath)
    const fs = Taro.getFileSystemManager()
    const readRes: any = await new Promise((resolve, reject) => {
      fs.readFile({ filePath: localPath, encoding: 'base64', success: resolve, fail: reject })
    })
    const base64 = readRes?.data as string
    console.log('[Upload] base64 读取完成，长度:', base64 ? base64.length : 0)
    if (!base64) return null
    const isPng = /\.png$/i.test(localPath)
    const res = await Network.request({
      url: '/api/upload/base64',
      method: 'POST',
      data: { image: base64, filename: isPng ? 'upload.png' : 'upload.jpg' }
    })
    const body: any = res.data
    console.log('[Upload] base64 上传响应:', res.statusCode, body && body.code, body && body.msg)
    if (res.statusCode === 200 && body?.code === 200 && body.data?.url) return body.data.url
    return null
  } catch (e) {
    console.error('[Upload] base64 兜底上传失败:', e)
    return null
  }
}

/** 小程序端统一上传：优先 uploadFile 直传，网络层失败自动降级 base64 通道 */
export async function uploadMiniAppImage(localPath: string): Promise<{ url: string | null; errorMsg?: string }> {
  console.log('[Upload] uploadMiniAppImage 开始:', localPath)
  try {
    const res = await Network.uploadFile({ url: '/api/upload', filePath: localPath, name: 'file' })
    console.log('[Upload] uploadFile statusCode:', res.statusCode)
    if (res.statusCode === 200) {
      const body: any = JSON.parse(res.data)
      if (body?.code === 200 && body.data?.url) return { url: body.data.url }
      return { url: null, errorMsg: body?.msg || '上传失败' }
    }
    return { url: null, errorMsg: `HTTP ${res.statusCode}` }
  } catch (error: any) {
    // uploadFile 网络层失败（多为真机域名白名单拦截），降级 base64 通道
    console.warn('[Upload] uploadFile 网络层失败，降级 base64:', error && (error.errMsg || error.message || error))
    const fallbackUrl = await uploadViaBase64(localPath)
    if (fallbackUrl) return { url: fallbackUrl }
    return { url: null, errorMsg: getUploadFailTip(error) }
  }
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
