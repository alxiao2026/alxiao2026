import { getSupabaseClient } from '@/storage/database/supabase-client';

/**
 * 微信凭证统一读取（AppID/AppSecret）
 *
 * 背景：线上部署环境不一定同步 server/.env（gitignore 排除），
 * 导致 code2session / access_token / 订阅消息等微信接口全部失败。
 *
 * 读取优先级：环境变量（WECHAT_APPID/WECHAT_SECRET） > wechat_config 表（管理后台可配）
 * 结果缓存 60s，保存配置时主动调用 clearWechatConfigCache() 立即生效。
 */

export interface WechatCredentials {
  appid: string;
  secret: string;
  /** 配置来源：env=环境变量，db=数据库，none=未配置 */
  source: 'env' | 'db' | 'none';
}

let cache: { creds: WechatCredentials; expiresAt: number } | null = null;

export async function getWechatCredentials(): Promise<WechatCredentials> {
  const envAppid = process.env.WECHAT_APPID || '';
  const envSecret = process.env.WECHAT_SECRET || '';
  if (envAppid && envSecret) {
    return { appid: envAppid, secret: envSecret, source: 'env' };
  }

  if (cache && Date.now() < cache.expiresAt) {
    return cache.creds;
  }

  let creds: WechatCredentials = { appid: '', secret: '', source: 'none' };
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('wechat_config')
      .select('appid, secret')
      .eq('id', 1)
      .maybeSingle();
    if (!error && data?.appid && data?.secret) {
      creds = { appid: data.appid, secret: data.secret, source: 'db' };
    }
  } catch (e: any) {
    console.warn('[wechat-config] 读取数据库配置失败:', e?.message);
  }

  cache = { creds, expiresAt: Date.now() + 60 * 1000 };
  return creds;
}

export function clearWechatConfigCache() {
  cache = null;
}

/** 保存配置到数据库（管理后台调用） */
export async function saveWechatCredentials(appid: string, secret: string) {
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
  if (error) throw error;
  clearWechatConfigCache();
}

/** 读取当前配置（管理后台展示用，secret 打码） */
export async function getWechatConfigForAdmin() {
  const creds = await getWechatCredentials();
  const mask = (s: string) => (s.length <= 8 ? '****' : `${s.slice(0, 4)}****${s.slice(-4)}`);
  return {
    appid: creds.appid,
    secret_masked: creds.secret ? mask(creds.secret) : '',
    source: creds.source,
    configured: creds.source !== 'none',
  };
}
