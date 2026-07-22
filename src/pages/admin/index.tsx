import { View, Text } from '@tarojs/components';
import { useState, useEffect } from 'react';
import Taro, { useDidShow } from '@tarojs/taro';
import { Network } from '@/network';
import { Store, ScanLine, Package, Gift, Settings, TrendingUp, ShoppingBag, CircleCheck, Lock } from 'lucide-react-taro';

const AdminPage = () => {
  const [merchantStats, setMerchantStats] = useState({
    totalSales: 0, totalOrders: 0, totalRevenue: '0.00',
    verifiedAmount: '0.00', verifiedCount: 0, prizeCount: 0,
    todaySales: 0, todayOrders: 0, todayRevenue: '0.00',
    todayVerifiedAmount: '0.00', todayVerifiedCount: 0
  });
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [merchantName, setMerchantName] = useState('');
  const [roleCode, setRoleCode] = useState<number>(0);

  const checkPermission = async () => {
    try {
      const userId = Taro.getStorageSync('user_id') || Taro.getStorageSync('userInfo')?.user_id || '';
      if (!userId) {
        setHasAccess(false);
        return;
      }
      const res = await Network.request({ url: `/api/users/${userId}/permissions` });
      const perms = (res.data as any)?.data;
      if (!perms || !perms.can_access_admin) {
        setHasAccess(false);
        return;
      }
      setRoleCode(perms.role_code ?? 0);
      setHasAccess(true);
      // 获取门店名称
      try {
        const merchantRes = await Network.request({ url: `/api/users/${userId}/merchant` });
        const merchant = (merchantRes.data as any)?.data;
        if (merchant?.name) setMerchantName(merchant.name);
      } catch { /* 非商家用户忽略 */ }
    } catch (err) {
      console.error('[Admin] 权限检查失败:', err);
      setHasAccess(false);
    }
  };

  const fetchMerchantInfo = async () => {
    try {
      const userId = Taro.getStorageSync('user_id') || Taro.getStorageSync('userInfo')?.user_id || '';
      if (!userId) return;
      const statsRes = await Network.request({ url: `/api/users/${userId}/merchant-stats` });
      const envelope = (statsRes as any)?.data || statsRes;
      const statsData = envelope?.data || envelope;
      if (statsData && typeof statsData === 'object' && 'totalSales' in statsData) {
        setMerchantStats(statsData);
      }
    } catch (e) {
      console.error('[fetchMerchantInfo] 获取商家统计失败:', e);
    }
  };

  useEffect(() => {
    checkPermission();
  }, []);

  useEffect(() => {
    if (hasAccess) fetchMerchantInfo();
  }, [hasAccess]);

  useDidShow(() => {
    if (hasAccess) fetchMerchantInfo();
  });

  // 权限未确认时显示加载
  if (hasAccess === null) {
    return (
      <View className="min-h-screen bg-gray-100 flex items-center justify-center">
        <Text className="block text-gray-400">加载中...</Text>
      </View>
    );
  }

  // 无权限访问
  if (!hasAccess) {
    return (
      <View className="min-h-screen bg-gray-100 flex flex-col items-center justify-center px-8">
        <View className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mb-4">
          <Lock size={28} color="#9CA3AF" />
        </View>
        <Text className="block text-gray-800 text-lg font-semibold mb-2">无权限访问</Text>
        <Text className="block text-gray-500 text-sm text-center mb-6">该功能仅对商家用户开放{'\n'}请使用商家管理员账号登录</Text>
        <View
          className="bg-blue-500 rounded-full px-8 py-3"
          onClick={() => Taro.reLaunch({ url: '/pages/index/index' })}
        >
          <Text className="block text-white font-medium">返回首页</Text>
        </View>
      </View>
    );
  }

  return (
    <View className="min-h-screen bg-gray-100">
      {/* 蓝色渐变头部 */}
      <View className="bg-gradient-to-b from-blue-500 to-blue-400 px-4 pt-4 pb-8">
        {/* 店铺名 + 切换按钮 */}
        <View className="flex flex-row items-center justify-between mb-5">
          <View className="flex flex-row items-center gap-2">
            <View className="w-8 h-8 bg-white bg-opacity-20 rounded-lg flex items-center justify-center">
              <Store size={18} color="#ffffff" />
            </View>
            <Text className="block text-white text-base font-semibold">
              {merchantName ? `${merchantName} · 管理后台` : '膨胀团 · 管理后台'}
            </Text>
          </View>
          <View className="bg-white bg-opacity-20 rounded-full px-3 py-2" onClick={() => Taro.navigateTo({ url: '/pages/index/index' })}>
            <Text className="block text-white text-xs">去店员版 ›</Text>
          </View>
        </View>

        {/* 数据统计行 */}
        <View className="flex flex-row">
          <View className="flex-1">
            <Text className="block text-blue-100 text-xs mb-1">核销金额</Text>
            <Text className="block text-white text-2xl font-bold">{merchantStats.todayVerifiedAmount}</Text>
            <Text className="block text-blue-200 text-xs mt-1">累计{merchantStats.verifiedAmount}</Text>
          </View>
          <View className="flex-1">
            <Text className="block text-blue-100 text-xs mb-1">核销券数</Text>
            <Text className="block text-white text-2xl font-bold">{merchantStats.todayVerifiedCount}</Text>
            <Text className="block text-blue-200 text-xs mt-1">累计{merchantStats.verifiedCount}份</Text>
          </View>
          <View className="flex-1">
            <Text className="block text-blue-100 text-xs mb-1">成交金额</Text>
            <Text className="block text-white text-2xl font-bold">{merchantStats.todayRevenue}</Text>
            <Text className="block text-blue-200 text-xs mt-1">累计{merchantStats.totalRevenue}</Text>
          </View>
        </View>
      </View>

      {/* 功能图标网格 */}
      <View className="bg-white rounded-2xl mx-4 -mt-4 p-4 shadow-sm relative z-10">
        <View className="flex flex-row flex-wrap">
          {[
            { icon: 'scan', label: '验券及退款', color: '#3b82f6', bg: '#eff6ff', page: '/pages/verification/index', adminOnly: false },
            { icon: 'package', label: '商品管理', color: '#8b5cf6', bg: '#f5f3ff', page: '/pages/product-manage/index', adminOnly: false },
            { icon: 'gift', label: '奖品管理', color: '#f59e0b', bg: '#fffbeb', page: '/pages/prize-manage/index', adminOnly: false },
            { icon: 'store', label: '商家管理', color: '#10b981', bg: '#ecfdf5', page: '/pages/merchant-admin/index', adminOnly: true },
            { icon: 'settings', label: '抽奖设置', color: '#ec4899', bg: '#fdf2f8', page: '/pages/lottery-settings/index', adminOnly: true },
          ].filter(item => !item.adminOnly || roleCode === 2).map((item, _, arr) => (
            <View
              key={item.label}
              className="flex flex-col items-center py-2"
              style={{ width: `${100 / arr.length}%` }}
              onClick={() => Taro.navigateTo({ url: item.page })}
            >
              <View className="w-12 h-12 rounded-xl flex items-center justify-center mb-2" style={{ backgroundColor: item.bg }}>
                {item.icon === 'scan' && <ScanLine size={22} color={item.color} />}
                {item.icon === 'package' && <Package size={22} color={item.color} />}
                {item.icon === 'gift' && <Gift size={22} color={item.color} />}
                {item.icon === 'store' && <Store size={22} color={item.color} />}
                {item.icon === 'settings' && <Settings size={22} color={item.color} />}
              </View>
              <Text className="block text-xs text-gray-600 text-center">{item.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* 经营概况卡片 */}
      <View className="bg-white rounded-2xl mx-4 mt-3 p-4 shadow-sm">
        <View className="flex flex-row items-center justify-between mb-3">
          <Text className="block text-base font-semibold text-gray-800">经营概况</Text>
          <Text className="block text-xs text-gray-400">今日</Text>
        </View>
        <View className="flex flex-row gap-3">
          <View className="flex-1 bg-orange-50 rounded-xl p-3">
            <View className="flex flex-row items-center gap-2 mb-1">
              <TrendingUp size={14} color="#f97316" />
              <Text className="block text-xs text-orange-600">今日售额</Text>
            </View>
            <Text className="block text-lg font-bold text-orange-600">{merchantStats.todayRevenue}</Text>
            <Text className="block text-xs text-orange-400 mt-1">{merchantStats.todayOrders}笔订单</Text>
          </View>
          <View className="flex-1 bg-blue-50 rounded-xl p-3">
            <View className="flex flex-row items-center gap-2 mb-1">
              <ShoppingBag size={14} color="#3b82f6" />
              <Text className="block text-xs text-blue-600">今日销量</Text>
            </View>
            <Text className="block text-lg font-bold text-blue-600">{merchantStats.todaySales}</Text>
            <Text className="block text-xs text-blue-400 mt-1">份</Text>
          </View>
          <View className="flex-1 bg-green-50 rounded-xl p-3">
            <View className="flex flex-row items-center gap-2 mb-1">
              <CircleCheck size={14} color="#22c55e" />
              <Text className="block text-xs text-green-600">今日核销</Text>
            </View>
            <Text className="block text-lg font-bold text-green-600">{merchantStats.todayVerifiedAmount}</Text>
            <Text className="block text-xs text-green-400 mt-1">{merchantStats.todayVerifiedCount}份</Text>
          </View>
        </View>
      </View>
    </View>
  );
};

export default AdminPage;
