import { useState, useEffect } from 'react';
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Network } from '@/network';
import { Plus, Pencil, Trash2, X, Store, ChevronLeft, ChevronRight } from 'lucide-react-taro';
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
  latitude?: string;
  longitude?: string;
}

export default function MerchantAdmin() {
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingMerchant, setEditingMerchant] = useState<Merchant | null>(null);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [timePickerType, setTimePickerType] = useState<'open' | 'close'>('open');
  const [tempOpenTime, setTempOpenTime] = useState('09:00');
  const [tempCloseTime, setTempCloseTime] = useState('22:00');

  // 表单数据
  const [formData, setFormData] = useState({
    name: '',
    logo: '',
    address: '',
    phone: '',
    business_hours: '',
    category: '',
    description: '',
    latitude: '',
    longitude: '',
    admin_phone: '',
    admin_password: '',
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
      latitude: '',
      longitude: '',
      admin_phone: '',
      admin_password: '',
    });
    setShowForm(true);
  };

  const handleEdit = async (merchant: Merchant) => {
    setEditingMerchant(merchant);
    setFormData({
      name: merchant.name,
      logo: merchant.logo || '',
      address: merchant.address || '',
      phone: merchant.phone || '',
      business_hours: merchant.business_hours || '',
      category: merchant.category || '',
      description: merchant.description || '',
      latitude: merchant.latitude || '',
      longitude: merchant.longitude || '',
      admin_phone: '',
      admin_password: '',
    });

    // 加载该商家的管理员账号并回显
    try {
      const res = await Network.request({
        url: `/api/merchants/${merchant.id}/admin`,
        method: 'GET',
      });
      console.log('管理员账号响应:', JSON.stringify(res));
      const adminData = res?.data?.data || res?.data;
      if (adminData?.phone) {
        setFormData((prev) => ({
          ...prev,
          admin_phone: adminData.phone || '',
          admin_password: adminData.password || '',
        }));
      }
    } catch (error) {
      console.log('获取管理员账号失败:', error);
    }
    // 解析营业时间
    if (merchant.business_hours) {
      const match = merchant.business_hours.match(/(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})/);
      if (match) {
        setTempOpenTime(match[1]);
        setTempCloseTime(match[2]);
      }
    }
    setShowForm(true);
  };

  const handlePhoneInput = (value: string) => {
    // 只允许数字，最多11位
    const cleaned = value.replace(/\D/g, '').slice(0, 11);
    setFormData({ ...formData, phone: cleaned });
  };

  const handleChooseLocation = async () => {
    const env = Taro.getEnv();
    const isMiniApp = env === Taro.ENV_TYPE.WEAPP || env === Taro.ENV_TYPE.TT;
    
    if (!isMiniApp) {
      Taro.showToast({ title: '定位功能仅在小程序中可用', icon: 'none' });
      return;
    }

    try {
      const res = await Taro.chooseLocation({});
      if (res.name || res.address) {
        const address = res.name ? `${res.name} - ${res.address}` : res.address;
        setFormData({
          ...formData,
          address: address,
          latitude: res.latitude?.toString() || '',
          longitude: res.longitude?.toString() || '',
        });
      }
    } catch (error) {
      console.log('选择位置取消或失败', error);
    }
  };

  const openTimePicker = (type: 'open' | 'close') => {
    setTimePickerType(type);
    setShowTimePicker(true);
  };

  const generateTimeOptions = () => {
    const options: string[] = [];
    for (let h = 0; h < 24; h++) {
      for (let m = 0; m < 60; m += 30) {
        options.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
      }
    }
    return options;
  };

  const handleTimeConfirm = () => {
    const businessHours = `${tempOpenTime} - ${tempCloseTime}`;
    setFormData({ ...formData, business_hours: businessHours });
    setShowTimePicker(false);
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

    // 验证手机号
    if (formData.phone && !/^1\d{10}$/.test(formData.phone)) {
      Taro.showToast({ title: '请输入正确的11位手机号', icon: 'none' });
      return;
    }

    // 验证管理员账号（新增必填；编辑时回显后同样校验）
    if (!formData.admin_phone) {
      Taro.showToast({ title: '请输入管理员手机号', icon: 'none' });
      return;
    }
    if (!/^1\d{10}$/.test(formData.admin_phone)) {
      Taro.showToast({ title: '请输入正确的11位管理员手机号', icon: 'none' });
      return;
    }
    if (!formData.admin_password) {
      Taro.showToast({ title: '请输入管理员登录密码', icon: 'none' });
      return;
    }
    if (formData.admin_password.length < 6) {
      Taro.showToast({ title: '密码长度至少6位', icon: 'none' });
      return;
    }

    try {
      let res;
      if (editingMerchant) {
        res = await Network.request({
          url: `/api/merchants/${editingMerchant.id}`,
          method: 'PUT',
          data: formData,
        });
      } else {
        res = await Network.request({
          url: '/api/merchants',
          method: 'POST',
          data: formData,
        });
      }

      console.log('保存商家响应:', res.statusCode, res.data);

      // Taro.request 在 HTTP 400/500 时不会抛异常，必须检查状态码
      if (res.statusCode < 200 || res.statusCode >= 300) {
        const errMsg = (res.data as any)?.message || '保存失败，请重试';
        Taro.showModal({
          title: '保存失败',
          content: Array.isArray(errMsg) ? errMsg.join('；') : String(errMsg),
          showCancel: false,
        });
        return;
      }

      Taro.showToast({ title: editingMerchant ? '更新成功' : '添加成功', icon: 'success' });
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
                <Button
                  variant="outline"
                  className="w-full justify-start h-auto py-3 px-4"
                  onClick={() => setShowCategoryPicker(true)}
                >
                  <Text className="block text-sm text-gray-500">
                    {formData.category || '请选择商家分类'}
                  </Text>
                </Button>
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

              {/* 商家定位 */}
              <View className="mb-4">
                <Text className="block text-sm font-medium text-gray-800 mb-2">商家定位</Text>
                <Button
                  variant="outline"
                  className="w-full justify-start h-auto py-3 px-4"
                  onClick={handleChooseLocation}
                >
                  <Text className="block text-sm text-gray-500">
                    {formData.address ? formData.address : '点击选择商家位置'}
                  </Text>
                </Button>
              </View>

              {/* 联系电话 */}
              <View className="mb-4">
                <Text className="block text-sm font-medium text-gray-800 mb-2">联系电话</Text>
                <Input
                  className="w-full"
                  placeholder="请输入11位手机号"
                  value={formData.phone}
                  onInput={(e) => handlePhoneInput(e.detail.value)}
                  maxlength={11}
                  type="number"
                />
                {formData.phone && formData.phone.length === 11 && (
                  <Text className="block text-xs text-green-600 mt-1">✓ 手机号格式正确</Text>
                )}
                {formData.phone && formData.phone.length > 0 && formData.phone.length < 11 && (
                  <Text className="block text-xs text-red-500 mt-1">请输入11位手机号</Text>
                )}
              </View>

              {/* 管理员手机号 */}
              <View className="mb-4">
                <Text className="block text-sm font-medium text-gray-800 mb-2">管理员手机号</Text>
                <Input
                  className="w-full"
                  placeholder="请输入管理员11位手机号"
                  value={formData.admin_phone}
                  onInput={(e) => setFormData({ ...formData, admin_phone: e.detail.value })}
                  maxlength={11}
                  type="number"
                />
                {formData.admin_phone && formData.admin_phone.length === 11 && (
                  <Text className="block text-xs text-green-600 mt-1">✓ 手机号格式正确</Text>
                )}
                {formData.admin_phone && formData.admin_phone.length > 0 && formData.admin_phone.length < 11 && (
                  <Text className="block text-xs text-red-500 mt-1">请输入11位手机号</Text>
                )}
              </View>

              {/* 管理员密码 */}
              <View className="mb-4">
                <Text className="block text-sm font-medium text-gray-800 mb-2">管理员登录密码</Text>
                <Input
                  className="w-full"
                  placeholder="请输入管理员登录密码（至少6位）"
                  value={formData.admin_password}
                  onInput={(e) => setFormData({ ...formData, admin_password: e.detail.value })}
                />
                {formData.admin_password && formData.admin_password.length >= 6 && (
                  <Text className="block text-xs text-green-600 mt-1">✓ 密码格式正确</Text>
                )}
                {formData.admin_password && formData.admin_password.length > 0 && formData.admin_password.length < 6 && (
                  <Text className="block text-xs text-red-500 mt-1">密码长度至少6位</Text>
                )}
              </View>

              {/* 营业时间 */}
              <View className="mb-4">
                <Text className="block text-sm font-medium text-gray-800 mb-2">营业时间</Text>
                <View className="flex gap-4">
                  <Button
                    className="flex-1 bg-gray-50 rounded-lg px-4 py-3 text-left"
                    onClick={() => openTimePicker('open')}
                  >
                    <Text className="block text-sm text-gray-600">开业时间</Text>
                    <Text className="block text-base text-gray-900 mt-1">{tempOpenTime}</Text>
                  </Button>
                  <Text className="block text-gray-400 self-center">至</Text>
                  <Button
                    className="flex-1 bg-gray-50 rounded-lg px-4 py-3 text-left"
                    onClick={() => openTimePicker('close')}
                  >
                    <Text className="block text-sm text-gray-600">关门时间</Text>
                    <Text className="block text-base text-gray-900 mt-1">{tempCloseTime}</Text>
                  </Button>
                </View>
                {formData.business_hours && (
                  <Text className="block text-xs text-gray-500 mt-2">
                    营业时间：{formData.business_hours}
                  </Text>
                )}
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
          className="fixed inset-0 flex items-end justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 110 }}
        >
          <View className="w-full bg-white rounded-t-3xl max-h-[80vh] flex flex-col">
            {/* 弹窗头部 */}
            <View className="flex items-center justify-between p-4 border-b border-gray-200">
              <View className="flex items-center gap-2">
                {selectedCategory && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSelectedCategory(null)}
                  >
                    <ChevronLeft size={20} color="#666" />
                  </Button>
                )}
                <Text className="block text-lg font-semibold text-gray-900">
                  {selectedCategory ? selectedCategory : '选择商家分类'}
                </Text>
              </View>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setShowCategoryPicker(false);
                  setSelectedCategory(null);
                }}
              >
                <X size={20} color="#666" />
              </Button>
            </View>

            {/* 分类列表 */}
            <View className="flex-1 overflow-y-auto">
              {!selectedCategory ? (
                // 一级分类列表
                <View>
                  {DOUYIN_CATEGORIES.map((cat) => (
                    <View
                      key={cat.name}
                      className="py-4 px-4 border-b border-gray-100 flex items-center justify-between"
                      onClick={() => setSelectedCategory(cat.name)}
                    >
                      <Text className="block text-base text-gray-900">{cat.name}</Text>
                      <ChevronRight size={18} color="#999" />
                    </View>
                  ))}
                </View>
              ) : (
                // 二级分类列表
                <View>
                  {DOUYIN_CATEGORIES.find((c) => c.name === selectedCategory)?.children?.map(
                    (sub) => (
                      <View
                        key={sub.name}
                        className="py-4 px-4 border-b border-gray-100 flex items-center justify-between"
                        onClick={() => {
                          setFormData({ ...formData, category: `${selectedCategory} · ${sub.name}` });
                          setShowCategoryPicker(false);
                          setSelectedCategory(null);
                        }}
                      >
                        <Text className="block text-base text-gray-900">{sub.name}</Text>
                        {formData.category === `${selectedCategory} · ${sub.name}` && (
                          <Text className="block text-sm text-orange-500">已选择</Text>
                        )}
                      </View>
                    )
                  )}
                </View>
              )}
            </View>
          </View>
        </View>
      )}

      {/* 时间选择器弹窗 */}
      {showTimePicker && (
        <View
          className="fixed inset-0 flex items-end justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 120 }}
        >
          <View className="w-full bg-white rounded-t-3xl max-h-[60vh] flex flex-col">
            {/* 弹窗头部 */}
            <View className="flex items-center justify-between p-4 border-b border-gray-200">
              <Text className="block text-lg font-semibold text-gray-900">
                选择{timePickerType === 'open' ? '开业' : '关门'}时间
              </Text>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowTimePicker(false)}
              >
                <X size={20} color="#666" />
              </Button>
            </View>

            {/* 时间滚轮 */}
            <View className="flex-1 overflow-y-auto py-4">
              {generateTimeOptions().map((time) => (
                <View
                  key={time}
                  className={`py-4 px-4 flex items-center justify-center ${
                    (timePickerType === 'open' ? tempOpenTime : tempCloseTime) === time
                      ? 'bg-orange-50'
                      : ''
                  }`}
                  onClick={() => {
                    if (timePickerType === 'open') {
                      setTempOpenTime(time);
                    } else {
                      setTempCloseTime(time);
                    }
                  }}
                >
                  <Text
                    className={`block text-lg ${
                      (timePickerType === 'open' ? tempOpenTime : tempCloseTime) === time
                        ? 'text-orange-600 font-semibold'
                        : 'text-gray-900'
                    }`}
                  >
                    {time}
                  </Text>
                </View>
              ))}
            </View>

            {/* 底部按钮 */}
            <View className="p-4 border-t border-gray-200">
              <Button className="w-full bg-orange-500 text-white" onClick={handleTimeConfirm}>
                确认
              </Button>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}
