import { View, Text, Image } from '@tarojs/components';
import { useState, useEffect } from 'react';
import Taro from '@tarojs/taro';
import { Network } from '@/network';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Pencil, Trash2, Gift, ShoppingBag, Store } from 'lucide-react-taro';

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
  cover_image: string | null;
  stock: number | null;
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
                            已售/剩余库存：0/{pkg.stock || '不限库存'}
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
                        <Text className="block text-sm text-gray-500">更多</Text>
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
    </View>
  );
};

export default AdminPage;