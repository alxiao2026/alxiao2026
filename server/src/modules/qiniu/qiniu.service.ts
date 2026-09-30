import { BadRequestException, Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as qiniu from 'qiniu';

/** 七牛各存储区域对应的 HTTPS 上传域名（客户端直传用） */
const REGION_UPLOAD_HOSTS: Record<string, string> = {
  z0: 'https://upload.qiniup.com',
  'cn-east-2': 'https://upload-cn-east-2.qiniup.com',
  z1: 'https://upload-z1.qiniup.com',
  z2: 'https://upload-z2.qiniup.com',
  na0: 'https://upload-na0.qiniup.com',
  as0: 'https://upload-as0.qiniup.com',
};

/** 允许的图片扩展名（用于生成存储 key，其余一律按 bin 处理） */
const IMAGE_EXT_RE = /\.(png|jpe?g|webp|gif|bmp|svg)$/i;

@Injectable()
export class QiniuService {
  /** 读取七牛配置，缺失时抛出带明确指引的错误 */
  private loadConfig() {
    const accessKey = (process.env.QINIU_ACCESS_KEY || '').trim();
    const secretKey = (process.env.QINIU_SECRET_KEY || '').trim();
    const bucket = (process.env.QINIU_BUCKET || '').trim();
    const domain = (process.env.QINIU_DOMAIN || '').trim().replace(/\/+$/, '');
    const region = (process.env.QINIU_REGION || 'z0').trim();
    const missing = [
      !accessKey && 'QINIU_ACCESS_KEY',
      !secretKey && 'QINIU_SECRET_KEY',
      !bucket && 'QINIU_BUCKET',
      !domain && 'QINIU_DOMAIN',
    ].filter(Boolean) as string[];
    return { accessKey, secretKey, bucket, domain, region, missing };
  }

  /** 配置是否完整（用于 status 自检接口） */
  getConfigStatus() {
    const { accessKey, secretKey, bucket, domain, region, missing } = this.loadConfig();
    return {
      configured: missing.length === 0,
      missing,
      bucket,
      region,
      domain,
      // 不回传密钥本体，仅回传是否已配置
      hasAccessKey: Boolean(accessKey),
      hasSecretKey: Boolean(secretKey),
    };
  }

  /** 生成存储 key：qiniu/yyyymm/随机hash.ext（防覆盖、便于按月管理） */
  buildKey(filename: string): string {
    const ext = (filename && filename.match(IMAGE_EXT_RE)?.[0]) || '.png';
    const now = new Date();
    const month = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const hash = crypto.randomBytes(10).toString('hex');
    return `qiniu/${month}/${hash}${ext}`;
  }

  /** 拼接访问 URL（公开空间：域名 + key） */
  buildUrl(key: string): string {
    const { domain } = this.loadConfig();
    if (!domain) {
      throw new BadRequestException(
        '七牛访问域名(QINIU_DOMAIN)未配置，请在 server/.env 中填写绑定的自定义 CDN 域名（https 开头）',
      );
    }
    return `${domain}/${key}`;
  }

  /** 客户端直传用的上传域名 */
  getUploadHost(): string {
    const { region } = this.loadConfig();
    return REGION_UPLOAD_HOSTS[region] || REGION_UPLOAD_HOSTS.z0;
  }

  /**
   * 生成上传凭证（uptoken）
   * @param key 指定 key 时为「覆盖式」凭证（scope=bucket:key），否则为整个空间的普通凭证
   */
  generateUploadToken(key?: string): string {
    const { accessKey, secretKey, bucket, missing } = this.loadConfig();
    if (missing.length) {
      throw new BadRequestException(
        `七牛云未配置完整，缺少: ${missing.join('、')}。请在 server/.env 中填写后重启服务`,
      );
    }
    const mac = new qiniu.auth.digest.Mac(accessKey, secretKey);
    const putPolicy = new qiniu.rs.PutPolicy({
      scope: key ? `${bucket}:${key}` : bucket,
      // 直传回显字段：客户端拿到 key/fsize，中转模式同样兼容
      returnBody: '{"key":"$(key)","hash":"$(etag)","fsize":$(fsize),"bucket":"$(bucket)"}',
    });
    putPolicy.fsizeLimit = 30 * 1024 * 1024; // 单文件上限 30MB
    putPolicy.deadline = Math.floor(Date.now() / 1000) + 3600; // 凭证有效期 1 小时
    return putPolicy.uploadToken(mac);
  }

  /**
   * 服务端中转上传：Buffer → 七牛存储
   * @returns 存储结果（key + 访问 URL）
   */
  async uploadBuffer(
    buffer: Buffer,
    filename: string,
    mimetype: string,
  ): Promise<{ key: string; url: string }> {
    const { accessKey, secretKey, bucket, region, missing } = this.loadConfig();
    if (missing.length) {
      throw new BadRequestException(
        `七牛云未配置完整，缺少: ${missing.join('、')}。请在 server/.env 中填写后重启服务`,
      );
    }
    if (!buffer || buffer.length === 0) {
      throw new BadRequestException('文件内容为空');
    }
    if (buffer.length > 30 * 1024 * 1024) {
      throw new BadRequestException('文件过大（上限 30MB）');
    }

    const key = this.buildKey(filename);
    const mac = new qiniu.auth.digest.Mac(accessKey, secretKey);
    const putPolicy = new qiniu.rs.PutPolicy({ scope: `${bucket}:${key}` });
    putPolicy.fsizeLimit = 30 * 1024 * 1024;
    putPolicy.deadline = Math.floor(Date.now() / 1000) + 3600;
    const uploadToken = putPolicy.uploadToken(mac);

    const config = new qiniu.conf.Config({
      // 7.x SDK 区域配置：regionsProvider 接受 Region.fromRegionId('z0' 等)
      regionsProvider: qiniu.httpc.Region.fromRegionId(region),
    });
    config.useHttpsDomain = true;
    config.useCdnDomain = false;
    const formUploader = new qiniu.form_up.FormUploader(config);
    const putExtra = new qiniu.form_up.PutExtra();
    putExtra.mimeType = mimetype || undefined;

    console.log(
      `[Qiniu] 上传文件: key=${key} size=${buffer.length} mime=${mimetype} bucket=${bucket} region=${region}`,
    );

    const { data, resp } = await new Promise<{ data: any; resp: any }>((resolve, reject) => {
      formUploader.put(uploadToken, key, buffer, putExtra, (err, body, info) => {
        if (err) return reject(err);
        resolve({ data: body, resp: info });
      });
    });

    // 七牛表单上传返回 200 才算成功（resp 为 ResponseInfo）
    if (!resp || resp.statusCode !== 200) {
      const detail = resp ? `${resp.statusCode} ${resp.error || ''}`.trim() : '无响应';
      console.error('[Qiniu] 上传失败:', detail);
      throw new BadRequestException(`七牛上传失败: ${detail}`);
    }
    const finalKey = (data && data.key) || key;
    const url = this.buildUrl(finalKey);
    console.log('[Qiniu] 上传成功:', finalKey, '->', url);
    return { key: finalKey, url };
  }

  /**
   * 从 Multer 文件对象读取内容（跨端双模式）：
   * - memoryStorage：file.buffer（H5 与小程序经全局内存存储配置均为此形态）
   * - diskStorage：file.path（兼容未来改为磁盘存储的部署形态）
   */
  async readUploadFile(file: Express.Multer.File): Promise<Buffer> {
    if (file && (file as any).buffer && (file as any).buffer.length > 0) {
      return (file as any).buffer as Buffer;
    }
    if (file && file.path) {
      return await fs.promises.readFile(file.path);
    }
    throw new BadRequestException('无法获取文件内容（file.path / file.buffer 均为空）');
  }
}
