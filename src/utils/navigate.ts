import Taro from '@tarojs/taro';

/**
 * 跳转到 tabBar 页面
 * - 小程序端使用 switchTab
 * - H5 端使用 reLaunch
 */
export function navigateToTabBar(url: string) {
  const isMiniApp = Taro.getEnv() === Taro.ENV_TYPE.WEAPP || Taro.getEnv() === Taro.ENV_TYPE.TT;
  if (isMiniApp) {
    return Taro.switchTab({ url });
  } else {
    return Taro.reLaunch({ url });
  }
}