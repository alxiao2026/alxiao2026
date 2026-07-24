import { View, Text } from '@tarojs/components';
import { useState, useCallback } from 'react';
import Taro, { useDidShow } from '@tarojs/taro';
import { Network } from '@/network';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Users, UtensilsCrossed, Gift } from 'lucide-react-taro';

interface MerchantLotteryRecord {
  id: string;
  order_id: string;
  user_id: string;
  user_nick_name: string;
  user_phone: string;
  prize_id: string;
  prize_name: string;
  prize_type: string;
  is_winner: boolean;
  redemption_code?: string;
  refund_status?: string;
  refund_amount?: string;
  redeemed_at?: string;
  expired?: boolean;
  expiry_date?: string;
  created_at: string;
}

type FilterKey = 'all' | 'winner' | 'loser';

const FILTER_TABS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'winner', label: '已中奖' },
  { key: 'loser', label: '未中奖' },
];

const AdminLotteryRecordsPage = () => {
  const [records, setRecords] = useState<MerchantLotteryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>('all');

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const userId = Taro.getStorageSync('user_id') || Taro.getStorageSync('userInfo')?.user_id || '';
      if (!userId) {
        Taro.showToast({ title: '请先登录', icon: 'none' });
        return;
      }
      const res = await Network.request({ url: `/api/lottery/merchant-records/${userId}` });
      console.log('[AdminLotteryRecords] 响应:', res.data);
      const envelope: any = (res as any)?.data || res;
      const list = envelope?.data || [];
      if (Array.isArray(list)) setRecords(list);
    } catch (e) {
      console.error('[AdminLotteryRecords] 获取失败:', e);
      Taro.showToast({ title: '获取抽奖记录失败', icon: 'none' });
    } finally {
      setLoading(false);
    }
  }, []);

  useDidShow(() => {
    fetchRecords();
  });

  const formatTime = (timeStr: string) => {
    if (!timeStr) return '';
    const date = new Date(timeStr);
    return `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  };

  const maskPhone = (phone: string) => {
    if (!phone || phone.length < 7) return phone || '';
    return `${phone.slice(0, 3)}****${phone.slice(-4)}`;
  };

  const filteredRecords = records.filter(r => {
    if (filter === 'winner') return r.is_winner;
    if (filter === 'loser') return !r.is_winner;
    return true;
  });

  const winnerCount = records.filter(r => r.is_winner).length;
  const freeMealCount = records.filter(r => r.is_winner && r.prize_type === 'free_meal').length;

  const renderRedemptionBadge = (record: MerchantLotteryRecord) => {
    if (!record.is_winner || !record.redemption_code) return null;
    if (record.refund_status === 'redeemed') {
      return <Text className="block text-xs text-green-600 mt-1">✓ 已核销{record.redeemed_at ? ` ${formatTime(record.redeemed_at)}` : ''}</Text>;
    }
    if (record.expired) {
      return <Text className="block text-xs text-red-500 mt-1">已过期未核销</Text>;
    }
    return <Text className="block text-xs text-amber-600 mt-1">待核销</Text>;
  };

  return (
    <View className="min-h-screen bg-gray-100 pb-6">
      {/* 统计头部 */}
      <View className="bg-gradient-to-b from-[#FF4757] to-[#ff6b7a] px-4 pt-5 pb-12">
        <View className="flex flex-row">
          <View className="flex-1 items-center">
            <View className="flex flex-row items-center gap-1 mb-1">
              <Users size={14} color="#fecaca" />
              <Text className="block text-red-100 text-xs">总抽奖次数</Text>
            </View>
            <Text className="block text-white text-2xl font-bold">{records.length}</Text>
          </View>
          <View className="flex-1 items-center">
            <View className="flex flex-row items-center gap-1 mb-1">
              <Trophy size={14} color="#fecaca" />
              <Text className="block text-red-100 text-xs">中奖次数</Text>
            </View>
            <Text className="block text-white text-2xl font-bold">{winnerCount}</Text>
          </View>
          <View className="flex-1 items-center">
            <View className="flex flex-row items-center gap-1 mb-1">
              <UtensilsCrossed size={14} color="#fecaca" />
              <Text className="block text-red-100 text-xs">霸王餐</Text>
            </View>
            <Text className="block text-white text-2xl font-bold">{freeMealCount}</Text>
          </View>
        </View>
      </View>

      {/* 筛选 Tabs */}
      <View className="bg-white rounded-2xl mx-4 -mt-7 p-2 shadow-sm relative z-10 flex flex-row">
        {FILTER_TABS.map(tab => (
          <View
            key={tab.key}
            className={`flex-1 rounded-xl py-2 ${filter === tab.key ? 'bg-[#FF4757]' : ''}`}
            onClick={() => setFilter(tab.key)}
          >
            <Text className={`block text-center text-sm ${filter === tab.key ? 'text-white font-semibold' : 'text-gray-500'}`}>
              {tab.label}
            </Text>
          </View>
        ))}
      </View>

      {/* 记录列表 */}
      <View className="px-4 mt-4 space-y-3">
        {loading ? (
          <View className="py-16">
            <Text className="block text-center text-gray-400 text-sm">加载中...</Text>
          </View>
        ) : filteredRecords.length === 0 ? (
          <View className="py-16 items-center">
            <Gift size={40} color="#d1d5db" />
            <Text className="block text-center text-gray-400 text-sm mt-3">暂无抽奖记录</Text>
          </View>
        ) : (
          filteredRecords.map(record => (
            <Card key={record.id} className="rounded-2xl border-0 shadow-sm p-4">
              {/* 奖品 + 状态 */}
              <View className="flex flex-row items-center justify-between mb-2">
                <Text className="block text-base font-semibold text-gray-800 flex-1">
                  {record.is_winner ? record.prize_name : '未中奖'}
                </Text>
                {record.is_winner ? (
                  <Badge className="bg-red-50 text-[#FF4757] border-0">中奖</Badge>
                ) : (
                  <Badge className="bg-gray-100 text-gray-400 border-0">未中奖</Badge>
                )}
              </View>

              {/* 用户信息 */}
              <View className="flex flex-row items-center justify-between mb-2">
                <Text className="block text-sm text-gray-600">
                  {record.user_nick_name || '匿名用户'}
                  {record.user_phone ? `（${maskPhone(record.user_phone)}）` : ''}
                </Text>
                <Text className="block text-xs text-gray-400">{formatTime(record.created_at)}</Text>
              </View>

              {/* 霸王餐返还金额 */}
              {record.is_winner && record.prize_type === 'free_meal' && record.refund_amount && (
                <View className="bg-orange-50 rounded-lg px-3 py-2 mb-2">
                  <Text className="block text-xs text-orange-600">
                    霸王餐返还金额 ¥{record.refund_amount}
                  </Text>
                </View>
              )}

              {/* 兑换码 + 核销状态 */}
              {record.is_winner && record.redemption_code && (
                <View className="bg-gray-50 rounded-lg px-3 py-2">
                  <Text className="block text-xs text-gray-500">兑换码：{record.redemption_code}</Text>
                  {renderRedemptionBadge(record)}
                </View>
              )}
            </Card>
          ))
        )}
      </View>
    </View>
  );
};

export default AdminLotteryRecordsPage;
