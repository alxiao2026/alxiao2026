import { Controller, Get, Param, HttpCode, HttpStatus, BadRequestException } from '@nestjs/common';
import { CouponsService } from './coupons.service';

@Controller('coupons')
export class CouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  /** C端：查询我的折扣券列表 */
  @Get(':userId')
  @HttpCode(HttpStatus.OK)
  async getMyCoupons(@Param('userId') userId: string) {
    if (!userId) throw new BadRequestException('缺少 user_id');
    const data = await this.couponsService.getMyCoupons(userId);
    return { code: 200, msg: 'success', data };
  }
}