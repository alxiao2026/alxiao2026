import { View, Text, Image } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { House, CircleUserRound } from 'lucide-react-taro';
import { navigateToTabBar } from '@/utils/navigate';
import { isRealLogin } from '@/utils/auth-guard';
import logoImg from '@/assets/tabbar/tuantuan-active.png';
import './index.css';

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
 * 三端统一渲染：小程序端配合 custom-tab-bar 占位组件隐藏原生栏，页面内悬浮展示；
 * 跳转经 navigateToTabBar 自动选择 switchTab（小程序）/ reLaunch（H5）
 */
export default function AppTabBar({ current }: AppTabBarProps) {
  const go = (path: string) => {
    if (current !== path) {
      // 未真实登录（含静默游客账号）点击「我的」→ 跳登录页，避免进入空白个人中心
      if (path === MINE_PATH && !isRealLogin()) {
        Taro.navigateTo({ url: '/pages/login/index' });
        return;
      }
      navigateToTabBar(path);
    }
  };

  const isHome = current === HOME_PATH;
  const isTuan = current === TUANTUAN_PATH;
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
        className="bg-white rounded-3xl"
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          height: '54px',
          position: 'relative',
          boxShadow: '0 8px 30px rgba(255, 71, 87, 0.14), 0 2px 8px rgba(0, 0, 0, 0.05)',
        }}
      >
        {/* 首页 */}
        <View
          style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => go(HOME_PATH)}
        >
          <View key={isHome ? 'home-on' : 'home-off'} className={isHome ? 'app-tabbar-pop' : ''} style={{ display: 'flex' }}>
            <House size={20} color={isHome ? ACTIVE_COLOR : INACTIVE_COLOR} strokeWidth={2.2} />
          </View>
          <Text
            className={`block text-xs mt-1 ${isHome ? 'font-semibold' : ''}`}
            style={{ color: isHome ? ACTIVE_COLOR : INACTIVE_COLOR }}
          >
            首页
          </Text>
          {isHome && (
            <View style={{ width: '4px', height: '4px', borderRadius: '999px', backgroundColor: ACTIVE_COLOR, marginTop: '2px' }} />
          )}
        </View>

        {/* 团团（中间渐变凸起 logo + 呼吸光效） */}
        <View
          style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', position: 'relative', height: '100%' }}
          onClick={() => go(TUANTUAN_PATH)}
        >
          <View
            className="app-tabbar-logo"
            style={{
              position: 'absolute',
              top: '-24px',
              width: '58px',
              height: '58px',
              borderRadius: '29px',
              padding: '3px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <View
              style={{
                width: '100%',
                height: '100%',
                borderRadius: '999px',
                backgroundColor: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Image src={logoImg} style={{ width: '44px', height: '44px' }} mode="aspectFit" />
            </View>
          </View>
          <Text
            className={`block text-xs ${isTuan ? 'font-semibold' : ''}`}
            style={{ color: isTuan ? ACTIVE_COLOR : INACTIVE_COLOR, marginBottom: '5px' }}
          >
            团团
          </Text>
        </View>

        {/* 我的 */}
        <View
          style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => go(MINE_PATH)}
        >
          <View key={isMine ? 'mine-on' : 'mine-off'} className={isMine ? 'app-tabbar-pop' : ''} style={{ display: 'flex' }}>
            <CircleUserRound size={20} color={isMine ? ACTIVE_COLOR : INACTIVE_COLOR} strokeWidth={2.2} />
          </View>
          <Text
            className={`block text-xs mt-1 ${isMine ? 'font-semibold' : ''}`}
            style={{ color: isMine ? ACTIVE_COLOR : INACTIVE_COLOR }}
          >
            我的
          </Text>
          {isMine && (
            <View style={{ width: '4px', height: '4px', borderRadius: '999px', backgroundColor: ACTIVE_COLOR, marginTop: '2px' }} />
          )}
        </View>
      </View>
    </View>
  );
}
