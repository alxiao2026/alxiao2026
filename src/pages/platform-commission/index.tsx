import { useState, useEffect } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { Network } from '@/network';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, TrendingUp, DollarSign } from 'lucide-react-taro';
import { buildSettlementCsv, downloadCsvFile, SettlementRevocation } from '@/lib/settlement-export';

interface CommissionSummary {
  total_commission: number;
  total_settlement: number;
  total_orders: number;
}

interface CommissionRecord {
  id?: string;
  order_id: string;
  merchant_id: string;
  package_id: string;
  order_amount: number;
  settlement_type: number;
  commission_rate: number;
  commission_amount: number;
  settlement_amount: number;
  settlement_date: string;
  status: string;
  settled_at?: string;
  created_at: string;
  verified_qty?: number;
  revocations?: SettlementRevocation[];
  orders?: {
    id: string;
    order_no?: string | null;
    created_at?: string | null;
    paid_at?: string | null;
    verified_at?: string | null;
    verification_code?: string | null;
  } | null;
  merchants?: { id: string | number; name?: string } | null;
  packages?: { id: string; name?: string } | null;
}

const STATUS_MAP: Record<string, { text: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; className: string }> = {
  settled: { text: '已结算', variant: 'secondary', className: 'bg-green-100 text-green-700 border-transparent' },
  pending: { text: '待结算', variant: 'secondary', className: 'bg-yellow-100 text-yellow-700 border-transparent' },
  withdrawn: { text: '已提现', variant: 'secondary', className: 'bg-blue-100 text-blue-700 border-transparent' },
  revoked: { text: '撤销核销', variant: 'secondary', className: 'bg-red-100 text-red-600 border-transparent' },
};

const formatTime = (v?: string | null) => {
  if (!v) return '-';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '-';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const getStatusInfo = (status: string) =>
  STATUS_MAP[status] || { text: status || '未知', variant: 'outline' as const, className: '' };

export default function PlatformCommissionPage() {
  const [summary, setSummary] = useState<CommissionSummary>({
    total_commission: 0,
    total_settlement: 0,
    total_orders: 0,
  });
  const [records, setRecords] = useState<CommissionRecord[]>([]);
  const [exporting, setExporting] = useState(false);
  const [startDate] = useState("");
  const [endDate] = useState("");
  const [, setLoading] = useState(false);

  useEffect(() => {
    fetchSummary();
    fetchRecords();
  }, []);

  const fetchSummary = async () => {
    try {
      const res = await Network.request({
        url: '/api/settlement/commission/summary',
        method: 'GET',
      });
      const data = (res.data as any)?.data;
      if (data) {
        setSummary(data);
      }
    } catch (error) {
      console.error('获取汇总失败:', error);
    }
  };

  const fetchRecords = async () => {
    try {
      setLoading(true);
      const { data } = await Network.request({ url: "/api/settlement/commission", method: "GET", data: { start_date: startDate, end_date: endDate } });
      if (data?.data) {
        const list = data.data.list;
        setRecords(Array.isArray(list) ? list : []);
      } else {
        setRecords([]);
      }
    } catch (error) {
      console.error('获取佣金明细失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportRecords = async () => {
    try {
      setExporting(true);
      const res = await Network.request({
        url: '/api/settlement/commission/export',
        method: 'GET',
      });
      const data = (res.data as any)?.data;
      if (!data || data.length === 0) {
        Taro.showToast({ title: '暂无数据可导出', icon: 'none' });
        return;
      }
      // 与商家端导出共用同一套表头与数据行（含撤销核销冲销行），维度完全一致
      const csvContent = buildSettlementCsv(data);
      const fileName = `平台佣金明细_${new Date().toISOString().split('T')[0]}.csv`;
      downloadCsvFile(fileName, csvContent);
    } catch (error) {
      console.error('导出失败:', error);
      Taro.showToast({ title: '导出失败', icon: 'none' });
    } finally {
      setExporting(false);
    }
  };

  return (
    <View className="min-h-screen bg-gray-50 pb-20">
      {/* 顶部导航 */}
      <View className="bg-white px-4 py-3 flex items-center justify-between border-b border-gray-200">
        <Text className="block text-lg font-semibold">平台佣金明细</Text>
        <Button
          size="sm"
          variant="outline"
          onClick={exportRecords}
          disabled={exporting}
        >
          <Download size={14} color="#FF4757" className="mr-1" />
          {exporting ? '导出中...' : '导出'}
        </Button>
      </View>

      <ScrollView scrollY className="flex-1">
        <View className="p-4">
          {/* 汇总卡片 */}
          <View className="bg-gradient-to-r from-purple-500 to-indigo-500 rounded-2xl p-5 mb-4 shadow-lg">
            <View className="flex items-center mb-4">
              <TrendingUp size={24} color="#fff" className="mr-2" />
              <Text className="block text-white text-base font-semibold">佣金汇总</Text>
            </View>
            <View className="grid grid-cols-3 gap-4">
              <View className="text-center">
                <Text className="block text-white text-2xl font-bold">¥{summary.total_commission.toFixed(2)}</Text>
                <Text className="block text-white text-xs opacity-80 mt-1">累计佣金</Text>
              </View>
              <View className="text-center">
                <Text className="block text-white text-2xl font-bold">¥{summary.total_settlement.toFixed(2)}</Text>
                <Text className="block text-white text-xs opacity-80 mt-1">累计结算</Text>
              </View>
              <View className="text-center">
                <Text className="block text-white text-2xl font-bold">{summary.total_orders}</Text>
                <Text className="block text-white text-xs opacity-80 mt-1">订单总数</Text>
              </View>
            </View>
          </View>

          {/* 佣金明细列表 */}
          <View className="space-y-3">
            {records.length === 0 ? (
              <View className="bg-white rounded-2xl p-8 text-center">
                <DollarSign size={48} color="#D1D5DB" className="mx-auto mb-4" />
                <Text className="block text-sm text-gray-400">暂无佣金记录</Text>
              </View>
            ) : (
              records.map((record) => {
                const statusInfo = getStatusInfo(record.status);
                const isRevoked = record.status === 'revoked';
                return (
                  <View key={record.id || record.order_id} className="bg-white rounded-2xl p-4 shadow-sm">
                    <View className="flex items-center justify-between mb-2">
                      <Text className="block text-sm font-semibold text-gray-800">
                        {record.merchants?.name || '未知商家'}
                      </Text>
                      <Badge variant={statusInfo.variant} className={statusInfo.className}>
                        <Text className="text-xs">{statusInfo.text}</Text>
                      </Badge>
                    </View>
                    <Text className="block text-xs text-gray-400 mb-1">
                      订单号：{record.orders?.order_no || record.order_id}
                    </Text>
                    <Text className="block text-xs text-gray-500 mb-3">
                      {record.packages?.name || '未知套餐'}
                    </Text>

                    <View className="space-y-2">
                      <View className="flex justify-between">
                        <Text className="block text-xs text-gray-500">订单金额</Text>
                        <Text className="block text-sm font-semibold text-gray-800">¥{record.order_amount.toFixed(2)}</Text>
                      </View>
                      <View className="flex justify-between">
                        <Text className="block text-xs text-gray-500">佣金率</Text>
                        <Text className="block text-sm text-gray-600">{record.commission_rate}%</Text>
                      </View>
                      <View className="flex justify-between border-t border-gray-100 pt-2">
                        <Text className="block text-xs text-gray-500">平台佣金</Text>
                        <Text className={`block text-sm font-bold ${isRevoked ? 'text-gray-400' : 'text-purple-600'}`}>
                          ¥{record.commission_amount.toFixed(2)}
                        </Text>
                      </View>
                      <View className="flex justify-between">
                        <Text className="block text-xs text-gray-500">商家应得</Text>
                        <Text className={`block text-sm font-semibold ${isRevoked ? 'text-gray-400' : 'text-green-600'}`}>
                          ¥{record.settlement_amount.toFixed(2)}
                        </Text>
                      </View>
                      {isRevoked && (
                        <Text className="block text-xs text-red-400">该订单已撤销核销，不结算佣金</Text>
                      )}
                      {/* 撤销核销红字记录：撤销份数/冲销佣金与应得/撤销时间/操作人，独立成行醒目展示 */}
                      {(record.revocations || []).map((rv, idx) => (
                        <View key={`rev-${idx}`} className="bg-red-50 rounded-lg px-2 py-2">
                          <View className="flex justify-between">
                            <Text className="block text-xs text-red-600 font-medium">
                              撤销核销 {rv.revoke_count} 份
                            </Text>
                            <Text className="block text-xs text-red-600 font-medium">
                              佣金 -¥{Number(rv.rollback_commission || 0).toFixed(2)} · 应得 -¥{Number(rv.rollback_amount || 0).toFixed(2)}
                            </Text>
                          </View>
                          <Text className="block text-xs text-red-400 mt-1">
                            {formatTime(rv.created_at)} · 操作人：{rv.operator_name || '—'}
                          </Text>
                        </View>
                      ))}
                    </View>

                    <View className="mt-3 pt-3 border-t border-gray-100 space-y-1">
                      <Text className="block text-xs text-gray-400">下单时间：{formatTime(record.orders?.created_at)}</Text>
                      <Text className="block text-xs text-gray-400">支付时间：{formatTime(record.orders?.paid_at)}</Text>
                      <Text className="block text-xs text-gray-400">
                        核销时间：{formatTime(record.orders?.verified_at || record.settled_at)}
                      </Text>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
