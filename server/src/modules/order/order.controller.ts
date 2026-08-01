import { Controller, Get, Post, Param, Body, Query, HttpCode, NotFoundException } from '@nestjs/common';
import { OrderService, Order } from './order.service';

@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Get()
  async findAll(@Query('merchant_id') merchantId?: string, @Query('status') status?: string, @Query('start_date') startDate?: string, @Query('end_date') endDate?: string, @Query('verified_by') verifiedBy?: string, @Query('keyword') keyword?: string): Promise<{ code: number; data: Order[] }> {
    if (merchantId) {
      const data = await this.orderService.findByMerchant(merchantId, status, startDate, endDate, verifiedBy, keyword);
      return { code: 200, data };
    }
    const data = await this.orderService.findAll({ status, startDate, endDate, verifiedBy, keyword });
    return { code: 200, data };
  }

  @Get('verifiers')
  async findVerifiers(@Query('merchant_id') merchantId?: string): Promise<{ code: number; data: Array<{ user_id: string; name: string }> }> {
    const data = await this.orderService.findVerifiers(merchantId);
    return { code: 200, data };
  }

  @Get('user/:userId/unparticipated')
  async findUnparticipatedByUserId(@Param('userId') userId: string) {
    const data = await this.orderService.findUnparticipatedByUserId(userId);
    return { code: 200, data };
  }

  @Get('user/:userId')
  async findByUserId(@Param('userId') userId: string): Promise<{ code: number; data: Order[] }> {
    const data = await this.orderService.findByUserId(userId);
    return { code: 200, data };
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<{ code: number; data: Order }> {
    const data = await this.orderService.findOne(id);
    return { code: 200, data };
  }

  @Get(':id/qrcode')
  async getQRCode(@Param('id') id: string): Promise<{ code: number; data: { qrcode: string; verification_code: string } }> {
    const data = await this.orderService.generateQRCode(id);
    return { code: 200, data };
  }

  @Get('verify/:code')
  async findByCode(@Param('code') code: string): Promise<{ code: number; data: Order }> {
    const data = await this.orderService.findByVerificationCode(code);
    return { code: 200, data };
  }

  /** 统一核销查询（自动识别团购订单码/奖品兑换码） */
  @Get('unified-verify/:code')
  async unifiedLookup(@Param('code') code: string) {
    const result = await this.orderService.unifiedLookup(code);
    if (!result) throw new NotFoundException('未找到该核销码对应的订单或奖品');
    return { code: 200, data: result, msg: 'success' };
  }

  /** 统一核销（自动识别团购订单码/奖品兑换码） */
  /** 撤销核销（核销后30分钟内） */
  @Post(':id/revoke-verify')
  @HttpCode(200)
  async revokeVerify(
    @Param('id') id: string,
    @Body() body: { merchant_user_id?: string },
  ) {
    const result = await this.orderService.revokeVerify(id, body.merchant_user_id);
    return { code: 200, data: result, msg: '核销已撤销，订单恢复待使用' };
  }

  @Post('unified-verify/:code')
  @HttpCode(200)
  async unifiedVerify(@Param('code') code: string, @Body() body: { verify_count?: number; merchant_user_id?: string }) {
    const result = await this.orderService.unifiedVerify(code, body.verify_count || 1, body.merchant_user_id);
    return { code: 200, data: result, msg: result.type === 'order' ? '核销成功' : '奖品核销成功' };
  }

  @Post()
  @HttpCode(200)
  async create(@Body() body: {
    user_id: string;
    nick_name?: string;
    avatar_url?: string;
    package_id?: string;
    package_name?: string;
    price?: string;
    original_price?: string;
    shop_name?: string;
    quantity?: number;
  }): Promise<{ code: number; data: Order }> {
    const data = await this.orderService.create(body);
    return { code: 200, data };
  }

  @Post('check-purchase')
  @HttpCode(200)
  async checkPurchase(@Body() body: {
    user_id: string;
    package_id: string;
    quantity: number;
  }): Promise<{ code: number; data: { can_buy: boolean; reason?: string; remaining?: number } }> {
    const data = await this.orderService.checkPurchase(body);
    return { code: 200, data };
  }

  @Post(':id/share')
  @HttpCode(200)
  async markShared(@Param('id') id: string): Promise<{ code: number; data: Order }> {
    const data = await this.orderService.markShared(id);
    return { code: 200, data };
  }

  @Post('verify/:code')
  @HttpCode(200)
  async verify(
    @Param('code') code: string,
    @Body() body?: { verify_count?: number; merchant_user_id?: string }
  ): Promise<{ code: number; data: Order; msg: string }> {
    const verifyCount = body?.verify_count || 1;
    const merchantUserId = body?.merchant_user_id;
    const data = await this.orderService.verify(code, verifyCount, merchantUserId);
    return { code: 200, data, msg: '核销成功' };
  }
}
