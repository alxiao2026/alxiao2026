import { Controller, Get, Post, Param, Body } from '@nestjs/common';
import { LotteryService } from './lottery.service';

@Controller('lottery')
export class LotteryController {
  constructor(private readonly lotteryService: LotteryService) {}

  @Post('draw')
  draw(@Body() body: { order_id: string; user_id: string }) {
    return this.lotteryService.draw(body.order_id, body.user_id);
  }

  @Get('record/:orderId')
  getRecordByOrderId(@Param('orderId') orderId: string) {
    return this.lotteryService.getRecordByOrderId(orderId);
  }

  @Get('user/:userId')
  getUserRecords(@Param('userId') userId: string) {
    return this.lotteryService.getUserRecords(userId);
  }

  @Get('winners')
  getWinners() {
    return this.lotteryService.getWinners();
  }

  /** 商品兑换码核销 */
  @Post('redeem')
  redeemProduct(@Body() body: { redemption_code: string; merchant_user_id: string }) {
    return this.lotteryService.redeemProduct(body.redemption_code, body.merchant_user_id);
  }
}