import { Module } from '@nestjs/common';
import { PrizeController } from './prize.controller';
import { PrizeService } from './prize.service';

@Module({
  controllers: [PrizeController],
  providers: [PrizeService]
})
export class PrizeModule {}
