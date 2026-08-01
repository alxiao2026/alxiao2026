import { Module } from '@nestjs/common';
import { NotificationModule } from '../notification/notification.module';
import { SettlementModule } from '../settlement/settlement.module';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';

@Module({
  imports: [NotificationModule, SettlementModule],
  controllers: [OrderController],
  providers: [OrderService]
})
export class OrderModule {}
