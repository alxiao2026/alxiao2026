import { View, Text, Image, ScrollView } from '@tarojs/components';
import { useState, useEffect, useCallback } from 'react';
import Taro, { useShareAppMessage } from '@tarojs/taro';
import { Network } from '@/network';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Gift, Share2, Star, Zap, ShoppingBag, LogIn } from 'lucide-react-taro';
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

const IndexPage = () => {
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [userId, setUserId] = useState<string>(`user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
  const [nickName, setNickName] = useState<string>('游客');
  const [avatarUrl, setAvatarUrl] = useState<string>('');
  const [orders, setOrders] = useState<Order[]>([]);
  const [lotteryResult, setLotteryResult] = useState<LotteryResult | null>(null);
  const [showLottery, setShowLottery] = useState(false);
  const [loading, setLoading] = useState(false);
  const [drawing, setDrawing] = useState(false);

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
      Taro.setStorageSync('user_id', userId);
    }
  }, []);

  // 获取数据
  useEffect(() => {
    fetchPrizes();
    fetchPackages();
    fetchOrders();
  }, [userId]);

  const fetchPrizes = async () => {
    try {
      const res = await Network.request({ url: '/api/prizes/active' });
      console.log('active prizes:', res.data);
      const data = (res.data as any)?.data || (res.data as Prize[]) || [];
      setPrizes(data);
    } catch (err) {
      console.error('获取奖品失败:', err);
    }
  };

  const fetchPackages = async () => {
    try {
      const res = await Network.request({ url: '/api/packages/active' });
      console.log('active packages:', res.data);
      const data = (res.data as any)?.data || (res.data as Package[]) || [];
      setPackages(data);
    } catch (err) {
      console.error('获取套餐失败:', err);
    }
  };

  const fetchOrders = async () => {
    try {
      const res = await Network.request({ url: `/api/orders/user/${userId}` });
      console.log('user orders:', res.data);
      const data = (res.data as any)?.data || (res.data as Order[]) || [];
      setOrders(data);
    } catch (err) {
      console.error('获取订单失败:', err);
    }
  };

  // 下单
  const handlePurchase = async (pkg: Package) => {
    setLoading(true);
    try {
      const res = await Network.request({
        url: '/api/orders',
        method: 'POST',
        data: {
          user_id: userId,
          nick_name: nickName,
          package_name: pkg.name,
          price: pkg.price,
        },
      });
      console.log('order created:', res.data);
      const order = (res.data as any)?.data || res.data;
      setOrders(prev => [order as Order, ...prev]);
      Taro.showToast({ title: '下单成功！分享好友即可开奖', icon: 'success', duration: 2000 });
    } catch (err) {
      console.error('下单失败:', err);
      Taro.showToast({ title: '下单失败', icon: 'none' });
    } finally {
      setLoading(false);
    }
  };

  // 分享
  const handleShare = useCallback(async (orderId: string) => {
    try {
      await Network.request({
        url: `/api/orders/${orderId}/share`,
        method: 'POST',
      });
      console.log('order shared:', orderId);
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
      console.log('用户取消授权或getUserProfile不可用:', err);
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
      console.log('lottery result:', res.data);
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

  return (
    <View className="min-h-screen bg-gray-50">
      <ScrollView className="flex-1" scrollY>
        {/* 顶部横幅 */}
        <View className="bg-gradient-to-r from-red-500 to-orange-400 px-4 pt-8 pb-12">
          {/* Logo 居中 */}
          <View className="flex items-center justify-center mb-4">
            <Image
              src={LOGO_URL}
              className="w-32 h-32"
              mode="aspectFit"
            />
          </View>

          {/* 用户信息和管理入口 */}
          <View className="flex items-center justify-between">
            <View
              className="flex flex-row items-center gap-2"
              onClick={() => { if (!avatarUrl) handleLogin(); }}
            >
              {avatarUrl ? (
                <Image
                  src={avatarUrl}
                  className="w-10 h-10 rounded-full border-2 border-white"
                  mode="aspectFill"
                />
              ) : (
                <View className="w-10 h-10 rounded-full bg-white bg-opacity-20 flex items-center justify-center border-2 border-white border-opacity-40">
                  <LogIn size={18} color="#fff" />
                </View>
              )}
              <View>
                <Text className="block text-sm font-medium text-white">{nickName}</Text>
                {!avatarUrl && (
                  <Text className="block text-xs text-white" style={{ opacity: 0.7 }}>点击授权登录</Text>
                )}
              </View>
            </View>

            {/* 管理入口 */}
            <View
              className="flex flex-row items-center gap-1 bg-white bg-opacity-20 rounded-full px-3 py-2"
              onClick={() => Taro.navigateTo({ url: '/pages/admin/index' })}
            >
              <Text className="block text-xs text-white">⚙️ 管理</Text>
            </View>
          </View>
        </View>

        {/* 奖品展示区 */}
        <View className="px-4 -mt-6">
          <Card className="rounded-2xl shadow-lg">
            <CardContent className="p-4">
              <View className="flex flex-row items-center gap-2 mb-3">
                <Gift size={20} color="#FF4757" />
                <Text className="block text-base font-bold text-gray-800">本期奖品</Text>
              </View>

              {prizes.length === 0 ? (
                <View className="py-6 flex items-center justify-center">
                  <Text className="block text-sm text-gray-400">暂无活动奖品</Text>
                </View>
              ) : (
                <View className="flex flex-col gap-3">
                  {prizes.map((prize, index) => (
                    <View
                      key={prize.id}
                      className="flex flex-row items-center gap-3 bg-gray-50 rounded-xl p-3"
                    >
                      <View
                        className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          index === 0 ? 'bg-red-100' : index === 1 ? 'bg-orange-100' : 'bg-blue-100'
                        }`}
                      >
                        <Star
                          size={20}
                          color={index === 0 ? '#FF4757' : index === 1 ? '#FFA502' : '#1890ff'}
                        />
                      </View>
                      <View className="flex-1">
                        <Text className="block text-sm font-semibold text-gray-800">{prize.name}</Text>
                        {prize.description && (
                          <Text className="block text-xs text-gray-500 mt-1">{prize.description}</Text>
                        )}
                        <Text className="block text-xs text-gray-400 mt-1">
                          剩余 <Text className="text-red-500 font-semibold">{prize.stock}</Text> 份
                        </Text>
                      </View>
                      <Badge variant="secondary" className="text-xs">
                        {prize.probability}%
                      </Badge>
                    </View>
                  ))}
                </View>
              )}
            </CardContent>
          </Card>
        </View>

        {/* 套餐列表 */}
        <View className="px-4 mt-4">
          <View className="flex flex-row items-center gap-2 mb-3">
            <ShoppingBag size={20} color="#FF4757" />
            <Text className="block text-base font-bold text-gray-800">选购套餐</Text>
          </View>

          {packages.length === 0 ? (
            <Card className="rounded-2xl shadow-lg">
              <CardContent className="p-6">
                <View className="flex items-center justify-center py-4">
                  <Text className="block text-sm text-gray-400">暂无活动套餐</Text>
                </View>
              </CardContent>
            </Card>
          ) : (
            packages.map((pkg) => {
              const features = parseFeatures(pkg.features);
              // 判断是否为预售套餐（售卖开始日期在未来）
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const startDate = pkg.sale_start_date ? new Date(pkg.sale_start_date) : null;
              const isPresale = startDate && startDate > today;

              return (
                <View
                  key={pkg.id}
                  className="mb-3"
                  onClick={() => Taro.navigateTo({ url: `/pages/package-detail/index?id=${pkg.id}` })}
                >
                  <Card className="rounded-2xl border-2 border-red-300 shadow-lg">
                    <CardContent className="p-6">
                      <View className="flex flex-row items-center justify-between mb-3">
                        <View className="flex flex-row items-center gap-2">
                          <ShoppingBag size={22} color="#FF4757" />
                          <Text className="block text-lg font-bold text-gray-800">{pkg.name}</Text>
                        </View>
                        <View className="flex flex-row gap-2">
                          {isPresale && (
                            <Badge className="bg-orange-500 text-white">预售</Badge>
                          )}
                          {pkg.badge && (
                            <Badge className="bg-red-500 text-white">{pkg.badge}</Badge>
                          )}
                        </View>
                      </View>

                      {pkg.description && (
                        <Text className="block text-sm text-gray-500 mb-3">{pkg.description}</Text>
                      )}

                      <View className="flex flex-row items-baseline gap-1 mb-4">
                        <Text className="block text-3xl font-bold text-red-500">¥{pkg.price}</Text>
                        {pkg.original_price && (
                          <Text className="block text-sm text-gray-400 line-through">¥{pkg.original_price}</Text>
                        )}
                      </View>

                      {features.length > 0 && (
                        <View className="flex flex-col gap-2 mb-4">
                          {features.map((feature, i) => (
                            <View key={i} className="flex flex-row items-center gap-2">
                              <Zap size={14} color="#FFA502" />
                              <Text className="block text-xs text-gray-600">{feature}</Text>
                            </View>
                          ))}
                        </View>
                      )}

                      <Button
                        className="w-full bg-red-500 hover:bg-red-600"
                        size="lg"
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePurchase(pkg);
                        }}
                        disabled={loading}
                      >
                        <Text className="block text-white font-semibold">{loading ? '购买中...' : '点击查看套餐详情'}</Text>
                      </Button>
                    </CardContent>
                  </Card>
                </View>
              );
            })
          )}
        </View>

        {/* 我的订单 */}
        {orders.length > 0 && (
          <View className="px-4 mt-6 mb-8">
            <View className="flex flex-row items-center justify-between mb-3">
              <Text className="block text-base font-bold text-gray-800">我的订单</Text>
              <View
                className="flex flex-row items-center gap-1"
                onClick={() => Taro.navigateTo({ url: '/pages/order-list/index' })}
              >
                <Text className="block text-xs text-red-500">查看全部</Text>
                <Text className="block text-xs text-red-500">›</Text>
              </View>
            </View>
            <View className="flex flex-col gap-3">
              {orders.slice(0, 3).map((order) => {
                return (
                  <Card
                    key={order.id}
                    className="rounded-xl"
                    onClick={() => Taro.navigateTo({ url: `/pages/order-detail/index?id=${order.id}` })}
                  >                    <CardContent className="p-4">
                      <View className="flex flex-row items-center justify-between">
                        <View>
                          <Text className="block text-sm font-semibold text-gray-800">{order.package_name}</Text>
                          <Text className="block text-xs text-gray-400 mt-1">
                            ¥{order.price} · {new Date(order.created_at).toLocaleDateString()}
                          </Text>
                        </View>
                        <View className="flex flex-row items-center gap-2">
                          {!order.shared ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleShare(order.id)}
                            >
                              <Share2 size={14} color="#FF4757" className="mr-1" />
                              <Text className="block text-xs">分享开奖</Text>
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              className="bg-red-500"
                              onClick={() => handleDraw(order.id)}
                              disabled={drawing}
                            >
                              <Gift size={14} color="#fff" className="mr-1" />
                              <Text className="block text-xs text-white">{drawing ? '开奖中...' : '开奖'}</Text>
                            </Button>
                          )}
                        </View>
                      </View>
                    </CardContent>
                  </Card>
                );
              })}
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