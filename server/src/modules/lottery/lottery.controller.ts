import { Controller, Get, Post, Param, Body, Query, Req, HttpCode } from '@nestjs/common';
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

  @Get('record-by-id/:recordId')
  async getRecordById(@Param('recordId') recordId: string) {
    const data = await this.lotteryService.getRecordById(recordId);
    return { code: 200, msg: 'success', data };
  }

  @Get('user/:userId')
  async getUserRecords(@Param('userId') userId: string) {
    const data = await this.lotteryService.getUserRecords(userId);
    return { code: 200, msg: 'success', data };
  }

  /** 门店全部抽奖记录（商家看本门店，管理员看全平台） */
  @Get('merchant-records/:userId')
  async getMerchantLotteryRecords(@Param('userId') userId: string) {
    const data = await this.lotteryService.getMerchantLotteryRecords(userId);
    return { code: 200, msg: 'success', data };
  }

  @Get('winners')
  async getWinners(@Query('merchant_id') merchantId?: string) {
    const data = await this.lotteryService.getWinners(merchantId);
    return { code: 200, msg: 'success', data };
  }

  /** 商品兑换码核销 */
  @Post('redeem')
  @HttpCode(200)
  async redeemProduct(@Body() body: { redemption_code: string; merchant_user_id: string }, @Req() req: Request) {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || '';
    const data = await this.lotteryService.redeemProduct(body.redemption_code, body.merchant_user_id, ip);
    return { code: 200, msg: 'success', data };
  }

  /** 查询兑换码状态（商家扫码后先查状态，再确认核销） */
  @Get('redeem/check/:code')
  async checkRedemptionCode(@Param('code') code: string) {
    const data = await this.lotteryService.checkRedemptionCode(code);
    return { code: 200, msg: 'success', data };
  }

  /** 生成核销二维码 */
  @Get('qrcode/:recordId')
  async generateRedemptionQRCode(@Param('recordId') recordId: string) {
    const data = await this.lotteryService.generateRedemptionQRCode(recordId);
    return { code: 200, msg: 'success', data };
  }

  /** 获取抽奖设置（字符串键值对，供设置页直接回显） */
  @Get('settings')
  async getSettings() {
    const data = await this.lotteryService.getSettingsMap();
    return { code: 200, msg: 'success', data };
  }

  /** 更新抽奖设置 */
  @Post('settings')
  @HttpCode(200)
  async updateSettings(@Body() body: Record<string, string>) {
    const data = await this.lotteryService.updateSettings(body);
    return { code: 200, msg: 'success', data };
  }

  /** 获取操作日志 */
  @Get('logs')
  async getLogs(@Body() body?: { limit?: number }) {
    const data = await this.lotteryService.getLogs(body?.limit || 100);
    return { code: 200, msg: 'success', data };
  }

  /** 用户分享次数+1 */
  @Post('share/:userId')
  @HttpCode(200)
  async incrementShareCount(@Param('userId') userId: string) {
    const data = await this.lotteryService.incrementShareCount(userId);
    return { code: 200, msg: 'success', data };
  }

  /** 用户社交媒体发布次数+1 */
  @Post('social-post/:userId')
  @HttpCode(200)
  async incrementSocialPostCount(@Param('userId') userId: string) {
    const data = await this.lotteryService.incrementSocialPostCount(userId);
    return { code: 200, msg: 'success', data };
  }
}
