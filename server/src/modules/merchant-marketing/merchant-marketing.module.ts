import { Module } from '@nestjs/common';
import { MerchantMarketingController } from './merchant-marketing.controller';
import { MerchantMarketingService } from './merchant-marketing.service';

@Module({
  controllers: [MerchantMarketingController],
  providers: [MerchantMarketingService],
  exports: [MerchantMarketingService],
})
export class MerchantMarketingModule {}
