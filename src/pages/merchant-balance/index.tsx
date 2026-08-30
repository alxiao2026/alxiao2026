import { useState, useEffect } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import { Network } from '@/network';
import { preloadSubscribeTemplates, requestSubscribeByScene } from '@/utils/subscribe-message';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Wallet, Clock, CircleX } from 'lucide-react-taro';

interface Balance {
  balance: number;
  total_settled: number;
  total_withdrawn: number;
}

interface WithdrawalRecord {
  id: string;
  amount: number;
  status: string;
  requested_at: string;
}

export default function MerchantBalancePage() {
  const router = useRouter();
  const merchantId = router.params.merchant_id || Taro.getStorageSync('merchant_id') || '';
  const [balance, setBalance] = useState<Balance>({
    balance: 0,
    total_settled: 0,
    total_withdrawn: 0,
  });
  const [withdrawalRecords, setWithdrawalRecords] = useState<WithdrawalRecord[]>([]);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);
  const [, setLoading] = useState(false);

  useEffect(() => {
    preloadSubscribeTemplates();
    fetchBalance();
    fetchWithdrawalRecords();
  }, []);

  const fetchBalance = async () => {
    if (!merchantId) return;
    try {
      setLoading(true);
      const res = await Network.request({
        url: `/api/settlement/balance/${merchantId}`,
        method: 'GET',
      });
      const data = (res.data as any)?.data;
      if (data) {
        setBalance(data);
      }
    } catch (error) {
      console.error('获取余额失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchWithdrawalRecords = async () => {
    if (!merchantId) return;
    try {
      const res = await Network.request({
        url: `/api/settlement/withdrawals?merchant_id=${merchantId}`,
        method: 'GET',
      });
      const data = (res.data as any)?.data;
      if (data) {
        setWithdrawalRecords(data);
      }
    } catch (error) {
      console.error('获取提现记录失败:', error);
    }
  };

  const handleWithdrawClick = () => {
    // 点击申请提现瞬间同步请求订阅授权（提现提交/到账/拒绝通知），不阻断提交流程
    requestSubscribeByScene('withdraw');
    requestWithdrawal();
  };

  const requestWithdrawal = async () => {
    if (!merchantId || !withdrawAmount) return;
    const amount = parseFloat(withdrawAmount);
    if (amount <= 0 || amount > balance.balance) {
      Taro.showToast({ title: '提现金额无效', icon: 'none' });
      return;
    }

    try {
      setWithdrawing(true);
      const res = await Network.request({
        url: '/api/settlement/withdraw',
        method: 'POST',
        data: {
          merchant_id: merchantId,
          amount: amount,
        },
      });
      const result = (res.data as any)?.data;
      if (result) {
        Taro.showToast({ title: '提现申请成功', icon: 'success' });
        setWithdrawAmount('');
        fetchBalance();
        fetchWithdrawalRecords();
      }
    } catch (error) {
      console.error('提现申请失败:', error);
      // 透出后端校验信息（如「每日仅可申请 1 次提现」「单笔最低 ¥1」），便于用户对照提现规则
      const backendMsg = (error as any)?.data?.message || (error as any)?.data?.msg;
      Taro.showToast({ title: backendMsg || '提现申请失败', icon: 'none' });
    } finally {
      setWithdrawing(false);
    }
  };

  const getStatusText = (status: string) => {
    const map: Record<string, string> = {
      pending: '处理中',
      success: '成功',
      rejected: '已拒绝',
      failed: '失败',
    };
    return map[status] || status;
  };

  const getStatusColor = (status: string) => {
    const map: Record<string, string> = {
      pending: 'text-yellow-600',
      success: 'text-green-600',
      rejected: 'text-red-600',
      failed: 'text-red-600',
    };
    return map[status] || 'text-gray-600';
  };

  return (
    <View className="min-h-screen bg-gray-50 pb-20">
      {/* 顶部导航 */}
      <View className="bg-white px-4 py-3 flex items-center border-b border-gray-200">
        <Text className="block text-lg font-semibold">商家余额</Text>
      </View>

      <ScrollView scrollY className="flex-1">
        <View className="p-4">
          {/* 余额卡片 */}
          <View className="bg-gradient-to-r from-red-500 to-pink-500 rounded-2xl p-5 mb-4 shadow-lg">
            <View className="flex items-center mb-3">
              <Wallet size={24} color="#fff" className="mr-2" />
              <Text className="block text-white text-base font-semibold">可提现余额</Text>
            </View>
            <Text className="block text-white text-3xl font-bold mb-4">
              ¥{balance.balance.toFixed(2)}
            </Text>
            <View className="flex flex-row justify-between">
              <View>
                <Text className="block text-white text-xs opacity-80">累计已结算</Text>
                <Text className="block text-white text-sm font-semibold">¥{balance.total_settled.toFixed(2)}</Text>
              </View>
              <View>
                <Text className="block text-white text-xs opacity-80">累计已提现</Text>
                <Text className="block text-white text-sm font-semibold">¥{balance.total_withdrawn.toFixed(2)}</Text>
              </View>
            </View>
          </View>

          {/* 提现申请 */}
          <View className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
            <Text className="block text-base font-semibold text-gray-800 mb-4">申请提现</Text>
            <Label className="block text-sm text-gray-600 mb-2">提现金额（元）</Label>
            <Input
              type="digit"
              value={withdrawAmount}
              onInput={(e) => setWithdrawAmount(e.detail.value)}
              placeholder="请输入提现金额"
              className="mb-4"
            />
            <Button
              className="w-full bg-gradient-to-r from-green-500 to-teal-500 text-white rounded-full h-12 text-base font-semibold"
              onClick={handleWithdrawClick}
              disabled={withdrawing || !withdrawAmount}
            >
              {withdrawing ? '申请中...' : '申请提现'}
            </Button>
            <Text className="block text-xs text-gray-400 mt-2 text-center">
              提现将转入您绑定的银行账户，审核通过后 T+7 个工作日到账
            </Text>
          </View>

          {/* 提现规则（审核要求清晰公示：额度/次数/时间/到账） */}
          <View className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
            <View className="flex items-center mb-3">
              <Clock size={16} color="#6B7280" className="mr-2" />
              <Text className="block text-base font-semibold text-gray-800">提现规则</Text>
            </View>
            <View className="flex flex-col">
              {[
                ['可提现额度', '账户可提现余额全额可提，单笔最低 ¥1'],
                ['每日提现次数', '每个自然日限申请 1 次'],
                ['提现受理时间', '全天可提交申请，平台工作日（周一至周五 9:00-18:00）审核处理'],
                ['到账时间', '审核通过后 T+7 个工作日内转入您绑定的银行账户'],
                ['手续费', '平台不收取提现手续费'],
              ].map(([label, value]) => (
                <View key={label} className="flex py-2 border-b border-gray-100 last:border-b-0">
                  <Text className="block text-xs text-gray-500 w-24 flex-shrink-0">{label}</Text>
                  <Text className="block text-xs text-gray-700 flex-1">{value}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* 提现记录 */}
          <View className="bg-white rounded-2xl p-4 shadow-sm">
            <Text className="block text-base font-semibold text-gray-800 mb-4">提现记录</Text>
            {withdrawalRecords.length === 0 ? (
              <Text className="block text-sm text-gray-400 text-center py-4">暂无提现记录</Text>
            ) : (
              <View className="space-y-3">
                {withdrawalRecords.map((record) => (
                  <View key={record.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                    <View className="flex items-center">
                      {record.status === 'pending' && <Clock size={16} color="#F59E0B" className="mr-2" />}
                      {record.status === 'rejected' && <CircleX size={16} color="#DC2626" className="mr-2" />}
                      <View>
                        <Text className="block text-sm font-semibold text-gray-800">¥{record.amount.toFixed(2)}</Text>
                        <Text className="block text-xs text-gray-500">{record.requested_at}</Text>
                      </View>
                    </View>
                    <Text className={`block text-sm font-medium ${getStatusColor(record.status)}`}>
                      {getStatusText(record.status)}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
