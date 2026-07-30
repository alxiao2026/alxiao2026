import { View, Text, Image, ScrollView } from '@tarojs/components';
import { useState, useEffect, useCallback } from 'react';
import Taro from '@tarojs/taro';
import { Network } from '@/network';
import { Badge } from '@/components/ui/badge';
import { getNavSafeAreaTop } from '@/lib/utils';
import AppTabBar from '@/components/app-tab-bar';
import {
  ClipboardList, ChevronRight, Pencil,
  Settings, Info, LogOut,
  ShoppingBag, CircleCheck, Ticket, Sparkles, User, Phone, Trophy, Store, UtensilsCrossed, Wallet, Bell
} from 'lucide-react-taro';

interface UserProfile {
  id: string;
  user_id: string;
  nick_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  gender: string;
  member_level: string;
  points: number;
}

interface UserStats {
  total_orders: number;
  unpaid_orders: number;
  pending_orders: number;
  used_orders: number;
  refunded_orders: number;
  total_spent: string;
  total_saved: string;
}

interface UserPermissions {
  role_code: number;
  role: string;
  merchant_id: number | null;
  can_access_admin: boolean;
  can_view_all_merchants: boolean;
  can_manage_own_store: boolean;
}

const UserCenterPage = () => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [lotteryCount, setLotteryCount] = useState(0);
  const [freeMealCount, setFreeMealCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [nickName, setNickName] = useState('');
  const [permissions, setPermissions] = useState<UserPermissions | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchProfile = useCallback(async (uid: string) => {
    try {
      const res = await Network.request({ url: `/api/users/${uid}` });
      console.log('[UserCenter] profile:', res.data);
      if (res.data?.code === 200 && res.data?.data) {
        setProfile(res.data.data);
        // 同步后端最新昵称/头像到本地，避免展示 storage 中的旧缓存
        if (res.data.data.nick_name) {
          setNickName(res.data.data.nick_name);
          Taro.setStorageSync('nick_name', res.data.data.nick_name);
        }
        if (res.data.data.avatar_url) {
          setAvatarUrl(res.data.data.avatar_url);
          Taro.setStorageSync('avatar_url', res.data.data.avatar_url);
        }
      }
    } catch (e) {
      console.error('获取用户信息失败:', e);
    }
  }, []);

  const fetchStats = useCallback(async (uid: string) => {
    try {
      const res = await Network.request({ url: `/api/users/${uid}/stats` });
      console.log('[UserCenter] stats:', res.data);
      if (res.data?.code === 200 && res.data?.data) {
        setStats(res.data.data);
      }
    } catch (e) {
      console.error('获取用户统计失败:', e);
    }
  }, []);

  const fetchPermissions = useCallback(async (uid: string) => {
    try {
      const res = await Network.request({ url: `/api/users/${uid}/permissions` });
      console.log('[UserCenter] permissions:', res.data);
      if (res.data?.code === 200 && res.data?.data) {
        setPermissions(res.data.data);
      }
      // 拉取未读通知数
      const countRes = await Network.request({ url: `/api/notifications/unread-count?user_id=${uid}` });
      setUnreadCount((countRes.data as any)?.data?.count || 0);
    } catch (e) {
      console.error('获取用户权限失败:', e);
    }
  }, []);

  const fetchLotteryCount = useCallback(async (uid: string) => {
    try {
      const res = await Network.request({ url: `/api/lottery/user/${uid}` });
      console.log('[UserCenter] lottery records:', res.data);
      const records = (res.data as any)?.data;
      if (Array.isArray(records)) {
        const winners = records.filter((r: any) => r.is_winner);
        setLotteryCount(winners.length);
        setFreeMealCount(winners.filter((r: any) => r.prize_type === 'free_meal').length);
      }
    } catch (e) {
      console.error('获取抽奖记录失败:', e);
    }
  }, []);

  useEffect(() => {
    const savedUserId = Taro.getStorageSync('user_id');
    const savedNickName = Taro.getStorageSync('nick_name');
    const savedAvatar = Taro.getStorageSync('avatar_url');

    if (savedUserId) {
      setUserId(savedUserId);
      setNickName(savedNickName || '');
      setAvatarUrl(savedAvatar || '');
      // 登录/注册用户到后端
      Network.request({
        url: '/api/users/login',
        method: 'POST',
        // 不传 nick_name/avatar_url，避免本地旧缓存覆盖数据库最新资料
        data: { user_id: savedUserId }
      }).then((res) => {
        console.log('[UserCenter] login:', res.data);
        if (res.data?.code === 200 && res.data?.data) {
          setProfile(res.data.data);
        }
      }).catch((e) => console.error('用户登录失败:', e));

      Promise.all([fetchProfile(savedUserId), fetchStats(savedUserId), fetchPermissions(savedUserId), fetchLotteryCount(savedUserId)]).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [fetchProfile, fetchStats, fetchPermissions, fetchLotteryCount]);

  const handleLogin = () => {
    Taro.navigateTo({ url: '/pages/login/index' });
  };

  const goToOrderList = (status?: string) => {
    const url = status ? `/pages/order-list/index?status=${status}` : '/pages/order-list/index';
    Taro.navigateTo({ url });
  };

  const goToLotteryRecords = () => {
    Taro.navigateTo({ url: '/pages/lottery-records/index' });
  };

  const goToProfileEdit = () => {
    Taro.navigateTo({ url: '/pages/profile-edit/index' });
  };

  const roleLabelMap: Record<string, { label: string; color: string }> = {
    consumer: { label: '普通', color: 'bg-gray-100 text-gray-600' },
    merchant: { label: '商家', color: 'bg-amber-100 text-amber-700' },
    admin: { label: '系统', color: 'bg-red-100 text-red-600' }
  };

  const level = roleLabelMap[permissions?.role || 'consumer'] || roleLabelMap.consumer;

  const goToAdmin = () => {
    Taro.navigateTo({ url: '/pages/admin/index' });
  };

  const menuItems = [
    ...(permissions?.can_access_admin ? [{
      icon: <Store size={20} color="#6B7280" />,
      label: '管理后台',
      desc: permissions?.can_view_all_merchants ? '全平台数据管理' : '本店数据管理',
      onClick: goToAdmin
    }] : []),
    ...(permissions?.can_access_admin ? [{ icon: <Wallet size={20} color="#6B7280" />, label: "商家余额", desc: "查看余额、提现", onClick: goToMerchantBalance }] : []),
    {
      icon: <Bell size={20} color="#6B7280" />,
      label: '消息通知',
      desc: '订单、中奖、退款等提醒',
      badge: unreadCount,
      onClick: () => Taro.navigateTo({ url: '/pages/notification-center/index' })
    },
    {
      icon: <Trophy size={20} color="#6B7280" />,
      label: '中奖记录',
      desc: '历史中奖 & 未参与订单',
      onClick: goToLotteryRecords
    },
    {
      icon: <Pencil size={20} color="#6B7280" />,
      label: '编辑资料',
      desc: '昵称、头像、手机号',
      onClick: goToProfileEdit
    },
    {
      icon: <Phone size={20} color="#6B7280" />,
      label: '联系客服',
      desc: '在线客服咨询',
      onClick: () => Taro.showToast({ title: '客服功能即将上线', icon: 'none' })
    },
    {
      icon: <Settings size={20} color="#6B7280" />,
      label: '设置',
      desc: '隐私、通知、通用',
      onClick: () => Taro.showToast({ title: '设置功能即将上线', icon: 'none' })
    },
    {
      icon: <Info size={20} color="#6B7280" />,
      label: '关于我们',
      desc: '版本信息与协议',
      onClick: () => Taro.showToast({ title: '关于我们即将上线', icon: 'none' })
    }
  ];

  if (loading) {
    return (
      <View className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Text className="text-gray-400">加载中...</Text>
      </View>
    );
  }

  // 未登录状态
  if (!userId) {
    return (
      <View className="min-h-screen bg-gray-50">
        <View className="bg-gradient-to-br from-[#FF4757] to-[#ff6b7a] px-6 pb-12 flex flex-col items-center" style={{ paddingTop: getNavSafeAreaTop() + 16 }}>
          <View className="w-20 h-20 rounded-full bg-white bg-opacity-20 flex items-center justify-center mb-4">
            <User size={40} color="#FFFFFF" />
          </View>
          <Text className="text-white text-lg font-semibold block">未登录</Text>
          <Text className="text-white text-sm block mt-1" style={{ opacity: 0.7 }}>登录后享受更多会员权益</Text>
          <View
            className="mt-6 bg-white rounded-full px-8 py-3"
            onClick={handleLogin}
          >
            <Text className="text-[#FF4757] font-semibold">立即登录</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <>
    <ScrollView scrollY className="min-h-screen bg-gray-50">
      {/* 自定义导航栏（动态避让状态栏与胶囊按钮） */}
      <View className="bg-[#FF4757] flex items-center px-4 pb-3" style={{ paddingTop: getNavSafeAreaTop() }}>
        <Text className="block text-white text-lg font-semibold flex-1 text-center">个人中心</Text>
      </View>

      {/* 顶部用户区域 */}
      <View className="bg-[#FF4757] px-5 pt-6 pb-8">
        <View className="flex items-center">
          {/* 头像 */}
          <View className="mr-4" onClick={avatarUrl ? goToProfileEdit : handleLogin}>
            {avatarUrl ? (
              <Image
                src={avatarUrl}
                className="w-16 h-16 rounded-full border-2 border-white"
                mode="aspectFill"
              />
            ) : (
              <View className="w-16 h-16 rounded-full bg-white bg-opacity-20 border-2 border-white flex items-center justify-center">
                <User size={32} color="#FFFFFF" />
              </View>
            )}
          </View>

          {/* 用户信息 */}
          <View className="flex-1">
            <View className="flex items-center">
              <Text className="text-white text-lg font-bold">{nickName || '未设置昵称'}</Text>
              <Badge className={`ml-2 ${level.color} border-0 text-xs`}>
                {level.label}
              </Badge>
            </View>
            {profile?.phone && (
              <Text className="text-white text-sm block mt-1" style={{ opacity: 0.7 }}>{profile.phone}</Text>
            )}
            <View className="flex items-center mt-1">
              <Sparkles size={14} color="#FDE68A" />
              <Text className="text-amber-200 text-xs ml-1">积分：{profile?.points || 0}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* 订单统计 */}
      <View className="mx-4 -mt-4 bg-white rounded-2xl overflow-hidden shadow-sm">
        <View className="flex flex-row">
          <View className="flex-1 py-4 flex flex-col items-center" onClick={() => goToOrderList('created')}>
            <View className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center mb-2">
              <Wallet size={20} color="#FF4757" />
            </View>
            <Text className="text-lg font-bold text-gray-800 block">{stats?.unpaid_orders || 0}</Text>
            <Text className="text-xs text-gray-500 block">待支付</Text>
          </View>
          <View className="flex-1 py-4 flex flex-col items-center" onClick={() => goToOrderList('paid')}>
            <View className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center mb-2">
              <Ticket size={20} color="#F97316" />
            </View>
            <Text className="text-lg font-bold text-gray-800 block">{stats?.pending_orders || 0}</Text>
            <Text className="text-xs text-gray-500 block">待使用</Text>
          </View>
          <View className="flex-1 py-4 flex flex-col items-center" onClick={() => goToOrderList('used')}>
            <View className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center mb-2">
              <CircleCheck size={20} color="#22C55E" />
            </View>
            <Text className="text-lg font-bold text-gray-800 block">{stats?.used_orders || 0}</Text>
            <Text className="text-xs text-gray-500 block">已使用</Text>
          </View>
          <View className="flex-1 py-4 flex flex-col items-center" onClick={() => goToOrderList('refunded')}>
            <View className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center mb-2">
              <ShoppingBag size={20} color="#9CA3AF" />
            </View>
            <Text className="text-lg font-bold text-gray-800 block">{stats?.refunded_orders || 0}</Text>
            <Text className="text-xs text-gray-500 block">已退款</Text>
          </View>
          <View className="flex-1 py-4 flex flex-col items-center" onClick={() => goToOrderList()}>
            <View className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center mb-2">
              <ClipboardList size={20} color="#FF4757" />
            </View>
            <Text className="text-lg font-bold text-gray-800 block">{stats?.total_orders || 0}</Text>
            <Text className="text-xs text-gray-500 block">全部订单</Text>
          </View>
        </View>
      </View>

      {/* 消费数据 */}
      <View className="mx-4 mt-3 bg-white rounded-2xl overflow-hidden">
        <View className="flex flex-row">
          <View className="flex-1 py-4 flex flex-col items-center border-r border-gray-50" onClick={goToLotteryRecords}>
            <View className="flex items-center mb-1">
              <Trophy size={16} color="#F97316" />
              <Text className="text-xs text-gray-500 ml-1">抽奖记录</Text>
            </View>
            <Text className="text-xl font-bold text-gray-800 block">
              {lotteryCount}<Text className="text-sm"> 次中奖</Text>
            </Text>
          </View>
          <View className="flex-1 py-4 flex flex-col items-center" onClick={goToLotteryRecords}>
            <View className="flex items-center mb-1">
              <UtensilsCrossed size={16} color="#EF4444" />
              <Text className="text-xs text-gray-500 ml-1">累计中霸王餐</Text>
            </View>
            <Text className="text-xl font-bold text-red-500 block">
              {freeMealCount}<Text className="text-sm"> 次</Text>
            </Text>
          </View>
        </View>
      </View>

      {/* 功能菜单 */}
      <View className="mx-4 mt-3 bg-white rounded-2xl overflow-hidden">
        {menuItems.map((item, index) => (
          <View key={item.label}>
            <View
              className="flex items-center px-4 py-4 active:bg-gray-50"
              onClick={item.onClick}
            >
              <View className="mr-3">{item.icon}</View>
              <View className="flex-1">
                <View className="flex flex-row items-center">
                  <Text className="text-sm font-medium text-gray-800">{item.label}</Text>
                  {(item as any).badge > 0 && (
                    <View className="ml-2 px-1 h-4 min-w-4 rounded-full bg-[#FF4757] flex items-center justify-center">
                      <Text className="text-xs text-white">{(item as any).badge > 99 ? '99+' : (item as any).badge}</Text>
                    </View>
                  )}
                </View>
                <Text className="text-xs text-gray-400 block mt-1">{item.desc}</Text>
              </View>
              <ChevronRight size={18} color="#D1D5DB" />
            </View>
            {index < menuItems.length - 1 && <View className="h-px bg-gray-50 mx-4" />}
          </View>
        ))}
      </View>

      {/* 底部退出 */}
      <View className="mx-4 mt-4 mb-8">
        <View
          className="bg-white rounded-2xl py-3 flex items-center justify-center active:bg-gray-50"
          onClick={() => {
            Taro.showModal({
              title: '退出登录',
              content: '确定要退出当前账号吗？',
              success: (res) => {
                if (res.confirm) {
                  Taro.removeStorageSync('user_id');
                  Taro.removeStorageSync('nick_name');
                  Taro.removeStorageSync('avatar_url');
                  Taro.removeStorageSync('is_logged_in');
                  Taro.removeStorageSync('user_role');
                  Taro.removeStorageSync('role_code');
                  Taro.removeStorageSync('merchant_id');
                  // 直接跳转登录页，关闭所有页面避免停留在中间页
                  Taro.reLaunch({ url: '/pages/login/index' });
                }
              }
            });
          }}
        >
          <LogOut size={18} color="#EF4444" />
          <Text className="text-[#FF4757] text-sm font-medium ml-2">退出登录</Text>
        </View>
      </View>

      {/* 底部标语与版本信息 */}
      <View className="py-4 flex flex-col items-center justify-center">
        <Text className="block text-xs text-gray-400" style={{ letterSpacing: '2px' }}>- 给生活来点小惊喜 -</Text>
        <Text className="block text-xs text-gray-300 mt-1">膨胀团 v1.0.0</Text>
      </View>

      {/* 底部占位（避让悬浮 TabBar） */}
      <View className="h-28" />
    </ScrollView>

    {/* 悬浮胶囊导航栏 */}
    <AppTabBar current="/pages/user-center/index" />
    </>
  );
};

export default UserCenterPage;

// 商家余额入口
const goToMerchantBalance = () => {
  Taro.navigateTo({ url: '/pages/merchant-balance/index' });
};
