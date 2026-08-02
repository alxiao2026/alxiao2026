import { useState, useEffect } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { Network } from '@/network';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, TrendingUp, DollarSign } from 'lucide-react-taro';

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
  orders?: {
    id: string;
    order_no?: string | null;
    created_at?: string | null;
    paid_at?: string | null;
    verified_at?: string | null;
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

      // 生成 CSV（中文表头，含订单号与时间字段）
      const headers = ['订单号', '商家', '套餐', '订单金额', '佣金率(%)', '平台佣金', '商家应得', '状态', '下单时间', '支付时间', '核销时间', '结算日期'];
      const statusTextMap: Record<string, string> = {
        settled: '已结算',
        pending: '待结算',
        withdrawn: '已提现',
        revoked: '撤销核销',
      };
      const rows = data.map((r: CommissionRecord) => [
        r.orders?.order_no || r.order_id,
        r.merchants?.name || '',
        r.packages?.name || '',
        Number(r.order_amount || 0).toFixed(2),
        r.commission_rate ?? 0,
        Number(r.commission_amount || 0).toFixed(2),
        Number(r.settlement_amount || 0).toFixed(2),
        statusTextMap[r.status] || r.status || '',
        formatTime(r.orders?.created_at),
        formatTime(r.orders?.paid_at),
        formatTime(r.orders?.verified_at || r.settled_at),
        r.settlement_date || '',
      ]);
      const escapeCell = (cell: unknown) => `"${String(cell ?? '').replace(/"/g, '""')}"`;
      const csvContent = '﻿' + [headers, ...rows].map((row) => row.map(escapeCell).join(',')).join('\n');
      const fileName = `平台佣金明细_${new Date().toISOString().split('T')[0]}.csv`;

      if (Taro.getEnv() === Taro.ENV_TYPE.WEB) {
        // H5：Blob 下载
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = fileName;
        link.click();
        Taro.showToast({ title: '导出成功', icon: 'success' });
      } else {
        // 小程序：写入本地文件后打开预览（showMenu 支持转发），失败降级为复制剪贴板
        const fs = Taro.getFileSystemManager();
        const userDataPath = (Taro as any).env?.USER_DATA_PATH || 'wxfile://tmp';
        const filePath = `${userDataPath}/${fileName}`;
        fs.writeFile({
          filePath,
          data: csvContent,
          encoding: 'utf8',
          success: () => {
            Taro.openDocument({
              filePath,
              showMenu: true,
              fail: () => {
                Taro.setClipboardData({ data: csvContent });
                Taro.showToast({ title: '已复制到剪贴板', icon: 'none' });
              },
            });
          },
          fail: (err) => {
            console.error('写入导出文件失败:', err);
            Taro.setClipboardData({ data: csvContent });
            Taro.showToast({ title: '已复制到剪贴板', icon: 'none' });
          },
        });
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
