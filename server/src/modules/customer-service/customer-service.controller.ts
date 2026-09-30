import { Body, Controller, Get, Put } from '@nestjs/common';
import { CustomerServiceService } from './customer-service.service';

@Controller('customer-service')
export class CustomerServiceController {
  constructor(private readonly customerService: CustomerServiceService) {}

  /** 获取客服配置（前端弹窗读取） */
  @Get('config')
  async getConfig() {
    const data = await this.customerService.getConfig();
    return { code: 200, msg: 'success', data };
  }

  /** 更新客服配置（管理员） */
  @Put('config')
  async updateConfig(
    @Body()
    body: {
      enabled?: boolean;
      qrcode_url?: string;
      title?: string;
      welcome_text?: string;
      service_id?: string;
      community_enabled?: boolean;
      community_title?: string;
      community_subtitle?: string;
      community_button_text?: string;
      community_qrcode_url?: string;
    },
  ) {
    const data = await this.customerService.updateConfig(body || {});
    return { code: 200, msg: '保存成功', data };
  }
}
