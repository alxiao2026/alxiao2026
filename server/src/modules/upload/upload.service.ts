import { Injectable } from '@nestjs/common'
import { S3Storage } from 'coze-coding-dev-sdk'

@Injectable()
export class UploadService {
  private storage: S3Storage

  constructor() {
    this.storage = new S3Storage({
      endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
      accessKey: '',
      secretKey: '',
      bucketName: process.env.COZE_BUCKET_NAME,
      region: 'cn-beijing'
    })
  }

  async uploadFile(file: Express.Multer.File): Promise<{ key: string; url: string }> {
    // 上传到对象存储
    const key = await this.storage.uploadFile({
      fileContent: file.buffer,
      fileName: file.originalname,
      contentType: file.mimetype
    })

    // 生成签名 URL（有效期 10 年，避免存库后短期失效）
    const url = await this.storage.generatePresignedUrl({
      key,
      expireTime: 315360000 // 10 年
    })

    return { key, url }
  }

  /** 从已有 URL 中提取对象存储 key（去除 bucket 前缀与 query） */
  private extractKey(url: string): string | null {
    try {
      const u = new URL(url)
      let path = u.pathname.replace(/^\/+/, '')
      const bucket = process.env.COZE_BUCKET_NAME || ''
      if (bucket && path.startsWith(bucket + '/')) path = path.slice(bucket.length + 1)
      return path || null
    } catch {
      return null
    }
  }

  /** 判断是否为 TOS 私有签名 URL */
  private isTosUrl(url: string): boolean {
    return typeof url === 'string' && /\.tos\.coze\.(site|cn)/.test(url)
  }

  /** 刷新单个 URL 的长期签名（10 年）；非 TOS URL 原样返回 */
  async refreshUrl(url: string | null | undefined): Promise<string | null | undefined> {
    if (!url || !this.isTosUrl(url)) return url
    const key = this.extractKey(url)
    if (!key) return url
    try {
      return await this.storage.generatePresignedUrl({ key, expireTime: 315360000 })
    } catch {
      return url
    }
  }

  /** 批量刷新 URL（支持数组 / 逗号分隔字符串 / JSON 字符串），返回同格式 */
  async refreshUrls(input: unknown): Promise<unknown> {
    if (input == null) return input
    if (typeof input === 'string') {
      const s = input.trim()
      if (!s) return input
      if (s.startsWith('[')) {
        try {
          const arr = JSON.parse(s)
          if (Array.isArray(arr)) return JSON.stringify(await this.refreshUrls(arr))
        } catch { /* 落到逗号分隔处理 */ }
      }
      if (s.includes(',')) {
        const parts = s.split(',').map((p) => p.trim()).filter(Boolean)
        const out = [] as string[]
        for (const p of parts) out.push((await this.refreshUrl(p)) as string)
        return out.join(',')
      }
      return this.refreshUrl(s)
    }
    if (Array.isArray(input)) {
      const out = [] as unknown[]
      for (const item of input) out.push(await this.refreshUrl(item as string))
      return out
    }
    return input
  }
}
