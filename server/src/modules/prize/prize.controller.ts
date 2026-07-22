import { Controller, Get, Post, Put, Delete, Param, Body, Query } from '@nestjs/common';
import { PrizeService } from './prize.service';

@Controller('prizes')
export class PrizeController {
  constructor(private readonly prizeService: PrizeService) {}

  @Get()
  findAll(@Query('merchant_id') merchantId?: string) {
    return this.prizeService.findAll(merchantId);
  }

  @Get('active')
  findActive() {
    return this.prizeService.findActive();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.prizeService.findOne(id);
  }

  @Post()
  create(@Body() body: { name: string; description?: string; probability?: string; image_url?: string; stock?: number; prize_type?: 'coupon' | 'product' | 'free_meal'; coupon_amount?: number; coupon_min_spend?: number; product_name?: string; product_value?: number; merchant_id?: number | null }) {
    return this.prizeService.create(body);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() body: Partial<{ name: string; description: string; probability: string; image_url: string; stock: number; is_active: boolean }>
  ) {
    return this.prizeService.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.prizeService.remove(id);
  }
}