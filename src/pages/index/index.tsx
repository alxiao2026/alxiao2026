import { View, Text, ScrollView } from '@tarojs/components';
import { useState, useEffect, useCallback } from 'react';
import Taro, { useShareAppMessage } from '@tarojs/taro';
import { Network } from '@/network';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Gift, Share2, Trophy, Star, Zap, ShoppingBag } from 'lucide-react-taro';
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

const IndexPage = () => {
  const [prizes, setPrizes] = useState<Prize[]>([]);
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

  // 获取奖品列表
  useEffect(() => {
    fetchPrizes();
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
  const handlePurchase = async () => {
    setLoading(true);
    try {
      const res = await Network.request({
        url: '/api/orders',
        method: 'POST',
        data: {
          user_id: userId,
          nick_name: nickName,
          package_name: '基础套餐',
          price: '9.90',
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
      // 触发分享
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
      title: '快来参加有奖销售！下单基础套餐，抽大奖！',
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

  return (
    <View className="min-h-screen bg-gray-50">
      <ScrollView className="flex-1" scrollY>
        {/* 顶部横幅 */}
        <View className="bg-gradient-to-r from-red-500 to-orange-400 px-4 pt-6 pb-10">
          <View className="flex flex-row items-center justify-between mb-4">
            <View>
              <Text className="block text-2xl font-bold text-white">有奖销售</Text>
              <Text className="block text-sm text-white mt-1 opacity-80">下单基础套餐，分享好友开大奖</Text>
            </View>
            <View
              className="bg-white rounded-full px-3 py-1 opacity-20"
              onClick={() => Taro.navigateTo({ url: '/pages/admin/index' })}
            >
              <Text className="block text-xs text-white">管理奖品</Text>
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

        {/* 基础套餐 */}
        <View className="px-4 mt-4">
          <Card className="rounded-2xl border-2 border-red-300 shadow-lg">
            <CardContent className="p-6">
              <View className="flex flex-row items-center justify-between mb-3">
                <View className="flex flex-row items-center gap-2">
                  <ShoppingBag size={22} color="#FF4757" />
                  <Text className="block text-lg font-bold text-gray-800">基础套餐</Text>
                </View>
                <Badge className="bg-red-500 text-white">限时特惠</Badge>
              </View>

              <View className="flex flex-row items-baseline gap-1 mb-4">
                <Text className="block text-3xl font-bold text-red-500">¥9.90</Text>
                <Text className="block text-sm text-gray-400 line-through">¥29.90</Text>
              </View>

              <View className="flex flex-col gap-2 mb-4">
                <View className="flex flex-row items-center gap-2">
                  <Zap size={14} color="#FFA502" />
                  <Text className="block text-xs text-gray-600">下单即获抽奖资格</Text>
                </View>
                <View className="flex flex-row items-center gap-2">
                  <Zap size={14} color="#FFA502" />
                  <Text className="block text-xs text-gray-600">分享给好友即可开奖</Text>
                </View>
                <View className="flex flex-row items-center gap-2">
                  <Zap size={14} color="#FFA502" />
                  <Text className="block text-xs text-gray-600">100%中奖机会（奖品概率可配置）</Text>
                </View>
              </View>

              <Button
                className="w-full bg-red-500 hover:bg-red-600"
                size="lg"
                onClick={handlePurchase}
                disabled={loading}
              >
                <Text className="block text-white font-semibold">{loading ? '购买中...' : '立即购买'}</Text>
              </Button>
            </CardContent>
          </Card>
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

        {/* 底部占位 */}
        <View className="h-8" />
      </ScrollView>

      {/* 抽奖结果弹窗 */}
      {showLottery && lotteryResult && (
        <View className="fixed inset-0 bg-black opacity-60 z-50 flex items-center justify-center px-6">
          <View className="bg-white rounded-3xl w-full max-w-xs p-8 items-center">
            {/* 中奖/未中奖图标 */}
            <View
              className={`w-20 h-20 rounded-full flex items-center justify-center mb-4 ${
                lotteryResult.is_winner ? 'bg-green-100' : 'bg-gray-100'
              }`}
            >
              {lotteryResult.is_winner ? (
                <Trophy size={40} color="#2ED573" />
              ) : (
                <Gift size={40} color="#747D8C" />
              )}
            </View>

            {/* 结果标题 */}
            <Text className="block text-xl font-bold text-gray-800 mb-2">
              {lotteryResult.is_winner ? '恭喜中奖！' : '再接再厉'}
            </Text>

            {lotteryResult.is_winner && lotteryResult.record.prize_name && (
              <View className="bg-red-50 rounded-xl px-4 py-3 mb-4 w-full">
                <Text className="block text-lg font-bold text-red-500 text-center">
                  {lotteryResult.record.prize_name}
                </Text>
              </View>
            )}

            {!lotteryResult.is_winner && (
              <Text className="block text-sm text-gray-500 text-center mb-4">
                下次一定中！再下一单试试手气吧
              </Text>
            )}

            <Button
              className="w-full bg-red-500"
              onClick={() => {
                setShowLottery(false);
                setLotteryResult(null);
              }}
            >
              <Text className="block text-white font-semibold">我知道了</Text>
            </Button>
          </View>
        </View>
      )}
    </View>
  );
};

export default IndexPage;