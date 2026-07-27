import { View, Text, Image, ScrollView } from '@tarojs/components';
import { useState, useEffect } from 'react';
import Taro from '@tarojs/taro';
import { Network } from '@/network';
import { Button } from '@/components/ui/button';
import AppTabBar from '@/components/app-tab-bar';
import { Trophy, Crown, Store, ChevronRight, Sparkles } from 'lucide-react-taro';

interface RankShop {
  id: number;
  name: string;
  logo: string | null;
  address: string | null;
  freeMealWins: number;
}

const STEPS = [
  { emoji: '🛒', title: '下团购单', desc: '任意套餐均可' },
  { emoji: '🎰', title: '自动抽奖', desc: '下单即抽 100%有礼' },
  { emoji: '🍽️', title: '中奖免费吃', desc: '霸王餐免单到手' },
];

export default function TuantuanPage() {
  const [rankShops, setRankShops] = useState<RankShop[]>([]);

  useEffect(() => {
    fetchRankShops();
  }, []);

  const fetchRankShops = async () => {
    try {
      const res = await Network.request({ url: '/api/merchants/free-meal-rank' });
      console.log('[团团] 霸王餐人气榜:', res.data);
      const data = (res.data as { data?: RankShop[] })?.data || [];
      setRankShops(data);
    } catch (err) {
      console.error('获取霸王餐人气榜失败:', err);
    }
  };

  return (
    <View className="min-h-screen bg-gray-50">
      <ScrollView scrollY className="h-screen">
        {/* ===== 品牌 Hero ===== */}
        <View className="bg-gradient-to-br from-[#FF4757] to-[#ff6b7a] px-6 pt-10 pb-14 flex flex-col items-center">
          <View className="w-20 h-20 rounded-full bg-white shadow-lg flex items-center justify-center">
            <Text className="block text-4xl">🎁</Text>
          </View>
          <Text className="block text-2xl font-bold text-white mt-4">下单抽霸王餐</Text>
          <Text className="block text-sm text-white mt-2" style={{ opacity: 0.9 }}>给生活来点小惊喜</Text>
          <View className="bg-white rounded-full px-4 py-1 mt-4" style={{ opacity: 0.95 }}>
            <Text className="block text-xs font-semibold text-[#FF4757]">每一单都有机会免单</Text>
          </View>
        </View>

        {/* ===== 怎么玩 ===== */}
        <View className="px-4 -mt-8">
          <View className="bg-white rounded-2xl shadow-lg px-4 py-4">
            <View className="flex flex-row items-center gap-2 mb-4">
              <Sparkles size={16} color="#FF4757" />
              <Text className="block text-sm font-bold text-gray-800">怎么玩？</Text>
              <Text className="block text-xs text-gray-400 ml-auto">三步就搞定</Text>
            </View>
            <View className="flex flex-row items-center">
              {STEPS.map((s, i) => (
                <View key={i} className="flex-1 flex flex-row items-center">
                  <View className="flex-1 bg-red-50 rounded-2xl px-2 py-3 flex flex-col items-center relative">
                    <View className="absolute -top-2 -left-1 w-5 h-5 rounded-full bg-gradient-to-br from-[#FF6B6B] to-[#FF4757] flex items-center justify-center">
                      <Text className="block text-xs font-bold text-white">{i + 1}</Text>
                    </View>
                    <Text className="block text-2xl">{s.emoji}</Text>
                    <Text className="block text-xs font-bold text-gray-800 mt-1">{s.title}</Text>
                    <Text className="block text-xs text-gray-400 mt-1">{s.desc}</Text>
                  </View>
                  {i < STEPS.length - 1 && (
                    <Text className="block text-gray-300 mx-1">▸</Text>
                  )}
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* ===== 霸王餐人气榜 ===== */}
        {rankShops.length > 0 && (
          <View className="px-4 mt-5">
            <View className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <View className="bg-gradient-to-r from-[#FF4757] to-[#ff6b7a] px-4 py-3">
                <View className="flex flex-row items-center gap-2">
                  <Trophy size={18} color="#FFE27A" />
                  <Text className="block text-sm font-bold text-white">霸王餐人气榜</Text>
                  <Text className="block text-xs text-white ml-auto" style={{ opacity: 0.85 }}>好运正在派送中</Text>
                </View>
              </View>
              <View className="px-3 py-3">
                {/* 冠军卡 */}
                <View
                  className="rounded-2xl bg-gradient-to-r from-[#FFF3D6] to-[#FFE9B8] px-3 py-3 flex flex-row items-center gap-3 relative overflow-hidden"
                  onClick={() => Taro.navigateTo({ url: `/pages/merchant/index?id=${rankShops[0].id}` })}
                >
                  <View className="absolute top-1 right-2 flex flex-row items-center gap-1">
                    <Crown size={14} color="#D97706" />
                    <Text className="block text-xs font-bold text-[#D97706]">人气王</Text>
                  </View>
                  <View className="relative flex-shrink-0">
                    {rankShops[0].logo ? (
                      <Image src={rankShops[0].logo} className="w-14 h-14 rounded-2xl" mode="aspectFill" />
                    ) : (
                      <View className="w-14 h-14 rounded-2xl bg-white flex items-center justify-center">
                        <Store size={28} color="#D97706" />
                      </View>
                    )}
                    <View className="absolute -top-2 -left-2 w-6 h-6 rounded-full bg-gradient-to-br from-[#FFD700] to-[#FFA502] flex items-center justify-center">
                      <Text className="block text-xs font-bold text-white">1</Text>
                    </View>
                  </View>
                  <View className="flex-1">
                    <Text className="block text-sm font-bold text-gray-900" numberOfLines={1}>{rankShops[0].name}</Text>
                    <View className="flex flex-row items-baseline gap-1 mt-1">
                      <Text className="block text-xs text-[#B7791F]">已送出</Text>
                      <Text className="block text-lg font-bold text-[#D97706]">{rankShops[0].freeMealWins}</Text>
                      <Text className="block text-xs text-[#B7791F]">份霸王餐 🎉</Text>
                    </View>
                  </View>
                  <ChevronRight size={16} color="#D97706" />
                </View>
                {/* 2-5 名：双列卡片 */}
                {[
                  rankShops.slice(1, 3),
                  rankShops.slice(3, 5),
                ].map((row, rowIdx) => (
                  row.length > 0 && (
                    <View key={rowIdx} className="flex flex-row gap-2 mt-2">
                      {row.map((shop) => {
                        const rank = rankShops.indexOf(shop) + 1;
                        const medal = rank === 2
                          ? 'bg-gradient-to-br from-[#E5E7EB] to-[#9CA3AF]'
                          : rank === 3
                            ? 'bg-gradient-to-br from-[#F0B27A] to-[#CD7F32]'
                            : 'bg-gradient-to-br from-[#CBD5E0] to-[#A0AEC0]';
                        return (
                          <View
                            key={shop.id}
                            className="flex-1 bg-gray-50 rounded-2xl px-2 py-2 flex flex-row items-center gap-2"
                            onClick={() => Taro.navigateTo({ url: `/pages/merchant/index?id=${shop.id}` })}
                          >
                            <View className="relative flex-shrink-0">
                              {shop.logo ? (
                                <Image src={shop.logo} className="w-10 h-10 rounded-xl" mode="aspectFill" />
                              ) : (
                                <View className="w-10 h-10 rounded-xl bg-white flex items-center justify-center">
                                  <Store size={20} color="#FF4757" />
                                </View>
                              )}
                              <View className={`absolute -top-1 -left-1 w-5 h-5 rounded-full ${medal} flex items-center justify-center`}>
                                <Text className="block text-xs font-bold text-white">{rank}</Text>
                              </View>
                            </View>
                            <View className="flex-1 overflow-hidden">
                              <Text className="block text-xs font-bold text-gray-800" numberOfLines={1}>{shop.name}</Text>
                              <Text className="block text-xs text-[#FF4757] font-semibold mt-1">{shop.freeMealWins} 份霸王餐</Text>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  )
                ))}
              </View>
            </View>
          </View>
        )}

        {/* ===== CTA ===== */}
        <View className="px-4 mt-6 mb-10">
          <Button
            className="w-full bg-[#FF4757] text-white rounded-full py-3 font-bold"
            onClick={() => Taro.reLaunch({ url: '/pages/index/index' })}
          >
            <Text>去逛逛 抽霸王餐 🎉</Text>
          </Button>
        </View>

        {/* 底部占位（避让悬浮 TabBar） */}
        <View className="h-36" />
      </ScrollView>

      {/* 悬浮胶囊导航栏 */}
      <AppTabBar current="/pages/tuantuan/index" />
    </View>
  );
}
