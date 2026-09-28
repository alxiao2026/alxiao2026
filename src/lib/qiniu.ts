import { Network } from '@/network'

/** 七牛上传结果 */
export interface QiniuUploadResult {
    key: string
    url: string
}

/** 直传凭证 */
export interface QiniuUpToken {
    uptoken: string
    key: string
    domain: string
    uploadHost: string
}

/**
 * 上传图片到七牛（服务端中转模式，H5/小程序跨端一致）
 *
 * @param filePathOrFile 小程序本地临时文件路径 或 H5 端 File 对象
 * @param onProgress 可选上传进度回调（0-100，仅小程序端有效）
 */
export async function uploadImageToQiniu(
    filePathOrFile: string | File,
    onProgress?: (percent: number) => void
): Promise<QiniuUploadResult> {
    console.log('[Qiniu] 开始上传图片:', filePathOrFile)

    const isH5File = typeof File !== 'undefined' && filePathOrFile instanceof File
    let uploadTask: any

    if (isH5File) {
        // H5 端手动构建 FormData，绕过 Taro.uploadFile 对 File 对象的兼容问题
        const fd = new FormData()
        fd.append('file', filePathOrFile)
        const promise = fetch('/api/qiniu/upload', { method: 'POST', body: fd }).then(async (response) => {
            const text = await response.text()
            return { statusCode: response.status, data: text }
        })
        uploadTask = {
            then: promise.then.bind(promise),
            catch: promise.catch.bind(promise),
            finally: promise.finally.bind(promise),
            onProgressUpdate: undefined,
        }
    } else {
        uploadTask = Network.uploadFile({
            url: '/api/qiniu/upload',
            filePath: filePathOrFile as string,
            name: 'file',
        })
    }

    if (onProgress && typeof uploadTask.onProgressUpdate === 'function') {
        uploadTask.onProgressUpdate(res => {
            console.log('[Qiniu] 上传进度:', res.progress)
            onProgress(res.progress)
        })
    }

    const res = await uploadTask
    console.log('[Qiniu] 上传响应 statusCode:', res.statusCode, 'body:', res.data)

    if (res.statusCode !== 200) {
        throw new Error(`上传失败（HTTP ${res.statusCode}）`)
    }

    let body: any = res.data
    if (typeof body === 'string') {
        try {
            body = JSON.parse(body)
        } catch {
            throw new Error('上传响应解析失败')
        }
    }

    // 信封模式解包：{ code, msg, data: { key, url } }
    const payload = body?.data ?? body
    if (!payload?.url) {
        throw new Error(payload?.msg || body?.msg || '上传失败')
    }
    return { key: payload.key, url: payload.url }
}

/**
 * 获取七牛客户端直传凭证（大文件可绕过业务后端中转）
 * 前端拿 uptoken 后用 Taro.uploadFile 直传 uploadHost，formData 携带 key/token
 */
export async function getQiniuUpToken(filename?: string): Promise<QiniuUpToken> {
    const res = await Network.request({
        url: `/api/qiniu/uptoken${filename ? `?filename=${encodeURIComponent(filename)}` : ''}`,
        method: 'GET',
    })
    console.log('[Qiniu] uptoken 响应:', res.data)

    let body: any = res.data
    if (typeof body === 'string') {
        try {
            body = JSON.parse(body)
        } catch {
            throw new Error('获取上传凭证失败')
        }
    }
    const payload = body?.data ?? body
    if (!payload?.uptoken) {
        throw new Error(payload?.msg || '获取上传凭证失败')
    }
    return payload as QiniuUpToken
}
