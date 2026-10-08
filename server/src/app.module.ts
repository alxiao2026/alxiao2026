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
import { QiniuModule } from './modules/qiniu/qiniu.module';
import { ShareModule } from './modules/share/share.module';
import { DistributionModule } from './modules/distribution/distribution.module';
import { CustomerServiceModule } from './modules/customer-service/customer-service.module';
import { OrchardModule } from './modules/orchard/orchard.module';
import { MerchantMarketingModule } from './modules/merchant-marketing/merchant-marketing.module';
import { TeamLotteryModule } from './modules/team-lottery/team-lottery.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    MulterModule.register({
      storage: memoryStorage(),
      limits: { fileSize: 30 * 1024 * 1024 }, // 30MB，与环境图/资质证照大图上传保持一致
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
    ShareModule,
    DistributionModule,
    CustomerServiceModule,
    OrchardModule,
    MerchantMarketingModule,
    TeamLotteryModule,
    QiniuModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
