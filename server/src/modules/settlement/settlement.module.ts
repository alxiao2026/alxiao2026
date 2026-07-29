import { Module } from '@nestjs/common';
import { NotificationModule } from '../notification/notification.module';
import { SettlementController } from './settlement.controller';
import { SettlementService } from './settlement.service';

@Module({
  imports: [NotificationModule],
  controllers: [SettlementController],
  providers: [SettlementService],
  exports: [SettlementService],
})
export class SettlementModule {}
