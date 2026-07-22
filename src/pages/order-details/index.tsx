import { View, Text } from '@tarojs/components';
import { useState, useEffect } from 'react';
import Taro from '@tarojs/taro';
import { Network } from '@/network';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Calendar, Funnel } from 'lucide-react-taro';

interface OrderItem {
  id: string;
  package_name: string;
  price: string;
  quantity: number;
  status: string;
  created_at: string;
  verified_at: string | null;
  verification_code: string;
  nick_name: string | null;
  phone: string | null;
  verified_count: number;
  order_no: string | null;
}

type TabType = 'all' | 'pending' | 'used';

export default function OrderDetailsPage() {
  const [merchantInfo, setMerchantInfo] = useState<{ id: number; name: string } | null>(null);
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [showFilter, setShowFilter] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    const userId = Taro.getStorageSync('user_id') || Taro.getStorageSync('userInfo')?.user_id || '';
    if (userId) {
      fetchMerchantInfo(userId);
    }
  }, []);

  const fetchMerchantInfo = async (userId: string) => {
    try {
      const res = await Network.request({ url: `/api/users/${userId}/merchant` });
      const merchant = (res.data as any)?.data;
      if (merchant) {
        setMerchantInfo(merchant);
        fetchOrders(merchant.id, 'all');
      }
    } catch (err) {
      console.log('当前用户非商家或未绑定门店');
    }
  };

  const fetchOrders = async (merchantId: number, status: string) => {
    setLoading(true);
    try {
      const params: Record<string, string> = { merchant_id: String(merchantId) };
      if (status !== 'all') params.status = status;
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;
      const res = await Network.request({ url: '/api/orders', data: params });
      const data = (res.data as any)?.data || res.data;
      setOrders(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('获取订单失败:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab as TabType);
    if (merchantInfo) {
      fetchOrders(merchantInfo.id, tab);
    }
  };

  const handleApplyFilter = () => {
    setShowFilter(false);
    if (merchantInfo) {
      fetchOrders(merchantInfo.id, activeTab);
    }
  };

  const handleClearFilter = () => {
    setStartDate('');
    setEndDate('');
    setShowFilter(false);
    if (merchantInfo) {
      fetchOrders(merchantInfo.id, activeTab);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid': return { text: '待使用', variant: 'default' as const };
      case 'used': return { text: '已核销', variant: 'secondary' as const };
      case 'refunded': return { text: '已退款', variant: 'outline' as const };
      case 'expired': return { text: '已过期', variant: 'outline' as const };
      default: return { text: status, variant: 'outline' as const };
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  return (
    <View className="min-h-screen bg-gray-50">
      {/* 头部 */}
      <View className="bg-gradient-to-b from-blue-500 to-blue-400 px-4 pt-4 pb-4">
        <View className="flex flex-row items-center justify-between mb-4">
          <View className="flex flex-row items-center gap-2" onClick={() => Taro.navigateBack()}>
            <ChevronLeft size={20} color="#ffffff" />
            <Text className="block text-white text-base font-semibold">订单明细</Text>
          </View>
          <View className="flex flex-row items-center gap-2">
            <View className="bg-white rounded-full px-4 py-2 flex flex-row items-center gap-1" onClick={() => setShowFilter(!showFilter)}>
              <Funnel size={16} color="#3b82f6" />
              <Text className="block text-blue-500 text-sm font-medium">筛选</Text>
            </View>
          </View>
        </View>

        {/* 店铺名 */}
        <Text className="block text-white text-sm">
          {merchantInfo ? merchantInfo.name : '膨胀团 · 订单明细'}
        </Text>
      </View>

      {/* 筛选面板 */}
      {showFilter && (
        <View className="bg-white mx-4 -mt-2 rounded-xl p-4 shadow-sm relative z-10">
          <Text className="block text-sm font-semibold text-gray-800 mb-3">日期筛选</Text>
          <View className="flex flex-row gap-3 mb-3">
            <View className="flex-1">
              <Text className="block text-xs text-gray-500 mb-1">开始日期</Text>
              <View className="bg-gray-50 rounded-lg px-3 py-2 flex flex-row items-center gap-2">
                <Calendar size={14} color="#9ca3af" />
                <Text className="block text-sm text-gray-700">{startDate || '选择日期'}</Text>
              </View>
              <input
                type="date"
                className="absolute opacity-0 w-full h-full top-0 left-0"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{ position: 'absolute', opacity: 0, width: '100%', height: '100%', top: 0, left: 0 }}
              />
            </View>
            <View className="flex-1">
              <Text className="block text-xs text-gray-500 mb-1">结束日期</Text>
              <View className="bg-gray-50 rounded-lg px-3 py-2 flex flex-row items-center gap-2">
                <Calendar size={14} color="#9ca3af" />
                <Text className="block text-sm text-gray-700">{endDate || '选择日期'}</Text>
              </View>
              <input
                type="date"
                className="absolute opacity-0 w-full h-full top-0 left-0"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{ position: 'absolute', opacity: 0, width: '100%', height: '100%', top: 0, left: 0 }}
              />
            </View>
          </View>
          <View className="flex flex-row gap-2">
            <Button variant="outline" className="flex-1" onClick={handleClearFilter}>
              <Text className="text-sm">清除</Text>
            </Button>
            <Button className="flex-1 bg-blue-500" onClick={handleApplyFilter}>
              <Text className="text-sm text-white">应用</Text>
            </Button>
          </View>
        </View>
      )}

      {/* Tabs */}
      <View className="bg-white mx-4 mt-3 rounded-xl shadow-sm">
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="w-full">
            <TabsTrigger value="all" className="flex-1">
              <Text className="text-sm">全部</Text>
            </TabsTrigger>
            <TabsTrigger value="pending" className="flex-1">
              <Text className="text-sm">待核销</Text>
            </TabsTrigger>
            <TabsTrigger value="used" className="flex-1">
              <Text className="text-sm">已核销</Text>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </View>

      {/* 订单列表 */}
      <View className="px-4 mt-3 mb-20">
        {loading ? (
          <View className="flex flex-col items-center justify-center py-12">
            <Text className="block text-sm text-gray-400">加载中...</Text>
          </View>
        ) : orders.length === 0 ? (
          <View className="flex flex-col items-center justify-center py-12">
            <Text className="block text-sm text-gray-400">暂无订单</Text>
          </View>
        ) : (
          orders.map((order) => {
            const badge = getStatusBadge(order.status);
            return (
              <Card key={order.id} className="mb-3">
                <CardContent className="p-4">
                  <View className="flex flex-row items-center justify-between mb-2">
                    <Text className="block text-xs text-gray-400">
                      {formatDate(order.created_at)}
                    </Text>
                    <Badge variant={badge.variant}>{badge.text}</Badge>
                  </View>
                  <View className="flex flex-row items-center gap-3">
                    <View className="flex-1">
                      <Text className="block text-base font-semibold text-gray-800">{order.package_name}</Text>
                      <Text className="block text-xs text-gray-500 mt-1">
                        用户：{order.nick_name || '匿名用户'} · {order.quantity || 1}份
                      </Text>
                      {order.verification_code && (
                        <Text className="block text-xs text-blue-500 mt-1">
                          核销码：{order.verification_code}
                        </Text>
                      )}
                    </View>
                    <View className="text-right">
                      <Text className="block text-base font-bold text-gray-800">¥{order.price}</Text>
                      <Text className="block text-xs text-gray-400">{order.quantity || 1}份</Text>
                      {order.status === 'used' && order.verified_count !== undefined && (
                        <Text className="block text-xs text-green-500 mt-1">
                          已核销{order.verified_count}份
                        </Text>
                      )}
                    </View>
                  </View>
                </CardContent>
              </Card>
            );
          })
        )}
      </View>
    </View>
  );
}
