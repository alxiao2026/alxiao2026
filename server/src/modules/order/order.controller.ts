import { Controller, Get, Post, Param, Body } from '@nestjs/common';
import { OrderService } from './order.service';

@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Get()
  findAll() {
    return this.orderService.findAll();
  }

  @Get('user/:userId')
  findByUserId(@Param('userId') userId: string) {
    return this.orderService.findByUserId(userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.orderService.findOne(id);
  }

  @Post()
  create(@Body() body: { user_id: string; nick_name?: string; avatar_url?: string; package_name?: string; price?: string }) {
    return this.orderService.create(body);
  }

  @Post(':id/share')
  markShared(@Param('id') id: string) {
    return this.orderService.markShared(id);
  }
}