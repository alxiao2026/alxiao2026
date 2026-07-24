import { View, Text, ScrollView } from '@tarojs/components';
import { useState, useEffect } from 'react';
import Taro from '@tarojs/taro';
import { Network } from '@/network';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Pencil, Trash2, Gift, Check, ChevronRight, Store } from 'lucide-react-taro';

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
  // 可用门店：null 表示全部门店通用；商家账号固定为本店
  const [merchants, setMerchants] = useState<{ id: number; name: string }[]>([]);
  const [boundMerchantName, setBoundMerchantName] = useState('');
  const [formMerchantId, setFormMerchantId] = useState<number | null>(null);
  const [showMerchantPicker, setShowMerchantPicker] = useState(false);

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
          setBoundMerchantName(merchant.name || '');
        }
      } catch (err) {
        console.error('获取商家信息失败:', err);
      }
    }
    setMerchantId(boundMerchantId);
    // 超级管理员加载门店列表，用于奖品"可用门店"选择
    if (!boundMerchantId) {
      try {
        const res = await Network.request({ url: '/api/merchants' });
        const list = (res.data as any)?.data || [];
        setMerchants(list.map((m: any) => ({ id: m.id, name: m.name })));
      } catch (err) {
        console.error('获取门店列表失败:', err);
      }
    }
    await fetchPrizes(boundMerchantId);
  };

  // 门店显示名：null=全部门店通用；本店=绑定门店名；其余从门店列表解析
  const getMerchantName = (mid: number | null) => {
    if (mid === null || mid === undefined) return '全部门店通用';
    if (merchantId && mid === merchantId) return boundMerchantName || '本店';
    return merchants.find((m) => m.id === mid)?.name || '指定门店';
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
    setFormMerchantId(merchantId); // 商家账号默认本店；超管默认全部门店通用
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
    setFormMerchantId(prize.merchant_id ?? null);
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
      // 可用门店：null 表示全部门店通用；商家账号固定为本店
      payload.merchant_id = merchantId ?? formMerchantId;
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
                {/* 第一行：奖品名称 + 操作按钮 */}
                <View className="flex flex-row items-center justify-between gap-2">
                  <View className="flex-1 min-w-0">
                    <Text className="block text-base font-semibold text-gray-800 truncate">{prize.name}</Text>
                  </View>
                  <View className="flex flex-row items-center gap-1 shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => openEditPrize(prize)}>
                      <Pencil size={15} color="#6b7280" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleTogglePrize(prize)}>
                      <Text className={`text-xs ${prize.is_active ? 'text-gray-500' : 'text-[#FF4757] font-semibold'}`}>
                        {prize.is_active ? '停用' : '启用'}
                      </Text>
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDeletePrize(prize.id)}>
                      <Trash2 size={15} color="#ef4444" />
                    </Button>
                  </View>
                </View>

                {/* 第二行：状态 / 类型 / 可用门店徽标（可整体换行） */}
                <View className="flex flex-row flex-wrap items-center gap-1 mt-2">
                  <Badge variant={prize.is_active ? 'default' : 'secondary'}>
                    {prize.is_active ? '启用' : '停用'}
                  </Badge>
                  <Badge variant="outline">
                    {prize.prize_type === 'coupon' ? '优惠券' : prize.prize_type === 'product' ? '商品' : '霸王餐'}
                  </Badge>
                  <Badge variant="secondary">{getMerchantName(prize.merchant_id)}</Badge>
                </View>

                {/* 奖品描述 */}
                {prize.description && (
                  <Text className="block text-sm text-gray-500 mt-2">{prize.description}</Text>
                )}

                {/* 统计信息 */}
                <View className="flex flex-row flex-wrap items-center gap-x-4 gap-y-1 mt-2">
                  <Text className="block text-xs text-gray-400">
                    概率 <Text className="text-[#FF4757] font-semibold">{prize.probability}%</Text>
                  </Text>
                  <Text className="block text-xs text-gray-400">
                    库存 <Text className="text-gray-600 font-semibold">{prize.stock}</Text>
                  </Text>
                  {prize.prize_type === 'coupon' && (
                    <Text className="block text-xs text-gray-400">
                      金额 <Text className="text-[#FF4757] font-semibold">¥{prize.coupon_amount}</Text>
                      {Number(prize.coupon_min_spend) > 0 && `（满${prize.coupon_min_spend}可用）`}
                    </Text>
                  )}
                  {prize.prize_type === 'product' && (
                    <Text className="block text-xs text-gray-400">
                      价值 <Text className="text-[#FF4757] font-semibold">¥{prize.product_value}</Text>
                    </Text>
                  )}
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
                {/* 可用门店 */}
                <View>
                  <Text className="block text-sm text-black mb-1">可用门店</Text>
                  {merchantId ? (
                    <View className="bg-gray-50 rounded-xl px-3 py-2 border border-gray-200 flex flex-row items-center gap-2">
                      <Store size={14} color="#6b7280" />
                      <Text className="block text-sm text-gray-600">本店{boundMerchantName ? `（${boundMerchantName}）` : ''} · 不可修改</Text>
                    </View>
                  ) : (
                    <View className="bg-white rounded-xl px-3 py-2 border border-gray-200 flex flex-row items-center justify-between" onClick={() => setShowMerchantPicker(true)}>
                      <View className="flex flex-row items-center gap-2">
                        <Store size={14} color="#6b7280" />
                        <Text className="block text-sm text-gray-800">{getMerchantName(formMerchantId)}</Text>
                      </View>
                      <ChevronRight size={16} color="#9ca3af" />
                    </View>
                  )}
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

      {/* 可用门店选择弹窗 */}
      {showMerchantPicker && (
        <View style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowMerchantPicker(false)}>
          <View className="bg-white rounded-2xl w-4/5 max-w-sm overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <View className="px-5 pt-5 pb-3 border-b border-gray-100">
              <Text className="block text-base font-bold text-black">选择可用门店</Text>
              <Text className="block text-xs text-gray-400 mt-1">中奖用户仅可在所选门店核销该奖品</Text>
            </View>
            <ScrollView scrollY style={{ maxHeight: 300 }} className="px-5 pt-2 pb-4">
              <View className="flex flex-row items-center justify-between py-3 border-b border-gray-50" onClick={() => { setFormMerchantId(null); setShowMerchantPicker(false); }}>
                <Text className={`block text-sm ${formMerchantId === null ? 'text-[#FF4757] font-semibold' : 'text-gray-800'}`}>全部门店通用</Text>
                {formMerchantId === null && <Check size={18} color="#FF4757" />}
              </View>
              {merchants.map((m) => (
                <View key={m.id} className="flex flex-row items-center justify-between py-3 border-b border-gray-50" onClick={() => { setFormMerchantId(m.id); setShowMerchantPicker(false); }}>
                  <Text className={`block text-sm ${formMerchantId === m.id ? 'text-[#FF4757] font-semibold' : 'text-gray-800'}`}>{m.name}</Text>
                  {formMerchantId === m.id && <Check size={18} color="#FF4757" />}
                </View>
              ))}
              {merchants.length === 0 && (
                <View className="py-6">
                  <Text className="block text-sm text-gray-400 text-center">暂无门店，请先在「商家收录」中添加</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      )}
    </View>
  );
}
