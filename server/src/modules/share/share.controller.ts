import { Controller, Get, Post, Body, Query, Param, HttpCode, BadRequestException } from '@nestjs/common';
import { ShareService } from './share.service';

@Controller('share')
export class ShareController {
  constructor(private readonly shareService: ShareService) {}

  /**
   * 生成海报太阳码（短码映射方案，支持超长参数如套餐 UUID、分销 inviter）。
   * POST /api/share/qrcode  body: { page: 'pages/package-detail/index', params: { id, inviter? } }
   * 太阳码统一落地首页，首页按 scene 短码中转跳转到真实 page。
   */
  @Post('qrcode')
  @HttpCode(200)
  async postQrCode(@Body() body: { page?: string; params?: Record<string, any>; scene?: string }) {
    // 兼容旧调用：{ scene, page }（scene 为短内容且 page 纯路径时直接生成）
    if (body?.scene && body?.page && !body?.params) {
      if (body.scene.length > 32) throw new BadRequestException('scene 不能超过 32 个字符');
      const { url } = await this.shareService.getMiniProgramQrCode(body.page, body.scene);
      return { code: 200, msg: 'success', data: { url, page: body.page, scene: body.scene } };
    }
    if (!body?.page) throw new BadRequestException('page 不能为空');
    const { url, code } = await this.shareService.createPosterQrCode(body.page, body.params || {});
    return { code: 200, msg: 'success', data: { url, code, page: body.page } };
  }

  /**
   * 生成分享海报用太阳码
   * GET /api/share/qrcode?type=merchant&id=5        → 商家主页
   * GET /api/share/qrcode?type=package&id=abc123    → 套餐详情页
   */
  @Get('qrcode')
  async getQrCode(@Query('type') type: string, @Query('id') id: string, @Query('inviter') inviter?: string) {
    if (!id) throw new BadRequestException('id 不能为空');

    let page: string;
    if (type === 'merchant') {
      page = 'pages/merchant/index';
    } else if (type === 'package') {
      page = 'pages/package-detail/index';
    } else if (type === 'index') {
      page = 'pages/index/index';
    } else {
      throw new BadRequestException('type 仅支持 merchant / package / index');
    }

    const params: Record<string, any> = { id };
    if (inviter) params.inviter = inviter;
    const { url, code } = await this.shareService.createPosterQrCode(page, params);
    return { code: 200, msg: 'success', data: { url, code, page } };
  }

  /** 短码解析：首页中转用，返回真实目标页与参数 */
  @Get('resolve/:code')
  async resolve(@Param('code') code: string) {
    const result = await this.shareService.resolveShortCode(code);
    if (!result) throw new BadRequestException('无效的分享码');
    return { code: 200, msg: 'success', data: result };
  }
}
