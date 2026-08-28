import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { S3Storage } from 'coze-coding-dev-sdk';
import { randomBytes } from 'crypto';
import { getWechatCredentials } from '../user/wechat-config';
import { getSupabaseClient } from '@/storage/database/supabase-client';

/**
 * 分享海报太阳码服务：
 * 调微信 wxacode.getUnlimited 生成小程序码（太阳码），上传 TOS 后返回可公网访问的图片 URL。
 * 前端将太阳码绘制进分享海报 Canvas。
 *
 * 启用条件：server/.env 或后台「微信配置」已配置 AppID/AppSecret；
 * 未配置时返回明确错误，前端降级为普通系统分享。
 */
@Injectable()
export class ShareService {
  private readonly logger = new Logger(ShareService.name);
  private storage: S3Storage;
  /** access_token 内存缓存（有效期 7200s，提前 5 分钟刷新） */
  private tokenCache: { token: string; expiresAt: number } | null = null;
  /** 太阳码缓存：同一 page+scene 复用，避免重复调用微信接口（带 24h 过期） */
  private qrCache = new Map<string, { url: string; expiresAt: number }>();

  constructor() {
    this.storage = new S3Storage({
      endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
      accessKey: '',
      secretKey: '',
      bucketName: process.env.COZE_BUCKET_NAME,
      region: 'cn-beijing'
    });
  }

  // ==================== 分享卡片封面与埋点 ====================

  /** 品牌底图缓存（TOS 读取一次后常驻内存，图片体量小） */
  private coverCache = new Map<string, Buffer>();

  /** TOS 签名直链缓存（签名有效期 6 天，缓存 5 天，剩余有效期内直接复用） */
  private coverUrlCache = new Map<string, { url: string; expiresAt: number }>();

  /** 分享底图 TOS key（与 TOS 实际上传一致）：cat ∈ food/daily/play/assist/win，ratio ∈ share(5:4)/square(1:1) */
  private static readonly COVER_KEYS: Record<string, Record<string, string>> = {
    food: { share: 'share-cover-food-share_c4fcc4f0.png', square: 'share-cover-food-square_0f7f99a0.png' },
    daily: { share: 'share-cover-daily-share_cd114f75.png', square: 'share-cover-daily-square_c08f59ee.png' },
    play: { share: 'share-cover-play-share_5dbc570d.png', square: 'share-cover-play-square_dcf8e305.png' },
    assist: { share: 'share-cover-assist-share_9d6d3017.png', square: 'share-cover-assist-square_078e94dc.png' },
    win: { share: 'share-cover-win-share_6f4c1d1c.png', square: 'share-cover-win-square_66748af5.png' },
  };

  /**
   * 读取分享封面（图片字节，供微信服务器抓取）：
   * 优先级 = 奖品图（仅限 TOS，校验魔数）→ 品类底图 → 跨类目兜底，保证永远返回合法图片字节。
   */
  async getShareCover(cat: string, ratio: string, prizeImage?: string): Promise<Buffer> {
    if (prizeImage) {
      try {
        const buf = await this.fetchPrizeImageBuffer(prizeImage);
        if (buf) return buf;
      } catch (err) {
        this.logger.warn(`prize_image 代取失败回退底图: ${err instanceof Error ? err.message : err}`);
      }
    }
    const map = ShareService.COVER_KEYS[cat] || ShareService.COVER_KEYS.play;
    const key = map[ratio] || map.share;
    const cached = this.coverCache.get(key);
    if (cached) return cached;
    try {
      const buf = await this.storage.readFile({ fileKey: key });
      this.coverCache.set(key, buf);
      return buf;
    } catch (err) {
      // 指定底图 key 异常时跨类目兜底（微信抓取失败不重试，端点必须永远 200 且有图）
      this.logger.error(`底图读取失败 key=${key}: ${err instanceof Error ? err.message : err}`);
      for (const m of Object.values(ShareService.COVER_KEYS)) {
        if (m.share === key) continue;
        try {
          const buf = await this.storage.readFile({ fileKey: m.share });
          this.coverCache.set(m.share, buf);
          return buf;
        } catch {
          /* 尝试下一个 */
        }
      }
      throw err;
    }
  }

  /**
   * 生成分享封面 TOS 签名直链（高可用封面方案）：
   * 微信分享卡片图片由微信服务器异步抓取，若走 /api/share/cover 代理，
   * 后端热编译/重启窗口内抓取失败会直接显示灰色默认占位图且不会重试。
   * TOS 签名直链由对象存储 CDN 直出，不依赖应用进程存活，抓取成功率大幅提升。
   * 前端在中奖结果出现时预取并缓存，分享回调同步读取，代理 URL 仅作最终兜底。
   */
  async getShareCoverUrl(cat: string, ratio: string, prizeImage?: string): Promise<string> {
    if (prizeImage) {
      try {
        const url = await this.resolvePrizeImageUrl(prizeImage);
        if (url) return url;
      } catch (err) {
        this.logger.warn(`prize_image 直链解析失败回退底图: ${err instanceof Error ? err.message : err}`);
      }
    }
    const map = ShareService.COVER_KEYS[cat] || ShareService.COVER_KEYS.play;
    const key = map[ratio] || map.share;
    const cached = this.coverUrlCache.get(key);
    if (cached && cached.expiresAt > Date.now() + 24 * 3600 * 1000) {
      return cached.url;
    }
    const url = await this.storage.generatePresignedUrl({ key, expireTime: 6 * 24 * 3600 });
    if (typeof url === 'string' && url.startsWith('http')) {
      this.coverUrlCache.set(key, { url, expiresAt: Date.now() + 5 * 24 * 3600 * 1000 });
      return url;
    }
    throw new Error('生成分享封面直链失败');
  }

  /**
   * 奖品图直链解析：
   * - 完整 https URL：仅允许 TOS 域名（防 SSRF），抓取并校验魔数后原样返回（签名长期有效）
   * - 无 scheme：视为 TOS key，确认存在且为图片后重新签直链
   * - 任何失败返回 null，由调用方回退品牌底图
   */
  private async resolvePrizeImageUrl(src: string): Promise<string | null> {
    const s = String(src || '').trim();
    if (!s) return null;
    if (/^https?:\/\//i.test(s)) {
      const buf = await this.fetchPrizeImageBuffer(s);
      return buf ? s : null;
    }
    const buf = await this.storage.readFile({ fileKey: s });
    if (!ShareService.looksLikeImage(buf)) return null;
    const url = await this.storage.generatePresignedUrl({ key: s, expireTime: 6 * 24 * 3600 });
    return typeof url === 'string' && url.startsWith('http') ? url : null;
  }

  /** 代取奖品图字节：仅允许 TOS 域名（防 SSRF），8s 超时，魔数校验不通过视为不可用 */
  private async fetchPrizeImageBuffer(src: string): Promise<Buffer | null> {
    const s = String(src || '').trim();
    if (!s) return null;
    if (/^https?:\/\//i.test(s)) {
      const host = new URL(s).hostname;
      if (!host.endsWith('.tos.coze.site')) return null;
      const res = await fetch(s, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) return null;
      const buf = Buffer.from(await res.arrayBuffer());
      return ShareService.looksLikeImage(buf) ? buf : null;
    }
    const buf = await this.storage.readFile({ fileKey: s });
    return ShareService.looksLikeImage(buf) ? buf : null;
  }

  /** 图片魔数校验：PNG / JPEG / GIF / WebP */
  private static looksLikeImage(buf: Buffer): boolean {
    if (!buf || buf.length < 16) return false;
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e) return true;
    if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return true;
    if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return true;
    if (buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42) return true;
    return false;
  }

  /**
   * 分享行为埋点：复用 orchard_records（reason='share_card', amount=0, remark=JSON）。
   * 轻量记录，不影响主流程；user_id 缺失时写 0（匿名）。
   */
  async trackShare(input: { user_id?: number | string; scene: string; page?: string; item_id?: string; template?: string }): Promise<void> {
    const scene = String(input.scene || '').slice(0, 32);
    const page = String(input.page || '').slice(0, 64);
    const item_id = input.item_id ? String(input.item_id).slice(0, 64) : null;
    const template = input.template ? String(input.template).slice(0, 128) : null;
    const userId = Number(input.user_id) || 0;
    try {
      const db = getSupabaseClient();
      await db.from('orchard_records').insert({
        user_id: userId,
        amount: 0,
        reason: 'share_card',
        remark: { scene, page, item_id, template },
      });
    } catch (err: any) {
      this.logger.warn(`分享埋点写入失败（不影响主流程）: ${err?.message}`);
    }
  }

  private async getAccessToken(): Promise<string | null> {
    const { appid, secret } = await getWechatCredentials();
    if (!appid || !secret) return null;
    if (this.tokenCache && Date.now() < this.tokenCache.expiresAt) {
      return this.tokenCache.token;
    }
    try {
      const url =
        `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential` +
        `&appid=${appid}&secret=${secret}`;
      const res = await fetch(url);
      const data: any = await res.json();
      if (!data?.access_token) {
        this.logger.warn(`获取微信 access_token 失败: ${JSON.stringify(data)}`);
        return null;
      }
      this.tokenCache = {
        token: data.access_token,
        expiresAt: Date.now() + ((data.expires_in || 7200) - 300) * 1000,
      };
      return data.access_token;
    } catch (err: any) {
      this.logger.error(`获取微信 access_token 异常: ${err?.message}`);
      return null;
    }
  }

  /**
   * 生成太阳码并返回图片 URL
   * @param page 小程序落地页路径（不带 query，query 参数放 scene）
   * @param scene 场景值（32 字符内，如 m=5 / p=abc123）
   */
  async getMiniProgramQrCode(page: string, scene: string): Promise<{ url: string }> {
    if (!page || !scene) throw new BadRequestException('page 与 scene 均不能为空');
    if (scene.length > 32) throw new BadRequestException('scene 不能超过 32 个字符');

    const cacheKey = `${page}::${scene}`;
    const cached = this.qrCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) return { url: cached.url };

    const token = await this.getAccessToken();
    if (!token) {
      throw new BadRequestException('微信 AppID/AppSecret 未配置，无法生成太阳码，请先在后台「微信配置」中完善');
    }

    // env_version 默认 release（正式版）；小程序未发布阶段可通过环境变量切 trial/develop
    const envVersion = process.env.WECHAT_QR_ENV || 'release';
    const res = await fetch(`https://api.weixin.qq.com/wxa/getwxacodeunlimit?access_token=${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scene,
        page,
        width: 280,
        check_path: false, // 允许页面未发布/未上线时也能生成
        env_version: envVersion,
      }),
    });

    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      // 微信侧返回错误 JSON
      const errData: any = await res.json();
      this.logger.warn(`生成太阳码失败: ${JSON.stringify(errData)}`);
      throw new BadRequestException(`生成太阳码失败：${errData?.errmsg || '微信接口异常'}（${errData?.errcode}）`);
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length < 100) {
      throw new BadRequestException('生成太阳码失败：微信返回内容异常');
    }

    // 上传 TOS，返回 30 天签名 URL
    const key = await this.storage.uploadFile({
      fileContent: buffer,
      fileName: `qrcode-${Date.now()}.png`,
      contentType: 'image/png',
    });
    const url = await this.storage.generatePresignedUrl({ key, expireTime: 2592000 });

    this.qrCache.set(cacheKey, { url, expiresAt: Date.now() + 24 * 60 * 60 * 1000 });
    this.logger.log(`太阳码已生成: page=${page} scene=${scene}`);
    return { url };
  }

  /**
   * 生成海报太阳码（短码映射方案）。
   * 真实 page 与参数（可能含超长 UUID、inviter 等）存入 share_qr_codes，
   * 太阳码统一落地首页 pages/index/index，scene 使用 10 位短码。
   * 首页 useLoad 解析短码 → resolveShortCode 取回真实目标页与参数后跳转。
   */
  async createPosterQrCode(
    targetPage: string,
    params: Record<string, any>,
  ): Promise<{ url: string; code: string }> {
    if (!targetPage) throw new BadRequestException('targetPage 不能为空');
    const code = await this.generateShortCode();
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from('share_qr_codes')
      .insert({ code, page: targetPage, params: params || {} });
    if (error) {
      this.logger.error(`写入太阳码短码映射失败: ${error.message}`);
      throw new BadRequestException('生成太阳码失败，请稍后重试');
    }
    // 统一落地首页，由首页中转（首页必然已发布，避免目标页未发布导致生成失败）
    const { url } = await this.getMiniProgramQrCode('pages/index/index', code);
    return { url, code };
  }

  /** 根据短码取回真实目标页与参数 */
  async resolveShortCode(code: string): Promise<{ page: string; params: Record<string, any> } | null> {
    if (!code) return null;
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('share_qr_codes')
      .select('page, params')
      .eq('code', code)
      .maybeSingle();
    if (error) {
      this.logger.warn(`解析太阳码短码失败 code=${code}: ${error.message}`);
      return null;
    }
    if (!data) return null;
    return { page: data.page, params: (data.params as Record<string, any>) || {} };
  }

  /** 生成 10 位短码（去易混淆字符），碰撞时重试 */
  private async generateShortCode(): Promise<string> {
    const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
    const supabase = getSupabaseClient();
    for (let attempt = 0; attempt < 5; attempt++) {
      const bytes = randomBytes(10);
      let code = '';
      for (let i = 0; i < 10; i++) code += chars[bytes[i] % chars.length];
      const { data } = await supabase
        .from('share_qr_codes')
        .select('id')
        .eq('code', code)
        .maybeSingle();
      if (!data) return code;
    }
    return `q${Date.now().toString(36)}`.slice(0, 16);
  }
}
