import { useState, useEffect } from 'react';
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Network } from '@/network';
import { Plus, Pencil, Trash2, X, Store } from 'lucide-react-taro';
import { DOUYIN_CATEGORIES } from '@/data/categories';

interface Merchant {
  id: number;
  name: string;
  logo?: string;
  address?: string;
  phone?: string;
  business_hours?: string;
  category?: string;
  description?: string;
}

export default function MerchantAdmin() {
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingMerchant, setEditingMerchant] = useState<Merchant | null>(null);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  // 表单数据
  const [formData, setFormData] = useState({
    name: '',
    logo: '',
    address: '',
    phone: '',
    business_hours: '',
    category: '',
    description: '',
  });

  useEffect(() => {
    loadMerchants();
  }, []);

  const loadMerchants = async () => {
    setLoading(true);
    try {
      const res = await Network.request({ url: '/api/merchants' });
      console.log('商家列表响应:', res.data);
      if (res.data?.code === 200) {
        setMerchants(res.data.data || []);
      }
    } catch (error) {
      console.error('加载商家失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingMerchant(null);
    setFormData({
      name: '',
      logo: '',
      address: '',
      phone: '',
      business_hours: '',
      category: '',
      description: '',
    });
    setShowForm(true);
  };

  const handleEdit = (merchant: Merchant) => {
    setEditingMerchant(merchant);
    setFormData({
      name: merchant.name,
      logo: merchant.logo || '',
      address: merchant.address || '',
      phone: merchant.phone || '',
      business_hours: merchant.business_hours || '',
      category: merchant.category || '',
      description: merchant.description || '',
    });
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    Taro.showModal({
      title: '确认删除',
      content: '确定要删除这个商家吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            await Network.request({
              url: `/api/merchants/${id}`,
              method: 'DELETE',
            });
            Taro.showToast({ title: '删除成功', icon: 'success' });
            loadMerchants();
          } catch (error) {
            console.error('删除失败:', error);
            Taro.showToast({ title: '删除失败', icon: 'error' });
          }
        }
      },
    });
  };

  const handleSubmit = async () => {
    if (!formData.name) {
      Taro.showToast({ title: '请输入商家名称', icon: 'none' });
      return;
    }

    try {
      if (editingMerchant) {
        await Network.request({
          url: `/api/merchants/${editingMerchant.id}`,
          method: 'PUT',
          data: formData,
        });
        Taro.showToast({ title: '更新成功', icon: 'success' });
      } else {
        await Network.request({
          url: '/api/merchants',
          method: 'POST',
          data: formData,
        });
        Taro.showToast({ title: '添加成功', icon: 'success' });
      }
      setShowForm(false);
      loadMerchants();
    } catch (error) {
      console.error('保存失败:', error);
      Taro.showToast({ title: '保存失败', icon: 'error' });
    }
  };

  return (
    <View className="min-h-screen bg-gray-50">
      {/* 顶部导航栏 */}
      <View className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <View className="flex items-center" onClick={() => Taro.navigateBack()}>
          <Text className="text-blue-500 text-sm">返回</Text>
        </View>
        <Text className="text-base font-semibold text-gray-800">商家收录</Text>
        <View className="w-12" />
      </View>

      {/* 添加按钮 */}
      <View className="p-4">
        <Button
          className="w-full flex items-center justify-center gap-2"
          style={{ backgroundColor: '#f97316' }}
          onClick={handleAdd}
        >
          <Plus size={18} color="#fff" />
          <Text className="text-white text-sm">添加商家</Text>
        </Button>
      </View>

      {/* 商家列表 */}
      <View className="px-4 pb-4">
        {loading ? (
          <View className="text-center py-8">
            <Text className="text-gray-500">加载中...</Text>
          </View>
        ) : merchants.length === 0 ? (
          <View className="text-center py-12">
            <Store size={48} color="#ccc" />
            <Text className="block text-gray-500 mt-4">暂无商家</Text>
            <Text className="block text-gray-400 text-sm mt-2">点击上方按钮添加商家</Text>
          </View>
        ) : (
          <View className="space-y-3">
            {merchants.map((merchant) => (
              <Card key={merchant.id} className="bg-white border border-gray-200">
                <CardContent className="p-4">
                  <View className="flex items-start justify-between">
                    <View className="flex-1">
                      <Text className="block text-base font-semibold text-gray-800">
                        {merchant.name}
                      </Text>
                      {merchant.category && (
                        <Text
                          className="block text-xs text-orange-500 mt-1"
                          onClick={() => handleEdit(merchant)}
                        >
                          {merchant.category}
                        </Text>
                      )}
                      {merchant.address && (
                        <Text className="block text-xs text-gray-500 mt-1">
                          {merchant.address}
                        </Text>
                      )}
                      {merchant.phone && (
                        <Text className="block text-xs text-gray-500 mt-1">
                          {merchant.phone}
                        </Text>
                      )}
                    </View>
                    <View className="flex items-center gap-2 ml-4">
                      <View
                        className="p-2 rounded-lg bg-blue-50"
                        onClick={() => handleEdit(merchant)}
                      >
                        <Pencil size={16} color="#3b82f6" />
                      </View>
                      <View
                        className="p-2 rounded-lg bg-red-50"
                        onClick={() => handleDelete(merchant.id)}
                      >
                        <Trash2 size={16} color="#ef4444" />
                      </View>
                    </View>
                  </View>
                </CardContent>
              </Card>
            ))}
          </View>
        )}
      </View>

      {/* 添加/编辑表单弹窗 */}
      {showForm && (
        <View
          className="fixed inset-0 bg-black"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 100 }}
          onClick={() => setShowForm(false)}
        >
          <View
            className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl"
            style={{ maxHeight: '80vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 弹窗头部 */}
            <View className="flex items-center justify-between p-4 border-b border-gray-200">
              <Text className="block text-base font-semibold text-gray-800">
                {editingMerchant ? '编辑商家' : '添加商家'}
              </Text>
              <View onClick={() => setShowForm(false)}>
                <X size={20} color="#666" />
              </View>
            </View>

            {/* 表单内容 */}
            <View className="p-4 overflow-y-auto" style={{ maxHeight: '60vh' }}>
              {/* 商家名称 */}
              <View className="mb-4">
                <Text className="block text-sm font-medium text-gray-800 mb-2">
                  商家名称 <Text className="text-red-500">*</Text>
                </Text>
                <Input
                  className="w-full"
                  placeholder="请输入商家名称"
                  value={formData.name}
                  onInput={(e) => setFormData({ ...formData, name: e.detail.value })}
                />
              </View>

              {/* 商家分类 */}
              <View className="mb-4">
                <Text className="block text-sm font-medium text-gray-800 mb-2">商家分类</Text>
                <View
                  className="w-full bg-white border border-gray-200 rounded-lg px-4 py-3"
                  onClick={() => setShowCategoryPicker(true)}
                >
                  <Text className="block text-sm text-gray-500">
                    {formData.category || '请选择商家分类'}
                  </Text>
                </View>
              </View>

              {/* 商家地址 */}
              <View className="mb-4">
                <Text className="block text-sm font-medium text-gray-800 mb-2">商家地址</Text>
                <Input
                  className="w-full"
                  placeholder="请输入商家地址"
                  value={formData.address}
                  onInput={(e) => setFormData({ ...formData, address: e.detail.value })}
                />
              </View>

              {/* 联系电话 */}
              <View className="mb-4">
                <Text className="block text-sm font-medium text-gray-800 mb-2">联系电话</Text>
                <Input
                  className="w-full"
                  placeholder="请输入联系电话"
                  value={formData.phone}
                  onInput={(e) => setFormData({ ...formData, phone: e.detail.value })}
                />
              </View>

              {/* 营业时间 */}
              <View className="mb-4">
                <Text className="block text-sm font-medium text-gray-800 mb-2">营业时间</Text>
                <Input
                  className="w-full"
                  placeholder="如：09:00-22:00"
                  value={formData.business_hours}
                  onInput={(e) => setFormData({ ...formData, business_hours: e.detail.value })}
                />
              </View>

              {/* 商家简介 */}
              <View className="mb-4">
                <Text className="block text-sm font-medium text-gray-800 mb-2">商家简介</Text>
                <Textarea
                  className="w-full"
                  placeholder="请输入商家简介"
                  value={formData.description}
                  onInput={(e) => setFormData({ ...formData, description: e.detail.value })}
                  maxlength={200}
                />
              </View>
            </View>

            {/* 底部按钮 */}
            <View className="p-4 border-t border-gray-200 flex gap-3">
              <Button
                className="flex-1"
                variant="outline"
                onClick={() => setShowForm(false)}
              >
                取消
              </Button>
              <Button
                className="flex-1"
                style={{ backgroundColor: '#f97316' }}
                onClick={handleSubmit}
              >
                <Text className="text-white">保存</Text>
              </Button>
            </View>
          </View>
        </View>
      )}

      {/* 分类选择弹窗 */}
      {showCategoryPicker && (
        <View
          className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
        >
          <View className="w-full bg-white rounded-t-3xl max-h-[80vh] flex flex-col">
            {/* 弹窗头部 */}
            <View className="flex items-center justify-between p-4 border-b border-gray-200">
              <Text className="block text-lg font-semibold text-gray-900">选择商家分类</Text>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowCategoryPicker(false)}
              >
                <X size={20} color="#666" />
              </Button>
            </View>

            {/* 分类列表 */}
            <View className="flex-1 overflow-y-auto p-4">
              {DOUYIN_CATEGORIES.map((cat) => (
                <View
                  key={cat.name}
                  className="py-3 px-4 border-b border-gray-100 flex items-center justify-between"
                  onClick={() => {
                    setFormData({ ...formData, category: cat.name });
                    setShowCategoryPicker(false);
                  }}
                >
                  <Text className="block text-base text-gray-900">{cat.name}</Text>
                  {formData.category === cat.name && (
                    <Text className="block text-sm text-orange-500">已选择</Text>
                  )}
                </View>
              ))}
            </View>
          </View>
        </View>
      )}
    </View>
  );
}
