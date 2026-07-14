import { View, Text } from '@tarojs/components';
import { useState, useEffect } from 'react';
import Taro from '@tarojs/taro';
import { Network } from '@/network';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Pencil, Trash2, Gift, ShoppingBag } from 'lucide-react-taro';

interface Prize {
  id: string;
  name: string;
  description: string | null;
  probability: string;
  image_url: string | null;
  stock: number;
  is_active: boolean;
  created_at: string;
  updated_at: string | null;
}

interface Package {
  id: string;
  name: string;
  description: string | null;
  price: string;
  original_price: string | null;
  badge: string | null;
  features: string | null;
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
  const [prizeForm, setPrizeForm] = useState({ name: '', description: '', probability: '0', stock: '0' });
  const [editingPackage, setEditingPackage] = useState<Package | null>(null);
  const [pkgForm, setPkgForm] = useState({ name: '', description: '', price: '9.90', original_price: '', badge: '', features: '' });

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
    await Promise.all([fetchPrizes(), fetchPackages()]);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  // ========== 奖品管理 ==========
  const openCreatePrize = () => {
    setEditingPrize(null);
    setPrizeForm({ name: '', description: '', probability: '10', stock: '100' });
    setShowDialog(true);
  };

  const openEditPrize = (prize: Prize) => {
    setEditingPrize(prize);
    setPrizeForm({
      name: prize.name,
      description: prize.description || '',
      probability: prize.probability,
      stock: String(prize.stock),
    });
    setShowDialog(true);
  };

  const handleSavePrize = async () => {
    if (!prizeForm.name) {
      Taro.showToast({ title: '请输入奖品名称', icon: 'none' });
      return;
    }

    try {
      if (editingPrize) {
        await Network.request({
          url: `/api/prizes/${editingPrize.id}`,
          method: 'PUT',
          data: {
            name: prizeForm.name,
            description: prizeForm.description,
            probability: prizeForm.probability,
            stock: Number(prizeForm.stock),
          },
        });
      } else {
        await Network.request({
          url: '/api/prizes',
          method: 'POST',
          data: {
            name: prizeForm.name,
            description: prizeForm.description,
            probability: prizeForm.probability,
            stock: Number(prizeForm.stock),
          },
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
    Taro.showModal({
      title: '确认删除',
      content: '确定要删除该奖品吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            await Network.request({ url: `/api/prizes/${id}`, method: 'DELETE' });
            Taro.showToast({ title: '删除成功', icon: 'success' });
            fetchPrizes();
          } catch (err) {
            console.error('删除失败:', err);
            Taro.showToast({ title: '删除失败', icon: 'none' });
          }
        }
      },
    });
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

  // ========== 套餐管理 ==========
  const openCreatePackage = () => {
    setEditingPackage(null);
    setPkgForm({ name: '', description: '', price: '9.90', original_price: '', badge: '', features: '' });
    setShowDialog(true);
  };

  const openEditPackage = (pkg: Package) => {
    setEditingPackage(pkg);
    setPkgForm({
      name: pkg.name,
      description: pkg.description || '',
      price: pkg.price,
      original_price: pkg.original_price || '',
      badge: pkg.badge || '',
      features: pkg.features ? JSON.parse(pkg.features).join('\n') : '',
    });
    setShowDialog(true);
  };

  const handleSavePackage = async () => {
    if (!pkgForm.name) {
      Taro.showToast({ title: '请输入套餐名称', icon: 'none' });
      return;
    }

    const featuresList = pkgForm.features
      .split('\n')
      .map(f => f.trim())
      .filter(Boolean);

    try {
      if (editingPackage) {
        await Network.request({
          url: `/api/packages/${editingPackage.id}`,
          method: 'PUT',
          data: {
            name: pkgForm.name,
            description: pkgForm.description,
            price: pkgForm.price,
            original_price: pkgForm.original_price || undefined,
            badge: pkgForm.badge || undefined,
            features: featuresList.length > 0 ? JSON.stringify(featuresList) : undefined,
          },
        });
      } else {
        await Network.request({
          url: '/api/packages',
          method: 'POST',
          data: {
            name: pkgForm.name,
            description: pkgForm.description,
            price: pkgForm.price,
            original_price: pkgForm.original_price || undefined,
            badge: pkgForm.badge || undefined,
            features: featuresList.length > 0 ? JSON.stringify(featuresList) : undefined,
          },
        });
      }
      setShowDialog(false);
      Taro.showToast({ title: editingPackage ? '更新成功' : '创建成功', icon: 'success' });
      fetchPackages();
    } catch (err) {
      console.error('保存失败:', err);
      Taro.showToast({ title: '保存失败', icon: 'none' });
    }
  };

  const handleDeletePackage = async (id: string) => {
    Taro.showModal({
      title: '确认删除',
      content: '确定要删除该套餐吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            await Network.request({ url: `/api/packages/${id}`, method: 'DELETE' });
            Taro.showToast({ title: '删除成功', icon: 'success' });
            fetchPackages();
          } catch (err) {
            console.error('删除失败:', err);
            Taro.showToast({ title: '删除失败', icon: 'none' });
          }
        }
      },
    });
  };

  const handleTogglePackage = async (pkg: Package) => {
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

  const closeDialog = () => {
    setShowDialog(false);
    setEditingPrize(null);
    setEditingPackage(null);
  };

  return (
    <View className="min-h-screen bg-gray-50">
      {/* 顶部操作栏 */}
      <View className="sticky top-0 bg-white z-10 px-4 py-3 border-b border-gray-100">
        <View className="flex flex-row items-center justify-between">
          <Text className="block text-lg font-bold text-gray-800">膨胀团 · 管理后台</Text>
          <Button size="sm" onClick={activeTab === 'prizes' ? openCreatePrize : openCreatePackage}>
            <Plus size={16} color="#fff" className="mr-1" />
            <Text className="block text-white text-sm">
              {activeTab === 'prizes' ? '添加奖品' : '添加套餐'}
            </Text>
          </Button>
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
                        </View>
                        {prize.description && (
                          <Text className="block text-sm text-gray-500 mt-1">{prize.description}</Text>
                        )}
                        <View className="flex flex-row items-center gap-4 mt-2">
                          <Text className="block text-xs text-gray-400">
                            概率: <Text className="block text-red-500 font-semibold">{prize.probability}%</Text>
                          </Text>
                          <Text className="block text-xs text-gray-400">
                            库存: <Text className="block text-gray-600 font-semibold">{prize.stock}</Text>
                          </Text>
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
          </TabsContent>

          <TabsContent value="packages" className="mt-3">
            {loading ? (
              <View className="flex items-center justify-center py-20">
                <Text className="block text-gray-400">加载中...</Text>
              </View>
            ) : packages.length === 0 ? (
              <View className="flex items-center justify-center py-20">
                <ShoppingBag size={48} color="#d1d5db" />
                <Text className="block text-gray-400 mt-3">暂无套餐，点击上方按钮添加</Text>
              </View>
            ) : (
              packages.map((pkg) => (
                <Card key={pkg.id} className="mb-3">
                  <CardContent className="p-4">
                    <View className="flex flex-row items-start justify-between">
                      <View className="flex-1">
                        <View className="flex flex-row items-center gap-2">
                          <Text className="block text-base font-semibold text-gray-800">{pkg.name}</Text>
                          <Badge variant={pkg.is_active ? 'default' : 'secondary'}>
                            {pkg.is_active ? '启用' : '停用'}
                          </Badge>
                          {pkg.badge && (
                            <Badge className="bg-red-500 text-white">{pkg.badge}</Badge>
                          )}
                        </View>
                        {pkg.description && (
                          <Text className="block text-sm text-gray-500 mt-1">{pkg.description}</Text>
                        )}
                        <View className="flex flex-row items-center gap-4 mt-2">
                          <Text className="block text-xs text-gray-400">
                            价格: <Text className="block text-red-500 font-semibold">¥{pkg.price}</Text>
                          </Text>
                          {pkg.original_price && (
                            <Text className="block text-xs text-gray-400">
                              原价: <Text className="block text-gray-400 line-through">¥{pkg.original_price}</Text>
                            </Text>
                          )}
                        </View>
                      </View>
                      <View className="flex flex-row items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={() => openEditPackage(pkg)}>
                          <Pencil size={16} color="#6b7280" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleTogglePackage(pkg)}>
                          <Badge variant={pkg.is_active ? 'secondary' : 'default'}>
                            {pkg.is_active ? '停用' : '启用'}
                          </Badge>
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDeletePackage(pkg.id)}>
                          <Trash2 size={16} color="#ef4444" />
                        </Button>
                      </View>
                    </View>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </View>

      {/* 编辑弹窗 */}
      {showDialog && (
        <View className="fixed inset-0 bg-black opacity-50 z-50 flex items-center justify-center px-4">
          <View className="bg-white rounded-2xl w-full max-w-sm p-6">
            <Text className="block text-lg font-bold text-gray-800 mb-4">
              {activeTab === 'prizes'
                ? (editingPrize ? '编辑奖品' : '添加奖品')
                : (editingPackage ? '编辑套餐' : '添加套餐')}
            </Text>

            {activeTab === 'prizes' ? (
              /* 奖品表单 */
              <View className="space-y-4">
                <View>
                  <Text className="block text-sm text-gray-600 mb-1">奖品名称</Text>
                  <View className="bg-gray-50 rounded-xl px-3 py-2">
                    <Input
                      className="w-full bg-transparent"
                      value={prizeForm.name}
                      placeholder="请输入奖品名称"
                      onInput={(e) => setPrizeForm({ ...prizeForm, name: e.detail.value })}
                    />
                  </View>
                </View>

                <View>
                  <Text className="block text-sm text-gray-600 mb-1">奖品描述</Text>
                  <View className="bg-gray-50 rounded-2xl p-3">
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
                    <Text className="block text-sm text-gray-600 mb-1">概率 (%)</Text>
                    <View className="bg-gray-50 rounded-xl px-3 py-2">
                      <Input
                        className="w-full bg-transparent"
                        value={prizeForm.probability}
                        placeholder="0-100"
                        onInput={(e) => setPrizeForm({ ...prizeForm, probability: e.detail.value })}
                      />
                    </View>
                  </View>
                  <View className="flex-1">
                    <Text className="block text-sm text-gray-600 mb-1">库存</Text>
                    <View className="bg-gray-50 rounded-xl px-3 py-2">
                      <Input
                        className="w-full bg-transparent"
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
                  <Text className="block text-sm text-gray-600 mb-1">套餐名称</Text>
                  <View className="bg-gray-50 rounded-xl px-3 py-2">
                    <Input
                      className="w-full bg-transparent"
                      value={pkgForm.name}
                      placeholder="请输入套餐名称"
                      onInput={(e) => setPkgForm({ ...pkgForm, name: e.detail.value })}
                    />
                  </View>
                </View>

                <View>
                  <Text className="block text-sm text-gray-600 mb-1">套餐描述</Text>
                  <View className="bg-gray-50 rounded-2xl p-3">
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
                    <Text className="block text-sm text-gray-600 mb-1">价格 (¥)</Text>
                    <View className="bg-gray-50 rounded-xl px-3 py-2">
                      <Input
                        className="w-full bg-transparent"
                        value={pkgForm.price}
                        placeholder="9.90"
                        onInput={(e) => setPkgForm({ ...pkgForm, price: e.detail.value })}
                      />
                    </View>
                  </View>
                  <View className="flex-1">
                    <Text className="block text-sm text-gray-600 mb-1">原价 (¥)</Text>
                    <View className="bg-gray-50 rounded-xl px-3 py-2">
                      <Input
                        className="w-full bg-transparent"
                        value={pkgForm.original_price}
                        placeholder="可选"
                        onInput={(e) => setPkgForm({ ...pkgForm, original_price: e.detail.value })}
                      />
                    </View>
                  </View>
                </View>

                <View>
                  <Text className="block text-sm text-gray-600 mb-1">角标（如「限时特惠」）</Text>
                  <View className="bg-gray-50 rounded-xl px-3 py-2">
                    <Input
                      className="w-full bg-transparent"
                      value={pkgForm.badge}
                      placeholder="可选"
                      onInput={(e) => setPkgForm({ ...pkgForm, badge: e.detail.value })}
                    />
                  </View>
                </View>

                <View>
                  <Text className="block text-sm text-gray-600 mb-1">功能特点（每行一条）</Text>
                  <View className="bg-gray-50 rounded-2xl p-3">
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
                  onClick={activeTab === 'prizes' ? handleSavePrize : handleSavePackage}
                >
                  <Text className="block text-white text-sm">保存</Text>
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