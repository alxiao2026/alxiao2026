import { getSupabaseClient } from '@/storage/database/supabase-client';

/**
 * 微信配置统一读取（登录 + 支付）：
 * 优先级：环境变量 > 数据库 wechat_config 表
 * 场景：生产部署若缺少 .env，管理员在后台配置一次即可全站生效。
 */

export interface WechatCredentials {
  appid: string;
  secret: string;
  source: 'env' | 'db' | 'none';
}

export interface WechatPayCredentials {
  appid: string;
  mchId: string;
  mchSerialNo: string;
  privateKey: string;
  apiV3Key: string;
  payPublicKey: string;
  payPublicKeyId: string;
  /** 为空时由调用方按当前环境动态拼接 */
  payNotifyUrl: string;
  source: 'env' | 'db' | 'none';
}

interface WechatConfigRow {
  appid?: string;
  secret?: string;
  mch_id?: string;
  mch_serial_no?: string;
  private_key?: string;
  api_v3_key?: string;
  pay_public_key?: string;
  pay_public_key_id?: string;
  pay_notify_url?: string;
  updated_at?: string;
}

const CACHE_TTL_MS = 60 * 1000;
let dbRowCache: WechatConfigRow | null = null;
let dbRowCacheAt = 0;

/** 读取 DB 整行配置（60s 缓存，登录/支付共用） */
async function getDbRow(): Promise<WechatConfigRow> {
  const now = Date.now();
  if (dbRowCache !== null && now - dbRowCacheAt < CACHE_TTL_MS) {
    return dbRowCache;
  }
  try {
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from('wechat_config')
      .select('*')
      .eq('id', 1)
      .maybeSingle();
    dbRowCache = (data as WechatConfigRow) || {};
    dbRowCacheAt = now;
    return dbRowCache;
  } catch (e) {
    console.error('[wechat-config] 读取 wechat_config 表失败:', (e as Error)?.message);
    return dbRowCache || {};
  }
}

function clearCache() {
  dbRowCache = null;
  dbRowCacheAt = 0;
}

/** 登录凭证：env 优先，DB 兜底 */
export async function getWechatCredentials(): Promise<WechatCredentials> {
  const envAppid = (process.env.WECHAT_APPID || '').trim();
  const envSecret = (process.env.WECHAT_SECRET || '').trim();
  if (envAppid && envSecret) {
    return { appid: envAppid, secret: envSecret, source: 'env' };
  }
  const row = await getDbRow();
  const appid = (row.appid || '').trim();
  const secret = (row.secret || '').trim();
  if (appid && secret) {
    return { appid, secret, source: 'db' };
  }
  return { appid: '', secret: '', source: 'none' };
}

/** 支付凭证：env 全量优先，DB 兜底（appid 复用登录凭证逻辑） */
export async function getWechatPayCredentials(): Promise<WechatPayCredentials> {
  const env = {
    appid: (process.env.WECHAT_APPID || '').trim(),
    mchId: (process.env.WECHAT_MCH_ID || '').trim(),
    mchSerialNo: (process.env.WECHAT_MCH_SERIAL_NO || '').trim(),
    privateKey: (process.env.WECHAT_PRIVATE_KEY || '').trim(),
    apiV3Key: (process.env.WECHAT_API_V3_KEY || '').trim(),
    payPublicKey: (process.env.WECHAT_PAY_PUBLIC_KEY || '').trim(),
    payPublicKeyId: (process.env.WECHAT_PAY_PUBLIC_KEY_ID || '').trim(),
    payNotifyUrl: (process.env.WECHAT_PAY_NOTIFY_URL || '').trim(),
  };
  // 核心字段齐全即视为 env 可用（公钥/回调可选）
  if (env.mchId && env.apiV3Key && env.mchSerialNo && env.privateKey) {
    return normalizePayPem({ ...env, source: 'env' });
  }

  const row = await getDbRow();
  const { appid } = await getWechatCredentials();
  const db: Omit<WechatPayCredentials, 'source'> = {
    appid,
    mchId: (row.mch_id || '').trim(),
    mchSerialNo: (row.mch_serial_no || '').trim(),
    privateKey: (row.private_key || '').trim(),
    apiV3Key: (row.api_v3_key || '').trim(),
    payPublicKey: (row.pay_public_key || '').trim(),
    payPublicKeyId: (row.pay_public_key_id || '').trim(),
    payNotifyUrl: (row.pay_notify_url || '').trim(),
  };
  if (db.mchId && db.apiV3Key && db.mchSerialNo && db.privateKey) {
    return normalizePayPem({ ...db, source: 'db' });
  }
  return normalizePayPem({ ...db, source: 'none' });
}

/**
 * PEM 还原：字面 \n 转真实换行、剔除 \r（防 Windows 换行污染）、保证末尾换行。
 * 末尾换行必须补齐：部分 OpenSSL 3.0.x 版本对无尾换行的 PEM 直接报
 * "DECODER routines::unsupported"，导致线上私钥解析失败。
 */
function restorePem(value: string): string {
  if (!value) return '';
  const restored = value.replace(/\\n/g, '\n').replace(/\r/g, '').trim();
  return restored.endsWith('\n') ? restored : `${restored}\n`;
}

/** PEM 规范化：.env/DB 中可能以字面 \n 存储私钥换行，统一还原（对真实换行幂等） */
function normalizePayPem(pay: WechatPayCredentials): WechatPayCredentials {
  return {
    ...pay,
    privateKey: restorePem(pay.privateKey),
    payPublicKey: restorePem(pay.payPublicKey),
  };
}

/** 保存登录凭证（AppID/AppSecret） */
export async function saveWechatCredentials(appid: string, secret: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('wechat_config').upsert(
    {
      id: 1,
      appid: appid.trim(),
      secret: secret.trim(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' },
  );
  if (error) throw new Error(`保存微信配置失败: ${error.message}`);
  clearCache();
}

export interface WechatPayConfigInput {
  mch_id: string;
  mch_serial_no: string;
  private_key: string;
  api_v3_key: string;
  pay_public_key?: string;
  pay_public_key_id?: string;
  pay_notify_url?: string;
}

/** 保存支付凭证（商户号/私钥/APIv3 密钥等；可选字段留空则保留原值由调用方处理） */
export async function saveWechatPayCredentials(input: WechatPayConfigInput): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('wechat_config').upsert(
    {
      id: 1,
      mch_id: input.mch_id.trim(),
      mch_serial_no: input.mch_serial_no.trim(),
      private_key: input.private_key.trim(),
      api_v3_key: input.api_v3_key.trim(),
      pay_public_key: (input.pay_public_key || '').trim(),
      pay_public_key_id: (input.pay_public_key_id || '').trim(),
      pay_notify_url: (input.pay_notify_url || '').trim(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' },
  );
  if (error) throw new Error(`保存微信支付配置失败: ${error.message}`);
  clearCache();
}

function maskSecret(value: string): string {
  if (!value) return '';
  if (value.length <= 8) return '****';
  return `${value.slice(0, 4)}****${value.slice(-4)}`;
}

/** 管理后台查看（敏感字段打码） */
export async function getWechatConfigForAdmin() {
  const cred = await getWechatCredentials();
  const pay = await getWechatPayCredentials();
  return {
    appid: cred.appid,
    secret_masked: maskSecret(cred.secret),
    source: cred.source,
    configured: Boolean(cred.appid && cred.secret),
    pay: {
      mch_id: pay.mchId,
      mch_serial_no: pay.mchSerialNo ? maskSecret(pay.mchSerialNo) : '',
      private_key_masked: pay.privateKey ? '已配置（内容不回显）' : '',
      api_v3_key_masked: maskSecret(pay.apiV3Key),
      pay_public_key_masked: pay.payPublicKey ? '已配置（内容不回显）' : '',
      pay_public_key_id: pay.payPublicKeyId,
      pay_notify_url: pay.payNotifyUrl,
      source: pay.source,
      configured: pay.source !== 'none',
    },
  };
}
