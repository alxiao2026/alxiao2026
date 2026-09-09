import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { QiniuService } from './qiniu.service';

@Controller('qiniu')
export class QiniuController {
  constructor(private readonly qiniuService: QiniuService) {}

  /** 配置自检：填完 .env 后先调这个接口确认凭证齐了 */
  @Get('status')
  @HttpCode(200)
  status() {
    const info = this.qiniuService.getConfigStatus();
    return {
      code: 200,
      msg: info.configured ? '七牛配置完整' : '七牛配置不完整',
      data: info,
    };
  }

  /**
   * 获取上传凭证（客户端直传模式）
   * 小程序端可用 wx.uploadFile 直传七牛上传域名，body 字段：key / token / file
   * 带上 filename 时会一并返回预生成的 key 与最终访问 URL
   */
  @Get('uptoken')
  @HttpCode(200)
  uptoken(@Query('filename') filename?: string) {
    const key = filename ? this.qiniuService.buildKey(filename) : undefined;
    const uptoken = this.qiniuService.generateUploadToken(key);
    return {
      code: 200,
      msg: 'success',
      data: {
        uptoken,
        key: key || null,
        uploadHost: this.qiniuService.getUploadHost(),
        url: key ? this.qiniuService.buildUrl(key) : null,
      },
    };
  }

  /**
   * 图片上传（服务端中转模式，推荐）
   * 前端用 Network.uploadFile({ url: '/api/qiniu/upload', name: 'file' })
   * 返回 { code, msg, data: { key, url } }
   */
  @Post('upload')
  @HttpCode(200)
  @UseInterceptors(FileInterceptor('file'))
  async upload(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('未收到文件（表单字段名需为 file）');
    }
    console.log(
      `[Qiniu] 收到上传: originalname=${file.originalname} mimetype=${file.mimetype} size=${file.size}`,
    );
    const buffer = await this.qiniuService.readUploadFile(file);
    const { key, url } = await this.qiniuService.uploadBuffer(
      buffer,
      file.originalname,
      file.mimetype,
    );
    return { code: 200, msg: 'success', data: { key, url } };
  }
}
