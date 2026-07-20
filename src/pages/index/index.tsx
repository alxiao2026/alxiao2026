import { View, Text, Image, ScrollView } from '@tarojs/components';
import { useState, useEffect, useCallback } from 'react';
import Taro, { useShareAppMessage } from '@tarojs/taro';
import { Network } from '@/network';
import {
  Gift, Share2, ShoppingBag, LogIn, LayoutDashboard, User,
  MapPin, ChevronRight, Clock, Flame, Award
} from 'lucide-react-taro';
import LotteryAnimation from './components/lottery-animation';
import './index.css';

interface Prize {
  id: string;
  name: string;
  description: string | null;
  probability: string;
  image_url: string | null;
  stock: number;
  is_active: boolean;
}

interface Package {
  id: string;
  name: string;
  description: string | null;
  price: string;
  original_price: string | null;
  badge: string | null;
  features: string | null;
  is_active: boolean;
  sale_start_date: string | null;
  sale_end_date: string | null;
  auto_renew: boolean;
  cover_image: string | null;
  sales_count: number;
}

interface Order {
  id: string;
  user_id: string;
  nick_name: string | null;
  package_name: string;
  price: string;
  status: string;
  shared: boolean;
  created_at: string;
  quantity: number;
  order_no: string;
}

interface LotteryResult {
  is_winner: boolean;
  prize: Prize | null;
  record: {
    id: string;
    prize_name: string | null;
    is_winner: boolean;
  };
}

const LOGO_URL = 'https://coze-coding-project.tos.coze.site/coze_storage_7662281810482692131/logo_new_pengtuan_2d6e000c.png?sign=1786611400-ab636b32a4-0-481e336cec57d85a4be349e1365bbc63d2a048d78e79de1c43bc7c0cc8dbdea9';

const DEFAULT_COVER = 'https://coze-coding-project.tos.coze.site/coze_storage_7662281810482692131/logo_new_pengtuan_2d6e000c.png?sign=1786611400-ab636b32a4-0-481e336cec57d85a4be349e1365bbc63d2a048d78e79de1c43bc7c0cc8dbdea9';

const IndexPage = () => {
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [userId, setUserId] = useState<string>('');
  const [nickName, setNickName] = useState<string>('游客');
  const [avatarUrl, setAvatarUrl] = useState<string>('');
  const [orders, setOrders] = useState<Order[]>([]);
  const [lotteryResult, setLotteryResult] = useState<LotteryResult | null>(null);
  const [showLottery, setShowLottery] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'hot' | 'new'>('all');

  // 读取缓存用户ID
  useEffect(() => {
    const savedUserId = Taro.getStorageSync('user_id');
    const savedNickName = Taro.getStorageSync('nick_name');
    const savedAvatar = Taro.getStorageSync('avatar_url');
    if (savedUserId) {
      setUserId(savedUserId);
      if (savedNickName) setNickName(savedNickName);
      if (savedAvatar) setAvatarUrl(savedAvatar);
    } else {
      const newId = `user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      Taro.setStorageSync('user_id', newId);
      setUserId(newId);
    }
  }, []);

  // 获取数据
  useEffect(() => {
    if (!userId) return;
    fetchPrizes();
    fetchPackages();
    fetchOrders();
  }, [userId]);

  const fetchPrizes = async () => {
    try {
      const res = await Network.request({ url: '/api/prizes/active' });
      const data = (res.data as any)?.data || (res.data as Prize[]) || [];
      setPrizes(data);
    } catch (err) {
      console.error('获取奖品失败:', err);
    }
  };

  const fetchPackages = async () => {
    try {
      const res = await Network.request({ url: '/api/packages/active' });
      const data = (res.data as any)?.data || (res.data as Package[]) || [];
      setPackages(data);
    } catch (err) {
      console.error('获取套餐失败:', err);
    }
  };

  const fetchOrders = async () => {
    try {
      const res = await Network.request({ url: `/api/orders/user/${userId}` });
      const data = (res.data as any)?.data || (res.data as Order[]) || [];
      setOrders(data);
    } catch (err) {
      console.error('获取订单失败:', err);
    }
  };

  // 分享
  const handleShare = useCallback(async (orderId: string) => {
    try {
      await Network.request({
        url: `/api/orders/${orderId}/share`,
        method: 'POST',
      });
      const env = Taro.getEnv();
      const isMiniApp = env === Taro.ENV_TYPE.WEAPP || env === Taro.ENV_TYPE.TT;
      if (isMiniApp) {
        Taro.showShareMenu({
          withShareTicket: true,
          success: () => {
            Taro.showToast({ title: '分享成功！现在可以开奖了', icon: 'success' });
            fetchOrders();
          },
        });
      } else {
        Taro.showToast({ title: '分享成功！现在可以开奖了', icon: 'success' });
        fetchOrders();
      }
    } catch (err) {
      console.error('分享失败:', err);
    }
  }, []);

  // 微信登录获取用户信息
  const handleLogin = async () => {
    try {
      const res = await Taro.getUserProfile({ desc: '用于展示用户信息', lang: 'zh_CN' });
      const { nickName: name, avatarUrl: avatar } = res.userInfo;
      setNickName(name);
      setAvatarUrl(avatar);
      Taro.setStorageSync('nick_name', name);
      Taro.setStorageSync('avatar_url', avatar);
    } catch (err) {
      console.log('用户取消授权:', err);
    }
  };

  // 设置分享
  useShareAppMessage(() => {
    return {
      title: '膨胀团！下单套餐，分享好友抽大奖！',
      path: '/pages/index/index',
    };
  });

  // 抽奖
  const handleDraw = async (orderId: string) => {
    if (drawing) return;
    setDrawing(true);
    try {
      const res = await Network.request({
        url: '/api/lottery/draw',
        method: 'POST',
        data: { order_id: orderId, user_id: userId },
      });
      const result = (res.data as any)?.data || res.data;
      setLotteryResult(result as LotteryResult);
      setShowLottery(true);
      fetchOrders();
    } catch (err: any) {
      const msg = (err as any)?.message || '抽奖失败';
      Taro.showToast({ title: msg, icon: 'none' });
    } finally {
      setDrawing(false);
    }
  };

  const parseFeatures = (features: string | null): string[] => {
    if (!features) return [];
    try {
      return JSON.parse(features);
    } catch {
      return features.split('\n').filter(Boolean);
    }
  };

  const formatPrice = (price: string): string => {
    const num = parseFloat(price);
    return Number.isNaN(num) ? price : num.toFixed(0);
  };

  const getFilteredPackages = () => {
    if (activeTab === 'hot') return packages.filter(p => (p.sales_count || 0) > 0);
    if (activeTab === 'new') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return packages.filter(p => {
        if (!p.sale_start_date) return false;
        const start = new Date(p.sale_start_date);
        return start >= today;
      });
    }
    return packages;
  };

  const filteredPackages = getFilteredPackages();

  return (
    <View className="min-h-screen bg-gray-50">
      <ScrollView className="flex-1" scrollY>
        {/* ===== 顶部渐变头部 ===== */}
        <View className="bg-gradient-to-b from-red-500 via-red-400 to-orange-300 px-4 pt-10 pb-16">
          {/* 第一行：Logo + 右侧入口 */}
          <View className="flex flex-row items-center justify-between mb-5">
            <View className="flex flex-row items-center gap-2">
              <Image src={LOGO_URL} className="w-9 h-9 rounded-lg" mode="aspectFit" />
              <Text className="block text-lg font-bold text-white">膨胀团</Text>
            </View>
            <View className="flex flex-row items-center gap-2">
              <View
                className="flex flex-row items-center gap-1 bg-white bg-opacity-20 rounded-full px-3 py-1"
                onClick={() => Taro.navigateTo({ url: '/pages/admin/index' })}
              >
                <LayoutDashboard size={13} color="#fff" />
                <Text className="block text-xs text-white">管理</Text>
              </View>
              <View
                className="flex flex-row items-center gap-1 bg-white rounded-full px-3 py-1"
                onClick={() => Taro.navigateTo({ url: '/pages/user-center/index' })}
              >
                <User size={13} color="#ff6a00" />
                <Text className="block text-xs font-medium" style={{ color: '#ff6a00' }}>我的</Text>
              </View>
            </View>
          </View>

          {/* 第二行：用户信息 */}
          <View
            className="flex flex-row items-center gap-3"
            onClick={() => {
              if (avatarUrl) {
                Taro.navigateTo({ url: '/pages/user-center/index' });
              } else {
                handleLogin();
              }
            }}
          >
            {avatarUrl ? (
              <Image src={avatarUrl} className="w-12 h-12 rounded-full border-2 border-white" mode="aspectFill" />
            ) : (
              <View className="w-12 h-12 rounded-full bg-white bg-opacity-20 flex items-center justify-center border-2 border-white border-opacity-40">
                <LogIn size={20} color="#fff" />
              </View>
            )}
            <View className="flex-1">
              <Text className="block text-base font-semibold text-white">{nickName}</Text>
              {!avatarUrl ? (
                <Text className="block text-xs text-white" style={{ opacity: 0.7 }}>点击登录，享受更多优惠</Text>
              ) : (
                <View className="flex flex-row items-center gap-1 mt-1">
                  <MapPin size={11} color="#fff" />
                  <Text className="block text-xs text-white" style={{ opacity: 0.8 }}>本地生活 · 优惠团购</Text>
                </View>
              )}
            </View>
            <ChevronRight size={18} color="#fff" />
          </View>
        </View>

        {/* ===== 奖品横幅（悬浮卡片） ===== */}
        {prizes.length > 0 && (
          <View className="px-4 -mt-8">
            <View className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <View className="bg-gradient-to-r from-red-500 to-orange-400 px-4 py-3">
                <View className="flex flex-row items-center gap-2">
                  <Gift size={18} color="#fff" />
                  <Text className="block text-sm font-bold text-white">本期奖品</Text>
                  <Text className="block text-xs text-white ml-auto" style={{ opacity: 0.8 }}>下单即可参与抽奖</Text>
                </View>
              </View>
              <View className="flex flex-row overflow-x-auto px-3 py-3 gap-3">
                {prizes.map((prize, index) => (
                  <View key={prize.id} className="flex-shrink-0 flex flex-col items-center w-20">
                    <View
                      className={`w-12 h-12 rounded-full flex items-center justify-center mb-1 ${
                        index === 0 ? 'bg-red-50' : index === 1 ? 'bg-orange-50' : 'bg-blue-50'
                      }`}
                    >
                      {prize.image_url ? (
                        <Image src={prize.image_url} className="w-10 h-10 rounded-full" mode="aspectFill" />
                      ) : (
                        <Award
                          size={22}
                          color={index === 0 ? '#FF4757' : index === 1 ? '#FFA502' : '#1890ff'}
                        />
                      )}
                    </View>
                    <Text className="block text-xs text-gray-700 text-center" numberOfLines={1}>{prize.name}</Text>
                    <Text className="block text-xs text-red-500 font-semibold mt-1">剩余{prize.stock}份</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        )}

        {/* ===== 分类标签栏 ===== */}
        <View className="px-4 mt-5">
          <View className="flex flex-row gap-4">
            {([
              { key: 'all', label: '全部' },
              { key: 'hot', label: '热销' },
              { key: 'new', label: '新品' },
            ] as const).map((tab) => (
              <View
                key={tab.key}
                className={`px-4 py-2 rounded-full ${
                  activeTab === tab.key
                    ? 'bg-red-500'
                    : 'bg-white'
                }`}
                onClick={() => setActiveTab(tab.key)}
              >
                <Text
                  className={`block text-sm font-medium ${
                    activeTab === tab.key ? 'text-white' : 'text-gray-600'
                  }`}
                >
                  {tab.label}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* ===== 套餐列表 ===== */}
        <View className="px-4 mt-4">
          {filteredPackages.length === 0 ? (
            <View className="bg-white rounded-2xl py-10 flex items-center justify-center">
              <Text className="block text-sm text-gray-400">暂无活动套餐</Text>
            </View>
          ) : (
            filteredPackages.map((pkg) => {
              const features = parseFeatures(pkg.features);
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const startDate = pkg.sale_start_date ? new Date(pkg.sale_start_date) : null;
              const isPresale = startDate && startDate > today;

              return (
                <View
                  key={pkg.id}
                  className="bg-white rounded-2xl mb-3 overflow-hidden shadow-sm"
                  onClick={() => Taro.navigateTo({ url: `/pages/package-detail/index?id=${pkg.id}` })}
                >
                  {/* 上半部分：封面图 + 信息 */}
                  <View className="flex flex-row">
                    {/* 封面图 */}
                    <View className="w-28 h-28 flex-shrink-0 relative">
                      <Image
                        src={pkg.cover_image || DEFAULT_COVER}
                        className="w-full h-full"
                        mode="aspectFill"
                      />
                      {isPresale && (
                        <View className="absolute top-0 left-0 bg-orange-500 rounded-br-lg px-2 py-1">
                          <Text className="block text-xs text-white font-medium">预售</Text>
                        </View>
                      )}
                      {pkg.badge && (
                        <View className="absolute top-0 left-0 bg-red-500 rounded-br-lg px-2 py-1">
                          <Text className="block text-xs text-white font-medium">{pkg.badge}</Text>
                        </View>
                      )}
                    </View>

                    {/* 右侧信息 */}
                    <View className="flex-1 px-3 py-2 flex flex-col justify-between">
                      <View>
                        <Text className="block text-sm font-bold text-gray-800" numberOfLines={2}>{pkg.name}</Text>
                        {pkg.description && (
                          <Text className="block text-xs text-gray-400 mt-1" numberOfLines={1}>{pkg.description}</Text>
                        )}
                      </View>

                      {/* 特性标签 */}
                      {features.length > 0 && (
                        <View className="flex flex-row flex-wrap gap-1 mt-1">
                          {features.slice(0, 2).map((f, i) => (
                            <View key={i} className="bg-orange-50 rounded px-1 py-0">
                              <Text className="block text-xs text-orange-600">{f}</Text>
                            </View>
                          ))}
                        </View>
                      )}

                      {/* 价格行 */}
                      <View className="flex flex-row items-end justify-between mt-2">
                        <View className="flex flex-row items-baseline gap-1">
                          <Text className="block text-xs text-red-500 font-bold">¥</Text>
                          <Text className="block text-xl font-bold text-red-500">{formatPrice(pkg.price)}</Text>
                          {pkg.original_price && (
                            <Text className="block text-xs text-gray-300 line-through ml-1">¥{formatPrice(pkg.original_price)}</Text>
                          )}
                        </View>
                        <View className="flex flex-row items-center gap-1">
                          <Flame size={12} color="#FF6B35" />
                          <Text className="block text-xs text-gray-400">已售{pkg.sales_count || 0}</Text>
                        </View>
                      </View>
                    </View>
                  </View>

                  {/* 底部购买栏 */}
                  <View className="flex flex-row items-center justify-between border-t border-gray-50 px-3 py-2">
                    <View className="flex flex-row items-center gap-1">
                      <Clock size={12} color="#999" />
                      <Text className="block text-xs text-gray-400">
                        {isPresale ? `${startDate?.getMonth()! + 1}月${startDate?.getDate()}日开售` : '长期有效'}
                      </Text>
                    </View>
                    <View className="bg-red-500 rounded-full px-4 py-1">
                      <Text className="block text-xs text-white font-medium">立即抢购</Text>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* ===== 我的订单 ===== */}
        {orders.length > 0 && (
          <View className="px-4 mt-5 mb-6">
            <View className="flex flex-row items-center justify-between mb-3">
              <View className="flex flex-row items-center gap-2">
                <ShoppingBag size={18} color="#FF4757" />
                <Text className="block text-base font-bold text-gray-800">我的订单</Text>
              </View>
              <View
                className="flex flex-row items-center gap-1"
                onClick={() => Taro.navigateTo({ url: '/pages/order-list/index' })}
              >
                <Text className="block text-xs text-red-500">查看全部</Text>
                <ChevronRight size={14} color="#FF4757" />
              </View>
            </View>
            <View className="flex flex-col gap-2">
              {orders.slice(0, 3).map((order) => (
                <View
                  key={order.id}
                  className="bg-white rounded-xl px-3 py-3 flex flex-row items-center justify-between"
                  onClick={() => Taro.navigateTo({ url: `/pages/order-detail/index?id=${order.id}` })}
                >
                  <View className="flex-1">
                    <Text className="block text-sm font-semibold text-gray-800" numberOfLines={1}>{order.package_name}</Text>
                    <View className="flex flex-row items-center gap-2 mt-1">
                      <Text className="block text-xs text-gray-400">
                        ¥{order.price} · x{order.quantity || 1} · {new Date(order.created_at).toLocaleDateString()}
                      </Text>
                    </View>
                  </View>
                  <View className="flex flex-row items-center gap-2 ml-2">
                    {!order.shared ? (
                      <View
                        className="bg-orange-50 rounded-full px-3 py-1 flex flex-row items-center gap-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleShare(order.id);
                        }}
                      >
                        <Share2 size={12} color="#FF6B35" />
                        <Text className="block text-xs text-orange-600">分享开奖</Text>
                      </View>
                    ) : (
                      <View
                        className="bg-red-500 rounded-full px-3 py-1 flex flex-row items-center gap-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDraw(order.id);
                        }}
                      >
                        <Gift size={12} color="#fff" />
                        <Text className="block text-xs text-white">{drawing ? '开奖中' : '开奖'}</Text>
                      </View>
                    )}
                    <ChevronRight size={14} color="#ccc" />
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* 底部占位 */}
        <View className="h-8" />
      </ScrollView>

      {/* 抽奖动画 */}
      <LotteryAnimation
        visible={showLottery}
        isWinner={lotteryResult?.is_winner ?? false}
        prizeName={lotteryResult?.record?.prize_name ?? null}
        onClose={() => {
          setShowLottery(false);
          setLotteryResult(null);
        }}
      />
    </View>
  );
};

export default IndexPage;
