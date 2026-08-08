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
      const uploadRes = await Network.uploadFile({
        url: '/api/upload',
        filePath: localPath,
        name: 'file',
      })
      Taro.hideLoading()
      if (uploadRes.statusCode === 200) {
        const data = JSON.parse(uploadRes.data)
        if (data.code === 200 && data.data?.url) return data.data.url
      }
      Taro.showToast({ title: '上传失败', icon: 'none' })
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
