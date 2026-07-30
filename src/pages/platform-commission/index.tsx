import { useState, useEffect } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { Network } from '@/network';
import { Button } from '@/components/ui/button';
import { Download, TrendingUp, DollarSign, Calendar } from 'lucide-react-taro';

interface CommissionSummary {
  total_commission: number;
  total_settlement: number;
  total_orders: number;
}

interface CommissionRecord {
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
  merchants?: any;
  packages?: any;
}

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
        link.download = `平台佣金明细_${new Date().toISOString().split('T')[0]}.csv`;
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
              records.map((record) => (
                <View key={record.order_id} className="bg-white rounded-2xl p-4 shadow-sm">
                  <View className="flex items-center justify-between mb-3">
                    <Text className="block text-sm font-semibold text-gray-800">
                      {record.merchants?.name || '未知商家'}
                    </Text>
                    <Text className="block text-xs text-gray-500">
                      {record.packages?.name || '未知套餐'}
                    </Text>
                  </View>

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
                      <Text className="block text-sm font-bold text-purple-600">¥{record.commission_amount.toFixed(2)}</Text>
                    </View>
                    <View className="flex justify-between">
                      <Text className="block text-xs text-gray-500">商家应得</Text>
                      <Text className="block text-sm font-semibold text-green-600">¥{record.settlement_amount.toFixed(2)}</Text>
                    </View>
                  </View>

                  <View className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                    <View className="flex items-center">
                      <Calendar size={12} color="#9CA3AF" className="mr-1" />
                      <Text className="block text-xs text-gray-400">{record.settlement_date}</Text>
                    </View>
                    <Text className={`block text-xs font-medium ${
                      record.status === 'settled' ? 'text-green-600' : 'text-yellow-600'
                    }`}
                    >
                      {record.status === 'settled' ? '已结算' : '待结算'}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
