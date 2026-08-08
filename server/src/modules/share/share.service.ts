import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { S3Storage } from 'coze-coding-dev-sdk';
import { getWechatCredentials } from '../user/wechat-config';

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
}
