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
