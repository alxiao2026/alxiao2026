import { View, Text, Image, ScrollView } from '@tarojs/components';
import { useState, useEffect } from 'react';
import Taro from '@tarojs/taro';
import { Network } from '@/network';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Search, ListFilter, ChevronDown, Ellipsis, Store } from 'lucide-react-taro';

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

export default function ProductManagePage() {
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeStatus, setActiveStatus] = useState('all');
  const [searchText] = useState('');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Package | null>(null);
  const [merchantId, setMerchantId] = useState<string | null>(null);
  const [merchantLoaded, setMerchantLoaded] = useState(false);

  useEffect(() => {
    loadMerchantInfo();
  }, []);

  useEffect(() => {
    if (merchantLoaded) {
      fetchPackages();
    }
  }, [merchantLoaded, merchantId]);

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

  const fetchPackages = async () => {
    setLoading(true);
    try {
      // 商家账号只加载本店套餐，超级管理员加载全部
      const url = merchantId ? `/api/packages?merchant_id=${merchantId}` : '/api/packages';
      const res = await Network.request({ url });
      const data = (res.data as any)?.data || res.data;
      setPackages(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('获取套餐失败:', err);
    } finally {
      setLoading(false);
    }
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
    if (searchText && !pkg.name.toLowerCase().includes(searchText.toLowerCase())) return false;
    return true;
  });

  const activeCount = packages.filter(p => p.is_active).length;
  const inactiveCount = packages.filter(p => !p.is_active).length;

  return (
    <View className="min-h-screen bg-gray-50">
      {/* 标题与筛选区 */}
      <View className="bg-white px-4 pt-4 pb-3">
        <View className="flex flex-row items-center justify-between mb-3">
          <Text className="block text-lg font-bold text-gray-800">团购商品</Text>
          <Text className="block text-sm text-gray-500">更多</Text>
        </View>

        {/* 分类标签 */}
        <View className="flex flex-row items-center gap-3 mb-3">
          <View className="bg-[#FF4757] rounded-full px-4 py-1">
            <Text className="block text-white text-sm font-medium">团购</Text>
          </View>
          <View className="bg-gray-100 rounded-full px-4 py-1">
            <Text className="block text-gray-600 text-sm">品牌</Text>
          </View>
          <View className="flex-1" />
          <View className="flex flex-row items-center gap-1 bg-gray-100 rounded-full px-3 py-1">
            <Store size={14} color="#6b7280" />
            <Text className="block text-sm text-gray-600">全部门店</Text>
            <ChevronDown size={14} color="#6b7280" />
          </View>
        </View>

        {/* 状态筛选标签 */}
        <ScrollView scrollX className="flex flex-row gap-2 mb-3" style={{ whiteSpace: 'nowrap' }}>
          {[
            { key: 'all', label: `全部 ${packages.length}` },
            { key: 'active', label: `已上架 ${activeCount}` },
            { key: 'inactive', label: `已下架 ${inactiveCount}` },
          ].map((tab) => (
            <View
              key={tab.key}
              className={`rounded-lg px-3 py-1 ${activeStatus === tab.key ? 'bg-red-50 border border-red-200' : 'bg-gray-50 border border-gray-200'}`}
              onClick={() => setActiveStatus(tab.key)}
            >
              <Text className={`block text-sm ${activeStatus === tab.key ? 'text-[#FF4757] font-medium' : 'text-gray-600'}`}>
                {tab.label}
              </Text>
            </View>
          ))}
        </ScrollView>

        {/* 搜索和筛选 */}
        <View className="flex flex-row items-center gap-2">
          <Text className="block text-sm text-gray-500">最新修改在上</Text>
          <ChevronDown size={14} color="#9ca3af" />
          <View className="flex-1" />
          <View className="flex flex-row items-center gap-1 bg-gray-100 rounded-lg px-3 py-1" onClick={() => {}}>
            <Search size={14} color="#6b7280" />
            <Text className="block text-sm text-gray-600">搜索</Text>
          </View>
          <View className="flex flex-row items-center gap-1 bg-gray-100 rounded-lg px-3 py-1">
            <ListFilter size={14} color="#6b7280" />
            <Text className="block text-sm text-[#FF4757]">筛选</Text>
          </View>
        </View>
      </View>

      {/* 商品列表 */}
      <View className="px-4 pt-3 pb-24">
        {loading ? (
          <View className="flex items-center justify-center py-20">
            <Text className="block text-gray-400">加载中...</Text>
          </View>
        ) : filteredPackages.length === 0 ? (
          <View className="flex items-center justify-center py-20">
            <Text className="block text-gray-400">暂无商品</Text>
          </View>
        ) : (
          filteredPackages.map((pkg) => (
            <Card key={pkg.id} className="mb-3 bg-white">
              <CardContent className="p-4">
                {/* 状态行 */}
                <View className="flex flex-row items-center gap-2 mb-3">
                  <View className={`w-2 h-2 rounded-full ${pkg.is_active ? 'bg-green-500' : 'bg-gray-400'}`} />
                  <Text className={`block text-sm font-medium ${pkg.is_active ? 'text-green-600' : 'text-gray-500'}`}>
                    {pkg.is_active ? '售卖中' : '已下架'}
                  </Text>
                  <Text className="block text-sm text-gray-400">| 长期售卖</Text>
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
                      已售/剩余库存：{pkg.sales_count || 0}/{pkg.stock || '不限库存'}
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
          ))
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
