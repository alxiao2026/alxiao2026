import { View, Text, Picker } from '@tarojs/components';
import { useState, useEffect } from 'react';
import Taro, { useRouter } from '@tarojs/taro';
import { Network } from '@/network';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { RevokeDialog } from '@/components/revoke-dialog';
import { Calendar, Funnel } from 'lucide-react-taro';

const isMiniApp = [Taro.ENV_TYPE.WEAPP as string, Taro.ENV_TYPE.TT as string].includes(Taro.getEnv());

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
  refunded_quantity?: number | null;
  order_no: string | null;
}

type TabType = 'all' | 'paid' | 'used' | 'refunded';

export default function OrderDetailsPage() {
  const [merchantInfo, setMerchantInfo] = useState<{ id: number; name: string } | null>(null);
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(false);
  const { params } = useRouter();
  const initialTab: TabType = ['paid', 'used', 'refunded'].includes(params.tab || '') ? (params.tab as TabType) : 'all';
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const [showFilter, setShowFilter] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [revokingId, setRevokingId] = useState('');
  const [revokeDialogVisible, setRevokeDialogVisible] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<OrderItem | null>(null);
  const [revokeQty, setRevokeQty] = useState(1);

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
      const userId = Taro.getStorageSync('user_id') || Taro.getStorageSync('userInfo')?.user_id || '';
      const queryParams: Record<string, string> = { merchant_id: String(merchantId), user_id: userId };
      if (status !== 'all') queryParams.status = status;
      if (startDate) queryParams.start_date = startDate;
      if (endDate) queryParams.end_date = endDate;
      console.log('[OrderDetails] 请求订单明细', { url: '/api/orders', params: queryParams });
      const res = await Network.request({ url: '/api/orders', data: queryParams });
      console.log('[OrderDetails] 订单明细响应', res.data);
      const data = (res.data as any)?.data || res.data;
      setOrders(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('获取订单失败:', err);
    } finally {
      setLoading(false);
    }
  };

  // 撤销核销剩余时间（分钟）：核销后30分钟内可撤销，返回0表示不可撤销
  const getRevokeRemainingMin = (order: OrderItem): number => {
    if (!order.verified_at || !order.verified_count || order.verified_count <= 0) return 0;
    const elapsed = Date.now() - new Date(order.verified_at).getTime();
    const remaining = 30 * 60 * 1000 - elapsed;
    return remaining > 0 ? Math.ceil(remaining / 60000) : 0;
  };

  // 撤销核销
  const doRevoke = async (order: OrderItem, revokeCount: number) => {
    setRevokingId(order.id);
    try {
      const userId = Taro.getStorageSync('user_id') || Taro.getStorageSync('userInfo')?.user_id || '';
      const res = await Network.request({
        url: `/api/orders/${order.id}/revoke-verify`,
        method: 'POST',
        data: { merchant_user_id: userId, revoke_count: revokeCount },
      });
      const body = res.data as any;
      if (res.statusCode >= 400 || (body?.code !== undefined && body.code !== 200)) {
        throw new Error(body?.message || body?.msg || '撤销失败');
      }
      Taro.showToast({ title: `已撤销 ${revokeCount} 份`, icon: 'success' });
      if (merchantInfo) {
        fetchOrders(merchantInfo.id, activeTab);
      }
    } catch (err: any) {
      console.error('撤销核销失败:', err);
      const msg = err?.message || err?.data?.message || '撤销失败，请重试';
      Taro.showToast({ title: msg, icon: 'none' });
    } finally {
      setRevokingId('');
    }
  };

  // 打开撤销份数选择弹窗（加减步进器，默认全部撤销可减）
  const handleRevoke = (order: OrderItem) => {
    const verifiedCount = order.verified_count || 0;
    if (verifiedCount < 1) return;
    setRevokeTarget(order);
    setRevokeQty(verifiedCount);
    setRevokeDialogVisible(true);
  };

  const closeRevokeDialog = () => {
    setRevokeDialogVisible(false);
    setRevokeTarget(null);
  };

  const confirmRevoke = () => {
    if (!revokeTarget) return;
    const target = revokeTarget;
    closeRevokeDialog();
    doRevoke(target, revokeQty);
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
      {/* 店铺名与筛选入口 */}
      <View className="flex flex-row items-center justify-between px-4 pt-3">
        <Text className="block text-sm text-gray-600 font-medium">
          {merchantInfo ? merchantInfo.name : '膨胀团 · 订单明细'}
        </Text>
        <View className="bg-white rounded-full px-4 py-2 flex flex-row items-center gap-1 shadow-sm" onClick={() => setShowFilter(!showFilter)}>
          <Funnel size={16} color="#FF4757" />
          <Text className="block text-[#FF4757] text-sm font-medium">筛选</Text>
        </View>
      </View>

      {/* 筛选面板 */}
      {showFilter && (
        <View className="bg-white mx-4 mt-3 rounded-xl p-4 shadow-sm relative z-10">
          <Text className="block text-sm font-semibold text-gray-800 mb-3">日期筛选</Text>
          <View className="flex flex-row gap-3 mb-3">
            <View className="flex-1">
              <Text className="block text-xs text-gray-500 mb-1">开始日期</Text>
              {isMiniApp ? (
                <Picker mode="date" value={startDate} onChange={(e) => setStartDate(e.detail.value as string)}>
                  <View className="bg-gray-50 rounded-lg px-3 py-2 flex flex-row items-center gap-2">
                    <Calendar size={14} color="#9ca3af" />
                    <Text className="block text-sm text-gray-700">{startDate || '选择日期'}</Text>
                  </View>
                </Picker>
              ) : (
                <View className="bg-gray-50 rounded-lg px-3 py-2 relative">
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    style={{
                      width: '100%',
                      border: 'none',
                      background: 'transparent',
                      fontSize: '14px',
                      color: '#374151',
                      outline: 'none',
                      padding: 0,
                    }}
                  />
                </View>
              )}
            </View>
            <View className="flex-1">
              <Text className="block text-xs text-gray-500 mb-1">结束日期</Text>
              {isMiniApp ? (
                <Picker mode="date" value={endDate} onChange={(e) => setEndDate(e.detail.value as string)}>
                  <View className="bg-gray-50 rounded-lg px-3 py-2 flex flex-row items-center gap-2">
                    <Calendar size={14} color="#9ca3af" />
                    <Text className="block text-sm text-gray-700">{endDate || '选择日期'}</Text>
                  </View>
                </Picker>
              ) : (
                <View className="bg-gray-50 rounded-lg px-3 py-2 relative">
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    style={{
                      width: '100%',
                      border: 'none',
                      background: 'transparent',
                      fontSize: '14px',
                      color: '#374151',
                      outline: 'none',
                      padding: 0,
                    }}
                  />
                </View>
              )}
            </View>
          </View>
          <View className="flex flex-row gap-2">
            <Button variant="outline" className="flex-1" onClick={handleClearFilter}>
              <Text className="text-sm">清除</Text>
            </Button>
            <Button className="flex-1 bg-[#FF4757]" onClick={handleApplyFilter}>
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
            <TabsTrigger value="paid" className="flex-1">
              <Text className="text-sm">待核销</Text>
            </TabsTrigger>
            <TabsTrigger value="used" className="flex-1">
              <Text className="text-sm">已核销</Text>
            </TabsTrigger>
            <TabsTrigger value="refunded" className="flex-1">
              <Text className="text-sm">已退款</Text>
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
            const remainingMin = getRevokeRemainingMin(order);
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
                        <Text className="block text-xs text-[#FF4757] mt-1">
                          核销码：{order.verification_code}
                        </Text>
                      )}
                    </View>
                    <View className="text-right">
                      <Text className="block text-base font-bold text-gray-800">¥{order.price}</Text>
                      <Text className="block text-xs text-gray-400">{order.quantity || 1}份</Text>
                      {(order.verified_count || 0) > 0 && (
                        <Text className="block text-xs text-green-500 mt-1">
                          已核销{order.verified_count}份
                        </Text>
                      )}
                      {(order.refunded_quantity || 0) > 0 && (
                        <Text className="block text-xs text-orange-500 mt-1">
                          已退款{order.refunded_quantity}份
                        </Text>
                      )}
                    </View>
                  </View>
                  {/* 撤销核销：核销后30分钟内可撤销，超时不可撤销 */}
                  {order.verified_count > 0 && order.verified_at && (
                    <View className="flex flex-row items-center justify-between mt-3 pt-3 border-t border-gray-100">
                      <Text className="text-xs text-gray-400">
                        核销于 {formatDate(order.verified_at)}
                      </Text>
                      {remainingMin > 0 ? (
                        <View className="flex flex-row items-center gap-2">
                          <Text className="text-xs text-orange-400">{remainingMin}分钟内可撤销</Text>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={revokingId === order.id}
                            onClick={() => handleRevoke(order)}
                          >
                            <Text className="block text-xs">{revokingId === order.id ? '撤销中' : '撤销核销'}</Text>
                          </Button>
                        </View>
                      ) : (
                        <Text className="text-xs text-gray-300">超30分钟不可撤销</Text>
                      )}
                    </View>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </View>

      {/* 撤销份数选择弹窗（加减步进器） */}
      <RevokeDialog
        visible={revokeDialogVisible}
        maxQty={revokeTarget?.verified_count || 1}
        qty={revokeQty}
        packageName={revokeTarget?.package_name}
        loading={!!revokingId}
        onQtyChange={setRevokeQty}
        onCancel={closeRevokeDialog}
        onConfirm={confirmRevoke}
      />
    </View>
  );
}
