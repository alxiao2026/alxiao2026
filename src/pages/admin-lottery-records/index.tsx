import { View, Text } from '@tarojs/components';
import { useState, useCallback } from 'react';
import Taro, { useDidShow } from '@tarojs/taro';
import { Network } from '@/network';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trophy, Users, UtensilsCrossed, Gift, Download } from 'lucide-react-taro';

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
  refunded_at?: string;
  redeemed_at?: string;
  expired?: boolean;
  expiry_date?: string;
  created_at: string;
}

type StatusFilterKey = 'all' | 'winner' | 'loser' | 'pending' | 'redeemed' | 'refunded' | 'expired' | 'voided';

const STATUS_FILTER_TABS: { key: StatusFilterKey; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'winner', label: '已中奖' },
  { key: 'loser', label: '未中奖' },
  { key: 'pending', label: '待核销' },
  { key: 'redeemed', label: '已核销' },
  { key: 'refunded', label: '已返现' },
  { key: 'expired', label: '已过期' },
  { key: 'voided', label: '已作废' },
];

const AdminLotteryRecordsPage = () => {
  const [records, setRecords] = useState<MerchantLotteryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilterKey>('all');

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

  const getRecordStatus = (record: MerchantLotteryRecord): { key: StatusFilterKey; label: string; color: string } => {
    if (!record.is_winner) return { key: 'loser', label: '未中奖', color: 'text-gray-500' };
    if (record.refund_status === 'voided') return { key: 'voided', label: '已作废', color: 'text-gray-500' };
    if (
      record.refund_status === 'refunded' ||
      (record.prize_type === 'coupon' && record.refund_status === 'redeemed') ||
      (record.prize_type === 'free_meal' && record.refunded_at)
    ) {
      return { key: 'refunded', label: '已返现', color: 'text-blue-600' };
    }
    if (record.refund_status === 'redeemed') return { key: 'redeemed', label: '已核销', color: 'text-green-600' };
    if (record.expired) return { key: 'expired', label: '已过期', color: 'text-red-500' };
    return { key: 'pending', label: '待核销', color: 'text-amber-600' };
  };

  const filteredRecords = records.filter(r => {
    if (filter === 'all') return true;
    const status = getRecordStatus(r);
    return status.key === filter;
  });

  const winnerCount = records.filter(r => r.is_winner).length;
  const freeMealCount = records.filter(r => r.is_winner && r.prize_type === 'free_meal').length;

  const renderRedemptionBadge = (record: MerchantLotteryRecord) => {
    if (!record.is_winner || !record.redemption_code) return null;
    const status = getRecordStatus(record);
    if (status.key === 'refunded') {
      return (
        <Text className="block text-xs text-blue-600 mt-1">
          ✓ 已返现（原路退回）
          {record.refunded_at ? ` ${formatTime(record.refunded_at)}` : record.redeemed_at ? ` ${formatTime(record.redeemed_at)}` : ''}
        </Text>
      );
    }
    if (status.key === 'redeemed') {
      return <Text className="block text-xs text-green-600 mt-1">✓ 已核销{record.redeemed_at ? ` ${formatTime(record.redeemed_at)}` : ''}</Text>;
    }
    if (record.expired) {
      return <Text className="block text-xs text-red-500 mt-1">已过期未核销</Text>;
    }
    return <Text className="block text-xs text-amber-600 mt-1">待核销</Text>;
  };

  const exportRecords = useCallback(async () => {
    if (filteredRecords.length === 0) {
      Taro.showToast({ title: '没有可导出的记录', icon: 'none' });
      return;
    }
    const userId = Taro.getStorageSync('user_id') || Taro.getStorageSync('userInfo')?.user_id || '';
    if (!userId) {
      Taro.showToast({ title: '请先登录', icon: 'none' });
      return;
    }
    try {
      Taro.showLoading({ title: '正在生成...', mask: true });
      const res = await Network.request({
        url: `/api/lottery/merchant-records/${userId}/export`,
        method: 'POST',
        data: { status: filter }
      });
      console.log('[AdminLotteryRecords] 导出响应:', res.data);
      const envelope: any = (res as any)?.data || res;
      const url = envelope?.data?.url;
      if (!url) {
        Taro.showToast({ title: '导出链接为空', icon: 'none' });
        return;
      }
      if (Taro.getEnv() === Taro.ENV_TYPE.WEB) {
        const link = document.createElement('a');
        link.href = url;
        link.download = `抽奖记录_${new Date().toISOString().slice(0, 10)}.csv`;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        await Taro.setClipboardData({ data: url });
        Taro.showModal({
          title: '导出成功',
          content: '下载链接已复制到剪贴板，请粘贴到浏览器下载',
          showCancel: false
        });
      }
    } catch (e) {
      console.error('[AdminLotteryRecords] 导出失败:', e);
      Taro.showToast({ title: '导出失败', icon: 'none' });
    } finally {
      Taro.hideLoading();
    }
  }, [filter, filteredRecords]);

  return (
    <View className="min-h-screen bg-gray-100 pb-6">
      {/* 统计头部 */}
      <View className="bg-gradient-to-b from-[#FF4757] to-[#ff6b7a] px-4 pt-5 pb-12">
        <View className="flex flex-row">
          <View className="flex-1 items-center">
            <View className="flex flex-row items-center justify-center gap-1 mb-1">
              <Users size={14} color="#fecaca" />
              <Text className="block text-red-100 text-xs">总抽奖次数</Text>
            </View>
            <Text className="block text-white text-2xl font-bold text-center w-full">{records.length}</Text>
          </View>
          <View className="flex-1 items-center">
            <View className="flex flex-row items-center justify-center gap-1 mb-1">
              <Trophy size={14} color="#fecaca" />
              <Text className="block text-red-100 text-xs">中奖次数</Text>
            </View>
            <Text className="block text-white text-2xl font-bold text-center w-full">{winnerCount}</Text>
          </View>
          <View className="flex-1 items-center">
            <View className="flex flex-row items-center justify-center gap-1 mb-1">
              <UtensilsCrossed size={14} color="#fecaca" />
              <Text className="block text-red-100 text-xs">霸王餐</Text>
            </View>
            <Text className="block text-white text-2xl font-bold text-center w-full">{freeMealCount}</Text>
          </View>
        </View>
      </View>

      {/* 筛选 Tabs + 导出 */}
      <View className="bg-white rounded-2xl mx-4 -mt-7 p-3 shadow-sm relative z-10">
        <View className="flex flex-row flex-wrap gap-2 mb-3">
          {STATUS_FILTER_TABS.map(tab => (
            <View
              key={tab.key}
              className={`rounded-full px-3 py-2 ${filter === tab.key ? 'bg-[#FF4757]' : 'bg-gray-100'}`}
              onClick={() => setFilter(tab.key)}
            >
              <Text className={`block text-xs ${filter === tab.key ? 'text-white font-semibold' : 'text-gray-600'}`}>
                {tab.label}
              </Text>
            </View>
          ))}
        </View>
        <Button variant="outline" size="sm" className="w-full" onClick={exportRecords}>
          <Download size={14} color="#666" className="mr-1" />
          <Text>导出当前筛选记录（{filteredRecords.length} 条）</Text>
        </Button>
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
          filteredRecords.map(record => {
            const status = getRecordStatus(record);
            return (
              <Card key={record.id} className="rounded-2xl border-0 shadow-sm p-4">
                {/* 奖品 + 状态 */}
                <View className="flex flex-row items-center justify-between mb-2">
                  <Text className="block text-base font-semibold text-gray-800 flex-1">
                    {record.is_winner ? record.prize_name : '未中奖'}
                  </Text>
                  <Badge className={`border-0 ${status.key === 'loser' ? 'bg-gray-100 text-gray-500' : status.key === 'redeemed' ? 'bg-green-50 text-green-600' : status.key === 'refunded' ? 'bg-blue-50 text-blue-600' : status.key === 'expired' ? 'bg-red-50 text-red-500' : status.key === 'voided' ? 'bg-gray-100 text-gray-500' : 'bg-amber-50 text-amber-600'}`}>
                    {status.label}
                  </Badge>
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
            );
          })
        )}
      </View>
    </View>
  );
};

export default AdminLotteryRecordsPage;
