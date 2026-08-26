import Taro from '@tarojs/taro';

/**
 * 判断当前会话是否为「真实登录」——用户在登录页完成过账号登录。
 * - 未登录（无 is_logged_in / user_id）→ 非真实登录
 * - 静默登录生成的游客账号（login_via = 'silent'）→ 非真实登录
 * - 历史版本已登录用户（无 login_via 标记但存有 user_role/user_phone）→ 视为真实登录
 */
export function isRealLogin(): boolean {
  if (Taro.getStorageSync('is_logged_in') !== true) return false;
  if (!Taro.getStorageSync('user_id')) return false;
  const via = Taro.getStorageSync('login_via');
  if (via === 'silent') return false;
  if (!via && !Taro.getStorageSync('user_role') && !Taro.getStorageSync('user_phone')) return false;
  return true;
}
