import { Controller, Post, UploadedFile, UseInterceptors, HttpCode, BadRequestException, InternalServerErrorException } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { getSupabaseClient } from '@/storage/database/supabase-client'
import { UploadService } from './upload.service'

@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post()
  @HttpCode(200)
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('文件未上传或格式不支持')
    }

    console.log('Upload file:', {
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      hasBuffer: !!file.buffer
    })

    try {
      const result = await this.uploadService.uploadFile(file)

      return {
        code: 200,
        msg: 'success',
        data: {
          key: result.key,
          url: result.url
        }
      }
    } catch (err) {
      console.error('[Upload] 上传到对象存储失败:', err)
      throw new InternalServerErrorException('文件上传失败，请稍后重试')
    }
  }

  // 批量刷新存量 TOS 图片 URL 的长期签名（修复签名过期导致的图片无法显示）
  @Post('refresh-urls')
  @HttpCode(200)
  async refreshUrls() {
    const supabase = getSupabaseClient()
    const result = { prizes: 0, merchants: 0, packages: 0, errors: 0 }

    const isTos = (u: any) => typeof u === 'string' && u.includes('tos.coze.site')

    // 1. prizes.image_url（单值）
    const { data: prizes } = await supabase.from('prizes').select('id, image_url')
    for (const p of prizes || []) {
      if (isTos(p.image_url)) {
        try {
          const nu = await this.uploadService.refreshUrl(p.image_url)
          if (nu !== p.image_url) {
            await supabase.from('prizes').update({ image_url: nu }).eq('id', p.id)
            result.prizes++
          }
        } catch { result.errors++ }
      }
    }

    // 2. merchants.logo（单值）+ images（jsonb 数组）
    const { data: merchants } = await supabase.from('merchants').select('id, logo, images')
    for (const m of merchants || []) {
      try {
        const upd: Record<string, any> = {}
        if (isTos(m.logo)) {
          const nu = await this.uploadService.refreshUrl(m.logo)
          if (nu !== m.logo) upd.logo = nu
        }
        if (Array.isArray(m.images)) {
          const ni = (await this.uploadService.refreshUrls(m.images)) as string[]
          if (JSON.stringify(ni) !== JSON.stringify(m.images)) upd.images = ni
        }
        if (Object.keys(upd).length) {
          await supabase.from('merchants').update(upd).eq('id', m.id)
          result.merchants++
        }
      } catch { result.errors++ }
    }

    // 3. packages.cover_image（单值）+ environment_images（text，JSON/逗号分隔）
    const { data: packages } = await supabase.from('packages').select('id, cover_image, environment_images')
    for (const p of packages || []) {
      try {
        const upd: Record<string, any> = {}
        if (isTos(p.cover_image)) {
          const nu = await this.uploadService.refreshUrl(p.cover_image)
          if (nu !== p.cover_image) upd.cover_image = nu
        }
        if (p.environment_images) {
          const raw = String(p.environment_images)
          let arr: string[] = []
          try { arr = JSON.parse(raw) } catch { arr = raw.split(',').map((s) => s.trim()).filter(Boolean) }
          if (Array.isArray(arr) && arr.length) {
            const ni = (await this.uploadService.refreshUrls(arr)) as string[]
            if (JSON.stringify(ni) !== JSON.stringify(arr)) {
              upd.environment_images = raw.startsWith('[') ? JSON.stringify(ni) : ni.join(',')
            }
          }
        }
        if (Object.keys(upd).length) {
          await supabase.from('packages').update(upd).eq('id', p.id)
          result.packages++
        }
      } catch { result.errors++ }
    }

    console.log('[Upload] 存量URL签名刷新完成:', result)
    return { code: 200, msg: 'success', data: result }
  }
}
