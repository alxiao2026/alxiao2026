import { Controller, Get, Post, Body, Query, Param, HttpCode, BadRequestException, Res, StreamableFile } from '@nestjs/common';
import { ShareService } from './share.service';

@Controller('share')
export class ShareController {
  constructor(private readonly shareService: ShareService) {}

  /**
   * 分享卡片品牌底图代理：GET /api/share/cover?category=food&ratio=share
   * 微信分享卡片的 imageUrl 由微信服务器抓取（不受小程序 request 域名白名单约束），
   * 走后端代理可保证可公网访问且不被防盗链拦截。
   * category ∈ food/daily/play/assist（非法值回退 play），ratio ∈ share(5:4)/square(1:1)
   */
  @Get('cover')
  async getCover(@Query('category') category: string, @Query('ratio') ratio: string, @Res({ passthrough: true }) res: any): Promise<StreamableFile> {
    const buf = await this.shareService.getShareCover(category || 'play', ratio || 'share');
    const head = buf.subarray(0, 3);
    const mime = head[0] === 0x89 && head[1] === 0x50 ? 'image/png' : 'image/jpeg';
    res.set?.('Content-Type', mime);
    res.set?.('Cache-Control', 'public, max-age=604800');
    return new StreamableFile(buf);
  }

  /**
   * 分享行为轻量埋点：POST /api/share/track
   * body: { scene: 'package'|'assist'|'generic', page, item_id, template }
   * 复用 orchard_records（reason='share_card'），写失败不影响前端主流程（service 内部吞错）。
   */
  @Post('track')
  @HttpCode(200)
  async track(@Body() body: { user_id?: number | string; scene?: string; page?: string; item_id?: string; template?: string }) {
    if (!body?.scene) throw new BadRequestException('scene 不能为空');
    await this.shareService.trackShare({ ...body, scene: body.scene });
    return { code: 200, msg: 'success', data: { tracked: true } };
  }

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
