import { Module } from '@nestjs/common';
import { UserModule } from '../user/user.module';
import { OrchardController } from './orchard.controller';
import { OrchardService } from './orchard.service';

@Module({
  imports: [UserModule],
  controllers: [OrchardController],
  providers: [OrchardService],
  exports: [OrchardService],
})
export class OrchardModule {}
