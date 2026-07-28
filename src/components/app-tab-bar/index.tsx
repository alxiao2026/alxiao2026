import { View, Text, Image } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { House, CircleUserRound } from 'lucide-react-taro';
import logoImg from '@/assets/tabbar/tuantuan-active.png';

interface AppTabBarProps {
  /** 当前页面路径，如 /pages/index/index */
  current: string;
}

const ACTIVE_COLOR = '#FF4757';
const INACTIVE_COLOR = '#9CA3AF';
const HOME_PATH = '/pages/index/index';
const TUANTUAN_PATH = '/pages/tuantuan/index';
const MINE_PATH = '/pages/user-center/index';

/**
 * 悬浮胶囊式底部导航（年轻活泼风）
 * 中间团团 logo 凸起，点击跳转对应主页
 * 
 * 注意：小程序端使用原生 tabBar，此组件仅在 H5 端渲染
 */
export default function AppTabBar({ current }: AppTabBarProps) {
  // 小程序端使用原生 tabBar，不渲染自定义组件
  if (Taro.getEnv() === Taro.ENV_TYPE.WEAPP || Taro.getEnv() === Taro.ENV_TYPE.TT) {
    return null;
  }

  const go = (path: string) => {
    if (current !== path) {
      Taro.reLaunch({ url: path });
    }
  };

  const isHome = current === HOME_PATH;
  const isMine = current === MINE_PATH;

  return (
    <View
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 100,
        display: 'flex',
        flexDirection: 'row',
        paddingLeft: '16px',
        paddingRight: '16px',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <View
        className="bg-white rounded-2xl shadow-lg"
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          height: '48px',
          position: 'relative',
        }}
      >
        {/* 首页 */}
        <View
          style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => go(HOME_PATH)}
        >
          <House size={20} color={isHome ? ACTIVE_COLOR : INACTIVE_COLOR} strokeWidth={2.2} />
          <Text
            className={`block text-xs mt-1 ${isHome ? 'font-semibold' : ''}`}
            style={{ color: isHome ? ACTIVE_COLOR : INACTIVE_COLOR }}
          >
            首页
          </Text>
        </View>

        {/* 团团（中间凸起 logo） */}
        <View
          style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', position: 'relative', height: '100%' }}
          onClick={() => go(TUANTUAN_PATH)}
        >
          <View
            style={{
              position: 'absolute',
              top: '-24px',
              width: '58px',
              height: '58px',
              borderRadius: '29px',
              backgroundColor: '#ffffff',
              boxShadow: '0 4px 14px rgba(255, 71, 87, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Image src={logoImg} style={{ width: '50px', height: '50px' }} mode="aspectFit" />
          </View>
        </View>

        {/* 我的 */}
        <View
          style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => go(MINE_PATH)}
        >
          <CircleUserRound size={20} color={isMine ? ACTIVE_COLOR : INACTIVE_COLOR} strokeWidth={2.2} />
          <Text
            className={`block text-xs mt-1 ${isMine ? 'font-semibold' : ''}`}
            style={{ color: isMine ? ACTIVE_COLOR : INACTIVE_COLOR }}
          >
            我的
          </Text>
        </View>
      </View>
    </View>
  );
}
