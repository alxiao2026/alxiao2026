import { Controller, Get, Post, Put, Delete, Param, Body } from '@nestjs/common';
import { PackageService } from './package.service';

@Controller('packages')
export class PackageController {
  constructor(private readonly packageService: PackageService) {}

  @Get()
  findAll() {
    return this.packageService.findAll();
  }

  @Get('active')
  findActive() {
    return this.packageService.findActive();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.packageService.findOne(id);
  }

  @Post()
  create(@Body() body: {
    name: string;
    description?: string;
    price?: string;
    original_price?: string;
    badge?: string;
    features?: string;
    cover_image?: string;
    environment_images?: string;
    stock?: number;
    sale_start_date?: string;
    sale_end_date?: string;
  }) {
    return this.packageService.create(body);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() body: Partial<{
      name: string;
      description: string;
      price: string;
      original_price: string;
      badge: string;
      features: string;
      cover_image: string;
      environment_images: string;
      stock: number;
      sale_start_date: string;
      sale_end_date: string;
      is_active: boolean;
    }>
  ) {
    return this.packageService.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.packageService.remove(id);
  }
}
