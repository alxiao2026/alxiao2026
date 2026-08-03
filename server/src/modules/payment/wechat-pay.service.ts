import { Injectable, Logger } from '@nestjs/common';
import { getWechatPayCredentials } from '../user/wechat-config';
import * as crypto from 'crypto';

/**
 * 微信支付 V3 服务（小程序 JSAPI 支付）
 *
 * 配置（server/.env）：
 *   WECHAT_APPID            小程序 AppID
 *   WECHAT_MCH_ID           微信支付商户号
 *   WECHAT_API_V3_KEY       商户 APIv3 密钥（32 位）
 *   WECHAT_MCH_SERIAL_NO    商户 API 证书序列号
 *   WECHAT_PRIVATE_KEY      商户 API 证书私钥（apiclient_key.pem 全文，换行可用 \n 转义）
 *   WECHAT_PAY_NOTIFY_URL   支付结果回调地址（公网 HTTPS）
 *   WECHAT_PAY_PUBLIC_KEY_ID  微信支付公钥 ID（PUB_KEY_ID_...，新商户号官方默认验签方式）
 *   WECHAT_PAY_PUBLIC_KEY     微信支付公钥 PEM 全文（商户平台 → API 安全 → 微信支付公钥）
 *
 * 任一缺失时 isEnabled() 返回 false，支付模块自动回退 Mock 通道。
 */
@Injectable()
export class WechatPayService {
  private readonly logger = new Logger(WechatPayService.name);

  private appid = '';
  private mchId = '';
  private apiV3Key = '';
  private serialNo = '';
  private payPublicKeyId = '';
  /** 微信支付公钥 PEM（新模式，回调验签用，可替代平台证书） */
  private payPublicKey = '';
  private privateKey = '';
  private notifyUrl = '';
  /** 动态配置缓存时间戳（配置来源：环境变量优先，数据库 wechat_config 兜底，60s 刷新） */
  private configLoadedAt = 0;

  /** 加载支付配置（env 优先、DB 兜底，60s 缓存；回调地址缺省时按当前运行环境动态拼接） */
  private async ensureConfig(): Promise<void> {
    const now = Date.now();
    if (this.configLoadedAt && now - this.configLoadedAt < 60_000) return;
    const pay = await getWechatPayCredentials();
    this.appid = pay.appid;
    this.mchId = pay.mchId;
    this.apiV3Key = pay.apiV3Key;
    this.serialNo = pay.mchSerialNo;
    this.payPublicKeyId = pay.payPublicKeyId;
    this.payPublicKey = pay.payPublicKey;
    this.privateKey = pay.privateKey;
    this.notifyUrl = pay.payNotifyUrl || this.buildDefaultNotifyUrl();
    this.configLoadedAt = now;
    if (pay.source !== 'none') {
      this.logger.log(`微信支付配置来源: ${pay.source}`);
    }
  }

  /** 回调地址兜底：按平台注入的项目域名拼接（适配开发/生产环境） */
  private buildDefaultNotifyUrl(): string {
    const domain = (
      process.env.COZE_PROJECT_DOMAIN_DEFAULT ||
      process.env.PROJECT_DOMAIN ||
      ''
    ).replace(/\/+$/, '');
    return domain ? `${domain}/api/payment/wechat-notify` : '';
  }

  /** 微信平台证书缓存：serial_no -> 证书 PEM（平台证书会轮换，缓存 1 小时） */
  private platformCerts = new Map<string, string>();
  private certsLoadedAt = 0;

  /** 支付配置是否齐全（齐全则启用真实微信通道，否则调用方回退 Mock） */
  async isEnabled(): Promise<boolean> {
    await this.ensureConfig();
    return Boolean(
      this.appid &&
        this.mchId &&
        this.apiV3Key &&
        this.serialNo &&
        this.privateKey &&
        this.notifyUrl,
    );
  }

  // ==================== JSAPI 下单 ====================

  /**
   * 小程序 JSAPI 统一下单，返回 prepay_id
   * https://pay.weixin.qq.com/doc/v3/apis/CHAPTER3_5.shtml
   */
  async createJsapiOrder(params: {
    outTradeNo: string;
    description: string;
    totalFen: number;
    openId: string;
  }): Promise<string> {
    await this.ensureConfig();
    const body = {
      appid: this.appid,
      mchid: this.mchId,
      description: (params.description || '团购套餐').slice(0, 127),
      out_trade_no: params.outTradeNo,
      notify_url: this.notifyUrl,
      amount: { total: params.totalFen, currency: 'CNY' },
      payer: { openid: params.openId },
    };
    const res = await this.requestWechat('POST', '/v3/pay/transactions/jsapi', body);
    if (!res?.prepay_id) {
      throw new Error(`微信下单未返回 prepay_id: ${JSON.stringify(res)}`);
    }
    return res.prepay_id as string;
  }

  /** 关闭订单（金额变更需要重新下单时调用，忽略失败） */
  async closeOrder(outTradeNo: string): Promise<void> {
    await this.ensureConfig();
    try {
      await this.requestWechat(
        'POST',
        `/v3/pay/transactions/out-trade-no/${outTradeNo}/close`,
        { mchid: this.mchId },
      );
    } catch (err: any) {
      this.logger.warn(`关闭微信订单失败（可忽略）: ${err?.message}`);
    }
  }

  /**
   * 生成小程序 Taro.requestPayment 调起参数（二次签名）
   * 签名串：appId\ntimeStamp\nnonceStr\npackage\n
   */
  async buildMiniProgramPayParams(prepayId: string) {
    await this.ensureConfig();
    const timeStamp = Math.floor(Date.now() / 1000).toString();
    const nonceStr = crypto.randomBytes(16).toString('hex');
    const pkg = `prepay_id=${prepayId}`;
    const message = `${this.appid}\n${timeStamp}\n${nonceStr}\n${pkg}\n`;
    const paySign = crypto
      .createSign('RSA-SHA256')
      .update(message)
      .sign(this.privateKey, 'base64');
    return {
      timeStamp,
      nonceStr,
      package: pkg,
      signType: 'RSA' as const,
      paySign,
    };
  }

  // ==================== 支付回调 ====================

  /**
   * 验证微信回调签名并解密资源，返回支付结果明文
   * { transaction_id, out_trade_no, trade_state, success_time, amount: { total, payer_total } ... }
   */
  async verifyAndDecryptNotify(
    headers: Record<string, string | string[] | undefined>,
    rawBody: string,
  ): Promise<any> {
    await this.ensureConfig();
    const timestamp = this.pickHeader(headers, 'wechatpay-timestamp');
    const nonce = this.pickHeader(headers, 'wechatpay-nonce');
    const signature = this.pickHeader(headers, 'wechatpay-signature');
    const serial = this.pickHeader(headers, 'wechatpay-serial');
    if (!timestamp || !nonce || !signature || !serial) {
      throw new Error('缺少微信支付回调签名头');
    }

    let verifyKey: string;
    if (serial.startsWith('PUB_KEY_ID_')) {
      // 微信支付公钥模式（新商户号默认）：直接用本地配置的公钥验签
      if (!this.payPublicKey) {
        throw new Error('回调使用微信支付公钥签名，但未配置 WECHAT_PAY_PUBLIC_KEY');
      }
      if (this.payPublicKeyId && serial !== this.payPublicKeyId) {
        this.logger.warn(
          `微信支付公钥 ID 不一致: 回调=${serial}, 配置=${this.payPublicKeyId}`,
        );
      }
      verifyKey = this.payPublicKey;
    } else {
      // 平台证书模式：下载并缓存平台证书（商户号无平台证书时为空，属正常降级）
      await this.loadPlatformCertificates();
      let cert = this.platformCerts.get(serial);
      if (!cert) {
        // 平台证书轮换：强制刷新后重试一次
        await this.loadPlatformCertificates(true);
        cert = this.platformCerts.get(serial);
      }
      if (!cert) {
        throw new Error(`未找到微信支付平台证书 serial=${serial}`);
      }
      verifyKey = cert;
    }

    const message = `${timestamp}\n${nonce}\n${rawBody}\n`;
    const ok = crypto
      .createVerify('RSA-SHA256')
      .update(message)
      .verify(verifyKey, signature, 'base64');
    if (!ok) {
      throw new Error('微信支付回调验签失败');
    }

    const body = JSON.parse(rawBody);
    const resource = body?.resource;
    if (!resource?.ciphertext) {
      throw new Error('微信支付回调缺少 resource');
    }
    const plain = this.decryptAesGcm(
      Buffer.from(this.apiV3Key, 'utf8'),
      resource.nonce,
      resource.associated_data,
      resource.ciphertext,
    );
    return JSON.parse(plain);
  }

  // ==================== 退款 ====================

  /**
   * 申请退款（受理成功即返回；最终到账以微信退款回调/查询为准，此处按受理成功处理）
   * https://pay.weixin.qq.com/doc/v3/apis/CHAPTER3_5.shtml
   */
  async createRefund(params: {
    transactionId?: string;
    outTradeNo: string;
    outRefundNo: string;
    refundFen: number;
    totalFen: number;
    reason?: string;
  }): Promise<any> {
    await this.ensureConfig();
    const body: Record<string, any> = {
      out_refund_no: params.outRefundNo,
      amount: { refund: params.refundFen, total: params.totalFen, currency: 'CNY' },
    };
    if (params.transactionId) body.transaction_id = params.transactionId;
    else body.out_trade_no = params.outTradeNo;
    if (params.reason) body.reason = params.reason.slice(0, 80);
    return this.requestWechat('POST', '/v3/refund/domestic/refunds', body);
  }

  // ==================== 内部工具 ====================

  /** 微信 V3 接口通用请求（携带 Authorization 签名头） */
  private async requestWechat(method: string, path: string, body?: any): Promise<any> {
    const url = `https://api.mch.weixin.qq.com${path}`;
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = crypto.randomBytes(16).toString('hex');
    const bodyStr = body ? JSON.stringify(body) : '';
    const message = `${method}\n${path}\n${timestamp}\n${nonce}\n${bodyStr}\n`;
    const signature = crypto
      .createSign('RSA-SHA256')
      .update(message)
      .sign(this.privateKey, 'base64');
    const authorization =
      `WECHATPAY2-SHA256-RSA2048 mchid="${this.mchId}",nonce_str="${nonce}",` +
      `timestamp="${timestamp}",serial_no="${this.serialNo}",signature="${signature}"`;

    const res = await fetch(url, {
      method,
      headers: {
        Authorization: authorization,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        // Node undici 默认发送 "Accept-Language: *"，微信商户 API 不接受，必须显式指定
        'Accept-Language': 'zh-CN',
      },
      body: bodyStr || undefined,
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`微信支付接口错误 HTTP ${res.status}: ${text}`);
    }
    return text ? JSON.parse(text) : {};
  }

  /** 下载并缓存微信平台证书（GET /v3/certificates，密文用 APIv3 密钥解密） */
  private async loadPlatformCertificates(force = false): Promise<void> {
    const cacheValid =
      this.platformCerts.size > 0 && Date.now() - this.certsLoadedAt < 3600_000;
    if (!force && cacheValid) return;

    let list: any[] = [];
    try {
      const res = await this.requestWechat('GET', '/v3/certificates');
      // 微信平台实际返回字段为 data（兼容旧字段 certificates）
      list = res?.data || res?.certificates || [];
    } catch (err: any) {
      // 新商户号默认仅提供「微信支付公钥」模式，无平台证书可下载（404 属预期，静默降级）
      this.logger.warn(`微信平台证书不可用（公钥模式属预期）: ${err?.message}`);
      return;
    }
    const next = new Map<string, string>();
    for (const item of list) {
      const enc = item?.encrypt_certificate;
      if (!item?.serial_no || !enc?.ciphertext) continue;
      const pem = this.decryptAesGcm(
        Buffer.from(this.apiV3Key, 'utf8'),
        enc.nonce,
        enc.associated_data,
        enc.ciphertext,
      );
      next.set(item.serial_no, pem);
    }
    if (next.size > 0) {
      this.platformCerts = next;
      this.certsLoadedAt = Date.now();
      this.logger.log(`微信平台证书已加载 ${next.size} 张`);
    }
  }

  /** AES-256-GCM 解密（微信 V3 密文：base64 密文尾部 16 字节为 authTag） */
  private decryptAesGcm(
    key: Buffer,
    nonce: string,
    aad: string | undefined,
    ciphertextB64: string,
  ): string {
    const data = Buffer.from(ciphertextB64, 'base64');
    const authTag = data.subarray(data.length - 16);
    const ciphertext = data.subarray(0, data.length - 16);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, nonce);
    if (aad) decipher.setAAD(Buffer.from(aad, 'utf8'));
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  }

  private pickHeader(
    headers: Record<string, string | string[] | undefined>,
    name: string,
  ): string {
    const v = headers[name];
    if (Array.isArray(v)) return v[0] || '';
    return v || '';
  }
}
