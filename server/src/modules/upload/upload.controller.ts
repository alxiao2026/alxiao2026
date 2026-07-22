import { Controller, Post, UploadedFile, UseInterceptors, HttpCode, BadRequestException, InternalServerErrorException } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
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
}
