import { Module } from '@nestjs/common';
import { NotificationModule } from '../notification/notification.module';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { WechatPayService } from './wechat-pay.service';

@Module({
  imports: [NotificationModule],
  controllers: [PaymentController],
  providers: [PaymentService, WechatPayService],
  exports: [PaymentService, WechatPayService],
})
export class PaymentModule {}
