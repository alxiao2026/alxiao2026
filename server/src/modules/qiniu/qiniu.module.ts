import { Module } from '@nestjs/common';
import { QiniuController } from './qiniu.controller';
import { QiniuService } from './qiniu.service';

/**
 * 七牛云对象存储模块
 * - POST /api/qiniu/upload  服务端中转上传（推荐，小程序/H5 通用）
 * - GET  /api/qiniu/uptoken 客户端直传凭证（备选，需在小程序后台加七牛上传域名白名单）
 * - GET  /api/qiniu/status  配置自检（检查 .env 凭证是否齐全）
 */
@Module({
  controllers: [QiniuController],
  providers: [QiniuService],
})
export class QiniuModule {}
