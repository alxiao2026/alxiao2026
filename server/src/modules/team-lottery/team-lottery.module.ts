import { Module, forwardRef } from '@nestjs/common';
import { TeamLotteryController } from './team-lottery.controller';
import { TeamLotteryService } from './team-lottery.service';
import { NotificationModule } from '../notification/notification.module';
import { PaymentModule } from '../payment/payment.module';

@Module({
  imports: [NotificationModule, PaymentModule],
  controllers: [TeamLotteryController],
  providers: [TeamLotteryService],
  exports: [TeamLotteryService],
})
export class TeamLotteryModule {}
