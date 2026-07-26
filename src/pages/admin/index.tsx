import { View, Text, Image, Picker } from '@tarojs/components'
import { useState, useEffect } from 'react';
import Taro, { useDidShow } from '@tarojs/taro';
import { Network } from '@/network';
import { Store, ScanLine, Package, Gift, Settings, TrendingUp, ShoppingBag, CircleCheck, Lock, Users, Coins, UtensilsCrossed, Trophy, User, CalendarDays, ClipboardList } from 'lucide-react-taro';

const AdminPage = () => {
  const [merchantStats, setMerchantStats] = useState({
    totalSales: 0, totalOrders: 0, totalRevenue: '0.00',
    verifiedAmount: '0.00', verifiedCount: 0, prizeCount: 0,
    todaySales: 0, todayOrders: 0, todayRevenue: '0.00',
    todayVerifiedAmount: '0.00', todayVerifiedCount: 0,
    todayLotteryUsers: 0, todayRefundAmount: '0.00', todayFreeMealWinners: 0
  });
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [merchantName, setMerchantName] = useState('');
  const [merchantLogo, setMerchantLogo] = useState('');
  const [roleCode, setRoleCode] = useState<number>(0);
  const [overviewStats, setOverviewStats] = useState({
    total_users: 0, consumers: 0, merchants: 0,
    packages_count: 0, prizes_count: 0, merchants_count: 0
  });
  const [timeFilter, setTimeFilter] = useState<'today' | 'week' | 'month' | 'custom'>('today');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

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
      // 获取门店名称和 logo
      try {
        const merchantRes = await Network.request({ url: `/api/users/${userId}/merchant` });
        const merchant = (merchantRes.data as any)?.data;
        if (merchant?.name) setMerchantName(merchant.name);
        if (merchant?.logo) setMerchantLogo(merchant.logo);
      } catch { /* 非商家用户忽略 */ }
    } catch (err) {
      console.error('[Admin] 权限检查失败:', err);
      setHasAccess(false);
    }
  };

  const fetchOverviewStats = async () => {
    try {
      const userId = Taro.getStorageSync('user_id') || Taro.getStorageSync('userInfo')?.user_id || '';
      let url = '/api/users/stats/overview';
      const params: string[] = [];
      if (userId) params.push(`user_id=${encodeURIComponent(userId)}`);

      if (timeFilter === 'today') {
        const today = new Date().toISOString().split('T')[0];
        params.push(`start_date=${today}`, `end_date=${today}`);
      } else if (timeFilter === 'week') {
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        params.push(`start_date=${weekAgo}`);
      } else if (timeFilter === 'month') {
        const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        params.push(`start_date=${monthAgo}`);
      } else if (timeFilter === 'custom' && customStartDate && customEndDate) {
        params.push(`start_date=${customStartDate}`, `end_date=${customEndDate}`);
      }

      if (params.length > 0) url += '?' + params.join('&');

      const res = await Network.request({ url, method: 'GET' });
      if (res.statusCode === 200) {
        setOverviewStats(res.data?.data || overviewStats);
      }
    } catch (error) {
      console.error('获取统计数据失败:', error);
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
    if (hasAccess) {
      fetchMerchantInfo();
      // 平台统计数据仅系统管理员可见，商家账号不请求
      if (roleCode === 2) fetchOverviewStats();
    }
  }, [hasAccess, roleCode, timeFilter, customStartDate, customEndDate]);

  useDidShow(() => {
    if (hasAccess) {
      fetchMerchantInfo();
      if (roleCode === 2) fetchOverviewStats();
    }
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
          className="bg-[#FF4757] rounded-full px-8 py-3"
          onClick={() => Taro.reLaunch({ url: '/pages/index/index' })}
        >
          <Text className="block text-white font-medium">返回首页</Text>
        </View>
      </View>
    );
  }

  return (
    <View className="min-h-screen bg-gray-100">
      {/* 红色渐变数据头部 */}
      <View className="bg-gradient-to-b from-[#FF4757] to-[#ff6b7a] px-4 pt-4 pb-8">
        {/* 店铺名 + 切换按钮 */}
        <View className="flex flex-row items-center justify-between mb-5">
          <View className="flex flex-row items-center gap-2">
            {merchantLogo ? (
              <Image src={merchantLogo} className="w-8 h-8 rounded-lg" mode="aspectFill" />
            ) : (
              <View className="w-8 h-8 bg-white bg-opacity-20 rounded-lg flex items-center justify-center">
                <Store size={18} color="#ffffff" />
              </View>
            )}
            <Text className="block text-white text-base font-semibold">
              {merchantName || '膨胀团'}
            </Text>
          </View>
          <View className="bg-white rounded-full px-3 py-1" onClick={() => Taro.navigateTo({ url: '/pages/user-center/index' })}>
            <Text className="block text-[#FF4757] text-xs">我的</Text>
          </View>
        </View>

        {/* 数据统计行 */}
        <View className="flex flex-row">
          <View className="flex-1">
            <Text className="block text-red-100 text-xs mb-1">核销金额</Text>
            <Text className="block text-white text-2xl font-bold">{merchantStats.todayVerifiedAmount}</Text>
            <Text className="block text-red-200 text-xs mt-1">累计{merchantStats.verifiedAmount}</Text>
          </View>
          <View className="flex-1">
            <Text className="block text-red-100 text-xs mb-1">核销券数</Text>
            <Text className="block text-white text-2xl font-bold">{merchantStats.todayVerifiedCount}</Text>
            <Text className="block text-red-200 text-xs mt-1">累计{merchantStats.verifiedCount}份</Text>
          </View>
          <View className="flex-1">
            <Text className="block text-red-100 text-xs mb-1">成交金额</Text>
            <Text className="block text-white text-2xl font-bold">{merchantStats.todayRevenue}</Text>
            <Text className="block text-red-200 text-xs mt-1">累计{merchantStats.totalRevenue}</Text>
          </View>
        </View>
      </View>

      {/* 功能图标网格 */}
      <View className="bg-white rounded-2xl mx-4 -mt-4 p-4 shadow-sm relative z-10">
        <View className="flex flex-row flex-wrap">
          {[
            { icon: 'clipboard', label: '订单明细', color: '#3b82f6', bg: '#eff6ff', page: '/pages/admin-orders/index', adminOnly: true },
            { icon: 'scan', label: '验券及退款', color: '#FF4757', bg: '#fef2f2', page: '/pages/verification/index', adminOnly: false, merchantOnly: true },
            { icon: 'package', label: '商品管理', color: '#8b5cf6', bg: '#f5f3ff', page: '/pages/product-manage/index', adminOnly: false },
            { icon: 'gift', label: '奖品管理', color: '#f59e0b', bg: '#fffbeb', page: '/pages/prize-manage/index', adminOnly: false },
            { icon: 'trophy', label: '抽奖记录', color: '#06b6d4', bg: '#ecfeff', page: '/pages/admin-lottery-records/index', adminOnly: false },
            { icon: 'store', label: '商家管理', color: '#10b981', bg: '#ecfdf5', page: '/pages/merchant-admin/index', adminOnly: true },
            { icon: 'settings', label: '抽奖设置', color: '#ec4899', bg: '#fdf2f8', page: '/pages/lottery-settings/index', adminOnly: true },
          ].filter(item => (!item.adminOnly || roleCode === 2) && (!('merchantOnly' in item) || !item.merchantOnly || roleCode === 1)).map((item, _, arr) => (
            <View
              key={item.label}
              className="flex flex-col items-center py-2"
              style={{ width: `${100 / arr.length}%` }}
              onClick={() => Taro.navigateTo({ url: item.page })}
            >
              <View className="w-12 h-12 rounded-xl flex items-center justify-center mb-2" style={{ backgroundColor: item.bg }}>
                {item.icon === 'scan' && <ScanLine size={22} color={item.color} />}
                {item.icon === 'clipboard' && <ClipboardList size={22} color={item.color} />}
                {item.icon === 'package' && <Package size={22} color={item.color} />}
                {item.icon === 'gift' && <Gift size={22} color={item.color} />}
                {item.icon === 'trophy' && <Trophy size={22} color={item.color} />}
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
          <Text className="block text-xs text-gray-400">
            {roleCode === 2
              ? (timeFilter === 'today' ? '今日' : timeFilter === 'week' ? '近7天' : timeFilter === 'month' ? '近30天' : '自定义')
              : '今日'}
          </Text>
        </View>

        {/* 时间筛选器（仅系统管理员可见，用于筛选平台统计数据） */}
        {roleCode === 2 && (
        <View className="flex flex-row gap-2 mb-3">
          <View className="flex-1">
            <View
              className={`rounded-lg py-2 text-center ${timeFilter === 'today' ? 'bg-[#FF4757]' : 'bg-gray-100'}`}
              onClick={() => setTimeFilter('today')}
            >
              <Text className={`text-xs ${timeFilter === 'today' ? 'text-white' : 'text-gray-600'}`}>今日</Text>
            </View>
          </View>
          <View className="flex-1">
            <View
              className={`rounded-lg py-2 text-center ${timeFilter === 'week' ? 'bg-[#FF4757]' : 'bg-gray-100'}`}
              onClick={() => setTimeFilter('week')}
            >
              <Text className={`text-xs ${timeFilter === 'week' ? 'text-white' : 'text-gray-600'}`}>近7天</Text>
            </View>
          </View>
          <View className="flex-1">
            <View
              className={`rounded-lg py-2 text-center ${timeFilter === 'month' ? 'bg-[#FF4757]' : 'bg-gray-100'}`}
              onClick={() => setTimeFilter('month')}
            >
              <Text className={`text-xs ${timeFilter === 'month' ? 'text-white' : 'text-gray-600'}`}>近30天</Text>
            </View>
          </View>
          <View className="flex-1">
            <View
              className={`rounded-lg py-2 text-center ${timeFilter === 'custom' ? 'bg-[#FF4757]' : 'bg-gray-100'}`}
              onClick={() => setTimeFilter('custom')}
            >
              <Text className={`text-xs ${timeFilter === 'custom' ? 'text-white' : 'text-gray-600'}`}>自定义</Text>
            </View>
          </View>
        </View>
        )}

        {/* 自定义时间选择（日历选择器，仅系统管理员可见） */}
        {roleCode === 2 && timeFilter === 'custom' && (
          <View className="flex flex-row gap-2 mb-3">
            <View className="flex-1">
              <Picker
                mode="date"
                value={customStartDate}
                end={customEndDate || undefined}
                onChange={(e) => setCustomStartDate(e.detail.value)}
              >
                <View className="bg-gray-50 rounded-xl px-3 py-2 flex flex-row items-center gap-2">
                  <CalendarDays size={14} color="#6b7280" />
                  <Text className={`text-xs ${customStartDate ? 'text-gray-800' : 'text-gray-400'}`}>
                    {customStartDate || '开始日期'}
                  </Text>
                </View>
              </Picker>
            </View>
            <View className="flex-1">
              <Picker
                mode="date"
                value={customEndDate}
                start={customStartDate || undefined}
                onChange={(e) => setCustomEndDate(e.detail.value)}
              >
                <View className="bg-gray-50 rounded-xl px-3 py-2 flex flex-row items-center gap-2">
                  <CalendarDays size={14} color="#6b7280" />
                  <Text className={`text-xs ${customEndDate ? 'text-gray-800' : 'text-gray-400'}`}>
                    {customEndDate || '结束日期'}
                  </Text>
                </View>
              </Picker>
            </View>
          </View>
        )}

        <View className="flex flex-row gap-3">
          <View className="flex-1 bg-red-50 rounded-xl p-3">
            <View className="flex flex-row items-center gap-2 mb-1">
              <TrendingUp size={14} color="#f97316" />
              <Text className="block text-xs text-[#FF4757]">销售金额</Text>
            </View>
            <Text className="block text-lg font-bold text-[#FF4757]">{merchantStats.todayRevenue}</Text>
            <Text className="block text-xs text-red-300 mt-1">{merchantStats.todayOrders}笔订单</Text>
          </View>
          <View className="flex-1 bg-red-50 rounded-xl p-3">
            <View className="flex flex-row items-center gap-2 mb-1">
              <ShoppingBag size={14} color="#FF4757" />
              <Text className="block text-xs text-[#FF4757]">销售份数</Text>
            </View>
            <Text className="block text-lg font-bold text-[#FF4757]">{merchantStats.todaySales}</Text>
            <Text className="block text-xs text-red-300 mt-1">份</Text>
          </View>
          <View className="flex-1 bg-green-50 rounded-xl p-3">
            <View className="flex flex-row items-center gap-2 mb-1">
              <CircleCheck size={14} color="#22c55e" />
              <Text className="block text-xs text-green-600">核销金额</Text>
            </View>
            <Text className="block text-lg font-bold text-green-600">{merchantStats.todayVerifiedAmount}</Text>
            <Text className="block text-xs text-green-400 mt-1">{merchantStats.todayVerifiedCount}份</Text>
          </View>
        </View>
        {/* 第二行：抽奖数据 */}
        <View className="flex flex-row gap-3 mt-3">
          <View className="flex-1 bg-purple-50 rounded-xl p-3">
            <View className="flex flex-row items-center gap-2 mb-1">
              <Users size={14} color="#8b5cf6" />
              <Text className="block text-xs text-purple-600">今日抽奖人数</Text>
            </View>
            <Text className="block text-lg font-bold text-purple-600">{merchantStats.todayLotteryUsers}</Text>
            <Text className="block text-xs text-purple-300 mt-1">人</Text>
          </View>
          <View className="flex-1 bg-amber-50 rounded-xl p-3">
            <View className="flex flex-row items-center gap-2 mb-1">
              <Coins size={14} color="#f59e0b" />
              <Text className="block text-xs text-amber-600">今日返还金额</Text>
            </View>
            <Text className="block text-lg font-bold text-amber-600">{merchantStats.todayRefundAmount}</Text>
            <Text className="block text-xs text-amber-400 mt-1">元</Text>
          </View>
          <View className="flex-1 bg-orange-50 rounded-xl p-3">
            <View className="flex flex-row items-center gap-2 mb-1">
              <UtensilsCrossed size={14} color="#f97316" />
              <Text className="block text-xs text-orange-600">霸王餐中奖</Text>
            </View>
            <Text className="block text-lg font-bold text-orange-600">{merchantStats.todayFreeMealWinners}</Text>
            <Text className="block text-xs text-orange-300 mt-1">人</Text>
          </View>
        </View>

        {/* 第三行：平台统计数据（仅系统管理员可见） */}
        {roleCode === 2 && (
        <View className="flex flex-row gap-3 mt-3">
          <View className="flex-1 bg-blue-50 rounded-xl p-3">
            <View className="flex flex-row items-center gap-2 mb-1">
              <Users size={14} color="#3b82f6" />
              <Text className="block text-xs text-blue-600">注册用户</Text>
            </View>
            <Text className="block text-lg font-bold text-blue-600">{overviewStats.total_users}</Text>
            <Text className="block text-xs text-blue-300 mt-1">人</Text>
          </View>
          <View className="flex-1 bg-green-50 rounded-xl p-3">
            <View className="flex flex-row items-center gap-2 mb-1">
              <User size={14} color="#22c55e" />
              <Text className="block text-xs text-green-600">普通用户</Text>
            </View>
            <Text className="block text-lg font-bold text-green-600">{overviewStats.consumers}</Text>
            <Text className="block text-xs text-green-300 mt-1">人</Text>
          </View>
          <View className="flex-1 bg-amber-50 rounded-xl p-3">
            <View className="flex flex-row items-center gap-2 mb-1">
              <Store size={14} color="#f59e0b" />
              <Text className="block text-xs text-amber-600">商家用户</Text>
            </View>
            <Text className="block text-lg font-bold text-amber-600">{overviewStats.merchants}</Text>
            <Text className="block text-xs text-amber-300 mt-1">人</Text>
          </View>
        </View>
        )}

        {/* 第四行：新建统计（仅系统管理员可见） */}
        {roleCode === 2 && (
        <View className="flex flex-row gap-3 mt-3">
          <View className="flex-1 bg-purple-50 rounded-xl p-3">
            <View className="flex flex-row items-center gap-2 mb-1">
              <Package size={14} color="#8b5cf6" />
              <Text className="block text-xs text-purple-600">新建套餐</Text>
            </View>
            <Text className="block text-lg font-bold text-purple-600">{overviewStats.packages_count}</Text>
            <Text className="block text-xs text-purple-300 mt-1">个</Text>
          </View>
          <View className="flex-1 bg-rose-50 rounded-xl p-3">
            <View className="flex flex-row items-center gap-2 mb-1">
              <Gift size={14} color="#f43f5e" />
              <Text className="block text-xs text-rose-600">新建奖品</Text>
            </View>
            <Text className="block text-lg font-bold text-rose-600">{overviewStats.prizes_count}</Text>
            <Text className="block text-xs text-rose-300 mt-1">个</Text>
          </View>
          <View className="flex-1 bg-indigo-50 rounded-xl p-3">
            <View className="flex flex-row items-center gap-2 mb-1">
              <Store size={14} color="#6366f1" />
              <Text className="block text-xs text-indigo-600">新建门店</Text>
            </View>
            <Text className="block text-lg font-bold text-indigo-600">{overviewStats.merchants_count}</Text>
            <Text className="block text-xs text-indigo-300 mt-1">个</Text>
          </View>
        </View>
        )}
      </View>

      {/* 底部留白与标语 */}
      <View className="flex flex-col items-center justify-center py-10">
        <Text className="block text-xs text-gray-300 tracking-widest">- 给生活来点小惊喜 -</Text>
      </View>
    </View>
  );
};

export default AdminPage;
