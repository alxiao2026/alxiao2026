import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from '@/app.controller';
import { AppService } from '@/app.service';
import { PrizeModule } from './modules/prize/prize.module';
import { OrderModule } from './modules/order/order.module';
import { LotteryModule } from './modules/lottery/lottery.module';
import { PackageModule } from './modules/package/package.module';
import { UploadModule } from './modules/upload/upload.module';
import { MerchantModule } from './modules/merchant/merchant.module';
import { UserModule } from './modules/user/user.module';
import { PaymentModule } from './modules/payment/payment.module';
import { SettlementModule } from './modules/settlement/settlement.module';
import { NotificationModule } from './modules/notification/notification.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
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
    UserModule,
    PaymentModule,
    SettlementModule,
    NotificationModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
