import { View, Text, Image, ScrollView } from '@tarojs/components';
import { useState, useEffect, useCallback } from 'react';
import Taro, { useShareAppMessage } from '@tarojs/taro';
import { Network } from '@/network';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Gift, Share2, Trophy, Star, Zap, ShoppingBag } from 'lucide-react-taro';
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

const LOGO_URL = 'https://coze-coding-project.tos.coze.site/coze_storage_7662281810482692131/logo_pengtuan_351a650c.png?sign=1786607826-2bed5f54c9-0-97678c83503bc0f3caa6d543ad6c00b34a3cd0feb4d4bdcebe92e8f5d9cd6125';

const IndexPage = () => {
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [userId, setUserId] = useState<string>(`user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
  const [nickName, setNickName] = useState<string>('游客');
  const [orders, setOrders] = useState<Order[]>([]);
  const [lotteryResult, setLotteryResult] = useState<LotteryResult | null>(null);
  const [showLottery, setShowLottery] = useState(false);
  const [loading, setLoading] = useState(false);
  const [drawing, setDrawing] = useState(false);

  // 读取缓存用户ID
  useEffect(() => {
    const savedUserId = Taro.getStorageSync('user_id');
    const savedNickName = Taro.getStorageSync('nick_name');
    if (savedUserId) {
      setUserId(savedUserId);
      if (savedNickName) setNickName(savedNickName);
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
      Taro.showShareMenu({
        withShareTicket: true,
        success: () => {
          Taro.showToast({ title: '分享成功！现在可以开奖了', icon: 'success' });
          fetchOrders();
        },
      });
    } catch (err) {
      console.error('分享失败:', err);
    }
  }, []);

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
        <View className="bg-gradient-to-r from-red-500 to-orange-400 px-4 pt-6 pb-10">
          <View className="flex flex-row items-center gap-3 mb-2">
            <Image
              src={LOGO_URL}
              className="w-12 h-12 rounded-full"
              mode="aspectFill"
            />
            <View className="flex-1">
              <Text className="block text-2xl font-bold text-white">膨胀团</Text>
              <Text className="block text-sm text-white mt-1 opacity-80">越膨胀越惊喜！</Text>
            </View>
            <View
              className="bg-white rounded-full px-3 py-1"
              onClick={() => Taro.navigateTo({ url: '/pages/admin/index' })}
            >
              <Text className="block text-xs font-semibold text-red-500">⚙️ 奖品管理</Text>
            </View>
          </View>

          {/* 用户信息 */}
          <View className="flex flex-row items-center gap-2">
            <View className="w-8 h-8 rounded-full bg-white flex items-center justify-center opacity-30">
              <Trophy size={16} color="#fff" />
            </View>
            <Text className="block text-sm text-white">{nickName}</Text>
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
              return (
                <Card
                  key={pkg.id}
                  className="rounded-2xl border-2 border-red-300 shadow-lg mb-3"
                >
                  <CardContent className="p-6">
                    <View className="flex flex-row items-center justify-between mb-3">
                      <View className="flex flex-row items-center gap-2">
                        <ShoppingBag size={22} color="#FF4757" />
                        <Text className="block text-lg font-bold text-gray-800">{pkg.name}</Text>
                      </View>
                      {pkg.badge && (
                        <Badge className="bg-red-500 text-white">{pkg.badge}</Badge>
                      )}
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
                      onClick={() => handlePurchase(pkg)}
                      disabled={loading}
                    >
                      <Text className="block text-white font-semibold">{loading ? '购买中...' : '立即购买'}</Text>
                    </Button>
                  </CardContent>
                </Card>
              );
            })
          )}
        </View>

        {/* 我的订单 */}
        {orders.length > 0 && (
          <View className="px-4 mt-6 mb-8">
            <Text className="block text-base font-bold text-gray-800 mb-3">我的订单</Text>
            <View className="flex flex-col gap-3">
              {orders.map((order) => {
                return (
                  <Card key={order.id} className="rounded-xl">
                    <CardContent className="p-4">
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

        {/* 管理入口 */}
        <View className="px-4 mt-4 mb-8">
          <View className="flex items-center justify-center">
            <View
              className="flex flex-row items-center gap-2 bg-gray-100 rounded-full px-5 py-2"
              onClick={() => Taro.navigateTo({ url: '/pages/admin/index' })}
            >
              <Text className="block text-xs text-gray-500">🎯 膨胀团 · 奖品配置</Text>
            </View>
          </View>
        </View>

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