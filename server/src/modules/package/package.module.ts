import { Module } from '@nestjs/common';
import { PackageController } from './package.controller';
import { PackageService } from './package.service';
import { PackageAutoRenewService } from './package-auto-renew.service';

@Module({
  controllers: [PackageController],
  providers: [PackageService, PackageAutoRenewService]
})
export class PackageModule {}
