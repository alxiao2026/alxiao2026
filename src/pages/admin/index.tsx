import { View, Text, Image } from '@tarojs/components';
import { useState, useEffect } from 'react';
import Taro, { useDidShow } from '@tarojs/taro';
import { Network } from '@/network';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Pencil, Trash2, Gift, ShoppingBag, Store, ScanLine, ClipboardCheck, TrendingUp, CircleCheck, Package } from 'lucide-react-taro';

interface Prize {
  id: string;
  name: string;
  description: string | null;
  probability: string;
  image_url: string | null;
  stock: number;
  is_active: boolean;
  prize_type: 'coupon' | 'product' | 'free_meal';
  coupon_amount: string;
  coupon_min_spend: string;
  product_name: string;
  product_value: string;
  created_at: string;
  updated_at: string | null;
}

const PRIZE_TYPE_OPTIONS = [
  { value: 'coupon', label: '优惠券模式' },
  { value: 'product', label: '商品模式' },
  { value: 'free_meal', label: '霸王餐模式' },
] as const;

interface Package {
  id: string;
  name: string;
  description: string | null;
  price: string;
  original_price: string | null;
  badge: string | null;
  features: string | null;
  cover_image: string | null;
  stock: number | null;
  sales_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string | null;
}

const AdminPage = () => {
  const [activeTab, setActiveTab] = useState('prizes');
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingPrize, setEditingPrize] = useState<Prize | null>(null);
  const [prizeForm, setPrizeForm] = useState({
    name: '', description: '', probability: '0', stock: '0',
    prize_type: 'coupon' as 'coupon' | 'product' | 'free_meal',
    coupon_amount: '', coupon_min_spend: '',
    product_name: '', product_value: '',
  });
  const [editingPackage, setEditingPackage] = useState<Package | null>(null);
  const [pkgForm, setPkgForm] = useState({ name: '', description: '', price: '9.90', original_price: '', badge: '', features: '' });
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Package | null>(null);
  // 核销相关状态
  const [verifyCode, setVerifyCode] = useState('');
  const [verifyResult, setVerifyResult] = useState<{ success: boolean; message: string; order?: any } | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [merchantInfo, setMerchantInfo] = useState<{ id: number; name: string } | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string>('');

  // 获取当前登录用户的商家信息和统计数据
  const fetchMerchantInfo = async () => {
    try {
      const userId = Taro.getStorageSync('user_id') || Taro.getStorageSync('userInfo')?.user_id || '';
      if (!userId) return;
      setCurrentUserId(userId);
      const res = await Network.request({ url: `/api/users/${userId}/merchant` });
      const merchant = (res.data as any)?.data;
      if (merchant) {
        setMerchantInfo(merchant);
      }
      // 获取商家统计数据
      try {
        const statsRes = await Network.request({ url: `/api/users/${userId}/merchant-stats` });
        const envelope = (statsRes as any)?.data || statsRes;
        const statsData = envelope?.data || envelope;
        console.log('[fetchMerchantInfo] 商家统计数据:', statsData);
        if (statsData && typeof statsData === 'object' && 'totalSales' in statsData) {
          setMerchantStats(statsData);
        }
      } catch (e) {
        console.error('[fetchMerchantInfo] 获取商家统计失败:', e);
      }
    } catch (err) {
      console.log('当前用户非商家或未绑定门店');
    }
  };

  const fetchPrizes = async () => {
    try {
      const res = await Network.request({ url: '/api/prizes' });
      console.log('prizes response:', res.data);
      setPrizes((res.data as any)?.data || (res.data as Prize[]) || []);
    } catch (err) {
      console.error('获取奖品失败:', err);
    }
  };

  const fetchPackages = async () => {
    try {
      const res = await Network.request({ url: '/api/packages' });
      console.log('packages response:', res.data);
      setPackages((res.data as any)?.data || (res.data as Package[]) || []);
    } catch (err) {
      console.error('获取套餐失败:', err);
    }
  };

  const loadData = async () => {
    setLoading(true);
    await Promise.all([fetchPrizes(), fetchPackages(), fetchMerchantInfo()]);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  // 页面每次显示时刷新商家统计数据（下单后返回自动更新）
  useDidShow(() => {
    fetchMerchantInfo();
  });

  // ========== 奖品管理 ==========
  const openCreatePrize = () => {
    setEditingPrize(null);
    setPrizeForm({
      name: '', description: '', probability: '10', stock: '100',
      prize_type: 'coupon', coupon_amount: '', coupon_min_spend: '',
      product_name: '', product_value: '',
    });
    setShowDialog(true);
  };

  const openEditPrize = (prize: Prize) => {
    setEditingPrize(prize);
    setPrizeForm({
      name: prize.name,
      description: prize.description || '',
      probability: prize.probability,
      stock: String(prize.stock),
      prize_type: prize.prize_type || 'coupon',
      coupon_amount: prize.coupon_amount || '',
      coupon_min_spend: prize.coupon_min_spend || '',
      product_name: prize.product_name || '',
      product_value: prize.product_value || '',
    });
    setShowDialog(true);
  };

  const handleSavePrize = async () => {
    if (!prizeForm.name) {
      Taro.showToast({ title: '请输入奖品名称', icon: 'none' });
      return;
    }

    try {
      const payload: Record<string, any> = {
        name: prizeForm.name,
        description: prizeForm.description,
        probability: prizeForm.probability,
        stock: Number(prizeForm.stock),
        prize_type: prizeForm.prize_type,
        coupon_amount: Number(prizeForm.coupon_amount) || 0,
        coupon_min_spend: Number(prizeForm.coupon_min_spend) || 0,
        product_name: prizeForm.product_name,
        product_value: Number(prizeForm.product_value) || 0,
      };
      if (editingPrize) {
        await Network.request({
          url: `/api/prizes/${editingPrize.id}`,
          method: 'PUT',
          data: payload,
        });
      } else {
        await Network.request({
          url: '/api/prizes',
          method: 'POST',
          data: payload,
        });
      }
      setShowDialog(false);
      Taro.showToast({ title: editingPrize ? '更新成功' : '创建成功', icon: 'success' });
      fetchPrizes();
    } catch (err) {
      console.error('保存失败:', err);
      Taro.showToast({ title: '保存失败', icon: 'none' });
    }
  };

  const handleDeletePrize = async (id: string) => {
    console.log('删除奖品，ID:', id);
    Taro.showModal({
      title: '确认删除',
      content: '确定要删除该奖品吗？',
      success: async (res) => {
        console.log('showModal 结果:', res);
        if (res.confirm) {
          try {
            console.log('发送删除请求:', `/api/prizes/${id}`);
            const deleteRes = await Network.request({ url: `/api/prizes/${id}`, method: 'DELETE' });
            console.log('删除响应:', deleteRes.data);
            Taro.showToast({ title: '删除成功', icon: 'success' });
            fetchPrizes();
          } catch (err) {
            console.error('删除失败:', err);
            Taro.showToast({ title: '删除失败', icon: 'none' });
          }
        }
      },
      fail: (err) => {
        console.error('showModal 失败:', err);
      },
    });
  };

  const handleDeletePackage = async () => {
    if (!deleteTarget) return;
    try {
      console.log('删除套餐，ID:', deleteTarget.id);
      await Network.request({ url: `/api/packages/${deleteTarget.id}`, method: 'DELETE' });
      Taro.showToast({ title: '删除成功', icon: 'success' });
      setDeleteTarget(null);
      fetchPackages();
    } catch (err) {
      console.error('删除套餐失败:', err);
      Taro.showToast({ title: '删除失败', icon: 'none' });
    }
  };

  const handleTogglePrize = async (prize: Prize) => {
    try {
      await Network.request({
        url: `/api/prizes/${prize.id}`,
        method: 'PUT',
        data: { is_active: !prize.is_active },
      });
      fetchPrizes();
    } catch (err) {
      console.error('切换状态失败:', err);
    }
  };

  // ========== 核销功能 ==========
  const [verifyTarget, setVerifyTarget] = useState<any>(null);
  const [verifyCount, setVerifyCount] = useState(1);
  const [verifyFailReason, setVerifyFailReason] = useState<string | null>(null);

  const [merchantStats, setMerchantStats] = useState({
    totalSales: 0, totalOrders: 0, totalRevenue: '0.00',
    verifiedAmount: '0.00', verifiedCount: 0, prizeCount: 0,
    todaySales: 0, todayOrders: 0, todayRevenue: '0.00',
    todayVerifiedAmount: '0.00', todayVerifiedCount: 0
  });

  const handleScanCode = async () => {
    const env = Taro.getEnv();
    const isMiniApp = env === Taro.ENV_TYPE.WEAPP || env === Taro.ENV_TYPE.TT;
    if (!isMiniApp) {
      Taro.showToast({ title: '扫码功能仅在小程序中可用', icon: 'none' });
      return;
    }
    try {
      const res = await Taro.scanCode({});
      console.log('扫码结果:', res);
      if (res.result) {
        const code = res.result.trim();
        setVerifyCode(code);
        await lookupOrder(code);
      }
    } catch (err) {
      console.error('扫码失败:', err);
    }
  };

  // 先查询订单信息，判断是否需要选择份数
  const lookupOrder = async (code: string) => {
    if (!code || verifying) return;
    setVerifying(true);
    setVerifyResult(null);
    setVerifyTarget(null);
    setVerifyFailReason(null);
    try {
      console.log('[核销] 查询订单, code:', code);
      // 先通过核销码查找订单（不核销）
      const res = await Network.request({
        url: `/api/orders/verify/${code}`,
        method: 'GET',
      });
      console.log('[核销] 订单信息:', res.data);
      const order = (res.data as any)?.data || res.data;
      if (!order || !order.id) {
        setVerifyFailReason('未找到对应订单，请检查核销码是否正确');
        return;
      }
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
      // 有核销规则警告时，弹窗提示不可核销原因
      if (order.verify_warning) {
        setVerifyFailReason(`不可核销：${order.verify_warning}`);
        return;
      }
      // 多份时弹出份数选择
      if (remaining > 1) {
        setVerifyTarget(order);
        setVerifyCount(1);
      } else {
        // 单份直接核销
        await doVerify(code, 1);
      }
    } catch (err: any) {
      console.error('[核销] 查询失败:', err);
      const msg = err?.data?.message || err?.message || '查询订单失败';
      setVerifyFailReason(msg);
    } finally {
      setVerifying(false);
    }
  };

  // 执行核销
  const doVerify = async (code: string, count: number) => {
    if (!code || verifying) return;
    setVerifying(true);
    setVerifyResult(null);
    try {
      console.log('[核销] 请求核销, code:', code, 'count:', count);
      const res = await Network.request({
        url: `/api/orders/verify/${code}`,
        method: 'POST',
        data: {
          verify_count: count,
          ...(currentUserId && { merchant_user_id: currentUserId }),
        },
      });
      console.log('[核销] 响应:', res.data);
      const data = (res.data as any)?.data || res.data;
      setVerifyResult({
        success: true,
        message: `成功核销 ${count} 份！`,
        order: data,
      });
    } catch (err: any) {
      console.error('[核销] 失败:', err);
      const msg = err?.data?.message || err?.message || '核销失败';
      setVerifyFailReason(msg);
    } finally {
      setVerifying(false);
      setVerifyTarget(null);
    }
  };

  // 确认核销选中的份数
  const handleConfirmVerify = () => {
    if (!verifyTarget) return;
    doVerify(verifyTarget.verification_code, verifyCount);
  };

  const handleManualVerify = () => {
    const code = verifyCode.trim().replace(/[-\s]/g, '');
    if (!code) {
      Taro.showToast({ title: '请输入核销码', icon: 'none' });
      return;
    }
    lookupOrder(code);
  };

  const closeDialog = () => {
    setShowDialog(false);
    setEditingPrize(null);
    setEditingPackage(null);
  };

  return (
    <View className="min-h-screen bg-gray-50">
      {/* 顶部操作栏 */}
      <View className="bg-gradient-to-r from-red-500 to-orange-400 px-4 pt-4 pb-4">
        <View className="flex flex-row items-center gap-3 mb-2">
          <View
            className="flex flex-row items-center gap-1"
            onClick={() => Taro.switchTab({ url: '/pages/index/index' })}
          >
            <Text className="block text-sm text-white opacity-80">‹ 首页</Text>
          </View>
          <View className="flex-1 flex flex-row items-center gap-2">
            <Image
              src="https://coze-coding-project.tos.coze.site/coze_storage_7662281810482692131/logo_new_pengtuan_2d6e000c.png?sign=1786611400-ab636b32a4-0-481e336cec57d85a4be349e1365bbc63d2a048d78e79de1c43bc7c0cc8dbdea9"
              className="w-8 h-8"
              mode="aspectFill"
            />
            <Text className="block text-base font-bold text-white">膨胀团 · 管理后台</Text>
          </View>
          <Button size="sm" className="bg-white text-red-500" onClick={activeTab === 'prizes' ? openCreatePrize : activeTab === 'packages' ? () => Taro.navigateTo({ url: '/pages/package-admin/index' }) : () => Taro.navigateTo({ url: '/pages/merchant-admin/index' })}>
            <Plus size={16} color="#FF4757" className="mr-1" />
            <Text className="block text-red-500 text-sm">
              {activeTab === 'prizes' ? '添加奖品' : activeTab === 'packages' ? '添加套餐' : '添加商家'}
            </Text>
          </Button>
        </View>
      </View>

      {/* 商家数据面板 — 融入背景，无卡片 */}
      <View className="px-4 pt-4 pb-2">
        {/* 今日数据 - 四格 */}
        <View className="flex flex-row flex-wrap">
          <View className="w-1/2 items-center py-3">
            <View className="flex items-center mb-1">
              <TrendingUp size={14} color="#9ca3af" className="mr-1" />
              <Text className="text-xs text-gray-400">今日售额</Text>
            </View>
            <Text className="block text-xl font-bold text-gray-900">¥{merchantStats.todayRevenue}</Text>
            <Text className="block text-xs text-gray-400 mt-1">{merchantStats.todayOrders} 笔订单</Text>
          </View>
          <View className="w-1/2 items-center py-3">
            <View className="flex items-center mb-1">
              <ShoppingBag size={14} color="#9ca3af" className="mr-1" />
              <Text className="text-xs text-gray-400">今日销量</Text>
            </View>
            <Text className="block text-xl font-bold text-gray-900">{merchantStats.todaySales}</Text>
            <Text className="block text-xs text-gray-400 mt-1">份</Text>
          </View>
          <View className="w-1/2 items-center py-3">
            <View className="flex items-center mb-1">
              <CircleCheck size={14} color="#9ca3af" className="mr-1" />
              <Text className="text-xs text-gray-400">今日核销金额</Text>
            </View>
            <Text className="block text-xl font-bold text-gray-900">¥{merchantStats.todayVerifiedAmount}</Text>
            <Text className="block text-xs text-gray-400 mt-1">{merchantStats.todayVerifiedCount} 份</Text>
          </View>
          <View className="w-1/2 items-center py-3">
            <View className="flex items-center mb-1">
              <Package size={14} color="#9ca3af" className="mr-1" />
              <Text className="text-xs text-gray-400">奖品发放</Text>
            </View>
            <Text className="block text-xl font-bold text-gray-900">{merchantStats.prizeCount}</Text>
            <Text className="block text-xs text-gray-400 mt-1">份</Text>
          </View>
        </View>

        {/* 累计数据 */}
        <View className="flex flex-row mt-1 pt-3 border-t border-gray-200">
          <View className="flex-1 items-center">
            <Text className="block text-xs text-gray-400">累计售额</Text>
            <Text className="block text-base font-bold text-gray-700 mt-1">¥{merchantStats.totalRevenue}</Text>
          </View>
          <View className="flex-1 items-center">
            <Text className="block text-xs text-gray-400">累计订单</Text>
            <Text className="block text-base font-bold text-gray-700 mt-1">{merchantStats.totalOrders}</Text>
          </View>
          <View className="flex-1 items-center">
            <Text className="block text-xs text-gray-400">累计核销</Text>
            <Text className="block text-base font-bold text-gray-700 mt-1">¥{merchantStats.verifiedAmount}</Text>
          </View>
        </View>
      </View>

      {/* Tabs */}
      <View className="px-4 pt-3">
        <Tabs defaultValue="prizes" onValueChange={(v) => setActiveTab(v)}>
          <TabsList className="w-full">
            <TabsTrigger value="prizes" className="flex-1">
              <Gift size={14} color="#6b7280" className="mr-1" />
              <Text className="block text-sm">奖品管理</Text>
            </TabsTrigger>
            <TabsTrigger value="packages" className="flex-1">
              <ShoppingBag size={14} color="#6b7280" className="mr-1" />
              <Text className="block text-sm">套餐管理</Text>
            </TabsTrigger>
            <TabsTrigger value="verify" className="flex-1">
              <ClipboardCheck size={14} color="#6b7280" className="mr-1" />
              <Text className="block text-sm">核销</Text>
            </TabsTrigger>
            <TabsTrigger value="merchants" className="flex-1">
              <Store size={14} color="#6b7280" className="mr-1" />
              <Text className="block text-sm">商家管理</Text>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="prizes" className="mt-3">
            {loading ? (
              <View className="flex items-center justify-center py-20">
                <Text className="block text-gray-400">加载中...</Text>
              </View>
            ) : prizes.length === 0 ? (
              <View className="flex items-center justify-center py-20">
                <Gift size={48} color="#d1d5db" />
                <Text className="block text-gray-400 mt-3">暂无奖品，点击上方按钮添加</Text>
              </View>
            ) : (
              <View>
                {/* 总概率提示 */}
                <View className="bg-orange-50 border border-orange-200 rounded-xl p-3 mb-3">
                  <Text className="block text-xs text-orange-600">
                    总概率: <Text className="font-bold">{prizes.filter(p => p.is_active).reduce((s, p) => s + parseFloat(p.probability || '0'), 0)}%</Text>
                    （建议总概率保持 100%，确保100%中奖）
                  </Text>
                </View>
                {prizes.map((prize) => (
                  <Card key={prize.id} className="mb-3">
                    <CardContent className="p-4">
                      <View className="flex flex-row items-start justify-between">
                        <View className="flex-1">
                          <View className="flex flex-row items-center gap-2">
                            <Text className="block text-base font-semibold text-gray-800">{prize.name}</Text>
                            <Badge variant={prize.is_active ? 'default' : 'secondary'}>
                              {prize.is_active ? '启用' : '停用'}
                            </Badge>
                            <Badge variant="outline">
                              {prize.prize_type === 'coupon' ? '优惠券' : prize.prize_type === 'product' ? '商品' : '霸王餐'}
                            </Badge>
                          </View>
                          {prize.description && (
                            <Text className="block text-sm text-gray-500 mt-1">{prize.description}</Text>
                          )}
                          <View className="flex flex-row items-center gap-4 mt-2">
                            <Text className="block text-xs text-gray-400">
                              概率: <Text className="text-red-500 font-semibold">{prize.probability}%</Text>
                            </Text>
                            <Text className="block text-xs text-gray-400">
                              库存: <Text className="text-gray-600 font-semibold">{prize.stock}</Text>
                            </Text>
                            {prize.prize_type === 'coupon' && (
                              <Text className="block text-xs text-gray-400">
                                金额: <Text className="text-red-500 font-semibold">¥{prize.coupon_amount}</Text>
                                {Number(prize.coupon_min_spend) > 0 && ` 满${prize.coupon_min_spend}可用`}
                              </Text>
                            )}
                            {prize.prize_type === 'product' && (
                              <Text className="block text-xs text-gray-400">
                                价值: <Text className="text-blue-500 font-semibold">¥{prize.product_value}</Text>
                              </Text>
                            )}
                          </View>
                        </View>
                        <View className="flex flex-row items-center gap-2">
                          <Button variant="ghost" size="sm" onClick={() => openEditPrize(prize)}>
                            <Pencil size={16} color="#6b7280" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleTogglePrize(prize)}>
                            <Badge variant={prize.is_active ? 'secondary' : 'default'}>
                              {prize.is_active ? '停用' : '启用'}
                            </Badge>
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDeletePrize(prize.id)}>
                            <Trash2 size={16} color="#ef4444" />
                          </Button>
                        </View>
                      </View>
                    </CardContent>
                  </Card>
                ))}
                </View>
              )}
          </TabsContent>

          <TabsContent value="packages" className="mt-3">
            {loading ? (
              <View className="flex items-center justify-center py-20">
                <Text className="block text-gray-400">加载中...</Text>
              </View>
            ) : packages.length === 0 ? (
              <View className="flex items-center justify-center py-20">
                <ShoppingBag size={48} color="#d1d5db" />
                <Text className="block text-gray-400 mt-3">暂无团购，点击上方按钮添加</Text>
              </View>
            ) : (
              <View>
                {packages.map((pkg) => (
                  <Card key={pkg.id} className="mb-3 bg-white">
                    <CardContent className="p-4">
                      {/* 状态行 */}
                      <View className="flex flex-row items-center gap-2 mb-3">
                        <View className="w-2 h-2 rounded-full bg-green-500" />
                        <Text className="block text-sm text-green-600 font-medium">售卖中</Text>
                        <Text className="block text-sm text-gray-400">| 不限时间</Text>
                      </View>

                      {/* 商品信息行 */}
                      <View className="flex flex-row gap-3">
                        {/* 商品图片 */}
                        <View className="w-24 h-24 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100">
                          {pkg.cover_image ? (
                            <Image src={pkg.cover_image} className="w-full h-full" mode="aspectFill" />
                          ) : (
                            <View className="w-full h-full flex items-center justify-center">
                              <ShoppingBag size={24} color="#d1d5db" />
                            </View>
                          )}
                        </View>

                        {/* 商品信息 */}
                        <View className="flex-1">
                          <Text className="block text-base font-bold text-gray-800 mb-1">{pkg.name}</Text>
                          {pkg.description && (
                            <Text className="block text-xs text-gray-500 mb-2 line-clamp-2">{pkg.description}</Text>
                          )}
                          <Text className="block text-xs text-gray-400 mb-2">
                            已售/剩余库存：{pkg.sales_count || 0}/{pkg.stock || '不限库存'}
                          </Text>
                          <Badge variant="outline" className="text-xs border-gray-300 text-gray-600">团购</Badge>
                        </View>
                      </View>

                      {/* 价格行 */}
                      <View className="flex flex-row items-baseline gap-2 mt-3 mb-3">
                        <Text className="block text-xl font-bold text-red-500">¥{pkg.price}</Text>
                        {pkg.original_price && (
                          <Text className="block text-sm text-gray-400 line-through">¥{pkg.original_price}</Text>
                        )}
                      </View>

                      {/* 操作按钮行 */}
                      <View className="flex flex-row items-center justify-between pt-3 border-t border-gray-100">
                        <View className="relative">
                          <Button variant="ghost" size="sm" onClick={() => setOpenMenuId(openMenuId === pkg.id ? null : pkg.id)}>
                            <Text className="block text-sm text-gray-500">更多</Text>
                          </Button>
                          {openMenuId === pkg.id && (
                            <View className="absolute left-0 bottom-full mb-1 bg-white rounded-lg shadow-lg border border-gray-100 z-50 min-w-24">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="w-full justify-start"
                                onClick={() => {
                                  setOpenMenuId(null);
                                  setDeleteTarget(pkg);
                                }}
                              >
                                <Text className="block text-sm text-red-500">删除团购</Text>
                              </Button>
                            </View>
                          )}
                        </View>
                        <View className="flex flex-row gap-2">
                          <Button variant="outline" size="sm" className="text-xs">
                            <Text className="block">改时间</Text>
                          </Button>
                          <Button variant="outline" size="sm" className="text-xs">
                            <Text className="block">改库存</Text>
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => Taro.redirectTo({ url: `/pages/package-admin/index?id=${pkg.id}` })}>
                            <Text className="block text-blue-500 text-xs">编辑</Text>
                          </Button>
                        </View>
                      </View>
                    </CardContent>
                  </Card>
                ))}
              </View>
            )}
          </TabsContent>

          <TabsContent value="verify" className="mt-3">
            {/* 商家身份信息 */}
            {merchantInfo && (
              <View className="flex flex-row items-center bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
                <Store size={18} color="#FF4757" />
                <View className="ml-2 flex-1">
                  <Text className="block text-sm font-semibold text-red-700">{merchantInfo.name}</Text>
                  <Text className="block text-xs text-red-400 mt-1">仅可核销本门店的订单</Text>
                </View>
              </View>
            )}

            {/* 扫码核销区域 */}
            <Card className="mb-4">
              <CardContent className="p-6 flex flex-col items-center">
                <ClipboardCheck size={48} color="#FF4757" />
                <Text className="block text-base font-bold text-gray-800 mt-3">订单核销</Text>
                <Text className="block text-sm text-gray-500 mt-1 text-center">
                  扫描用户出示的二维码，或手动输入核销码
                </Text>

                {/* 扫码按钮 */}
                <Button
                  className="w-full mt-4 bg-red-500"
                  size="lg"
                  onClick={handleScanCode}
                >
                  <ScanLine size={18} color="#fff" className="mr-2" />
                  <Text className="block text-white font-semibold">扫码核销</Text>
                </Button>

                {/* 手动输入 */}
                <View className="w-full mt-4">
                  <Text className="block text-sm text-gray-600 mb-2">手动输入核销码</Text>
                  <View className="flex flex-row gap-2">
                    <View className="flex-1 bg-gray-50 rounded-xl px-3 py-2 border border-gray-200">
                      <Input
                        className="w-full"
                        style={{ backgroundColor: 'transparent' }}
                        value={verifyCode}
                        placeholder="请输入12位核销码"
                        onInput={(e) => setVerifyCode(e.detail.value)}
                      />
                    </View>
                    <Button
                      className="bg-red-500"
                      onClick={handleManualVerify}
                      disabled={verifying}
                    >
                      <Text className="block text-white text-sm">{verifying ? '核销中...' : '核销'}</Text>
                    </Button>
                  </View>
                </View>
              </CardContent>
            </Card>

            {/* 核销结果 */}
            {verifyResult && (
              <Card className={`mb-4 border-2 ${verifyResult.success ? 'border-green-300' : 'border-red-300'}`}>
                <CardContent className="p-4">
                  <View className="flex flex-row items-center gap-2 mb-2">
                    <View className={`w-3 h-3 rounded-full ${verifyResult.success ? 'bg-green-500' : 'bg-red-500'}`} />
                    <Text className={`block text-sm font-bold ${verifyResult.success ? 'text-green-600' : 'text-red-600'}`}>
                      {verifyResult.message}
                    </Text>
                  </View>
                  {verifyResult.order && (
                    <View className="mt-2 bg-gray-50 rounded-lg p-3">
                      <Text className="block text-sm text-gray-800 font-semibold">{verifyResult.order.package_name}</Text>
                      <Text className="block text-xs text-gray-500 mt-1">
                        用户：{verifyResult.order.nick_name || '匿名用户'}
                      </Text>
                      <Text className="block text-xs text-gray-500">
                        金额：¥{verifyResult.order.price} · 共{verifyResult.order.quantity || 1}份 · 已核销{verifyResult.order.verified_count || 0}份
                      </Text>
                      {verifyResult.order.verified_at && (
                        <Text className="block text-xs text-green-600 mt-1">
                          核销时间：{new Date(verifyResult.order.verified_at).toLocaleString()}
                        </Text>
                      )}
                    </View>
                  )}
                </CardContent>
              </Card>
            )}

            {/* 多份核销选择弹窗 */}
            {verifyTarget && (
              <View
                style={{
                  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                  backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 999,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <View className="bg-white rounded-2xl mx-6 w-full max-w-sm overflow-hidden">
                  <View className="p-4 border-b border-gray-100">
                    <Text className="block text-base font-bold text-gray-800 text-center">选择核销份数</Text>
                  </View>
                  <View className="p-4">
                    <Text className="block text-sm font-semibold text-gray-800">{verifyTarget.package_name}</Text>
                    <Text className="block text-xs text-gray-500 mt-1">
                      用户：{verifyTarget.nick_name || '匿名用户'} · 共{verifyTarget.quantity || 1}份 · 已核销{verifyTarget.verified_count || 0}份
                    </Text>
                    <Text className="block text-xs text-orange-600 mt-1 font-semibold">
                      剩余 {(verifyTarget.quantity || 1) - (verifyTarget.verified_count || 0)} 份可核销
                    </Text>
                    {/* 核销规则警告 */}
                    {verifyTarget.verify_warning && (
                      <View className="mt-2 bg-red-50 rounded-lg px-3 py-2">
                        <Text className="block text-xs text-red-600">{verifyTarget.verify_warning}</Text>
                      </View>
                    )}

                    {/* 份数选择器 */}
                    <View className="flex flex-row items-center justify-between mt-4 bg-gray-50 rounded-xl px-4 py-3">
                      <Text className="block text-sm text-gray-600">本次核销份数</Text>
                      <View className="flex flex-row items-center gap-3">
                        <View
                          className={`w-8 h-8 rounded-full flex items-center justify-center ${verifyCount <= 1 ? 'bg-gray-200' : 'bg-red-100'}`}
                          onClick={() => { if (verifyCount > 1) setVerifyCount(verifyCount - 1); }}
                        >
                          <Text className={`text-base font-bold ${verifyCount <= 1 ? 'text-gray-400' : 'text-red-500'}`}>-</Text>
                        </View>
                        <Text className="text-lg font-bold text-gray-800 w-8 text-center">{verifyCount}</Text>
                        <View
                          className={`w-8 h-8 rounded-full flex items-center justify-center ${verifyCount >= (verifyTarget.quantity || 1) - (verifyTarget.verified_count || 0) ? 'bg-gray-200' : 'bg-red-100'}`}
                          onClick={() => {
                            const max = (verifyTarget.quantity || 1) - (verifyTarget.verified_count || 0);
                            if (verifyCount < max) setVerifyCount(verifyCount + 1);
                          }}
                        >
                          <Text className={`text-base font-bold ${verifyCount >= (verifyTarget.quantity || 1) - (verifyTarget.verified_count || 0) ? 'text-gray-400' : 'text-red-500'}`}>+</Text>
                        </View>
                      </View>
                    </View>
                  </View>
                  <View className="flex flex-row border-t border-gray-100">
                    <View
                      className="flex-1 py-3 flex items-center justify-center"
                      onClick={() => setVerifyTarget(null)}
                    >
                      <Text className="block text-sm text-gray-500">取消</Text>
                    </View>
                    <View className="w-px bg-gray-100" />
                    <View
                      className="flex-1 py-3 flex items-center justify-center"
                      onClick={handleConfirmVerify}
                    >
                      <Text className="block text-sm text-red-500 font-bold">确认核销 {verifyCount} 份</Text>
                    </View>
                  </View>
                </View>
              </View>
            )}

            {/* 核销失败原因弹窗 */}
            {verifyFailReason && (
              <View
                style={{
                  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                  backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 999,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
                onClick={() => setVerifyFailReason(null)}
              >
                <View
                  className="bg-white rounded-2xl mx-6 w-full max-w-sm overflow-hidden"
                  onClick={(e) => e.stopPropagation()}
                >
                  <View className="p-6 pb-4 flex flex-col items-center">
                    <View className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mb-4">
                      <Text className="text-2xl">✕</Text>
                    </View>
                    <Text className="block text-base font-bold text-gray-800 text-center mb-2">无法核销</Text>
                    <Text className="block text-sm text-gray-600 text-center leading-6">{verifyFailReason}</Text>
                  </View>
                  <View className="border-t border-gray-100">
                    <View
                      className="py-3 flex items-center justify-center"
                      onClick={() => setVerifyFailReason(null)}
                    >
                      <Text className="block text-sm text-gray-800 font-semibold">知道了</Text>
                    </View>
                  </View>
                </View>
              </View>
            )}

            {/* 使用说明 */}
            <Card>
              <CardContent className="p-4">
                <Text className="block text-sm font-semibold text-gray-800 mb-2">核销说明</Text>
                <View className="flex flex-col gap-1">
                  <Text className="block text-xs text-gray-500 leading-5">1. 用户到店后出示订单详情页中的二维码</Text>
                  <Text className="block text-xs text-gray-500 leading-5">2. 点击「扫码核销」按钮，使用微信扫一扫扫描二维码</Text>
                  <Text className="block text-xs text-gray-500 leading-5">3. 也可以手动输入用户提供的12位核销码</Text>
                  <Text className="block text-xs text-gray-500 leading-5">4. 核销成功后，订单状态变更为「已使用」</Text>
                </View>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="merchants" className="mt-3">
            <View className="flex items-center justify-center py-8">
              <Button
                onClick={() => Taro.navigateTo({ url: '/pages/merchant-admin/index' })}
                className="flex items-center gap-2"
              >
                <Store size={16} color="#fff" />
                <Text className="text-white text-sm">进入商家管理</Text>
              </Button>
            </View>
          </TabsContent>
        </Tabs>
      </View>

      {/* 编辑弹窗 */}
      {showDialog && (
        <View style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <View className="bg-white rounded-2xl w-full max-w-sm p-6">
            <Text className="block text-lg font-bold text-black mb-4">
              {activeTab === 'prizes'
                ? (editingPrize ? '编辑奖品' : '添加奖品')
                : (editingPackage ? '编辑套餐' : '添加套餐')}
            </Text>

            {activeTab === 'prizes' ? (
              /* 奖品表单 */
              <View className="space-y-4">
                <View>
                  <Text className="block text-sm text-black mb-1">奖品名称</Text>
                  <View className="bg-white rounded-xl px-3 py-2 border border-gray-200">
                    <Input
                      className="w-full"
                      style={{ backgroundColor: 'transparent' }}
                      value={prizeForm.name}
                      placeholder="请输入奖品名称"
                      onInput={(e) => setPrizeForm({ ...prizeForm, name: e.detail.value })}
                    />
                  </View>
                </View>

                {/* 模式选择 */}
                <View>
                  <Text className="block text-sm text-black mb-2">奖品模式</Text>
                  <View className="flex flex-row gap-2">
                    {PRIZE_TYPE_OPTIONS.map((opt) => (
                      <View
                        key={opt.value}
                        className={`flex-1 rounded-xl px-3 py-2 border text-center ${prizeForm.prize_type === opt.value ? 'border-red-500 bg-red-50' : 'border-gray-200 bg-white'}`}
                        onClick={() => setPrizeForm({ ...prizeForm, prize_type: opt.value })}
                      >
                        <Text className={`block text-sm ${prizeForm.prize_type === opt.value ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
                          {opt.label}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>

                {/* 优惠券模式字段 */}
                {prizeForm.prize_type === 'coupon' && (
                  <>
                    <View className="flex flex-row gap-3">
                      <View className="flex-1">
                        <Text className="block text-sm text-black mb-1">优惠券金额（元）</Text>
                        <View className="bg-white rounded-xl px-3 py-2 border border-gray-200">
                          <Input
                            className="w-full"
                            style={{ backgroundColor: 'transparent' }}
                            value={prizeForm.coupon_amount}
                            placeholder="如 5"
                            onInput={(e) => setPrizeForm({ ...prizeForm, coupon_amount: e.detail.value })}
                          />
                        </View>
                      </View>
                      <View className="flex-1">
                        <Text className="block text-sm text-black mb-1">使用条件（满多少元）</Text>
                        <View className="bg-white rounded-xl px-3 py-2 border border-gray-200">
                          <Input
                            className="w-full"
                            style={{ backgroundColor: 'transparent' }}
                            value={prizeForm.coupon_min_spend}
                            placeholder="如 50"
                            onInput={(e) => setPrizeForm({ ...prizeForm, coupon_min_spend: e.detail.value })}
                          />
                        </View>
                      </View>
                    </View>
                    <View className="bg-amber-50 rounded-xl p-3">
                      <Text className="block text-xs text-amber-700">抽中后系统校验订单支付金额，满足条件则优惠券金额直接退回原支付账户</Text>
                    </View>
                  </>
                )}

                {/* 商品模式字段 */}
                {prizeForm.prize_type === 'product' && (
                  <>
                    <View className="flex flex-row gap-3">
                      <View className="flex-1">
                        <Text className="block text-sm text-black mb-1">商品名称</Text>
                        <View className="bg-white rounded-xl px-3 py-2 border border-gray-200">
                          <Input
                            className="w-full"
                            style={{ backgroundColor: 'transparent' }}
                            value={prizeForm.product_name}
                            placeholder="如 精美马克杯"
                            onInput={(e) => setPrizeForm({ ...prizeForm, product_name: e.detail.value })}
                          />
                        </View>
                      </View>
                      <View className="flex-1">
                        <Text className="block text-sm text-black mb-1">商品价值（元）</Text>
                        <View className="bg-white rounded-xl px-3 py-2 border border-gray-200">
                          <Input
                            className="w-full"
                            style={{ backgroundColor: 'transparent' }}
                            value={prizeForm.product_value}
                            placeholder="如 39"
                            onInput={(e) => setPrizeForm({ ...prizeForm, product_value: e.detail.value })}
                          />
                        </View>
                      </View>
                    </View>
                    <View className="bg-blue-50 rounded-xl p-3">
                      <Text className="block text-xs text-blue-700">抽中后生成专属二维码，兑换时需商家核销</Text>
                    </View>
                  </>
                )}

                {/* 霸王餐模式说明 */}
                {prizeForm.prize_type === 'free_meal' && (
                  <View className="bg-green-50 rounded-xl p-3">
                    <Text className="block text-xs text-green-700">抽中霸王餐后，系统直接返还用户原先支付金额到原支付账户</Text>
                  </View>
                )}

                <View>
                  <Text className="block text-sm text-black mb-1">奖品描述</Text>
                  <View className="bg-white rounded-2xl p-3 border border-gray-200">
                    <Textarea
                      style={{ width: '100%', minHeight: '60px', backgroundColor: 'transparent' }}
                      value={prizeForm.description}
                      placeholder="请输入奖品描述"
                      onInput={(e) => setPrizeForm({ ...prizeForm, description: e.detail.value })}
                    />
                  </View>
                </View>

                <View className="flex flex-row gap-3">
                  <View className="flex-1">
                    <Text className="block text-sm text-black mb-1">概率 (%)</Text>
                    <View className="bg-white rounded-xl px-3 py-2 border border-gray-200">
                      <Input
                        className="w-full"
                        style={{ backgroundColor: 'transparent' }}
                        value={prizeForm.probability}
                        placeholder="0-100"
                        onInput={(e) => setPrizeForm({ ...prizeForm, probability: e.detail.value })}
                      />
                    </View>
                  </View>
                  <View className="flex-1">
                    <Text className="block text-sm text-black mb-1">库存</Text>
                    <View className="bg-white rounded-xl px-3 py-2 border border-gray-200">
                      <Input
                        className="w-full"
                        style={{ backgroundColor: 'transparent' }}
                        value={prizeForm.stock}
                        placeholder="0"
                        onInput={(e) => setPrizeForm({ ...prizeForm, stock: e.detail.value })}
                      />
                    </View>
                  </View>
                </View>
              </View>
            ) : (
              /* 套餐表单 */
              <View className="space-y-4">
                <View>
                  <Text className="block text-sm text-black mb-1">套餐名称</Text>
                  <View className="bg-white rounded-xl px-3 py-2 border border-gray-200">
                    <Input
                      className="w-full"
                      style={{ backgroundColor: 'transparent' }}
                      value={pkgForm.name}
                      placeholder="请输入套餐名称"
                      onInput={(e) => setPkgForm({ ...pkgForm, name: e.detail.value })}
                    />
                  </View>
                </View>

                <View>
                  <Text className="block text-sm text-black mb-1">套餐描述</Text>
                  <View className="bg-white rounded-2xl p-3 border border-gray-200">
                    <Textarea
                      style={{ width: '100%', minHeight: '60px', backgroundColor: 'transparent' }}
                      value={pkgForm.description}
                      placeholder="请输入套餐描述"
                      onInput={(e) => setPkgForm({ ...pkgForm, description: e.detail.value })}
                    />
                  </View>
                </View>

                <View className="flex flex-row gap-3">
                  <View className="flex-1">
                    <Text className="block text-sm text-black mb-1">价格 (¥)</Text>
                    <View className="bg-white rounded-xl px-3 py-2 border border-gray-200">
                      <Input
                        className="w-full"
                        style={{ backgroundColor: 'transparent' }}
                        value={pkgForm.price}
                        placeholder="9.90"
                        onInput={(e) => setPkgForm({ ...pkgForm, price: e.detail.value })}
                      />
                    </View>
                  </View>
                  <View className="flex-1">
                    <Text className="block text-sm text-black mb-1">原价 (¥)</Text>
                    <View className="bg-white rounded-xl px-3 py-2 border border-gray-200">
                      <Input
                        className="w-full"
                        style={{ backgroundColor: 'transparent' }}
                        value={pkgForm.original_price}
                        placeholder="可选"
                        onInput={(e) => setPkgForm({ ...pkgForm, original_price: e.detail.value })}
                      />
                    </View>
                  </View>
                </View>

                <View>
                  <Text className="block text-sm text-black mb-1">角标（如「限时特惠」）</Text>
                  <View className="bg-white rounded-xl px-3 py-2 border border-gray-200">
                    <Input
                      className="w-full"
                      style={{ backgroundColor: 'transparent' }}
                      value={pkgForm.badge}
                      placeholder="可选"
                      onInput={(e) => setPkgForm({ ...pkgForm, badge: e.detail.value })}
                    />
                  </View>
                </View>

                <View>
                  <Text className="block text-sm text-black mb-1">功能特点（每行一条）</Text>
                  <View className="bg-white rounded-2xl p-3 border border-gray-200">
                    <Textarea
                      style={{ width: '100%', minHeight: '80px', backgroundColor: 'transparent' }}
                      value={pkgForm.features}
                      placeholder="下单即获抽奖资格&#10;分享给好友即可开奖&#10;100%中奖机会"
                      onInput={(e) => setPkgForm({ ...pkgForm, features: e.detail.value })}
                    />
                  </View>
                </View>
              </View>
            )}

            <View className="flex flex-row gap-3 mt-6">
              <View className="flex-1">
                <Button variant="outline" className="w-full" onClick={closeDialog}>
                  <Text className="block text-sm">取消</Text>
                </Button>
              </View>
              <View className="flex-1">
                <Button
                  className="w-full bg-red-500"
                  onClick={handleSavePrize}
                >
                  <Text className="block text-white text-sm">保存</Text>
                </Button>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* 删除确认对话框 */}
      {deleteTarget && (
        <View className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={() => setDeleteTarget(null)}>
          <View className="bg-white rounded-2xl p-6 w-80" onClick={(e) => e.stopPropagation()}>
            <Text className="block text-lg font-bold text-black mb-2">确认删除</Text>
            <Text className="block text-sm text-gray-600 mb-2">确定要删除以下团购套餐吗？</Text>
            <Text className="block text-sm text-black font-medium mb-4">
              {deleteTarget.name}
            </Text>
            <Text className="block text-xs text-red-500 mb-6">删除后将不在后台和前端页面显示，此操作不可恢复。</Text>
            <View className="flex flex-row gap-3">
              <View className="flex-1">
                <Button variant="outline" className="w-full" onClick={() => setDeleteTarget(null)}>
                  <Text className="block text-sm">取消</Text>
                </Button>
              </View>
              <View className="flex-1">
                <Button className="w-full bg-red-500" onClick={handleDeletePackage}>
                  <Text className="block text-white text-sm">确定删除</Text>
                </Button>
              </View>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

export default AdminPage;