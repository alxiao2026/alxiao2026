import { View, Text, Image, ScrollView, Swiper, SwiperItem } from '@tarojs/components';
import { useState, useEffect } from 'react';
import Taro, { useShareAppMessage, useShareTimeline, useDidShow, useLoad } from '@tarojs/taro';
import { Network } from '@/network';
import { formatPrice, getNavSafeAreaTop } from '@/lib/utils';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import AppTabBar from '@/components/app-tab-bar';
import {
  ChevronRight, Clock, Flame, Trophy, Store
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

interface RankShop {
  id: number;
  name: string;
  logo: string | null;
  address: string | null;
  freeMealWins: number;
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
  category: string | null;
}

interface LotteryResult {
  is_winner: boolean;
  prize: Prize | null;
  record: {
    id: string;
    prize_name: string | null;
    is_winner: boolean;
    prize_type?: string;
    coupon_amount?: string;
    coupon_min_spend?: string;
    discount_rate?: number;
    discount_cap?: number;
    discount_capped?: boolean;
    product_name?: string;
    product_value?: string;
    redemption_code?: string;
    refund_amount?: string;
  };
}

interface WinnerRecord {
  id: string;
  prize_name: string;
  user_id: string;
  nick_name: string;
  avatar_url: string | null;
  created_at: string;
}


const DEFAULT_COVER = 'https://coze-coding-project.tos.coze.site/coze_storage_7666397081875218472/lottery/popup_mascot_box_v3_7348436c_cd186a3a.png?sign=2102468949-167c99c778-0-ee299d9fb5b1b984bc8995b3ca408bb0555e8af4bc2e341103b3fcf05a721952';

// 登录态读取（兼容历史存储的字符串 '1' / 'true'）
const readLoggedIn = (): boolean => {
  const v = Taro.getStorageSync('is_logged_in');
  return v === true || v === '1' || v === 'true';
};

const IndexPage = () => {
  const [rankShops, setRankShops] = useState<RankShop[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [userId, setUserId] = useState<string>('');
  const [winners, setWinners] = useState<WinnerRecord[]>([]);
  const [lotteryResult, setLotteryResult] = useState<LotteryResult | null>(null);
  const [showLottery, setShowLottery] = useState(false);
  const [activeIndustry, setActiveIndustry] = useState('全部');

  // 中奖名单按 5 条一屏分组，滚动时整屏翻页
  const winnerGroups: WinnerRecord[][] = [];
  for (let i = 0; i < winners.length; i += 5) {
    winnerGroups.push(winners.slice(i, i + 5));
  }

  // 从后端拉取最新用户信息，保证昵称/头像/登录态实时同步
  const refreshUserInfo = async (uid: string) => {
    try {
      const res = await Network.request({ url: `/api/users/${uid}` });
      console.log('[Index] refreshUserInfo response:', JSON.stringify(res.data));
      const user = (res.data as { code?: number; data?: { nick_name?: string; avatar_url?: string } })?.data;
      if (user) {
        if (user.nick_name) {
          Taro.setStorageSync('nick_name', user.nick_name);
        }
        if (user.avatar_url) {
          Taro.setStorageSync('avatar_url', user.avatar_url);
        }
      }
    } catch (err) {
      console.error('[Index] 刷新用户信息失败:', err);
    }
  };

  // 读取缓存用户ID
  useEffect(() => {
    const savedUserId = Taro.getStorageSync('user_id');
    const loggedIn = readLoggedIn();
    if (savedUserId) {
      setUserId(savedUserId);
      if (loggedIn) refreshUserInfo(savedUserId);
    } else {
      const newId = `user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      Taro.setStorageSync('user_id', newId);
      setUserId(newId);
    }
  }, []);

  // 分销裂变：识别分享链接/太阳码中的 inviter 参数，绑定上下级关系；解析海报太阳码短码并中转跳转
  useLoad((options) => {
    // 太阳码进入时参数在 scene（如 inviter=xxx 或 10 位短码），分享卡片进入时在 query.inviter
    let inviterId = typeof options?.inviter === 'string' ? options.inviter : '';
    const sceneRaw = typeof options?.scene === 'string' ? decodeURIComponent(options.scene) : '';
    if (!inviterId && sceneRaw) {
      const m = sceneRaw.match(/inviter=([^&]+)/);
      if (m) inviterId = m[1];
    }

    const doBind = (inviter: string) => {
      if (!inviter) return;
      // 等 user_id 初始化完成后再绑定（首次进入时 user_id 是异步生成的）
      setTimeout(() => {
        const myId = Taro.getStorageSync('user_id');
        if (!myId || myId === inviter) return;
        Network.request({
          url: '/api/distribution/bind',
          method: 'POST',
          data: { user_id: myId, inviter_id: inviter }
        }).then((res) => {
          console.log('[分销绑定]', JSON.stringify(res.data));
        }).catch((err) => {
          console.log('[分销绑定] 失败（可忽略）:', err);
        });
      }, 800);
    };

    // 短码太阳码：scene 为 10 位短码（不含 = 且不是 inviter= 开头），需解析成真实目标页
    const isShortCode = /^[a-zA-Z0-9]{8,16}$/.test(sceneRaw) && !sceneRaw.includes('=');
    if (isShortCode) {
      Network.request({ url: `/api/share/resolve/${sceneRaw}` })
        .then((res) => {
          const payload = (res.data as any)?.data;
          console.log('[太阳码短码解析]', sceneRaw, JSON.stringify(payload));
          if (!payload?.page) return;
          const params = payload.params || {};
          if (params.inviter) doBind(String(params.inviter));
          const qs = Object.keys(params)
            .filter((k) => k !== 'inviter')
            .map((k) => `${k}=${encodeURIComponent(String(params[k]))}`)
            .join('&');
          const target = `/${payload.page}${qs ? `?${qs}` : ''}`;
          // 目标页为 Tab 页用 switchTab，否则 reLaunch（海报太阳码冷启动需 reLaunch）
          setTimeout(() => {
            Taro.reLaunch({ url: target }).catch(() => {
              Taro.navigateTo({ url: target }).catch((e) => console.log('[太阳码跳转] 失败:', e));
            });
          }, 300);
        })
        .catch((err) => console.log('[太阳码短码解析] 失败:', err));
      return;
    }

    if (inviterId) doBind(inviterId);
  });

  // 获取数据
  useEffect(() => {
    fetchRankShops();
    if (!userId) return;
    fetchPackages();
    fetchWinners();
  }, [userId]);

  // 页面每次显示时刷新数据（下单后返回自动更新销量）
  useDidShow(() => {
    // 已登录时主动从后端刷新头像/昵称缓存，供个人中心等页面使用
    const loggedIn = readLoggedIn();
    const savedUserId = Taro.getStorageSync('user_id');
    if (loggedIn && savedUserId) refreshUserInfo(savedUserId);
    fetchRankShops();
    if (!userId) return;
    fetchPackages();
    fetchWinners();
  });

  const fetchRankShops = async () => {
    try {
      const res = await Network.request({ url: '/api/merchants/free-meal-rank' });
      console.log('[首页] 霸王餐人气榜:', res.data);
      const data = (res.data as any)?.data || [];
      setRankShops(data);
    } catch (err) {
      console.error('获取霸王餐人气榜失败:', err);
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

  const fetchWinners = async () => {
    try {
      const res = await Network.request({ url: '/api/lottery/winners' });
      const data = (res.data as any)?.data || (res.data as WinnerRecord[]) || [];
      setWinners(data);
    } catch (err) {
      console.error('获取中奖名单失败:', err);
    }
  };

  // 设置分享（转发给朋友）
  useShareAppMessage(() => {
    const inviterId = Taro.getStorageSync('user_id') || '';
    return {
      title: '膨胀团！下单套餐，分享好友抽大奖！',
      path: inviterId ? `/pages/index/index?inviter=${inviterId}` : '/pages/index/index',
    };
  });

  // 分享到朋友圈
  useShareTimeline(() => {
    const inviterId = Taro.getStorageSync('user_id') || '';
    return {
      title: '膨胀团！下单套餐抽霸王餐，每单都有好运！',
      query: inviterId ? `inviter=${inviterId}` : '',
    };
  });

  const parseFeatures = (features: string | null): string[] => {
    if (!features) return [];
    try {
      return JSON.parse(features);
    } catch {
      return features.split('\n').filter(Boolean);
    }
  };

  // ===== 行业分类导航：按套餐大类聚合（category 形如"餐饮美食 · 火锅烧烤"） =====
  const industryEmoji = (name: string): string => {
    if (/餐饮|美食|火锅|烧烤|饮品|小吃/.test(name)) return '🍜';
    if (/购物|超市|便利|百货/.test(name)) return '🛒';
    if (/休闲|娱乐|KTV|电影|游戏/.test(name)) return '🎮';
    if (/丽人|美容|美发|美甲/.test(name)) return '💅';
    if (/酒店|住宿|旅游/.test(name)) return '🏨';
    if (/运动|健身|瑜伽/.test(name)) return '💪';
    if (/教育|亲子|培训/.test(name)) return '🎨';
    if (/宠物/.test(name)) return '🐾';
    return '🎈';
  };

  const industries: string[] = [];
  packages.forEach(p => {
    const major = p.category?.split('·')[0]?.trim();
    if (major && !industries.includes(major)) industries.push(major);
  });

  const industryTabs = [{ name: '全部', emoji: '🎈' }, ...industries.map(n => ({ name: n, emoji: industryEmoji(n) }))];

  const filteredPackages = activeIndustry === '全部'
    ? packages
    : packages.filter(p => p.category?.startsWith(activeIndustry));

  return (
  <>
    <View className="min-h-screen bg-gray-50">
      {/* ===== 状态栏固定背景（与页面背景同色 #F9FAFB，完全融合；不随页面滚动） ===== */}
      <View
        style={{ position: 'fixed', top: 0, left: 0, right: 0, height: getNavSafeAreaTop(), zIndex: 100, backgroundColor: '#F9FAFB' }}
      />
      <ScrollView className="flex-1" scrollY>
        {/* ===== 顶部品牌区（居中极简，动态避让状态栏与胶囊按钮） ===== */}
        <View className="px-5 pb-4 flex flex-col items-center" style={{ paddingTop: getNavSafeAreaTop() }}>
          <Text className="block text-2xl font-bold text-[#FF4757]">膨胀团</Text>
          <Text className="block text-xs text-gray-400 mt-1">给生活来点小惊喜 · 每单都有好运 ✨</Text>
        </View>

        {/* ===== 霸王餐人气榜（年轻活泼风格） ===== */}
        {rankShops.length > 0 && (
          <View className="px-4 mt-2">
            <View
              className="rounded-3xl overflow-hidden px-3 py-3"
              style={{ background: 'linear-gradient(135deg, #FFE5EC 0%, #F3E8FF 50%, #E0F2FE 100%)' }}
            >
              {/* 标题栏 */}
              <View className="flex flex-row items-center gap-2 mb-3 px-1">
                <Trophy size={18} color="#FF6B9D" />
                <Text className="block text-base font-bold text-pink-500">霸王餐人气榜</Text>
                <Text className="block text-xs text-gray-400 ml-auto">🎉 好运正在派送</Text>
              </View>

              {/* 冠军卡 */}
              <View
                className="bg-white rounded-2xl px-3 py-3 flex flex-row items-center gap-3 relative shadow-sm mb-2"
                onClick={() => Taro.navigateTo({ url: `/pages/merchant/index?id=${rankShops[0].id}` })}
              >
                <View className="absolute top-2 right-2 bg-gradient-to-r from-yellow-400 to-amber-500 rounded-full px-2 py-1">
                  <Text className="block text-xs font-bold text-white">人气王</Text>
                </View>
                <View className="relative flex-shrink-0">
                  {rankShops[0].logo ? (
                    <Image 
                      src={rankShops[0].logo} 
                      className="w-14 h-14 rounded-2xl" 
                      mode="aspectFill" 
                      onError={() => console.log('[首页] 霸王餐人气榜冠军 logo 加载失败:', rankShops[0].logo)}
                    />
                  ) : (
                    <View className="w-14 h-14 rounded-2xl bg-pink-50 flex items-center justify-center">
                      <Store size={28} color="#FF6B9D" />
                    </View>
                  )}
                  <View className="absolute -top-1 -left-1 w-6 h-6 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center shadow">
                    <Text className="block text-xs font-bold text-white">1</Text>
                  </View>
                </View>
                <View className="flex-1">
                  <Text className="block text-sm font-bold text-gray-800" numberOfLines={1}>{rankShops[0].name}</Text>
                  <View className="flex flex-row items-center gap-1 mt-1">
                    <Text className="block text-lg font-bold text-pink-500">{rankShops[0].freeMealWins}</Text>
                    <Text className="block text-xs text-gray-400">份霸王餐</Text>
                  </View>
                </View>
                <ChevronRight size={16} color="#FF6B9D" />
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
                      const medalColor = rank === 2 ? 'from-gray-300 to-gray-400' : rank === 3 ? 'from-amber-300 to-amber-500' : 'from-gray-200 to-gray-300';
                      return (
                        <View
                          key={shop.id}
                          className="flex-1 bg-white rounded-2xl px-2 py-2 flex flex-row items-center gap-2 shadow-sm"
                          onClick={() => Taro.navigateTo({ url: `/pages/merchant/index?id=${shop.id}` })}
                        >
                          <View className="relative flex-shrink-0">
                            {shop.logo ? (
                              <Image 
                                src={shop.logo} 
                                className="w-10 h-10 rounded-xl" 
                                mode="aspectFill"
                                onError={() => console.log('[首页] 霸王餐人气榜 logo 加载失败:', shop.logo)}
                              />
                            ) : (
                              <View className="w-10 h-10 rounded-xl bg-pink-50 flex items-center justify-center">
                                <Store size={20} color="#FF6B9D" />
                              </View>
                            )}
                            <View className={`absolute -top-1 -left-1 w-5 h-5 rounded-full bg-gradient-to-br ${medalColor} flex items-center justify-center`}>
                              <Text className="block text-xs font-bold text-white">{rank}</Text>
                            </View>
                          </View>
                          <View className="flex-1 overflow-hidden">
                            <Text className="block text-xs font-bold text-gray-800" numberOfLines={1}>{shop.name}</Text>
                            <Text className="block text-xs text-pink-500 font-semibold mt-1">{shop.freeMealWins} 份霸王餐</Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )
              ))}
            </View>
          </View>
        )}

        {/* ===== 行业分类导航（红色氛围区） ===== */}
        <View className="px-4 mt-5 mb-4">
          <View className="bg-gradient-to-br from-[#FF4757] via-[#FF5C6C] to-[#FF8FA3] rounded-2xl shadow-lg px-3 py-3">
            <View className="flex flex-row items-center gap-1 px-1 mb-2">
              <Text className="block text-sm">🧭</Text>
              <Text className="block text-sm font-bold text-white">逛一逛</Text>
              <Text className="block text-xs text-white ml-1" style={{ opacity: 0.8 }}>按行业找好店</Text>
            </View>
            <ScrollView scrollX className="whitespace-nowrap" showScrollbar={false}>
              <View className="flex flex-row gap-2">
                {industryTabs.map((item) => {
                  const active = activeIndustry === item.name;
                  return (
                    <View
                      key={item.name}
                      className={`flex flex-row items-center gap-1 px-3 py-2 rounded-full ${active ? 'bg-white' : 'bg-white'}`}
                      style={active ? undefined : { opacity: 0.9, backgroundColor: 'rgba(255,255,255,0.22)' }}
                      onClick={() => setActiveIndustry(item.name)}
                    >
                      <Text className="block text-sm">{item.emoji}</Text>
                      <Text className={`block text-xs font-semibold ${active ? 'text-[#FF4757]' : 'text-white'}`}>{item.name}</Text>
                    </View>
                  );
                })}
              </View>
            </ScrollView>
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
                        <View className="absolute top-0 left-0 bg-[#FF4757] rounded-br-lg px-2 py-1">
                          <Text className="block text-xs text-white font-medium">预售</Text>
                        </View>
                      )}
                      {pkg.badge && (
                        <View className="absolute top-0 left-0 bg-[#FF4757] rounded-br-lg px-2 py-1">
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
                            <View key={i} className="bg-red-50 rounded px-1 py-0">
                              <Text className="block text-xs text-[#FF4757]">{f}</Text>
                            </View>
                          ))}
                        </View>
                      )}

                      {/* 抽奖提示（红色背景） */}
                      <View className="flex flex-row mt-1">
                        <View className="bg-[#FF4757] rounded-full px-3 py-1">
                          <Text className="block text-xs text-white font-semibold">下单抽霸王餐</Text>
                        </View>
                      </View>

                      {/* 价格行 */}
                      <View className="flex flex-row items-end justify-between mt-2">
                        <View className="flex flex-row items-baseline gap-1">
                          <Text className="block text-xs text-[#FF4757] font-bold">¥</Text>
                          <Text className="block text-xl font-bold text-[#FF4757]">{formatPrice(pkg.price)}</Text>
                          {Number(pkg.original_price) > Number(pkg.price) && (
                            <Text className="block text-xs text-gray-300 line-through ml-1">¥{formatPrice(pkg.original_price || 0)}</Text>
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
                    <View className="bg-[#FF4757] rounded-full px-4 py-1">
                      <Text className="block text-xs text-white font-medium">立即抢购</Text>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* ===== 往期中奖名单（年轻活泼风格） ===== */}
        {winners.length > 0 && (
          <View className="px-4 mt-5 mb-6">
            {/* 标题栏 */}
            <View className="flex flex-row items-center gap-2 mb-3 px-1">
              <Text className="block text-base font-bold text-gray-800">往期中奖名单</Text>
              <View className="bg-gradient-to-r from-pink-100 to-purple-100 rounded-full px-2 py-1">
                <Text className="block text-xs text-pink-500">🍀 好运接力中</Text>
              </View>
            </View>
            {/* 渐变背景容器 */}
            <View
              className="rounded-2xl px-2 py-2 overflow-hidden"
              style={{ background: 'linear-gradient(135deg, #FFF0F5 0%, #F3E8FF 50%, #EFF6FF 100%)' }}
            >
              <Swiper
                className="h-52"
                vertical
                autoplay
                circular
                interval={2200}
                duration={450}
              >
                {winnerGroups.map((group, gi) => (
                  <SwiperItem key={gi}>
                    <View className="flex flex-col gap-1">
                      {group.map((w) => (
                        <View key={w.id} className="flex flex-row items-center bg-white rounded-full px-3 h-10 shadow-sm">
                          <Avatar className="h-6 w-6">
                            {w.avatar_url ? <AvatarImage src={w.avatar_url} /> : null}
                            <AvatarFallback className="bg-pink-50 flex items-center justify-center">
                              <Text className="block text-xs font-semibold text-pink-500">{(w.nick_name || '客').charAt(0)}</Text>
                            </AvatarFallback>
                          </Avatar>
                          <Text className="block text-xs text-gray-600 ml-2">
                            {w.nick_name}
                            <Text className="text-pink-500"> 抽中 </Text>
                            <Text className="text-gray-800 font-semibold">{w.prize_name}</Text>
                          </Text>
                        </View>
                      ))}
                    </View>
                  </SwiperItem>
                ))}
              </Swiper>
            </View>
          </View>
        )}

        {/* 底部文案 */}
        <View className="py-4 text-center">
          <Text className="block text-sm text-gray-400">- 给生活来点小惊喜 -</Text>
        </View>

        {/* 底部占位（避让悬浮 TabBar） */}
        <View className="h-24" />
      </ScrollView>

      {/* 抽奖动画 */}
      <LotteryAnimation
        visible={showLottery}
        isWinner={lotteryResult?.is_winner ?? false}
        prizeName={lotteryResult?.record?.prize_name ?? null}
        prizeType={(lotteryResult?.record?.prize_type as 'coupon' | 'product' | 'free_meal') || 'coupon'}
        discountCap={lotteryResult?.record?.discount_cap || 0}
        discountCapped={lotteryResult?.record?.discount_capped || false}
        productName={lotteryResult?.record?.product_name || ''}
        productValue={lotteryResult?.record?.product_value || '0'}
        redemptionCode={lotteryResult?.record?.redemption_code || ''}
        refundAmount={lotteryResult?.record?.refund_amount || '0'}
        onClose={() => {
          setShowLottery(false);
          setLotteryResult(null);
        }}
      />
    </View>
    <AppTabBar current="/pages/index/index" />
  </>
  );
};

export default IndexPage;
