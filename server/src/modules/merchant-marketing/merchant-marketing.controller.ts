import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  MerchantMarketingService,
  CreateMarketingActivityDto,
  UpdateMarketingActivityDto,
} from './merchant-marketing.service';

@Controller('merchant-marketing')
export class MerchantMarketingController {
  constructor(private readonly marketingService: MerchantMarketingService) {}

  /** 获取指定商家的营销活动列表 */
  @Get(':merchantId')
  @HttpCode(HttpStatus.OK)
  async findByMerchant(@Param('merchantId') merchantId: string) {
    const data = await this.marketingService.findByMerchant(merchantId);
    return { code: 200, msg: 'success', data };
  }

  /** 创建营销活动 */
  @Post()
  @HttpCode(HttpStatus.OK)
  async create(@Body() dto: CreateMarketingActivityDto) {
    const data = await this.marketingService.create(dto);
    return { code: 200, msg: 'success', data };
  }

  /** 更新营销活动 */
  @Put(':id')
  @HttpCode(HttpStatus.OK)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateMarketingActivityDto,
  ) {
    const data = await this.marketingService.update(id, dto);
    return { code: 200, msg: 'success', data };
  }

  /** 更新营销活动状态 */
  @Patch(':id/status')
  @HttpCode(HttpStatus.OK)
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: string,
  ) {
    const data = await this.marketingService.updateStatus(id, status);
    return { code: 200, msg: 'success', data };
  }

  /** 删除营销活动 */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string) {
    const data = await this.marketingService.remove(id);
    return { code: 200, msg: 'success', data };
  }
}
