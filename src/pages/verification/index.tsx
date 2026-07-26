import { View, Text } from '@tarojs/components';
import { useState, useEffect } from 'react';
import Taro from '@tarojs/taro';
import { Network } from '@/network';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScanLine, ClipboardList, FileText, RotateCcw, MessageSquare, Store, Search, ChevronRight, ListOrdered } from 'lucide-react-taro';

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
  verify_warning?: string;
  verified_count?: number;
}

export default function VerificationPage() {
  const [merchantInfo, setMerchantInfo] = useState<{ id: number; name: string } | null>(null);
  const [searchCode, setSearchCode] = useState('');
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [, setLoading] = useState(false);
  const [activeSection, setActiveSection] = useState('verify');
  const [verifyCode, setVerifyCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{ success: boolean; message: string; order?: any; prize?: any } | null>(null);
  const [verifyTarget, setVerifyTarget] = useState<any>(null);
  const [verifyCount, setVerifyCount] = useState(1);
  const [verifyFailReason, setVerifyFailReason] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState('');

  useEffect(() => {
    const userId = Taro.getStorageSync('user_id') || Taro.getStorageSync('userInfo')?.user_id || '';
    if (userId) {
      setCurrentUserId(userId);
      fetchMerchantInfo(userId);
    }
  }, []);

  const fetchMerchantInfo = async (userId: string) => {
    try {
      const res = await Network.request({ url: `/api/users/${userId}/merchant` });
      const merchant = (res.data as any)?.data;
      if (merchant) setMerchantInfo(merchant);
    } catch (err) {
      console.log('当前用户非商家或未绑定门店');
    }
  };

  const fetchOrders = async (status?: string) => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (status) params.status = status;
      if (merchantInfo) params.merchant_id = String(merchantInfo.id);
      const res = await Network.request({ url: '/api/orders', data: params });
      const data = (res.data as any)?.data || res.data;
      setOrders(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('获取订单失败:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleScanCode = async () => {
    const env = Taro.getEnv();
    const isMiniApp = env === Taro.ENV_TYPE.WEAPP || env === Taro.ENV_TYPE.TT;
    if (!isMiniApp) {
      Taro.showToast({ title: '扫码功能仅在小程序中可用', icon: 'none' });
      return;
    }
    try {
      const res = await Taro.scanCode({});
      if (res.result) {
        const code = res.result.trim();
        setVerifyCode(code);
        await lookupOrder(code);
      }
    } catch (err) {
      console.error('扫码失败:', err);
    }
  };

  // 统一核销查询：自动识别团购订单码或抽奖奖品兑换码
  const lookupOrder = async (code: string) => {
    if (!code || verifying) return;
    setVerifying(true);
    setVerifyResult(null);
    setVerifyTarget(null);
    setVerifyFailReason(null);
    try {
      const res = await Network.request({ url: `/api/orders/unified-verify/${code}`, method: 'GET' });
      const body = res.data as any;
      // Taro.request 对 HTTP 4xx/5xx 不会 reject，必须手动检查状态码
      if (res.statusCode !== 200) {
        const msg = Array.isArray(body?.message) ? body.message.join('；') : (body?.message || body?.msg || '未找到该核销码对应的订单或奖品');
        setVerifyFailReason(msg);
        return;
      }
      const result = body?.data || body;
      // 团购订单
      if (result?.type === 'order' && result.order?.id) {
        const order = result.order;
        if (order.status === 'used') {
          setVerifyFailReason('该订单已全部核销，无法重复核销');
          return;
        }
        if (order.status === 'refunded') {
          setVerifyFailReason('该订单已退款，无法核销');
          return;
        }
        if (order.status === 'expired') {
          setVerifyFailReason('该订单已过期，无法核销');
          return;
        }
        const remaining = (order.quantity || 1) - (order.verified_count || 0);
        if (remaining <= 0) {
          setVerifyFailReason('该订单已全部核销，无法重复核销');
          return;
        }
        if (order.verify_warning) {
          setVerifyFailReason(`不可核销：${order.verify_warning}`);
          return;
        }
        if (remaining > 1) {
          setVerifyTarget(order);
          setVerifyCount(1);
        } else {
          await doVerify(code, 1);
        }
        return;
      }
      // 抽奖奖品
      if (result?.type === 'prize' && result.prize) {
        const prize = result.prize;
        if (prize.redeemed) {
          setVerifyFailReason('该奖品已核销过，无法重复核销');
          return;
        }
        await doVerify(code, 1);
        return;
      }
      setVerifyFailReason('未找到对应订单或奖品，请检查核销码是否正确');
    } catch (err: any) {
      const msg = err?.data?.message || err?.message || '查询失败';
      setVerifyFailReason(msg);
    } finally {
      setVerifying(false);
    }
  };

  // 统一核销提交：自动识别团购订单码或抽奖奖品兑换码
  const doVerify = async (code: string, count: number) => {
    if (!code || verifying) return;
    setVerifying(true);
    setVerifyResult(null);
    try {
      const res = await Network.request({
        url: `/api/orders/unified-verify/${code}`,
        method: 'POST',
        data: { verify_count: count, ...(currentUserId && { merchant_user_id: currentUserId }) },
      });
      const body = res.data as any;
      // Taro.request 对 HTTP 4xx/5xx 不会 reject，必须手动检查状态码
      if (res.statusCode !== 200) {
        const msg = Array.isArray(body?.message) ? body.message.join('；') : (body?.message || body?.msg || '核销失败');
        setVerifyFailReason(msg);
        return;
      }
      const result = body?.data || body;
      if (result?.type === 'order') {
        setVerifyResult({ success: true, message: `成功核销 ${count} 份！`, order: result.data });
      } else if (result?.type === 'prize') {
        setVerifyResult({ success: true, message: '奖品核销成功！', prize: result.data });
      } else {
        setVerifyResult({ success: true, message: '核销成功！', order: result });
      }
      fetchOrders();
    } catch (err: any) {
      const msg = err?.data?.message || err?.message || '核销失败';
      setVerifyFailReason(msg);
    } finally {
      setVerifying(false);
      setVerifyTarget(null);
    }
  };

  const handleManualVerify = () => {
    const code = verifyCode.trim().replace(/[-\s]/g, '');
    if (!code) { Taro.showToast({ title: '请输入核销码', icon: 'none' }); return; }
    lookupOrder(code);
  };

  const handleSearchOrder = () => {
    const code = searchCode.trim().replace(/[-\s]/g, '');
    if (!code) { Taro.showToast({ title: '请输入订单号', icon: 'none' }); return; }
    lookupOrder(code);
  };

  const handleConfirmVerify = () => {
    if (!verifyTarget) return;
    doVerify(verifyTarget.verification_code, verifyCount);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid': return { text: '待使用', variant: 'default' as const };
      case 'used': return { text: '已完成', variant: 'secondary' as const };
      case 'refunded': return { text: '已退款', variant: 'outline' as const };
      case 'expired': return { text: '已过期', variant: 'outline' as const };
      default: return { text: status, variant: 'outline' as const };
    }
  };

  const menuItems = [
    { icon: ListOrdered, label: '订单明细', color: '#FF4757', bg: '#fef2f2', action: () => Taro.navigateTo({ url: '/pages/order-details/index' }) },
    { icon: ClipboardList, label: '预约处理', color: '#FF4757', bg: '#fef2f2', action: () => fetchOrders('paid') },
    { icon: FileText, label: '核销明细', color: '#FF4757', bg: '#fef2f2', action: () => fetchOrders('used') },
    { icon: RotateCcw, label: '处理售后', color: '#f59e0b', bg: '#fffbeb', action: () => fetchOrders('refunded') },
    { icon: RotateCcw, label: '发起退款', color: '#f59e0b', bg: '#fffbeb', action: () => { Taro.showToast({ title: '退款功能开发中', icon: 'none' }); } },
    { icon: MessageSquare, label: '评价管理', color: '#f59e0b', bg: '#fffbeb', action: () => { Taro.showToast({ title: '评价功能开发中', icon: 'none' }); } },
  ];

  return (
    <View className="min-h-screen bg-gray-50">
      {/* 头部 */}
      <View className="bg-gradient-to-b from-[#FF4757] to-[#ff6b7a] px-4 pt-4 pb-6">
        <View className="flex flex-row items-center justify-between mb-4">
          <View className="flex flex-row items-center gap-2">
            <View className="w-8 h-8 bg-white bg-opacity-20 rounded-lg flex items-center justify-center">
              <Store size={18} color="#ffffff" />
            </View>
            <Text className="block text-white text-base font-semibold">
              {merchantInfo ? merchantInfo.name : '膨胀团 · 验券中心'}
            </Text>
          </View>
        </View>

        {/* 搜索栏 */}
        <View className="bg-white rounded-xl px-4 py-3 flex flex-row items-center gap-2">
          <Search size={18} color="#9ca3af" />
          <View className="flex-1">
            <Input
              className="w-full"
              style={{ backgroundColor: 'transparent' }}
              value={searchCode}
              placeholder="订单漏核销？输入订单号处理"
              onInput={(e) => setSearchCode(e.detail.value)}
              onConfirm={handleSearchOrder}
            />
          </View>
          <Button size="sm" onClick={handleSearchOrder}>
            <Text className="text-xs">搜索</Text>
          </Button>
        </View>
      </View>

      {/* 验券入口 */}
      <View className="px-4 -mt-2">
        <View className="flex flex-row gap-3">
          <View className="flex-1 bg-[#FF4757] rounded-2xl p-6 flex flex-col items-center" onClick={handleScanCode}>
            <ScanLine size={36} color="#ffffff" />
            <Text className="block text-white text-base font-bold mt-3">扫码验券</Text>
          </View>
          <View className="flex-1 bg-green-500 rounded-2xl p-6 flex flex-col items-center" onClick={() => setActiveSection(activeSection === 'manual' ? 'verify' : 'manual')}>
            <ClipboardList size={36} color="#ffffff" />
            <Text className="block text-white text-base font-bold mt-3">输码验券</Text>
          </View>
        </View>
      </View>

      {/* 手动输入核销码 */}
      {activeSection === 'manual' && (
        <View className="px-4 mt-3">
          <Card>
            <CardContent className="p-4">
              <Text className="block text-sm font-semibold text-gray-800 mb-3">手动输入核销码</Text>
              <View className="flex flex-row gap-2">
                <View className="flex-1 bg-gray-50 rounded-xl px-3 py-2 border border-gray-200">
                  <Input
                    className="w-full"
                    style={{ backgroundColor: 'transparent' }}
                    value={verifyCode}
                    placeholder="请输入团购核销码或奖品兑换码"
                    onInput={(e) => setVerifyCode(e.detail.value)}
                  />
                </View>
                <Button className="bg-green-500" onClick={handleManualVerify} disabled={verifying}>
                  <Text className="block text-white text-sm">{verifying ? '核销中...' : '核销'}</Text>
                </Button>
              </View>
            </CardContent>
          </Card>
        </View>
      )}

      {/* 核销结果 */}
      {verifyResult && (
        <View className="px-4 mt-3">
          <Card className={`border-2 ${verifyResult.success ? 'border-green-300' : 'border-red-300'}`}>
            <CardContent className="p-4">
              <View className="flex flex-row items-center gap-2 mb-2">
                <View className={`w-3 h-3 rounded-full ${verifyResult.success ? 'bg-green-500' : 'bg-[#FF4757]'}`} />
                <Text className={`block text-sm font-bold ${verifyResult.success ? 'text-green-600' : 'text-red-600'}`}>
                  {verifyResult.message}
                </Text>
              </View>
              {verifyResult.order && (
                <View className="mt-2 bg-gray-50 rounded-lg p-3">
                  <Text className="block text-sm text-gray-800 font-semibold">{verifyResult.order.package_name}</Text>
                  <Text className="block text-xs text-gray-500 mt-1">用户：{verifyResult.order.nick_name || '匿名用户'}</Text>
                  <Text className="block text-xs text-gray-500">
                    金额：¥{verifyResult.order.price} · 共{verifyResult.order.quantity || 1}份 · 已核销{verifyResult.order.verified_count || 0}份
                  </Text>
                </View>
              )}
              {verifyResult.prize && (
                <View className="mt-2 bg-gray-50 rounded-lg p-3">
                  <Text className="block text-sm text-gray-800 font-semibold">奖品：{verifyResult.prize.prize_name}</Text>
                  {verifyResult.prize.product_name ? (
                    <Text className="block text-xs text-gray-500 mt-1">商品：{verifyResult.prize.product_name}</Text>
                  ) : null}
                  <Text className="block text-xs text-gray-500 mt-1">用户：{verifyResult.prize.nick_name || '匿名用户'}</Text>
                  <Text className="block text-xs text-gray-500">兑换码：{verifyResult.prize.redemption_code}</Text>
                </View>
              )}
            </CardContent>
          </Card>
        </View>
      )}

      {/* 功能菜单 */}
      <View className="px-4 mt-3">
        {menuItems.map((item, idx) => (
          <Card key={idx} className="mb-2" onClick={item.action}>
            <CardContent className="p-4 flex flex-row items-center justify-between">
              <View className="flex flex-row items-center gap-3">
                <View className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: item.bg }}>
                  <item.icon size={20} color={item.color} />
                </View>
                <Text className="block text-base text-gray-800">{item.label}</Text>
              </View>
              <ChevronRight size={18} color="#9ca3af" />
            </CardContent>
          </Card>
        ))}
      </View>

      {/* 多份核销选择弹窗 */}
      {verifyTarget && (
        <View style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <View className="bg-white rounded-2xl mx-6 w-full max-w-sm overflow-hidden">
            <View className="p-4 border-b border-gray-100">
              <Text className="block text-base font-bold text-gray-800 text-center">选择核销份数</Text>
            </View>
            <View className="p-4">
              <Text className="block text-sm font-semibold text-gray-800">{verifyTarget.package_name}</Text>
              <Text className="block text-xs text-gray-500 mt-1">
                用户：{verifyTarget.nick_name || '匿名用户'} · 共{verifyTarget.quantity || 1}份 · 已核销{verifyTarget.verified_count || 0}份
              </Text>
              <Text className="block text-xs text-[#FF4757] mt-1 font-semibold">
                剩余 {(verifyTarget.quantity || 1) - (verifyTarget.verified_count || 0)} 份可核销
              </Text>
              <View className="flex flex-row items-center justify-between mt-4 bg-gray-50 rounded-xl px-4 py-3">
                <Text className="block text-sm text-gray-600">本次核销份数</Text>
                <View className="flex flex-row items-center gap-3">
                  <View className={`w-8 h-8 rounded-full flex items-center justify-center ${verifyCount <= 1 ? 'bg-gray-200' : 'bg-red-100'}`} onClick={() => { if (verifyCount > 1) setVerifyCount(verifyCount - 1); }}>
                    <Text className={`text-base font-bold ${verifyCount <= 1 ? 'text-gray-400' : 'text-[#FF4757]'}`}>-</Text>
                  </View>
                  <Text className="text-lg font-bold text-gray-800 w-8 text-center">{verifyCount}</Text>
                  <View className={`w-8 h-8 rounded-full flex items-center justify-center ${verifyCount >= (verifyTarget.quantity || 1) - (verifyTarget.verified_count || 0) ? 'bg-gray-200' : 'bg-red-100'}`} onClick={() => { const max = (verifyTarget.quantity || 1) - (verifyTarget.verified_count || 0); if (verifyCount < max) setVerifyCount(verifyCount + 1); }}>
                    <Text className={`text-base font-bold ${verifyCount >= (verifyTarget.quantity || 1) - (verifyTarget.verified_count || 0) ? 'text-gray-400' : 'text-[#FF4757]'}`}>+</Text>
                  </View>
                </View>
              </View>
            </View>
            <View className="flex flex-row border-t border-gray-100">
              <View className="flex-1 py-3 flex items-center justify-center" onClick={() => setVerifyTarget(null)}>
                <Text className="block text-sm text-gray-500">取消</Text>
              </View>
              <View className="w-px bg-gray-100" />
              <View className="flex-1 py-3 flex items-center justify-center" onClick={handleConfirmVerify}>
                <Text className="block text-sm text-[#FF4757] font-bold">确认核销 {verifyCount} 份</Text>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* 核销失败弹窗 */}
      {verifyFailReason && (
        <View style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setVerifyFailReason(null)}>
          <View className="bg-white rounded-2xl mx-6 w-full max-w-sm overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <View className="p-6 pb-4 flex flex-col items-center">
              <View className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mb-4">
                <Text className="text-2xl">✕</Text>
              </View>
              <Text className="block text-base font-bold text-gray-800 text-center mb-2">无法核销</Text>
              <Text className="block text-sm text-gray-600 text-center leading-6">{verifyFailReason}</Text>
            </View>
            <View className="border-t border-gray-100">
              <View className="py-3 flex items-center justify-center" onClick={() => setVerifyFailReason(null)}>
                <Text className="block text-sm text-gray-800 font-semibold">知道了</Text>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* 订单列表 */}
      {orders.length > 0 && (
        <View className="px-4 mt-3 mb-20">
          <Text className="block text-sm font-semibold text-gray-600 mb-2">订单列表</Text>
          {orders.map((order) => {
            const badge = getStatusBadge(order.status);
            return (
              <Card key={order.id} className="mb-2">
                <CardContent className="p-4">
                  <View className="flex flex-row items-center justify-between mb-2">
                    <Text className="block text-xs text-gray-400">
                      下单于 {new Date(order.created_at).toLocaleString('zh-CN')}
                    </Text>
                    <Badge variant={badge.variant}>{badge.text}</Badge>
                  </View>
                  <View className="flex flex-row items-center gap-3">
                    <View className="flex-1">
                      <Text className="block text-base font-semibold text-gray-800">{order.package_name}</Text>
                      <Text className="block text-xs text-gray-500 mt-1">
                        用户：{order.nick_name || '匿名用户'} · {order.quantity || 1}份
                      </Text>
                    </View>
                    <View className="text-right">
                      <Text className="block text-base font-bold text-gray-800">¥{order.price}</Text>
                      <Text className="block text-xs text-gray-400">{order.quantity || 1}份</Text>
                    </View>
                  </View>
                </CardContent>
              </Card>
            );
          })}
        </View>
      )}
    </View>
  );
}
