import { Controller, Get, Post, Param, Body, Req, HttpCode } from '@nestjs/common';
import { LotteryService } from './lottery.service';
import type { Request } from 'express';

@Controller('lottery')
export class LotteryController {
  constructor(private readonly lotteryService: LotteryService) {}

  @Post('draw')
  @HttpCode(200)
  async draw(@Body() body: { order_id: string; user_id: string }, @Req() req: Request) {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || '';
    const ua = req.headers['user-agent'] || '';
    const data = await this.lotteryService.draw(body.order_id, body.user_id, ip, ua);
    return { code: 200, msg: 'success', data };
  }

  @Get('record/:orderId')
  async getRecordByOrderId(@Param('orderId') orderId: string) {
    const data = await this.lotteryService.getRecordByOrderId(orderId);
    return { code: 200, msg: 'success', data };
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
  @HttpCode(200)
  redeemProduct(@Body() body: { redemption_code: string; merchant_user_id: string }, @Req() req: Request) {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || '';
    return this.lotteryService.redeemProduct(body.redemption_code, body.merchant_user_id, ip);
  }

  /** 获取抽奖设置 */
  @Get('settings')
  getSettings() {
    return this.lotteryService.getSettings();
  }

  /** 更新抽奖设置 */
  @Post('settings')
  @HttpCode(200)
  updateSettings(@Body() body: Record<string, string>) {
    return this.lotteryService.updateSettings(body);
  }

  /** 获取操作日志 */
  @Get('logs')
  getLogs(@Body() body?: { limit?: number }) {
    return this.lotteryService.getLogs(body?.limit || 100);
  }

  /** 用户分享次数+1 */
  @Post('share/:userId')
  @HttpCode(200)
  incrementShareCount(@Param('userId') userId: string) {
    return this.lotteryService.incrementShareCount(userId);
  }

  /** 用户社交媒体发布次数+1 */
  @Post('social-post/:userId')
  @HttpCode(200)
  incrementSocialPostCount(@Param('userId') userId: string) {
    return this.lotteryService.incrementSocialPostCount(userId);
  }
}
