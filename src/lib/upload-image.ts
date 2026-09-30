import Taro from '@tarojs/taro'
import { uploadImageToQiniu } from '@/lib/qiniu'

export const isMiniAppEnv = () => {
  const env = Taro.getEnv()
  return env === Taro.ENV_TYPE.WEAPP || env === Taro.ENV_TYPE.TT
}

/**
 * 微信小程序隐私授权前置检查
 * 调用 chooseMedia/chooseImage 等涉及相册/相机的 API 前，必须先完成隐私授权。
 * 正常返回表示可以继续；抛出 'PRIVACY_NOT_DECLARED' 表示未在后台配置权限。
 */
export async function ensurePrivacyAuthorized(): Promise<void> {
  // 仅微信小程序需要隐私授权；抖音/H5 跳过
  if (Taro.getEnv() !== Taro.ENV_TYPE.WEAPP) return

  // 微信原生隐私授权 API（Taro 尚未封装，直接使用 wx）
  // @ts-ignore
  const wxApi = typeof wx !== 'undefined' ? wx : undefined
  if (!wxApi?.getPrivacySetting || !wxApi?.requirePrivacyAuthorize) {
    console.warn('[Privacy] 当前基础库不支持隐私授权 API，跳过')
    return
  }

  try {
    const setting: any = await new Promise((resolve, reject) => {
      wxApi.getPrivacySetting({ success: resolve, fail: reject })
    })

    // 已授权或不需要授权，直接放行
    if (!setting?.needAuthorization) {
      console.log('[Privacy] 隐私授权已完成或无需授权')
      return
    }

    // 需要授权时，弹出微信官方授权框
    await new Promise((resolve, reject) => {
      wxApi.requirePrivacyAuthorize({ success: resolve, fail: reject })
    })
    console.log('[Privacy] 用户已同意隐私授权')
  } catch (e: any) {
    console.error('[Privacy] 隐私授权失败:', e)
    const errMsg = e?.errMsg || e?.message || String(e) || ''
    const lower = errMsg.toLowerCase()

    // 未在隐私保护指引中声明相册/相机权限
    if (/not declared|scope.*not.*declared|privacy agreement/.test(lower)) {
      throw new Error('PRIVACY_NOT_DECLARED')
    }

    // 用户拒绝授权：只给提示，不阻塞（用户可再次点击触发授权框）
    if (/deny|refuse|reject|cancel|fail auth/.test(lower)) {
      throw new Error('PRIVACY_DENIED')
    }

    // 其他未知错误默认放行，避免误杀正常流程
    console.warn('[Privacy] 未知隐私授权错误，默认放行:', errMsg)
  }
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


/**
 * 小程序端统一上传（已接入七牛云）
 * 底层调用 uploadImageToQiniu，文件直接上传到七牛对象存储。
 */
export async function uploadMiniAppImage(localPath: string): Promise<{ url: string | null; errorMsg?: string }> {
  try {
    const result = await uploadImageToQiniu(localPath)
    return { url: result.url }
  } catch (e: any) {
    const msg = e?.message || e?.errMsg || String(e) || '上传失败'
    console.error('[Upload] 七牛上传失败:', msg)
    return { url: null, errorMsg: msg }
  }
}

/** 上传失败诊断弹窗：完整展示域名与两条通道的真实错误，便于真机截图反馈定位 */
export function showUploadFailModal(detail: string, title = '上传失败') {
  // 先关 loading，防止 showLoading 和 showModal 冲突导致弹窗不出现
  Taro.hideLoading()
  const lower = (detail || '').toLowerCase()
  // 微信小程序隐私协议未配置/未授权时给出可操作的提示
  if (/not declared|privacy agreement/.test(lower) || /PRIVACY_NOT_DECLARED/.test(detail)) {
    Taro.showModal({
      title: '需要授权相册权限',
      content: '请先在小程序后台「设置-基本设置-用户隐私保护指引」中声明「相册/照片」权限，然后重新进入本页。',
      showCancel: false,
      confirmText: '知道了'
    })
    return
  }
  if (/PRIVACY_DENIED/.test(detail)) {
    Taro.showToast({ title: '需同意隐私授权后方可选图', icon: 'none' })
    return
  }
  Taro.showModal({
    title: `${title}·V84请截图`,
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
    let fileOrPath: string | File
    if (isMiniAppEnv()) {
      fileOrPath = localPath
    } else {
      const file = h5File || (localPath.startsWith('data:') ? dataUrlToFile(localPath) : undefined)
      if (!file) {
        Taro.hideLoading()
        Taro.showToast({ title: '文件读取失败', icon: 'none' })
        return null
      }
      fileOrPath = file
    }
    const { url } = await uploadImageToQiniu(fileOrPath)
    Taro.hideLoading()
    return url
  } catch (error: any) {
    console.error('上传图片失败:', error)
    Taro.hideLoading()
    Taro.showToast({ title: error?.message || '上传失败', icon: 'none' })
    return null
  }
}
