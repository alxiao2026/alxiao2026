import Taro from '@tarojs/taro'
import { Network } from '@/network'

/**
 * 静默登录：本地无账号时，用 wx.login 的 code 经后端换取/创建账号。
 * 解决未登录用户（含微信审核人员）打开依赖账号的页面时无数据、假死的问题。
 * 同一时刻只发起一次登录流程，并发调用共享结果。
 */
let pending: Promise<string> | null = null

export async function ensureLogin(): Promise<string> {
  const existing = Taro.getStorageSync('user_id')
  if (existing) return existing as string
  if (pending) return pending

  pending = (async () => {
    console.log('[SilentLogin] 本地无账号，发起静默登录')
    const loginRes = await Taro.login().catch((e) => {
      console.error('[SilentLogin] Taro.login 失败:', e)
      return null
    })
    const code = loginRes?.code
    if (!code) throw new Error('微信登录凭证获取失败')

    const res = await Network.request({
      url: '/api/users/login/wechat',
      method: 'POST',
      data: { code }
    })
    console.log('[SilentLogin] 登录响应:', res.data)
    const user = res.data?.data
    if (res.data?.code === 200 && user?.user_id) {
      Taro.setStorageSync('user_id', user.user_id)
      Taro.setStorageSync('is_logged_in', true)
      // 标记为静默游客账号：未在登录页完成账号登录，进入「我的」时仍需引导去登录页
      Taro.setStorageSync('login_via', 'silent')
      if (user.nick_name) Taro.setStorageSync('nick_name', user.nick_name)
      if (user.avatar_url) Taro.setStorageSync('avatar_url', user.avatar_url)
      console.log('[SilentLogin] 登录成功:', user.user_id)
      return user.user_id as string
    }
    throw new Error(res.data?.msg || '静默登录失败')
  })().finally(() => {
    pending = null
  })

  return pending
}
