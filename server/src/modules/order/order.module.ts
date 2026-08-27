import { Module } from '@nestjs/common';
import { NotificationModule } from '../notification/notification.module';
import { SettlementModule } from '../settlement/settlement.module';
import { OrderController } from './order.controller';
import { OrderExpireRefundService } from './order-expire-refund.service';
import { OrderService } from './order.service';

@Module({
  imports: [NotificationModule, SettlementModule],
  controllers: [OrderController],
  providers: [OrderService, OrderExpireRefundService]
})
export class OrderModule {}
