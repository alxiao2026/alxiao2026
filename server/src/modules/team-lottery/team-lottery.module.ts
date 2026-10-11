import { Module, forwardRef } from '@nestjs/common';
import { TeamLotteryController } from './team-lottery.controller';
import { TeamLotteryService } from './team-lottery.service';
import { NotificationModule } from '../notification/notification.module';
import { PaymentModule } from '../payment/payment.module';
import { CouponsModule } from '../coupons/coupons.module';

@Module({
  imports: [NotificationModule, PaymentModule, CouponsModule],
  controllers: [TeamLotteryController],
  providers: [TeamLotteryService],
  exports: [TeamLotteryService],
})
export class TeamLotteryModule {}
