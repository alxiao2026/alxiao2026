import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { WechatNotifyService } from './wechat-notify.service';

@Module({
  controllers: [NotificationController],
  providers: [NotificationService, WechatNotifyService],
  exports: [NotificationService],
})
export class NotificationModule {}
