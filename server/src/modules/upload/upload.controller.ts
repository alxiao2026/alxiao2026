import { Controller, Post, UploadedFile, UseInterceptors, HttpCode } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { UploadService } from './upload.service'

@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post()
  @HttpCode(200)
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    console.log('Upload file:', {
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      hasBuffer: !!file.buffer
    })

    const result = await this.uploadService.uploadFile(file)

    return {
      code: 200,
      msg: 'success',
      data: {
        key: result.key,
        url: result.url
      }
    }
  }
}
