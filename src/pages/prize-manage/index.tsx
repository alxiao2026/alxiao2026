import { View, Text, ScrollView, Image } from '@tarojs/components';
import { useState, useEffect } from 'react';
import Taro from '@tarojs/taro';
import { Network } from '@/network';
import { uploadMiniAppImage, ensurePrivacyAuthorized } from '@/lib/upload-image';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Pencil, Trash2, Gift, Check, ChevronRight, Store, ShieldCheck, X, Search } from 'lucide-react-taro';

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
  discount_rate: string;
  discount_cap: string;
  product_name: string;
  product_value: string;
  merchant_id: number | null;
  validity_hours: number | null;
  is_fallback?: boolean | null;
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
    discount_rate: '8.5', discount_cap: '',
    product_name: '', product_value: '', validity_hours: '',
    image_url: '',
    is_fallback: false,
  });
  // 可用门店：null 表示全部门店通用；商家账号固定为本店
  const [merchants, setMerchants] = useState<{ id: number; name: string }[]>([]);
  const [boundMerchantName, setBoundMerchantName] = useState('');
  const [formMerchantId, setFormMerchantId] = useState<number | null>(null);
  const [showMerchantPicker, setShowMerchantPicker] = useState(false);
  const [searchText, setSearchText] = useState('');

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

  // 规范化商家ID（null/undefined 统一为 null，其余转 number 便于比较）
  const normMid = (v: number | null | undefined) => (v === null || v === undefined ? null : Number(v));

  // 已被其他奖品占用的概率（按商家维度：仅统计同一可用门店下的启用中非兜底奖品，不含正在编辑的奖品自身）
  const usedProbability = (targetMid: number | null) =>
    prizes
      .filter((p) => p.is_active && !p.is_fallback && p.id !== editingPrize?.id && normMid(p.merchant_id) === normMid(targetMid))
      .reduce((s, p) => s + (parseFloat(p.probability) || 0), 0);

  // 剩余可分配概率（按商家维度，保留两位小数，最低为 0）
  const remainingProbability = (targetMid: number | null) => Math.max(0, Math.round((100 - usedProbability(targetMid)) * 100) / 100);

  const openCreatePrize = () => {
    setEditingPrize(null);
    // 自动填入当前商家维度下的剩余可分配概率，填完一个下一个自动递减
    setPrizeForm({ name: '', description: '', probability: String(remainingProbability(merchantId ?? null)), stock: '100', prize_type: 'coupon', discount_rate: '8.5', discount_cap: '', product_name: '', product_value: '', validity_hours: '', image_url: '', is_fallback: false });
    setFormMerchantId(merchantId); // 商家账号默认本店；超管默认全部门店通用
    setShowDialog(true);
  };

  const openEditPrize = (prize: Prize) => {
    setEditingPrize(prize);
    setPrizeForm({
      name: prize.name, description: prize.description || '', probability: prize.probability,
      stock: String(prize.stock), prize_type: prize.prize_type || 'coupon',
      discount_rate: prize.discount_rate || '8.5', discount_cap: prize.discount_cap || '',
      product_name: prize.product_name || '', product_value: prize.product_value || '',
      validity_hours: prize.validity_hours ? String(prize.validity_hours) : '',
      image_url: prize.image_url || '',
      is_fallback: !!prize.is_fallback,
    });
    setFormMerchantId(prize.merchant_id ?? null);
    setShowDialog(true);
  };

  const handleSavePrize = async () => {
    if (!prizeForm.name) { Taro.showToast({ title: '请输入奖品名称', icon: 'none' }); return; }
    // 概率总和按商家维度校验：同一可用门店下的启用奖品概率合计不超 100%
    // 商家账号固定校验本店；超管按表单所选目标门店校验（全部门店通用也作为一个维度）
    if (!prizeForm.is_fallback) {
      const targetMid = merchantId ?? formMerchantId;
      const prob = parseFloat(prizeForm.probability) || 0;
      const remaining = remainingProbability(targetMid);
      if (prob > remaining + 1e-9) {
        Taro.showModal({
          title: '概率超标',
          content: `「${getMerchantName(targetMid)}」奖品概率之和不能超过 100%\n该门店剩余可分配 ${remaining}%，建议填 ${remaining}%`,
          showCancel: false,
          confirmText: '知道了',
          confirmColor: '#FF4757',
        });
        return;
      }
    }
    if (prizeForm.prize_type === 'coupon') {
      const rate = Number(prizeForm.discount_rate);
      if (!(rate >= 1 && rate <= 9.9)) {
        Taro.showToast({ title: '折扣比例需在 1.0~9.9 折之间', icon: 'none' }); return;
      }
    }
    try {
      const payload: Record<string, any> = {
        name: prizeForm.name, description: prizeForm.description,
        // 兜底奖：不设概率与库存，仅作为候补（未中其他奖品时必中）
        probability: prizeForm.is_fallback ? '0' : prizeForm.probability,
        stock: prizeForm.is_fallback ? 0 : Number(prizeForm.stock),
        prize_type: prizeForm.prize_type, is_fallback: prizeForm.is_fallback,
        discount_rate: Number(prizeForm.discount_rate) || 0, discount_cap: Number(prizeForm.discount_cap) || 0,
        product_name: prizeForm.product_name, product_value: Number(prizeForm.product_value) || 0,
        image_url: prizeForm.image_url || null,
      };
      // 商品/霸王餐：有效期（小时），留空表示使用全局默认
      if (prizeForm.prize_type === 'product' || prizeForm.prize_type === 'free_meal') {
        payload.validity_hours = prizeForm.validity_hours ? Number(prizeForm.validity_hours) : null;
      }
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

  const handleUploadPrizeImage = async () => {
    try {
      await ensurePrivacyAuthorized()
      const res = await Taro.chooseMedia({ count: 1, mediaType: ['image'], sizeType: ['compressed'], sourceType: ['album', 'camera'] });
      const tempFilePath = res.tempFiles?.[0]?.tempFilePath;
      if (!tempFilePath) return;
      Taro.showLoading({ title: '上传中...' });
      // 优先 uploadFile 直传，失败自动降级 base64 通道（绕开真机域名白名单限制）
      const { url, errorMsg } = await uploadMiniAppImage(tempFilePath);
      Taro.hideLoading();
      if (url) {
        setPrizeForm(prev => ({ ...prev, image_url: url }));
        Taro.showToast({ title: '上传成功', icon: 'success' });
      } else {
        Taro.showToast({ title: errorMsg || '上传失败', icon: 'none' });
      }
    } catch (err: any) {
      Taro.hideLoading();
      if (err?.errMsg?.includes('cancel')) return;
      console.error('[PrizeManage] 上传图片失败:', err);
      Taro.showToast({ title: '上传失败', icon: 'none' });
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

  // 搜索过滤：匹配奖品标题或门店名称（忽略大小写）
  const filteredPrizes = prizes.filter((prize) => {
    const keyword = searchText.trim().toLowerCase();
    if (!keyword) return true;
    if (prize.name.toLowerCase().includes(keyword)) return true;
    if (getMerchantName(prize.merchant_id).toLowerCase().includes(keyword)) return true;
    return false;
  });

  // 超管视角：奖品按商家维度分组（全部门店通用视为一组），组内保持原顺序
  const prizeGroups: { mid: number | null; name: string; items: Prize[]; totalProb: number }[] = (() => {
    const map = new Map<string, { mid: number | null; items: Prize[] }>();
    filteredPrizes.forEach((p) => {
      const mid = normMid(p.merchant_id);
      const key = mid === null ? '__all__' : String(mid);
      if (!map.has(key)) map.set(key, { mid, items: [] });
      map.get(key)!.items.push(p);
    });
    const groups = Array.from(map.values()).map((g) => ({
      mid: g.mid,
      name: getMerchantName(g.mid),
      items: g.items,
      totalProb: Math.round(g.items.filter((p) => p.is_active && !p.is_fallback).reduce((s, p) => s + (parseFloat(p.probability) || 0), 0) * 100) / 100,
    }));
    // 「全部门店通用」排最前，其余按商家名排序
    groups.sort((a, b) => (a.mid === null ? -1 : b.mid === null ? 1 : a.name.localeCompare(b.name, 'zh-CN')));
    return groups;
  })();

  return (
    <View className="min-h-screen bg-gray-50">
      {/* 搜索框：支持门店名或奖品标题 */}
      <View className="px-4 mt-3">
        <View className="flex flex-row items-center bg-white rounded-full border border-gray-200 px-3 py-1">
          <Search size={16} color="#9ca3af" />
          <View className="flex-1 ml-2">
            <Input
              value={searchText}
              onInput={(e) => setSearchText(e.detail.value)}
              placeholder="搜索门店或奖品标题"
              placeholderClass="text-gray-400"
              className="w-full text-sm border-0 bg-transparent"
            />
          </View>
          {searchText.length > 0 && (
            <View className="ml-1" onClick={() => setSearchText('')}>
              <X size={14} color="#9ca3af" />
            </View>
          )}
        </View>
      </View>

      {/* 总概率提示：商家账号显示本店合计；超管按商家维度分别提示 */}
      <View className="px-4 mt-3">
        <View className="bg-red-50 border border-red-200 rounded-xl p-3">
          {merchantId ? (
            <Text className="block text-xs text-[#FF4757]">
              总概率: <Text className="font-bold">{prizes.filter(p => p.is_active && !p.is_fallback).reduce((s, p) => s + parseFloat(p.probability || '0'), 0)}%</Text>
              （低于 100% 的差额由兜底奖候补；未设兜底奖则可能出现未中奖）
            </Text>
          ) : (
            <Text className="block text-xs text-[#FF4757]">
              中奖率按商家维度独立控制：每个门店（含「全部门店通用」）奖品概率合计不超过 100%；低于 100% 的差额由该维度兜底奖候补
            </Text>
          )}
        </View>
      </View>

      {/* 奖品列表 */}
      <View className="px-4 pt-3 pb-20">
        {loading ? (
          <View className="flex items-center justify-center py-20">
            <Text className="block text-gray-400">加载中...</Text>
          </View>
        ) : filteredPrizes.length === 0 ? (
          <View className="flex items-center justify-center py-20">
            <Gift size={48} color="#d1d5db" />
            <Text className="block text-gray-400 mt-3">
              {searchText.trim() ? '没有匹配的奖品' : '暂无奖品，点击上方按钮添加'}
            </Text>
          </View>
        ) : (
          // 超管视角按商家维度分组排版；商家账号仅本店一组，直接平铺
          prizeGroups.map((group) => (
            <View key={group.mid === null ? '__all__' : String(group.mid)}>
              {!merchantId && (
                <View className="flex flex-row items-center gap-2 mt-2 mb-2 px-1">
                  <Store size={15} color="#FF4757" />
                  <Text className="text-sm font-bold text-gray-800">{group.name}</Text>
                  <View className="bg-red-50 rounded-full px-2 py-1">
                    <Text className="text-xs text-[#FF4757] font-semibold">概率合计 {group.totalProb}%</Text>
                  </View>
                </View>
              )}
              {group.items.map((prize) => (
            <Card key={prize.id} className="mb-3">
              <CardContent className="p-4">
                {/* 奖品图片（有则展示） */}
                {prize.image_url && (
                  <View className="mb-3">
                    <Image src={prize.image_url} className="w-full h-24 rounded-lg" mode="aspectFill" />
                  </View>
                )}
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
                  {prize.is_fallback && (
                    <Badge variant="secondary">兜底奖</Badge>
                  )}
                  <Badge variant="secondary">{getMerchantName(prize.merchant_id)}</Badge>
                </View>

                {/* 奖品描述 */}
                {prize.description && (
                  <Text className="block text-sm text-gray-500 mt-2">{prize.description}</Text>
                )}

                {/* 统计信息 */}
                <View className="flex flex-row flex-wrap items-center gap-x-4 gap-y-1 mt-2">
                  {prize.is_fallback ? (
                    <Text className="block text-xs text-gray-400">
                      兜底奖 <Text className="text-amber-600 font-semibold">候补必中 · 不限量</Text>
                    </Text>
                  ) : (
                    <>
                      <Text className="block text-xs text-gray-400">
                        概率 <Text className="text-[#FF4757] font-semibold">{prize.probability}%</Text>
                      </Text>
                      <Text className="block text-xs text-gray-400">
                        库存 <Text className="text-gray-600 font-semibold">{prize.stock}</Text>
                      </Text>
                    </>
                  )}
                  {prize.prize_type === 'coupon' && (
                    <Text className="block text-xs text-gray-400">
                      折扣 <Text className="text-[#FF4757] font-semibold">{prize.discount_rate}折</Text>
                      {Number(prize.discount_cap) > 0 && `（单笔最高优惠¥${prize.discount_cap}）`}
                    </Text>
                  )}
                  {prize.prize_type === 'product' && (
                    <Text className="block text-xs text-gray-400">
                      价值 <Text className="text-[#FF4757] font-semibold">¥{prize.product_value}</Text>
                    </Text>
                  )}
                  {(prize.prize_type === 'product' || prize.prize_type === 'free_meal') && prize.validity_hours && (
                    <Text className="block text-xs text-gray-400">
                      有效期 <Text className="text-gray-600 font-semibold">{prize.validity_hours}小时</Text>
                    </Text>
                  )}
                </View>
              </CardContent>
            </Card>
              ))}
            </View>
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
        <View style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <View className="bg-white rounded-2xl w-full max-w-sm" style={{ display: 'flex', flexDirection: 'column', maxHeight: '85vh' }}>
            <View className="px-6 pt-5 pb-2 flex flex-row items-center justify-between">
              <Text className="block text-lg font-bold text-gray-800">{editingPrize ? '编辑奖品' : '添加奖品'}</Text>
              <View className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center" onClick={() => setShowDialog(false)}>
                <X size={14} color="#6b7280" />
              </View>
            </View>
            <ScrollView scrollY style={{ height: '60vh' }}>
              <View className="space-y-4 px-6 pb-4">
                <View>
                  <Text className="block text-sm text-gray-700 font-medium mb-1">奖品名称</Text>
                  <View className="bg-white rounded-xl px-3 py-2 border border-gray-200">
                    <Input className="w-full" style={{ backgroundColor: 'transparent' }} value={prizeForm.name} placeholder="请输入奖品名称" onInput={(e) => setPrizeForm({ ...prizeForm, name: e.detail.value })} />
                  </View>
                </View>
                <View>
                  <Text className="block text-sm text-gray-700 font-medium mb-2">奖品模式</Text>
                  <View className="flex flex-row gap-2">
                    {PRIZE_TYPE_OPTIONS.map((opt) => (
                      <View key={opt.value} className={`flex-1 min-w-0 rounded-xl px-3 py-2 border text-center ${prizeForm.prize_type === opt.value ? 'border-[#FF4757] bg-red-50' : 'border-gray-200 bg-white'}`} onClick={() => setPrizeForm({ ...prizeForm, prize_type: opt.value })}>
                        <Text className={`block text-sm ${prizeForm.prize_type === opt.value ? 'text-red-600 font-medium' : 'text-gray-600'}`}>{opt.label}</Text>
                      </View>
                    ))}
                  </View>
                </View>
                {/* 兜底奖标签：不设概率与库存，未中其他奖品时必中此奖；不在用户端奖池展示 */}
                <View
                  className={`rounded-xl px-3 py-3 border flex flex-row items-center gap-2 ${prizeForm.is_fallback ? 'border-amber-500 bg-amber-50' : 'border-gray-200 bg-white'}`}
                  onClick={() => setPrizeForm({ ...prizeForm, is_fallback: !prizeForm.is_fallback })}
                >
                  <ShieldCheck size={18} color={prizeForm.is_fallback ? '#d97706' : '#9ca3af'} />
                  <View className="flex-1 min-w-0">
                    <Text className={`block text-sm ${prizeForm.is_fallback ? 'text-amber-700 font-semibold' : 'text-gray-700'}`}>兜底奖</Text>
                    <Text className="block text-xs text-gray-400">不设概率只管候补，未中其他奖品时必中此奖</Text>
                  </View>
                  <View className={`w-5 h-5 rounded-full border flex items-center justify-center ${prizeForm.is_fallback ? 'bg-amber-500 border-amber-500' : 'border-gray-300'}`}>
                    {prizeForm.is_fallback && <Check size={12} color="#ffffff" />}
                  </View>
                </View>
                {/* 商品/霸王餐：奖品有效期（小时），留空使用全局默认 */}
                {(prizeForm.prize_type === 'product' || prizeForm.prize_type === 'free_meal') && (
                  <View>
                    <Text className="block text-sm text-gray-700 font-medium mb-1">奖品有效期（小时）</Text>
                    <View className="bg-white rounded-xl px-3 py-2 border border-gray-200">
                      <Input className="w-full" style={{ backgroundColor: 'transparent' }} value={prizeForm.validity_hours} placeholder="如 72，留空使用全局默认有效期" onInput={(e) => setPrizeForm({ ...prizeForm, validity_hours: e.detail.value })} />
                    </View>
                    <Text className="block text-xs text-gray-400 mt-1">中奖后需在有效期内核销，过期无法兑奖；留空则使用抽奖设置中的全局有效期</Text>
                  </View>
                )}
                {/* 奖品图片 */}
                <View>
                  <Text className="block text-sm text-gray-700 font-medium mb-1">奖品图片（选填）</Text>
                  <View className="flex flex-row gap-3 items-center">
                    <View
                      className="w-20 h-20 bg-gray-50 rounded-xl border border-dashed border-gray-300 flex items-center justify-center overflow-hidden"
                      onClick={handleUploadPrizeImage}
                    >
                      {prizeForm.image_url ? (
                        <Image src={prizeForm.image_url} className="w-full h-full" mode="aspectFill" />
                      ) : (
                        <Plus size={24} color="#9ca3af" />
                      )}
                    </View>
                    <Text className="block text-xs text-gray-400 flex-1 min-w-0">点击上传奖品图片，支持 jpg/png；建议 200×200 像素</Text>
                  </View>
                </View>
                {/* 可用门店 */}
                <View>
                  <Text className="block text-sm text-gray-700 font-medium mb-1">可用门店</Text>
                  {merchantId ? (
                    <View className="bg-gray-50 rounded-xl px-3 py-2 border border-gray-200 flex flex-row items-center gap-2">
                      <Store size={14} color="#6b7280" />
                      <Text className="block text-sm text-gray-600 flex-1 min-w-0 truncate">本店{boundMerchantName ? `（${boundMerchantName}）` : ''} · 不可修改</Text>
                    </View>
                  ) : (
                    <View className="bg-white rounded-xl px-3 py-2 border border-gray-200 flex flex-row items-center justify-between" onClick={() => setShowMerchantPicker(true)}>
                      <View className="flex flex-row items-center gap-2 flex-1 min-w-0">
                        <Store size={14} color="#6b7280" />
                        <Text className="block text-sm text-gray-800 truncate">{getMerchantName(formMerchantId)}</Text>
                      </View>
                      <ChevronRight size={16} color="#9ca3af" />
                    </View>
                  )}
                </View>
                {prizeForm.prize_type === 'coupon' && (
                  <>
                    <View className="flex flex-row gap-3">
                      <View className="flex-1 min-w-0">
                        <Text className="block text-sm text-gray-700 font-medium mb-1">折扣比例（1.0~9.9折）</Text>
                        <View className="bg-white rounded-xl px-3 py-2 border border-gray-200">
                          <Input type="digit" className="w-full" style={{ backgroundColor: 'transparent' }} value={prizeForm.discount_rate} placeholder="如 8.5" onInput={(e) => setPrizeForm({ ...prizeForm, discount_rate: e.detail.value })} />
                        </View>
                      </View>
                      <View className="flex-1 min-w-0">
                        <Text className="block text-sm text-gray-700 font-medium mb-1">单笔最高优惠（元）</Text>
                        <View className="bg-white rounded-xl px-3 py-2 border border-gray-200">
                          <Input type="digit" className="w-full" style={{ backgroundColor: 'transparent' }} value={prizeForm.discount_cap} placeholder="如 5，0为不封顶" onInput={(e) => setPrizeForm({ ...prizeForm, discount_cap: e.detail.value })} />
                        </View>
                      </View>
                    </View>
                    <View className="bg-orange-50 rounded-xl px-3 py-2">
                      <Text className="block text-xs text-orange-600">中奖后按订单金额自动返还折扣差额（如8.5折返还15%），超过单笔最高优惠按上限返还；返还即时到账并直接核销，订单退款时将从退款中扣除已返还金额。</Text>
                    </View>
                  </>
                )}
                {prizeForm.prize_type === 'product' && (
                  <>
                    <View>
                      <Text className="block text-sm text-gray-700 font-medium mb-1">商品名称</Text>
                      <View className="bg-white rounded-xl px-3 py-2 border border-gray-200">
                        <Input className="w-full" style={{ backgroundColor: 'transparent' }} value={prizeForm.product_name} placeholder="请输入商品名称" onInput={(e) => setPrizeForm({ ...prizeForm, product_name: e.detail.value })} />
                      </View>
                    </View>
                    <View>
                      <Text className="block text-sm text-gray-700 font-medium mb-1">商品价值（元）</Text>
                      <View className="bg-white rounded-xl px-3 py-2 border border-gray-200">
                        <Input className="w-full" style={{ backgroundColor: 'transparent' }} value={prizeForm.product_value} placeholder="如 99" onInput={(e) => setPrizeForm({ ...prizeForm, product_value: e.detail.value })} />
                      </View>
                    </View>
                  </>
                )}
                {prizeForm.is_fallback ? (
                  <View className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                    <Text className="block text-xs text-amber-700">兜底奖无需设置概率与库存：永远有货，其他奖品未中时自动候补发放，且不在用户端奖池展示</Text>
                  </View>
                ) : (
                  <View className="flex flex-row gap-3">
                    <View className="flex-1 min-w-0">
                      <Text className="block text-sm text-gray-700 font-medium mb-1">中奖概率（%）</Text>
                      <View className="bg-white rounded-xl px-3 py-2 border border-gray-200">
                        <Input className="w-full" style={{ backgroundColor: 'transparent' }} value={prizeForm.probability} placeholder="如 10" onInput={(e) => setPrizeForm({ ...prizeForm, probability: e.detail.value })} />
                      </View>
                      {(() => {
                        const prob = parseFloat(prizeForm.probability) || 0;
                        const remaining = remainingProbability(merchantId ?? formMerchantId);
                        const over = prob > remaining + 1e-9;
                        return over ? (
                          <Text className="block text-xs mt-1 text-[#FF4757] font-medium">概率超标：「{getMerchantName(merchantId ?? formMerchantId)}」剩余可分配 {remaining}%，建议填 {remaining}%</Text>
                        ) : (
                          <Text className="block text-xs mt-1 text-gray-400">「{getMerchantName(merchantId ?? formMerchantId)}」剩余可分配概率 {remaining}%</Text>
                        );
                      })()}
                    </View>
                    <View className="flex-1 min-w-0">
                      <Text className="block text-sm text-gray-700 font-medium mb-1">库存数量</Text>
                      <View className="bg-white rounded-xl px-3 py-2 border border-gray-200">
                        <Input className="w-full" style={{ backgroundColor: 'transparent' }} value={prizeForm.stock} placeholder="如 100" onInput={(e) => setPrizeForm({ ...prizeForm, stock: e.detail.value })} />
                      </View>
                    </View>
                  </View>
                )}
                <View>
                  <Text className="block text-sm text-gray-700 font-medium mb-1">奖品描述</Text>
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
            <ScrollView scrollY style={{ maxHeight: 300 }}>
              <View className="px-5 pt-2 pb-4">
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
              </View>
            </ScrollView>
          </View>
        </View>
      )}
    </View>
  );
}
