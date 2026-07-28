import { useState, useEffect } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import { Network } from '@/network';
import { Button } from '@/components/ui/button';
import { Download, Clock, Package } from 'lucide-react-taro';

interface SettlementRecord {
  id: string;
  order_id: string;
  order_amount: number;
  settlement_type: number;
  commission_rate: number;
  commission_amount: number;
  settlement_amount: number;
  settlement_price?: number;
  settlement_date: string;
  status: string;
  settled_at?: string;
  withdrawn_at?: string;
  created_at: string;
  orders?: any;
  packages?: any;
}

export default function SettlementRecordsPage() {
  const router = useRouter();
  const merchantId = router.params.merchant_id || '';
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
      if (data) {
        setRecords(data);
      }
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
      if (data && data.length > 0) {
        // 生成 CSV 内容
        const headers = Object.keys(data[0]);
        const csvContent = [
          headers.join(','),
          ...data.map((row: any) => headers.map(h => `"${row[h] || ''}"`).join(','))
        ].join('\n');

        // 创建下载链接
        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `商家结算明细_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        
        Taro.showToast({ title: '导出成功', icon: 'success' });
      } else {
        Taro.showToast({ title: '暂无数据可导出', icon: 'none' });
      }
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
    };
    return map[status] || status;
  };

  const getStatusColor = (status: string) => {
    const map: Record<string, string> = {
      pending: 'text-yellow-600',
      settled: 'text-blue-600',
      withdrawn: 'text-green-600',
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
                      <Text className="block text-xs text-gray-500">订单金额</Text>
                      <Text className="block text-sm font-semibold text-gray-800">¥{record.order_amount.toFixed(2)}</Text>
                    </View>
                    <View className="flex justify-between">
                      <Text className="block text-xs text-gray-500">
                        {record.settlement_type === 1 ? `佣金率 ${record.commission_rate}%` : '结算价'}
                      </Text>
                      <Text className="block text-sm text-gray-600">
                        {record.settlement_type === 1 ? `¥${record.commission_amount.toFixed(2)}` : `¥${(record.settlement_price ?? 0).toFixed(2)}`}
                      </Text>
                    </View>
                    <View className="flex justify-between border-t border-gray-100 pt-2">
                      <Text className="block text-xs text-gray-500">商家应得</Text>
                      <Text className="block text-sm font-bold text-green-600">¥{record.settlement_amount.toFixed(2)}</Text>
                    </View>
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
