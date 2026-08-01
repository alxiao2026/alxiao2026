import { View, Text, Image, ScrollView } from '@tarojs/components';
import { useState, useEffect } from 'react';
import Taro from '@tarojs/taro';
import { Network } from '@/network';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, X, ChevronDown, Ellipsis, Store, Sparkles, Timer, Flame, Package as PackageIcon } from 'lucide-react-taro';

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
  merchant_id: string | null;
  sale_end_date: string | null;
  created_at: string;
  updated_at: string | null;
}

interface MerchantOption {
  id: string;
  name: string;
}

type SortType = 'default' | 'expire' | 'sales' | 'stock';

const SORT_OPTIONS: Array<{ key: SortType; label: string }> = [
  { key: 'default', label: '最新创建' },
  { key: 'expire', label: '快到期' },
  { key: 'sales', label: '销量最高' },
  { key: 'stock', label: '库存最少' },
];

/** 解析 "2026/3/4" 这类有效期字符串为时间戳，无效/空返回极大值（排最后） */
const parseEndDate = (s?: string | null): number => {
  if (!s) return Number.MAX_SAFE_INTEGER;
  const t = new Date(s.replace(/\//g, '-')).getTime();
  return Number.isNaN(t) ? Number.MAX_SAFE_INTEGER : t;
};

export default function ProductManagePage() {
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeStatus, setActiveStatus] = useState('all');
  const [searchText, setSearchText] = useState('');
  const [sortType, setSortType] = useState<SortType>('default');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Package | null>(null);
  const [merchantId, setMerchantId] = useState<string | null>(null);
  const [merchantLoaded, setMerchantLoaded] = useState(false);
  const [merchants, setMerchants] = useState<MerchantOption[]>([]);
  const [selectedMerchantId, setSelectedMerchantId] = useState('');

  const isSuperAdmin = Taro.getStorageSync('role_code') === 'super_admin';

  useEffect(() => {
    loadMerchantInfo();
    if (isSuperAdmin) {
      fetchMerchants();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (merchantLoaded) {
      fetchPackages();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [merchantLoaded, merchantId, selectedMerchantId]);

  const loadMerchantInfo = async () => {
    const userId = Taro.getStorageSync('user_id');
    if (userId) {
      try {
        const res = await Network.request({ url: `/api/users/${userId}/merchant` });
        const data = (res.data as any)?.data || res.data;
        if (data && data.id) {
          setMerchantId(String(data.id));
        }
      } catch (err) {
        console.error('获取商家信息失败:', err);
      }
    }
    setMerchantLoaded(true);
  };

  const fetchMerchants = async () => {
    try {
      const res = await Network.request({ url: '/api/merchants' });
      const data = (res.data as any)?.data || res.data;
      setMerchants(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('获取门店列表失败:', err);
    }
  };

  const fetchPackages = async () => {
    setLoading(true);
    try {
      // 商家账号只加载本店套餐；超级管理员可全量或按门店筛选
      const effectiveMerchantId = isSuperAdmin ? selectedMerchantId : (merchantId || '');
      const url = effectiveMerchantId ? `/api/packages?merchant_id=${effectiveMerchantId}` : '/api/packages';
      const res = await Network.request({ url });
      const data = (res.data as any)?.data || res.data;
      setPackages(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('获取套餐失败:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectMerchant = () => {
    const options = ['全部门店', ...merchants.map(m => m.name)];
    Taro.showActionSheet({
      itemList: options,
      success: (res) => {
        if (res.tapIndex === 0) {
          setSelectedMerchantId('');
        } else {
          setSelectedMerchantId(String(merchants[res.tapIndex - 1].id));
        }
      },
    });
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await Network.request({ url: `/api/packages/${deleteTarget.id}`, method: 'DELETE' });
      Taro.showToast({ title: '删除成功', icon: 'success' });
      setDeleteTarget(null);
      fetchPackages();
    } catch (err) {
      console.error('删除失败:', err);
      Taro.showToast({ title: '删除失败', icon: 'none' });
    }
  };

  const handleToggleActive = async (pkg: Package) => {
    try {
      await Network.request({
        url: `/api/packages/${pkg.id}`,
        method: 'PUT',
        data: { is_active: !pkg.is_active },
      });
      fetchPackages();
    } catch (err) {
      console.error('切换状态失败:', err);
    }
  };

  const filteredPackages = packages.filter((pkg) => {
    if (activeStatus === 'active' && !pkg.is_active) return false;
    if (activeStatus === 'inactive' && pkg.is_active) return false;
    if (searchText && !pkg.name.toLowerCase().includes(searchText.trim().toLowerCase())) return false;
    return true;
  });

  const sortedPackages = [...filteredPackages].sort((a, b) => {
    if (sortType === 'expire') {
      return parseEndDate(a.sale_end_date) - parseEndDate(b.sale_end_date);
    }
    if (sortType === 'sales') {
      return (b.sales_count || 0) - (a.sales_count || 0);
    }
    if (sortType === 'stock') {
      const sa = a.stock === null || a.stock === undefined ? Number.MAX_SAFE_INTEGER : a.stock;
      const sb = b.stock === null || b.stock === undefined ? Number.MAX_SAFE_INTEGER : b.stock;
      return sa - sb;
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  /** 有效期展示信息：临期（≤7天）或已过期给出预警样式 */
  const getExpiryInfo = (pkg: Package): { text: string; urgent: boolean } => {
    if (!pkg.sale_end_date) return { text: '长期售卖', urgent: false };
    const end = parseEndDate(pkg.sale_end_date);
    const days = Math.ceil((end - Date.now()) / 86400000);
    if (days < 0) return { text: '已过期', urgent: true };
    if (days <= 7) return { text: `仅剩 ${days} 天`, urgent: true };
    return { text: `有效期至 ${pkg.sale_end_date}`, urgent: false };
  };

  const activeCount = packages.filter(p => p.is_active).length;
  const inactiveCount = packages.filter(p => !p.is_active).length;
  const selectedMerchantName = selectedMerchantId
    ? (merchants.find(m => String(m.id) === selectedMerchantId)?.name || '已选门店')
    : '全部门店';

  const renderSortIcon = (key: SortType, active: boolean) => {
    const color = active ? '#FF4757' : '#9ca3af';
    if (key === 'default') return <Sparkles size={13} color={color} />;
    if (key === 'expire') return <Timer size={13} color={color} />;
    if (key === 'sales') return <Flame size={13} color={color} />;
    return <PackageIcon size={13} color={color} />;
  };

  return (
    <View className="min-h-screen bg-gray-50">
      {/* 头部功能区 */}
      <View className="bg-gradient-to-b from-red-50 to-gray-50 px-4 pt-4 pb-3">
        <View className="flex flex-row items-center justify-between mb-3">
          <Text className="block text-lg font-bold text-gray-800">团购商品</Text>
          <Badge className="bg-[#FF4757] text-white border-0">{packages.length} 个套餐</Badge>
        </View>

        {/* 搜索框 */}
        <View className="flex flex-row items-center bg-white rounded-full border border-gray-200 px-3 py-1 mb-3">
          <Search size={16} color="#9ca3af" />
          <View className="flex-1 ml-2">
            <Input
              value={searchText}
              onInput={(e) => setSearchText(e.detail.value)}
              placeholder="搜索套餐名称"
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

        {/* 状态胶囊 + 门店筛选 */}
        <View className="flex flex-row items-center gap-2 mb-3">
          {[
            { key: 'all', label: `全部 ${packages.length}` },
            { key: 'active', label: `已上架 ${activeCount}` },
            { key: 'inactive', label: `已下架 ${inactiveCount}` },
          ].map((tab) => (
            <View
              key={tab.key}
              className={`rounded-full px-3 py-1 ${activeStatus === tab.key ? 'bg-[#FF4757]' : 'bg-white border border-gray-200'}`}
              onClick={() => setActiveStatus(tab.key)}
            >
              <Text className={`block text-xs ${activeStatus === tab.key ? 'text-white font-medium' : 'text-gray-600'}`}>
                {tab.label}
              </Text>
            </View>
          ))}
          <View className="flex-1" />
          {isSuperAdmin && merchants.length > 0 && (
            <View
              className={`flex flex-row items-center gap-1 rounded-full px-3 py-1 ${selectedMerchantId ? 'bg-red-50 border border-[#FF4757]' : 'bg-white border border-gray-200'}`}
              onClick={handleSelectMerchant}
            >
              <Store size={13} color={selectedMerchantId ? '#FF4757' : '#6b7280'} />
              <Text className={`block text-xs ${selectedMerchantId ? 'text-[#FF4757] font-medium' : 'text-gray-600'}`}>
                {selectedMerchantName}
              </Text>
              <ChevronDown size={13} color={selectedMerchantId ? '#FF4757' : '#6b7280'} />
            </View>
          )}
        </View>

        {/* 排序 chips */}
        <ScrollView scrollX className="flex flex-row" style={{ whiteSpace: 'nowrap' }}>
          <View className="flex flex-row gap-2">
            {SORT_OPTIONS.map((opt) => {
              const active = sortType === opt.key;
              return (
                <View
                  key={opt.key}
                  className={`flex flex-row items-center gap-1 rounded-full px-3 py-1 ${active ? 'bg-red-50 border border-[#FF4757]' : 'bg-white border border-gray-200'}`}
                  onClick={() => setSortType(opt.key)}
                >
                  {renderSortIcon(opt.key, active)}
                  <Text className={`block text-xs ${active ? 'text-[#FF4757] font-medium' : 'text-gray-500'}`}>
                    {opt.label}
                  </Text>
                </View>
              );
            })}
          </View>
        </ScrollView>
      </View>

      {/* 商品列表 */}
      <View className="px-4 pt-3 pb-24">
        {loading ? (
          <View className="flex items-center justify-center py-20">
            <Text className="block text-gray-400">加载中...</Text>
          </View>
        ) : sortedPackages.length === 0 ? (
          <View className="flex items-center justify-center py-20">
            <Text className="block text-gray-400">{searchText ? '没有匹配的套餐' : '暂无商品'}</Text>
          </View>
        ) : (
          sortedPackages.map((pkg) => {
            const expiry = getExpiryInfo(pkg);
            return (
              <Card key={pkg.id} className="mb-3 bg-white">
                <CardContent className="p-4">
                  {/* 状态行 */}
                  <View className="flex flex-row items-center gap-2 mb-3">
                    <View className={`w-2 h-2 rounded-full ${pkg.is_active ? 'bg-green-500' : 'bg-gray-400'}`} />
                    <Text className={`block text-sm font-medium ${pkg.is_active ? 'text-green-600' : 'text-gray-500'}`}>
                      {pkg.is_active ? '售卖中' : '已下架'}
                    </Text>
                    <Text className={`block text-xs ${expiry.urgent ? 'text-orange-500 font-medium' : 'text-gray-400'}`}>
                      | {expiry.text}
                    </Text>
                  </View>

                  {/* 商品信息行 */}
                  <View className="flex flex-row gap-3">
                    <View className="w-24 h-24 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100">
                      {pkg.cover_image ? (
                        <Image src={pkg.cover_image} className="w-full h-full" mode="aspectFill" />
                      ) : (
                        <View className="w-full h-full flex items-center justify-center bg-gray-100">
                          <Text className="block text-xs text-gray-400">暂无图片</Text>
                        </View>
                      )}
                    </View>

                    <View className="flex-1">
                      <Text className="block text-base font-bold text-gray-800 mb-1">{pkg.name}</Text>
                      {pkg.description && (
                        <Text className="block text-xs text-gray-500 mb-2 line-clamp-2">{pkg.description}</Text>
                      )}
                      <Text className="block text-xs text-gray-400 mb-2">
                        已售/剩余库存：{pkg.sales_count || 0}/{pkg.stock ?? '不限库存'}
                      </Text>
                      <Badge variant="outline" className="text-xs border-gray-300 text-gray-600">团购</Badge>
                    </View>
                  </View>

                  {/* 价格行 */}
                  <View className="flex flex-row items-baseline gap-2 mt-3 mb-3">
                    <Text className="block text-xl font-bold text-[#FF4757]">¥{pkg.price}</Text>
                    {pkg.original_price && (
                      <Text className="block text-sm text-gray-400 line-through">¥{pkg.original_price}</Text>
                    )}
                  </View>

                  {/* 操作按钮行 */}
                  <View className="flex flex-row items-center justify-between pt-3 border-t border-gray-100">
                    <View className="relative">
                      <Button variant="ghost" size="sm" onClick={() => setOpenMenuId(openMenuId === pkg.id ? null : pkg.id)}>
                        <Ellipsis size={16} color="#6b7280" />
                      </Button>
                      {openMenuId === pkg.id && (
                        <View className="absolute left-0 bottom-full mb-1 bg-white rounded-lg shadow-lg border border-gray-100 z-50 min-w-24">
                          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => { setOpenMenuId(null); handleToggleActive(pkg); }}>
                            <Text className="block text-sm text-gray-700">{pkg.is_active ? '下架' : '上架'}</Text>
                          </Button>
                          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => { setOpenMenuId(null); setDeleteTarget(pkg); }}>
                            <Text className="block text-sm text-[#FF4757]">删除</Text>
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
                        <Text className="block text-[#FF4757] text-xs">编辑</Text>
                      </Button>
                    </View>
                  </View>
                </CardContent>
              </Card>
            );
          })
        )}
      </View>

      {/* 底部操作栏 */}
      <View style={{ position: 'fixed', bottom: 0, left: 0, right: 0, display: 'flex', flexDirection: 'row', padding: '12px', backgroundColor: '#fff', borderTop: '1px solid #e5e7eb', zIndex: 100 }}>
        <View className="flex-1 bg-[#FF4757] rounded-xl py-3 flex items-center justify-center" onClick={() => Taro.navigateTo({ url: '/pages/package-admin/index' })}>
          <Text className="block text-white text-sm font-bold">创建商品</Text>
        </View>
      </View>

      {/* 删除确认弹窗 */}
      {deleteTarget && (
        <View style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <View className="bg-white rounded-2xl mx-6 w-full max-w-sm overflow-hidden">
            <View className="p-6 pb-4 flex flex-col items-center">
              <Text className="block text-base font-bold text-gray-800 text-center mb-2">确认删除</Text>
              <Text className="block text-sm text-gray-600 text-center">确定要删除「{deleteTarget.name}」吗？</Text>
            </View>
            <View className="flex flex-row border-t border-gray-100">
              <View className="flex-1 py-3 flex items-center justify-center" onClick={() => setDeleteTarget(null)}>
                <Text className="block text-sm text-gray-500">取消</Text>
              </View>
              <View className="w-px bg-gray-100" />
              <View className="flex-1 py-3 flex items-center justify-center" onClick={handleDelete}>
                <Text className="block text-sm text-[#FF4757] font-bold">确认删除</Text>
              </View>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}
