import { Module } from '@nestjs/common';
import { AppController } from '@/app.controller';
import { AppService } from '@/app.service';
import { PrizeModule } from './modules/prize/prize.module';
import { OrderModule } from './modules/order/order.module';
import { LotteryModule } from './modules/lottery/lottery.module';

@Module({
  imports: [PrizeModule, OrderModule, LotteryModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
