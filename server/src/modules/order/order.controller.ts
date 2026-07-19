import { Controller, Get, Post, Param, Body, HttpCode } from '@nestjs/common';
import { OrderService, Order } from './order.service';

@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Get()
  async findAll(): Promise<{ code: number; data: Order[] }> {
    const data = await this.orderService.findAll();
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
  async verify(@Param('code') code: string): Promise<{ code: number; data: Order; msg: string }> {
    const data = await this.orderService.verify(code);
    return { code: 200, data, msg: '核销成功' };
  }
}
