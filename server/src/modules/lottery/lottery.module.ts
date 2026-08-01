import { Module } from '@nestjs/common';
import { NotificationModule } from '../notification/notification.module';
import { PaymentModule } from '../payment/payment.module';
import { LotteryController } from './lottery.controller';
import { LotteryService } from './lottery.service';

@Module({
  imports: [NotificationModule, PaymentModule],
  controllers: [LotteryController],
  providers: [LotteryService]
})
export class LotteryModule {}
