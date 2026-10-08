import { Module } from '@nestjs/common';
import { TeamLotteryController } from './team-lottery.controller';
import { TeamLotteryService } from './team-lottery.service';

@Module({
  controllers: [TeamLotteryController],
  providers: [TeamLotteryService],
  exports: [TeamLotteryService],
})
export class TeamLotteryModule {}
