import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { MerchantService, CreateMerchantDto, UpdateMerchantDto, SaveQualificationDto } from './merchant.service';

@Controller('merchants')
export class MerchantController {
  constructor(private readonly merchantService: MerchantService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll() {
    const data = await this.merchantService.findAll();
    return { code: 200, msg: 'success', data };
  }

  /** 霸王餐人气榜：中霸王餐次数最多的门店 TOP5 */
  @Get('free-meal-rank')
  @HttpCode(HttpStatus.OK)
  async getFreeMealRank() {
    const data = await this.merchantService.getFreeMealRank(5);
    return { code: 200, msg: 'success', data };
  }

  /** 商家首页：商家详情 + 上架奖品 */
  @Get(':id/detail')
  @HttpCode(HttpStatus.OK)
  async getDetail(@Param('id') id: string) {
    const data = await this.merchantService.getDetailWithPrizes(Number(id));
    if (!data) {
      return { code: 404, msg: '商家不存在', data: null };
    }
    return { code: 200, msg: 'success', data };
  }

  /** 商家资质与收款银行卡信息查询 */
  @Get(':id/qualification')
  @HttpCode(HttpStatus.OK)
  async getQualification(@Param('id') id: string) {
    const data = await this.merchantService.getQualification(Number(id));
    return { code: 200, msg: 'success', data };
  }

  /** 商家资质与收款银行卡信息保存（覆盖更新） */
  @Post(':id/qualification')
  @HttpCode(HttpStatus.OK)
  async saveQualification(@Param('id') id: string, @Body() body: SaveQualificationDto) {
    const data = await this.merchantService.saveQualification(Number(id), body || {});
    return { code: 200, msg: '保存成功', data };
  }

  /** 消费者端：获取店内免费 WiFi（扫码连 WiFi 模块用） */
  @Get(':id/wifi')
  @HttpCode(HttpStatus.OK)
  async getWifiInfo(@Param('id') id: string) {
    const data = await this.merchantService.getWifiInfo(Number(id));
    return { code: 200, msg: 'success', data };
  }

  /** 管理端：更新门店 WiFi 信息 */
  @Put(':id/wifi')
  @HttpCode(HttpStatus.OK)
  async updateWifi(
    @Param('id') id: string,
    @Body() body: { wifi_ssid?: string; wifi_password?: string },
  ) {
    const data = await this.merchantService.updateWifi(Number(id), body);
    return { code: 200, msg: 'success', data };
  }

  /** 获取商家营销模块配置 */
  @Get(':id/marketing-features')
  @HttpCode(HttpStatus.OK)
  async getMarketingFeatures(@Param('id') id: string) {
    const data = await this.merchantService.getMarketingFeatures(Number(id));
    return { code: 200, msg: 'success', data };
  }

  /** 管理端：更新商家营销模块配置 */
  @Put(':id/marketing-features')
  @HttpCode(HttpStatus.OK)
  async updateMarketingFeatures(
    @Param('id') id: string,
    @Body() body: { features?: Record<string, boolean> },
  ) {
    const data = await this.merchantService.updateMarketingFeatures(Number(id), body.features || {});
    return { code: 200, msg: 'success', data };
  }

  /** 获取商家社群营销配置 */
  @Get(':id/community-marketing')
  @HttpCode(HttpStatus.OK)
  async getCommunityMarketing(@Param('id') id: string) {
    const data = await this.merchantService.getCommunityMarketing(Number(id));
    return { code: 200, msg: 'success', data };
  }

  /** 管理端：更新商家社群营销配置 */
  @Put(':id/community-marketing')
  @HttpCode(HttpStatus.OK)
  async updateCommunityMarketing(
    @Param('id') id: string,
    @Body() body: { enabled?: boolean; title?: string; subtitle?: string; button_text?: string; qrcode_url?: string | null },
  ) {
    const data = await this.merchantService.updateCommunityMarketing(Number(id), body);
    return { code: 200, msg: 'success', data };
  }

  @Get('code/:code')
  @HttpCode(HttpStatus.OK)
  async findByCode(@Param('code') code: string) {
    const data = await this.merchantService.findByCode(code);
    if (!data) {
      return { code: 404, msg: '商家不存在', data: null };
    }
    return { code: 200, msg: 'success', data };
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async findById(@Param('id') id: string) {
    const data = await this.merchantService.findById(Number(id));
    if (!data) {
      return { code: 404, msg: '商家不存在', data: null };
    }
    return { code: 200, msg: 'success', data };
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  async create(@Body() body: CreateMerchantDto) {
    if (!body.name) {
      return { code: 400, msg: '商家名称不能为空', data: null };
    }
    const data = await this.merchantService.create(body);
    return { code: 200, msg: 'success', data };
  }

  @Put(':id')
  @HttpCode(HttpStatus.OK)
  async update(@Param('id') id: string, @Body() body: UpdateMerchantDto) {
    const data = await this.merchantService.update(Number(id), body);
    return { code: 200, msg: 'success', data };
  }

  @Get(':id/admin')
  @HttpCode(HttpStatus.OK)
  async getAdmin(@Param('id') id: string) {
    const data = await this.merchantService.getAdmin(Number(id));
    return { code: 200, msg: 'success', data };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async delete(@Param('id') id: string) {
    await this.merchantService.delete(Number(id));
    return { code: 200, msg: 'success', data: { success: true } };
  }
}
