import { View, Text, ScrollView } from '@tarojs/components';
import { useState, useEffect } from 'react';
import Taro from '@tarojs/taro';
import { Network } from '@/network';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
  created_at: string;
  updated_at: string | null;
}

const AdminPage = () => {
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingPrize, setEditingPrize] = useState<Prize | null>(null);
  const [form, setForm] = useState({ name: '', description: '', probability: '0', stock: '0' });

  const fetchPrizes = async () => {
    setLoading(true);
    try {
      const res = await Network.request({ url: '/api/prizes' });
      console.log('prizes response:', res.data);
      setPrizes((res.data as any)?.data || (res.data as Prize[]) || []);
    } catch (err) {
      console.error('获取奖品失败:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrizes();
  }, []);

  const openCreate = () => {
    setEditingPrize(null);
    setForm({ name: '', description: '', probability: '10', stock: '100' });
    setShowDialog(true);
  };

  const openEdit = (prize: Prize) => {
    setEditingPrize(prize);
    setForm({
      name: prize.name,
      description: prize.description || '',
      probability: prize.probability,
      stock: String(prize.stock),
    });
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!form.name) {
      Taro.showToast({ title: '请输入奖品名称', icon: 'none' });
      return;
    }

    try {
      if (editingPrize) {
        const res = await Network.request({
          url: `/api/prizes/${editingPrize.id}`,
          method: 'PUT',
          data: {
            name: form.name,
            description: form.description,
            probability: form.probability,
            stock: Number(form.stock),
          },
        });
        console.log('update response:', res.data);
      } else {
        const res = await Network.request({
          url: '/api/prizes',
          method: 'POST',
          data: {
            name: form.name,
            description: form.description,
            probability: form.probability,
            stock: Number(form.stock),
          },
        });
        console.log('create response:', res.data);
      }
      setShowDialog(false);
      Taro.showToast({ title: editingPrize ? '更新成功' : '创建成功', icon: 'success' });
      fetchPrizes();
    } catch (err) {
      console.error('保存失败:', err);
      Taro.showToast({ title: '保存失败', icon: 'none' });
    }
  };

  const handleDelete = async (id: string) => {
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

  const handleToggleActive = async (prize: Prize) => {
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

  return (
    <View className="min-h-screen bg-gray-50">
      {/* 顶部操作栏 */}
      <View className="sticky top-0 bg-white z-10 px-4 py-3 border-b border-gray-100">
        <View className="flex flex-row items-center justify-between">
          <Text className="block text-lg font-bold text-gray-800">膨胀团 · 奖品配置</Text>
          <Button size="sm" onClick={openCreate}>
            <Plus size={16} color="#fff" className="mr-1" />
            <Text className="block text-white text-sm">添加奖品</Text>
          </Button>
        </View>
      </View>

      {/* 奖品列表 */}
      <ScrollView className="flex-1 px-4 pt-4 pb-8" scrollY>
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
                    <Button variant="ghost" size="sm" onClick={() => openEdit(prize)}>
                      <Pencil size={16} color="#6b7280" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleToggleActive(prize)}>
                      <Badge variant={prize.is_active ? 'secondary' : 'default'}>
                        {prize.is_active ? '停用' : '启用'}
                      </Badge>
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(prize.id)}>
                      <Trash2 size={16} color="#ef4444" />
                    </Button>
                  </View>
                </View>
              </CardContent>
            </Card>
          ))
        )}
      </ScrollView>

      {/* 编辑弹窗 */}
      {showDialog && (
        <View className="fixed inset-0 bg-black opacity-50 z-50 flex items-center justify-center px-4">
          <View className="bg-white rounded-2xl w-full max-w-sm p-6">
            <Text className="block text-lg font-bold text-gray-800 mb-4">
              {editingPrize ? '编辑奖品' : '添加奖品'}
            </Text>

            <View className="space-y-4">
              <View>
                <Text className="block text-sm text-gray-600 mb-1">奖品名称</Text>
                <View className="bg-gray-50 rounded-xl px-3 py-2">
                  <Input
                    className="w-full bg-transparent"
                    value={form.name}
                    placeholder="请输入奖品名称"
                    onInput={(e) => setForm({ ...form, name: e.detail.value })}
                  />
                </View>
              </View>

              <View>
                <Text className="block text-sm text-gray-600 mb-1">奖品描述</Text>
                <View className="bg-gray-50 rounded-2xl p-3">
                  <Textarea
                    style={{ width: '100%', minHeight: '60px', backgroundColor: 'transparent' }}
                    value={form.description}
                    placeholder="请输入奖品描述"
                    onInput={(e) => setForm({ ...form, description: e.detail.value })}
                  />
                </View>
              </View>

              <View className="flex flex-row gap-3">
                <View className="flex-1">
                  <Text className="block text-sm text-gray-600 mb-1">概率 (%)</Text>
                  <View className="bg-gray-50 rounded-xl px-3 py-2">
                    <Input
                      className="w-full bg-transparent"
                      value={form.probability}
                      placeholder="0-100"
                      onInput={(e) => setForm({ ...form, probability: e.detail.value })}
                    />
                  </View>
                </View>
                <View className="flex-1">
                  <Text className="block text-sm text-gray-600 mb-1">库存</Text>
                  <View className="bg-gray-50 rounded-xl px-3 py-2">
                    <Input
                      className="w-full bg-transparent"
                      value={form.stock}
                      placeholder="0"
                      onInput={(e) => setForm({ ...form, stock: e.detail.value })}
                    />
                  </View>
                </View>
              </View>
            </View>

            <View className="flex flex-row gap-3 mt-6">
              <View className="flex-1">
                <Button variant="outline" className="w-full" onClick={() => setShowDialog(false)}>
                  <Text className="block text-sm">取消</Text>
                </Button>
              </View>
              <View className="flex-1">
                <Button className="w-full bg-red-500" onClick={handleSave}>
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