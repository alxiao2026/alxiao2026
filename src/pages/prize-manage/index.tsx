import { View, Text, ScrollView } from '@tarojs/components';
import { useState, useEffect } from 'react';
import Taro from '@tarojs/taro';
import { Network } from '@/network';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Pencil, Trash2, Gift } from 'lucide-react-taro';

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
  merchant_id: number | null;
  created_at: string;
  updated_at: string | null;
}

const PRIZE_TYPE_OPTIONS = [
  { value: 'coupon', label: '优惠券模式' },
  { value: 'product', label: '商品模式' },
  { value: 'free_meal', label: '霸王餐模式' },
] as const;

export default function PrizeManagePage() {
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [loading, setLoading] = useState(true);
  const [merchantId, setMerchantId] = useState<number | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [editingPrize, setEditingPrize] = useState<Prize | null>(null);
  const [prizeForm, setPrizeForm] = useState({
    name: '', description: '', probability: '0', stock: '0',
    prize_type: 'coupon' as 'coupon' | 'product' | 'free_meal',
    coupon_amount: '', coupon_min_spend: '',
    product_name: '', product_value: '',
  });

  useEffect(() => {
    initMerchantAndFetch();
  }, []);

  // 获取当前登录账号绑定的门店，商家账号仅显示本店奖品
  const initMerchantAndFetch = async () => {
    const userId = Taro.getStorageSync('user_id');
    let boundMerchantId: number | null = null;
    if (userId) {
      try {
        const res = await Network.request({ url: `/api/users/${userId}/merchant` });
        const merchant = (res.data as any)?.data;
        if (merchant?.id) {
          boundMerchantId = merchant.id;
        }
      } catch (err) {
        console.error('获取商家信息失败:', err);
      }
    }
    setMerchantId(boundMerchantId);
    await fetchPrizes(boundMerchantId);
  };

  const fetchPrizes = async (mid: number | null = merchantId) => {
    setLoading(true);
    try {
      const url = mid ? `/api/prizes?merchant_id=${mid}` : '/api/prizes';
      const res = await Network.request({ url });
      setPrizes((res.data as any)?.data || (res.data as Prize[]) || []);
    } catch (err) {
      console.error('获取奖品失败:', err);
    } finally {
      setLoading(false);
    }
  };

  const openCreatePrize = () => {
    setEditingPrize(null);
    setPrizeForm({ name: '', description: '', probability: '10', stock: '100', prize_type: 'coupon', coupon_amount: '', coupon_min_spend: '', product_name: '', product_value: '' });
    setShowDialog(true);
  };

  const openEditPrize = (prize: Prize) => {
    setEditingPrize(prize);
    setPrizeForm({
      name: prize.name, description: prize.description || '', probability: prize.probability,
      stock: String(prize.stock), prize_type: prize.prize_type || 'coupon',
      coupon_amount: prize.coupon_amount || '', coupon_min_spend: prize.coupon_min_spend || '',
      product_name: prize.product_name || '', product_value: prize.product_value || '',
    });
    setShowDialog(true);
  };

  const handleSavePrize = async () => {
    if (!prizeForm.name) { Taro.showToast({ title: '请输入奖品名称', icon: 'none' }); return; }
    try {
      const payload: Record<string, any> = {
        name: prizeForm.name, description: prizeForm.description, probability: prizeForm.probability,
        stock: Number(prizeForm.stock), prize_type: prizeForm.prize_type,
        coupon_amount: Number(prizeForm.coupon_amount) || 0, coupon_min_spend: Number(prizeForm.coupon_min_spend) || 0,
        product_name: prizeForm.product_name, product_value: Number(prizeForm.product_value) || 0,
      };
      // 商家账号创建奖品自动挂到本店
      if (merchantId) payload.merchant_id = merchantId;
      if (editingPrize) {
        await Network.request({ url: `/api/prizes/${editingPrize.id}`, method: 'PUT', data: payload });
      } else {
        await Network.request({ url: '/api/prizes', method: 'POST', data: payload });
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
    Taro.showModal({
      title: '确认删除', content: '确定要删除该奖品吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            await Network.request({ url: `/api/prizes/${id}`, method: 'DELETE' });
            Taro.showToast({ title: '删除成功', icon: 'success' });
            fetchPrizes();
          } catch (err) {
            Taro.showToast({ title: '删除失败', icon: 'none' });
          }
        }
      },
    });
  };

  const handleTogglePrize = async (prize: Prize) => {
    try {
      await Network.request({ url: `/api/prizes/${prize.id}`, method: 'PUT', data: { is_active: !prize.is_active } });
      fetchPrizes();
    } catch (err) {
      console.error('切换状态失败:', err);
    }
  };

  return (
    <View className="min-h-screen bg-gray-50">
      {/* 总概率提示 */}
      <View className="px-4 mt-3">
        <View className="bg-red-50 border border-red-200 rounded-xl p-3">
          <Text className="block text-xs text-[#FF4757]">
            总概率: <Text className="font-bold">{prizes.filter(p => p.is_active).reduce((s, p) => s + parseFloat(p.probability || '0'), 0)}%</Text>
            （建议总概率保持 100%，确保100%中奖）
          </Text>
        </View>
      </View>

      {/* 奖品列表 */}
      <View className="px-4 pt-3 pb-20">
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
          prizes.map((prize) => (
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
                        概率: <Text className="text-[#FF4757] font-semibold">{prize.probability}%</Text>
                      </Text>
                      <Text className="block text-xs text-gray-400">
                        库存: <Text className="text-gray-600 font-semibold">{prize.stock}</Text>
                      </Text>
                      {prize.prize_type === 'coupon' && (
                        <Text className="block text-xs text-gray-400">
                          金额: <Text className="text-[#FF4757] font-semibold">¥{prize.coupon_amount}</Text>
                          {Number(prize.coupon_min_spend) > 0 && ` 满${prize.coupon_min_spend}可用`}
                        </Text>
                      )}
                      {prize.prize_type === 'product' && (
                        <Text className="block text-xs text-gray-400">
                          价值: <Text className="text-[#FF4757] font-semibold">¥{prize.product_value}</Text>
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
          ))
        )}
      </View>

      {/* 底部新建奖品按钮 */}
      <View style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        padding: '12px 16px', backgroundColor: '#fff', borderTop: '1px solid #f3f4f6', zIndex: 100
      }}
      >
        <View className="bg-[#FF4757] rounded-full py-3 flex flex-row items-center justify-center gap-1" onClick={openCreatePrize}>
          <Plus size={18} color="#ffffff" />
          <Text className="block text-white text-base font-semibold">新建奖品</Text>
        </View>
      </View>

      {/* 编辑弹窗 */}
      {showDialog && (
        <View style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <View className="bg-white rounded-2xl w-full max-w-sm" style={{ display: 'flex', flexDirection: 'column', maxHeight: '85vh' }}>
            <View className="px-6 pt-6 pb-2">
              <Text className="block text-lg font-bold text-black">{editingPrize ? '编辑奖品' : '添加奖品'}</Text>
            </View>
            <ScrollView scrollY style={{ flex: 1 }} className="px-6">
              <View className="space-y-4">
                <View>
                  <Text className="block text-sm text-black mb-1">奖品名称</Text>
                  <View className="bg-white rounded-xl px-3 py-2 border border-gray-200">
                    <Input className="w-full" style={{ backgroundColor: 'transparent' }} value={prizeForm.name} placeholder="请输入奖品名称" onInput={(e) => setPrizeForm({ ...prizeForm, name: e.detail.value })} />
                  </View>
                </View>
                <View>
                  <Text className="block text-sm text-black mb-2">奖品模式</Text>
                  <View className="flex flex-row gap-2">
                    {PRIZE_TYPE_OPTIONS.map((opt) => (
                      <View key={opt.value} className={`flex-1 rounded-xl px-3 py-2 border text-center ${prizeForm.prize_type === opt.value ? 'border-[#FF4757] bg-red-50' : 'border-gray-200 bg-white'}`} onClick={() => setPrizeForm({ ...prizeForm, prize_type: opt.value })}>
                        <Text className={`block text-sm ${prizeForm.prize_type === opt.value ? 'text-red-600 font-medium' : 'text-gray-600'}`}>{opt.label}</Text>
                      </View>
                    ))}
                  </View>
                </View>
                {prizeForm.prize_type === 'coupon' && (
                  <>
                    <View className="flex flex-row gap-3">
                      <View className="flex-1">
                        <Text className="block text-sm text-black mb-1">优惠券金额（元）</Text>
                        <View className="bg-white rounded-xl px-3 py-2 border border-gray-200">
                          <Input className="w-full" style={{ backgroundColor: 'transparent' }} value={prizeForm.coupon_amount} placeholder="如 5" onInput={(e) => setPrizeForm({ ...prizeForm, coupon_amount: e.detail.value })} />
                        </View>
                      </View>
                      <View className="flex-1">
                        <Text className="block text-sm text-black mb-1">满多少可用（元）</Text>
                        <View className="bg-white rounded-xl px-3 py-2 border border-gray-200">
                          <Input className="w-full" style={{ backgroundColor: 'transparent' }} value={prizeForm.coupon_min_spend} placeholder="如 50" onInput={(e) => setPrizeForm({ ...prizeForm, coupon_min_spend: e.detail.value })} />
                        </View>
                      </View>
                    </View>
                  </>
                )}
                {prizeForm.prize_type === 'product' && (
                  <>
                    <View>
                      <Text className="block text-sm text-black mb-1">商品名称</Text>
                      <View className="bg-white rounded-xl px-3 py-2 border border-gray-200">
                        <Input className="w-full" style={{ backgroundColor: 'transparent' }} value={prizeForm.product_name} placeholder="请输入商品名称" onInput={(e) => setPrizeForm({ ...prizeForm, product_name: e.detail.value })} />
                      </View>
                    </View>
                    <View>
                      <Text className="block text-sm text-black mb-1">商品价值（元）</Text>
                      <View className="bg-white rounded-xl px-3 py-2 border border-gray-200">
                        <Input className="w-full" style={{ backgroundColor: 'transparent' }} value={prizeForm.product_value} placeholder="如 99" onInput={(e) => setPrizeForm({ ...prizeForm, product_value: e.detail.value })} />
                      </View>
                    </View>
                  </>
                )}
                <View className="flex flex-row gap-3">
                  <View className="flex-1">
                    <Text className="block text-sm text-black mb-1">中奖概率（%）</Text>
                    <View className="bg-white rounded-xl px-3 py-2 border border-gray-200">
                      <Input className="w-full" style={{ backgroundColor: 'transparent' }} value={prizeForm.probability} placeholder="如 10" onInput={(e) => setPrizeForm({ ...prizeForm, probability: e.detail.value })} />
                    </View>
                  </View>
                  <View className="flex-1">
                    <Text className="block text-sm text-black mb-1">库存数量</Text>
                    <View className="bg-white rounded-xl px-3 py-2 border border-gray-200">
                      <Input className="w-full" style={{ backgroundColor: 'transparent' }} value={prizeForm.stock} placeholder="如 100" onInput={(e) => setPrizeForm({ ...prizeForm, stock: e.detail.value })} />
                    </View>
                  </View>
                </View>
                <View>
                  <Text className="block text-sm text-black mb-1">奖品描述</Text>
                  <View className="bg-white rounded-xl px-3 py-2 border border-gray-200">
                    <Textarea style={{ width: '100%', minHeight: '60px', backgroundColor: 'transparent' }} value={prizeForm.description} placeholder="请输入奖品描述" onInput={(e) => setPrizeForm({ ...prizeForm, description: e.detail.value })} />
                  </View>
                </View>
              </View>
            </ScrollView>
            <View className="flex flex-row border-t border-gray-100 px-6 py-4 gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setShowDialog(false)}>
                <Text className="block text-sm">取消</Text>
              </Button>
              <Button className="flex-1 bg-[#FF4757]" onClick={handleSavePrize}>
                <Text className="block text-white text-sm">{editingPrize ? '保存' : '创建'}</Text>
              </Button>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}
