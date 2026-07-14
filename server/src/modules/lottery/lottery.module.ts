import { Module } from '@nestjs/common';
import { LotteryController } from './lottery.controller';
import { LotteryService } from './lottery.service';

@Module({
  controllers: [LotteryController],
  providers: [LotteryService]
})
export class LotteryModule {}
