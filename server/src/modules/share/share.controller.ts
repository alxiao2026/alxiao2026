import { Controller, Get, Post, Body, Query, HttpCode, BadRequestException } from '@nestjs/common';
import { ShareService } from './share.service';

@Controller('share')
export class ShareController {
  constructor(private readonly shareService: ShareService) {}

  /**
   * 生成太阳码（自定义 page+scene，供分享海报/分销海报使用）
   * POST /api/share/qrcode  body: { scene, page }
   */
  @Post('qrcode')
  @HttpCode(200)
  async postQrCode(@Body() body: { scene?: string; page?: string }) {
    if (!body?.scene || !body?.page) throw new BadRequestException('scene 与 page 均不能为空');
    const { url } = await this.shareService.getMiniProgramQrCode(body.page, body.scene);
    return { code: 200, msg: 'success', data: { url, page: body.page, scene: body.scene } };
  }

  /**
   * 生成分享海报用太阳码
   * GET /api/share/qrcode?type=merchant&id=5        → 商家主页
   * GET /api/share/qrcode?type=package&id=abc123    → 套餐详情页
   */
  @Get('qrcode')
  async getQrCode(@Query('type') type: string, @Query('id') id: string) {
    if (!id) throw new BadRequestException('id 不能为空');

    let page: string;
    let scene: string;
    if (type === 'merchant') {
      page = 'pages/merchant/index';
      scene = `m=${id}`;
    } else if (type === 'package') {
      page = 'pages/package-detail/index';
      scene = `p=${id}`;
    } else {
      throw new BadRequestException('type 仅支持 merchant / package');
    }

    const { url } = await this.shareService.getMiniProgramQrCode(page, scene);
    return { code: 200, msg: 'success', data: { url, page, scene } };
  }
}
