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

    // 生成签名 URL（有效期 30 天）
    const url = await this.storage.generatePresignedUrl({
      key,
      expireTime: 2592000 // 30 天
    })

    return { key, url }
  }
}
