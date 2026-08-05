import { useState, useEffect } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import { Network } from '@/network';
import { Button } from '@/components/ui/button';
import { Download, Clock, Package } from 'lucide-react-taro';
import { buildSettlementCsv, downloadCsvFile, SettlementRevocation } from '@/lib/settlement-export';

interface SettlementRecord {
  id: string;
  order_id: string;
  order_amount: number;
  commission_amount: number;
  settlement_amount: number;
  rebate_amount?: number;
  settlement_date: string;
  status: string;
  settled_at?: string;
  withdrawn_at?: string;
  created_at: string;
  verified_qty?: number;
  revocations?: SettlementRevocation[];
  orders?: any;
  packages?: any;
}

const formatTime = (v?: string | null) => {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '—';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export default function SettlementRecordsPage() {
  const router = useRouter();
  const merchantId = router.params.merchant_id || Taro.getStorageSync('merchant_id') || '';
  const [records, setRecords] = useState<SettlementRecord[]>([]);
  const [exporting, setExporting] = useState(false);
  const [, setLoading] = useState(false);

  useEffect(() => {
    fetchRecords();
  }, []);

  const fetchRecords = async () => {
    if (!merchantId) return;
    try {
      setLoading(true);
      const res = await Network.request({
        url: `/api/settlement/records?merchant_id=${merchantId}`,
        method: 'GET',
      });
      const data = (res.data as any)?.data;
      setRecords(data?.list || []);
    } catch (error) {
      console.error('获取结算记录失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportRecords = async () => {
    try {
      setExporting(true);
      const res = await Network.request({
        url: `/api/settlement/records/export?merchant_id=${merchantId}`,
        method: 'GET',
      });
      const data = (res.data as any)?.data;
      if (!data || data.length === 0) {
        Taro.showToast({ title: '暂无数据可导出', icon: 'none' });
        return;
      }
      // 与平台端导出共用同一套表头与数据行（含撤销核销冲销行），维度完全一致
      const csvContent = buildSettlementCsv(data);
      const fileName = `商家结算明细_${new Date().toISOString().split('T')[0]}.csv`;
      downloadCsvFile(fileName, csvContent);
    } catch (error) {
      console.error('导出失败:', error);
      Taro.showToast({ title: '导出失败', icon: 'none' });
    } finally {
      setExporting(false);
    }
  };

  const getStatusText = (status: string) => {
    const map: Record<string, string> = {
      pending: '待结算',
      settled: '已结算',
      withdrawn: '已提现',
      revoked: '撤销核销',
    };
    return map[status] || status;
  };

  const getStatusColor = (status: string) => {
    const map: Record<string, string> = {
      pending: 'text-yellow-600',
      settled: 'text-blue-600',
      withdrawn: 'text-green-600',
      revoked: 'text-red-600',
    };
    return map[status] || 'text-gray-600';
  };

  return (
    <View className="min-h-screen bg-gray-50 pb-20">
      {/* 顶部导航 */}
      <View className="bg-white px-4 py-3 flex items-center justify-between border-b border-gray-200">
        <Text className="block text-lg font-semibold">结算明细</Text>
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
          {records.length === 0 ? (
            <View className="bg-white rounded-2xl p-8 text-center">
              <Package size={48} color="#D1D5DB" className="mx-auto mb-4" />
              <Text className="block text-sm text-gray-400">暂无结算记录</Text>
            </View>
          ) : (
            <View className="space-y-3">
              {records.map((record) => (
                <View key={record.id} className="bg-white rounded-2xl p-4 shadow-sm">
                  <View className="flex items-center justify-between mb-3">
                    <Text className="block text-sm font-semibold text-gray-800">
                      订单号：{record.order_id.slice(0, 8)}...
                    </Text>
                    <Text className={`block text-xs font-medium ${getStatusColor(record.status)}`}>
                      {getStatusText(record.status)}
                    </Text>
                  </View>

                  <View className="space-y-2">
                    <View className="flex justify-between">
                      <Text className="block text-xs text-gray-500">核销份数</Text>
                      <Text className="block text-sm text-gray-800">{record.verified_qty ?? 0} 份</Text>
                    </View>
                    <View className="flex justify-between">
                      <Text className="block text-xs text-gray-500">核销码</Text>
                      <Text className="block text-sm text-gray-800">{record.orders?.verification_code || '—'}</Text>
                    </View>
                    <View className="flex justify-between">
                      <Text className="block text-xs text-gray-500">核销时间</Text>
                      <Text className="block text-sm text-gray-800">
                        {formatTime(record.orders?.verified_at)}
                      </Text>
                    </View>
                    <View className="flex justify-between border-t border-gray-100 pt-2">
                      <Text className="block text-xs text-gray-500">订单金额</Text>
                      <Text className="block text-sm font-semibold text-gray-800">¥{record.order_amount.toFixed(2)}</Text>
                    </View>
                    {/* 中奖返现：消费者中奖后平台已即时返还的金额，从商家应得中扣除 */}
                    {Number(record.rebate_amount ?? 0) > 0 && (
                      <View className="flex justify-between">
                        <Text className="block text-xs text-orange-500">中奖返现</Text>
                        <Text className="block text-sm text-orange-500">-¥{Number(record.rebate_amount).toFixed(2)}</Text>
                      </View>
                    )}
                    <View className="flex justify-between">
                      <Text className="block text-xs text-gray-500">平台佣金</Text>
                      <Text className="block text-sm text-gray-600">¥{record.commission_amount.toFixed(2)}</Text>
                    </View>
                    <View className="flex justify-between border-t border-gray-100 pt-2">
                      <Text className="block text-xs text-gray-500">商家应得</Text>
                      <Text className="block text-sm font-bold text-green-600">¥{record.settlement_amount.toFixed(2)}</Text>
                    </View>
                    {/* 退款标记：退款份数为未核销部分，未计入本账单，仅作标记 */}
                    {Number(record.orders?.refunded_quantity ?? 0) > 0 && (
                      <View className="flex justify-between bg-orange-50 rounded-lg px-2 py-2">
                        <Text className="block text-xs text-orange-600">退款标记</Text>
                        <Text className="block text-xs text-orange-600">
                          已退款 {record.orders.refunded_quantity} 份 · ¥{(Number(record.orders.refunded_quantity) * Number(record.orders.price ?? 0)).toFixed(2)}（未核销份数，未计入本账单）
                        </Text>
                      </View>
                    )}
                    {/* 撤销核销红字记录：撤销份数/扣回金额/撤销时间/操作人，独立成行醒目展示 */}
                    {(record.revocations || []).map((rv, idx) => (
                      <View key={`rev-${idx}`} className="bg-red-50 rounded-lg px-2 py-2">
                        <View className="flex justify-between">
                          <Text className="block text-xs text-red-600 font-medium">
                            撤销核销 {rv.revoke_count} 份
                          </Text>
                          <Text className="block text-xs text-red-600 font-medium">
                            -¥{Number(rv.rollback_amount || 0).toFixed(2)}
                          </Text>
                        </View>
                        <Text className="block text-xs text-red-400 mt-1">
                          {formatTime(rv.created_at)} · 操作人：{rv.operator_name || '—'}
                        </Text>
                      </View>
                    ))}
                    {/* 商家应得金额来源备注（含中奖返现扣减链路） */}
                    <Text className="block text-xs text-gray-400 leading-relaxed">
                      {(() => {
                        const orderAmt = Number(record.order_amount) || 0;
                        const rebate = Number(record.rebate_amount) || 0;
                        const commission = Number(record.commission_amount) || 0;
                        const parts: string[] = [`订单金额 ¥${orderAmt.toFixed(2)}`];
                        if (rebate > 0) parts.push(`中奖返现 ¥${rebate.toFixed(2)}`);
                        if (commission > 0) {
                          const base = Math.max(orderAmt - rebate, 0.01);
                          parts.push(`平台佣金 ¥${commission.toFixed(2)}（抽佣 ${(commission / base * 100).toFixed(1).replace(/\.0$/, '')}%）`);
                        }
                        if (parts.length === 1) return '来源：订单金额全额结算（平台未抽佣）= 商家应得';
                        return `来源：${parts.join(' − ')} = 商家应得`;
                      })()}
                    </Text>
                  </View>

                  <View className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                    <Text className="block text-xs text-gray-400">
                      结算日期：{record.settlement_date}
                    </Text>
                    {record.status === 'pending' && <Clock size={14} color="#F59E0B" />}
                    {record.status === 'settled' && <Clock size={14} color="#3B82F6" />}
                    {record.status === 'withdrawn' && <Clock size={14} color="#10B981" />}
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
