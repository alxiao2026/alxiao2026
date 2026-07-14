import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { AppController } from '@/app.controller';
import { AppService } from '@/app.service';
import { PrizeModule } from './modules/prize/prize.module';
import { OrderModule } from './modules/order/order.module';
import { LotteryModule } from './modules/lottery/lottery.module';
import { PackageModule } from './modules/package/package.module';
import { UploadModule } from './modules/upload/upload.module';
import { MerchantModule } from './modules/merchant/merchant.module';

@Module({
  imports: [
    MulterModule.register({
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    }),
    PrizeModule,
    OrderModule,
    LotteryModule,
    PackageModule,
    UploadModule,
    MerchantModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
