import { useState, useEffect } from 'react';
import { View, Text, Image } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Network } from '@/network';
import { Plus, Pencil, Trash2, X, Store, ChevronLeft, ChevronRight, Image as ImageIcon, Percent, Coins, ShieldCheck } from 'lucide-react-taro';
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
  images?: string[];
  settlement_type?: number;
  commission_rate?: number;
  settlement_price?: number;
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
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  // 结算价模式下的套餐结算价列表（逐个套餐设置）
  const [packagePrices, setPackagePrices] = useState<Array<{ id: string; name: string; price: number; settlement_price: string }>>([]);
  const [loadingPackages, setLoadingPackages] = useState(false);
  const [saving, setSaving] = useState(false);

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
    images: [] as string[],
    admin_phone: '',
    admin_password: '',
    settlement_type: 0,
    commission_rate: '',
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
      images: [],
      admin_phone: '',
      admin_password: '',
      settlement_type: 0,
      commission_rate: '',
    });
    setPackagePrices([]);
    setShowForm(true);
  };

  /** 加载商家所有套餐及其结算价（结算价模式下逐个设置） */
  const loadPackagePrices = async (merchantId: number) => {
    setLoadingPackages(true);
    try {
      const res = await Network.request({ url: `/api/settlement/config/merchant/${merchantId}` });
      console.log('套餐结算配置响应:', res.data);
      const list = (res.data as any)?.data || [];
      setPackagePrices(
        list.map((p: any) => ({
          id: p.id,
          name: p.name,
          price: p.price,
          settlement_price: p.config?.settlement_price != null && Number(p.config.settlement_price) > 0 ? String(p.config.settlement_price) : '',
        }))
      );
    } catch (error) {
      console.error('加载套餐结算价失败:', error);
      setPackagePrices([]);
    } finally {
      setLoadingPackages(false);
    }
  };

  /** 切换结算方式（两种模式互斥，切换后另一种模式自动失效） */
  const handleSettlementTypeChange = (value: string) => {
    const type = parseInt(value);
    setFormData({ ...formData, settlement_type: type });
    if (type === 2 && editingMerchant?.id) {
      loadPackagePrices(editingMerchant.id);
    }
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
      images: merchant.images || [],
      admin_phone: '',
      admin_password: '',
      settlement_type: merchant.settlement_type || 0,
      commission_rate: merchant.settlement_type === 1 && merchant.commission_rate != null ? String(merchant.commission_rate) : '',
    });
    // 结算价模式：回显该商家所有套餐的结算价
    if (merchant.settlement_type === 2) {
      loadPackagePrices(merchant.id);
    } else {
      setPackagePrices([]);
    }

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

  // 上传首图（Logo）
  const handleUploadLogo = async () => {
    const env = Taro.getEnv();
    const isMiniApp = env === Taro.ENV_TYPE.WEAPP || env === Taro.ENV_TYPE.TT;
    
    if (uploadingLogo) return;
    
    try {
      setUploadingLogo(true);
      
      if (isMiniApp) {
        const res = await Taro.chooseMedia({
          count: 1,
          mediaType: ['image'],
          sourceType: ['album', 'camera'],
        });
        
        const tempFilePath = res.tempFiles[0].tempFilePath;
        const fileSize = res.tempFiles[0].size;
        
        // 检查文件大小（5M限制）
        if (fileSize > 5 * 1024 * 1024) {
          Taro.showToast({ title: '图片不能超过5M', icon: 'none' });
          return;
        }
        
        Taro.showLoading({ title: '上传中...' });
        
        const uploadRes = await Network.uploadFile({
          url: '/api/upload',
          filePath: tempFilePath,
          name: 'file',
        });
        
        Taro.hideLoading();
        
        if (uploadRes.statusCode === 200) {
          const data = JSON.parse(uploadRes.data);
          if (data.code === 200 && data.data?.url) {
            setFormData({ ...formData, logo: data.data.url });
            Taro.showToast({ title: '上传成功', icon: 'success' });
          } else {
            Taro.showToast({ title: '上传失败', icon: 'none' });
          }
        } else {
          Taro.showToast({ title: '上传失败', icon: 'none' });
        }
      } else {
        // H5端使用input选择文件
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.style.display = 'none';
        document.body.appendChild(input);
        input.onchange = async (e: any) => {
          const file = e.target.files[0];
          input.remove();
          if (!file) return;
          
          if (file.size > 5 * 1024 * 1024) {
            Taro.showToast({ title: '图片不能超过5M', icon: 'none' });
            return;
          }
          
          const formDataUpload = new FormData();
          formDataUpload.append('file', file);
          
          Taro.showLoading({ title: '上传中...' });
          
          try {
            const response = await fetch('/api/upload', {
              method: 'POST',
              body: formDataUpload,
            });
            
            const data = await response.json();
            Taro.hideLoading();
            
            if (data.code === 200 && data.data?.url) {
              setFormData({ ...formData, logo: data.data.url });
              Taro.showToast({ title: '上传成功', icon: 'success' });
            } else {
              Taro.showToast({ title: '上传失败', icon: 'none' });
            }
          } catch (error) {
            Taro.hideLoading();
            Taro.showToast({ title: '上传失败', icon: 'none' });
          }
        };
        input.click();
      }
    } catch (error) {
      console.error('上传首图失败:', error);
      Taro.hideLoading();
      Taro.showToast({ title: '上传失败', icon: 'none' });
    } finally {
      setUploadingLogo(false);
    }
  };

  // 上传环境图
  const handleUploadEnvImage = async () => {
    const env = Taro.getEnv();
    const isMiniApp = env === Taro.ENV_TYPE.WEAPP || env === Taro.ENV_TYPE.TT;
    
    if (uploadingImages) return;
    
    try {
      setUploadingImages(true);
      
      if (isMiniApp) {
        const res = await Taro.chooseMedia({
          count: 9,
          mediaType: ['image'],
          sourceType: ['album', 'camera'],
        });
        
        const newImages: string[] = [];
        let successCount = 0;
        let failCount = 0;
        
        for (const file of res.tempFiles) {
          if (file.size > 5 * 1024 * 1024) {
            failCount++;
            continue;
          }
          
          try {
            const uploadRes = await Network.uploadFile({
              url: '/api/upload',
              filePath: file.tempFilePath,
              name: 'file',
            });
            
            if (uploadRes.statusCode === 200) {
              const data = JSON.parse(uploadRes.data);
              if (data.code === 200 && data.data?.url) {
                newImages.push(data.data.url);
                successCount++;
              } else {
                failCount++;
              }
            } else {
              failCount++;
            }
          } catch (error) {
            failCount++;
          }
        }
        
        if (successCount > 0) {
          setFormData({ ...formData, images: [...formData.images, ...newImages] });
        }
        
        if (failCount > 0) {
          Taro.showToast({ 
            title: `${successCount}张成功，${failCount}张失败`, 
            icon: 'none' 
          });
        } else {
          Taro.showToast({ title: `成功上传${successCount}张`, icon: 'success' });
        }
      } else {
        // H5端
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.multiple = true;
        input.style.display = 'none';
        document.body.appendChild(input);
        input.onchange = async (e: any) => {
          const files = Array.from(e.target.files) as File[];
          input.remove();
          const newImages: string[] = [];
          let successCount = 0;
          let failCount = 0;
          
          for (const file of files) {
            if (file.size > 5 * 1024 * 1024) {
              failCount++;
              continue;
            }
            
            const formDataUpload = new FormData();
            formDataUpload.append('file', file);
            
            try {
              const response = await fetch('/api/upload', {
                method: 'POST',
                body: formDataUpload,
              });
              
              const data = await response.json();
              
              if (data.code === 200 && data.data?.url) {
                newImages.push(data.data.url);
                successCount++;
              } else {
                failCount++;
              }
            } catch (error) {
              failCount++;
            }
          }
          
          if (successCount > 0) {
            setFormData({ ...formData, images: [...formData.images, ...newImages] });
          }
          
          if (failCount > 0) {
            Taro.showToast({ 
              title: `${successCount}张成功，${failCount}张失败`, 
              icon: 'none' 
            });
          } else {
            Taro.showToast({ title: `成功上传${successCount}张`, icon: 'success' });
          }
        };
        input.click();
      }
    } catch (error) {
      console.error('上传环境图失败:', error);
      Taro.showToast({ title: '上传失败', icon: 'none' });
    } finally {
      setUploadingImages(false);
    }
  };

  // 删除图片
  const handleRemoveImage = (type: 'logo' | 'env', index?: number) => {
    if (type === 'logo') {
      setFormData({ ...formData, logo: '' });
    } else if (type === 'env' && index !== undefined) {
      const newImages = [...formData.images];
      newImages.splice(index, 1);
      setFormData({ ...formData, images: newImages });
    }
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

    // 验证结算配置（必填，未填无法保存商家）
    if (formData.settlement_type !== 1 && formData.settlement_type !== 2) {
      Taro.showToast({ title: '请选择结算配置方式', icon: 'none' });
      return;
    }
    if (formData.settlement_type === 1) {
      const rate = Number(formData.commission_rate);
      if (formData.commission_rate === '' || Number.isNaN(rate) || rate < 0 || rate > 100) {
        Taro.showToast({ title: '请填写0-100的佣金百分比', icon: 'none' });
        return;
      }
    }
    // 结算价模式：每个套餐的结算价必填，有空值跳窗提示
    if (formData.settlement_type === 2 && packagePrices.length > 0) {
      const emptyPkgs = packagePrices.filter((p) => {
        const v = Number(p.settlement_price);
        return p.settlement_price.trim() === '' || Number.isNaN(v) || v <= 0;
      });
      if (emptyPkgs.length > 0) {
        Taro.showModal({
          title: '结算价未填写完整',
          content: `以下套餐的结算价为空或无效：\n${emptyPkgs.map((p) => `· ${p.name}`).join('\n')}\n\n请逐个填写后再保存`,
          showCancel: false,
          confirmText: '去填写',
          confirmColor: '#FF4757',
        });
        return;
      }
    }

    try {
      setSaving(true);
      let res;
      const submitData = {
        ...formData,
        commission_rate: formData.settlement_type === 1 ? Number(formData.commission_rate) : 0,
      };
      if (editingMerchant) {
        res = await Network.request({
          url: `/api/merchants/${editingMerchant.id}`,
          method: 'PUT',
          data: submitData,
        });
      } else {
        res = await Network.request({
          url: '/api/merchants',
          method: 'POST',
          data: submitData,
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

      // 佣金百分比模式：清除该商家所有套餐的套餐级结算配置，
      // 避免残留的套餐级配置（如按结算价）优先级更高，导致商家级百分比不生效
      if (formData.settlement_type === 1 && editingMerchant) {
        try {
          const clearRes = await Network.request({
            url: `/api/settlement/config/merchant/${editingMerchant.id}`,
            method: 'DELETE',
          });
          console.log('清除套餐级结算配置响应:', clearRes.statusCode, clearRes.data);
        } catch (e) {
          console.error('清除套餐级结算配置失败:', e);
        }
      }

      // 结算价模式：商家保存成功后，逐套餐写入结算价配置
      if (formData.settlement_type === 2 && packagePrices.length > 0) {
        const merchantId = editingMerchant?.id ?? (res.data as any)?.data?.id;
        const results = await Promise.all(
          packagePrices.map((pkg) =>
            Network.request({
              url: '/api/settlement/config',
              method: 'POST',
              data: {
                package_id: pkg.id,
                merchant_id: merchantId,
                settlement_type: 2,
                commission_rate: 0,
                settlement_price: Number(pkg.settlement_price),
              },
            })
          )
        );
        const failed = results.filter((r) => r.statusCode < 200 || r.statusCode >= 300);
        if (failed.length > 0) {
          Taro.showModal({
            title: '部分结算价保存失败',
            content: '商家信息已保存，但有套餐结算价写入失败，请重新编辑该商家检查结算价',
            showCancel: false,
          });
          setShowForm(false);
          loadMerchants();
          return;
        }
      }

      Taro.showToast({ title: editingMerchant ? '更新成功' : '添加成功', icon: 'success' });
      setShowForm(false);
      loadMerchants();
    } catch (error) {
      console.error('保存失败:', error);
      Taro.showToast({ title: '保存失败', icon: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <View className="min-h-screen bg-gray-50">
      {/* 添加按钮 */}
      <View className="p-4">
        <Button
          className="w-full flex items-center justify-center gap-2 bg-[#FF4757]"
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
                          className="block text-xs text-[#FF4757] mt-1"
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
                        className="p-2 rounded-lg bg-red-50"
                        onClick={() =>
                          Taro.navigateTo({
                            url: `/pages/merchant-qualification/index?merchant_id=${merchant.id}`,
                          })
                        }
                      >
                        <ShieldCheck size={16} color="#FF4757" />
                      </View>
                      <View
                        className="p-2 rounded-lg bg-red-50"
                        onClick={() => handleEdit(merchant)}
                      >
                        <Pencil size={16} color="#FF4757" />
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
                  商家名称 <Text className="text-[#FF4757]">*</Text>
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
                  <Text className="block text-xs text-[#FF4757] mt-1">请输入11位手机号</Text>
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
                  <Text className="block text-xs text-[#FF4757] mt-1">请输入11位手机号</Text>
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
                  <Text className="block text-xs text-[#FF4757] mt-1">密码长度至少6位</Text>
                )}
              </View>


              {/* 商家首图 */}
              <View className="mb-4">
                <Text className="block text-sm font-medium text-gray-800 mb-2">商家首图 *</Text>
                {formData.logo ? (
                  <View className="relative">
                    <Image
                      src={formData.logo}
                      className="w-full h-48 rounded-lg bg-gray-900"
                      mode="aspectFit"
                    />
                    <Button
                      className="absolute top-2 right-2 w-8 h-8 bg-black bg-opacity-50 rounded-full flex items-center justify-center p-0"
                      onClick={() => handleRemoveImage('logo')}
                    >
                      <X size={16} color="#fff" />
                    </Button>
                  </View>
                ) : (
                  <Button
                    className="w-full h-32 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center"
                    onClick={handleUploadLogo}
                    disabled={uploadingLogo}
                  >
                    <ImageIcon size={32} color="#9ca3af" />
                    <Text className="block text-sm text-gray-500 mt-2">
                      {uploadingLogo ? '上传中...' : '点击上传首图'}
                    </Text>
                    <Text className="block text-xs text-gray-400 mt-1">建议 4:3 横图（如 1200×900 像素），不超过5M；商家主页将完整展示原图不裁切</Text>
                  </Button>
                )}
              </View>

              {/* 商家环境图 */}
              <View className="mb-4">
                <Text className="block text-sm font-medium text-gray-800 mb-2">商家环境图（选填）</Text>
                <View className="grid grid-cols-3 gap-2">
                  {formData.images.map((img, index) => (
                    <View key={index} className="relative">
                      <Image
                        src={img}
                        className="w-full h-24 rounded-lg bg-gray-50"
                        mode="aspectFit"
                        onClick={() => Taro.previewImage({ current: img, urls: formData.images })}
                      />
                      <Button
                        className="absolute top-1 right-1 w-6 h-6 bg-black bg-opacity-50 rounded-full flex items-center justify-center p-0"
                        onClick={() => handleRemoveImage('env', index)}
                      >
                        <X size={12} color="#fff" />
                      </Button>
                    </View>
                  ))}
                  {formData.images.length < 9 && (
                    <Button
                      className="w-full h-24 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center"
                      onClick={handleUploadEnvImage}
                      disabled={uploadingImages}
                    >
                      <Plus size={20} color="#9ca3af" />
                      <Text className="block text-xs text-gray-500 mt-1">
                        {uploadingImages ? '上传中' : '添加'}
                      </Text>
                    </Button>
                  )}
                </View>
                <Text className="block text-xs text-gray-400 mt-2">最多9张，每张不超过5M；建议 4:3 或 1:1 比例，商家主页将完整展示不裁切，点击小图可预览大图</Text>
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

              {/* 结算配置（必填，仅系统管理员可见可修改） */}
              <View className="mb-4 bg-indigo-50 rounded-xl p-4 border border-indigo-100">
                <View className="flex flex-row items-center mb-1">
                  <ShieldCheck size={16} color="#6366f1" />
                  <Text className="block text-sm font-medium text-gray-800 ml-1">
                    结算配置 <Text className="text-[#FF4757]">*</Text>
                  </Text>
                </View>
                <Text className="block text-xs text-gray-400 mb-3">必填项，未填写无法保存商家；配置数字仅平台管理员可见，商家与消费者端不展示</Text>
                <RadioGroup
                  value={formData.settlement_type ? String(formData.settlement_type) : ''}
                  onValueChange={handleSettlementTypeChange}
                >
                  <View className="space-y-3">
                    <View className="flex items-center space-x-3 p-3 bg-white rounded-xl">
                      <RadioGroupItem value="1" id="settle-type-1" />
                      <Label className="flex-1">
                        <View className="flex items-center">
                          <Percent size={18} color="#FF4757" className="mr-2" />
                          <View>
                            <Text className="block text-sm font-medium text-gray-800">佣金百分比</Text>
                            <Text className="block text-xs text-gray-500">按订单金额的百分比收取平台佣金</Text>
                          </View>
                        </View>
                      </Label>
                    </View>
                    <View className="flex items-center space-x-3 p-3 bg-white rounded-xl">
                      <RadioGroupItem value="2" id="settle-type-2" />
                      <Label className="flex-1">
                        <View className="flex items-center">
                          <Coins size={18} color="#f59e0b" className="mr-2" />
                          <View>
                            <Text className="block text-sm font-medium text-gray-800">套餐结算价</Text>
                            <Text className="block text-xs text-gray-500">按固定价格与商家结算</Text>
                          </View>
                        </View>
                      </Label>
                    </View>
                  </View>
                </RadioGroup>

                {formData.settlement_type === 1 && (
                  <View className="mt-3">
                    <Text className="block text-sm font-medium text-gray-800 mb-2">佣金百分比（%）</Text>
                    <Input
                      className="w-full bg-white"
                      placeholder="请输入0-100的佣金百分比"
                      type="digit"
                      value={formData.commission_rate}
                      onInput={(e) => setFormData({ ...formData, commission_rate: e.detail.value })}
                    />
                  </View>
                )}
                {formData.settlement_type === 2 && (
                  <View className="mt-3">
                    <Text className="block text-sm font-medium text-gray-800 mb-2">套餐结算价（逐个套餐设置）</Text>
                    {loadingPackages ? (
                      <View className="bg-white rounded-xl p-4 text-center">
                        <Text className="block text-sm text-gray-400">正在加载门店套餐...</Text>
                      </View>
                    ) : packagePrices.length === 0 ? (
                      <View className="bg-amber-50 rounded-xl p-3 border border-amber-100">
                        <Text className="block text-xs text-amber-600">
                          {editingMerchant ? '该商家暂无套餐，保存后请先添加套餐，再回到本页逐个设置结算价' : '新建商家保存并添加套餐后，可回到本页逐个设置结算价'}
                        </Text>
                      </View>
                    ) : (
                      <View className="space-y-2">
                        {packagePrices.map((pkg, idx) => (
                          <View key={pkg.id} className="flex flex-row items-center gap-3 bg-white rounded-xl p-3">
                            <View className="flex-1">
                              <Text className="block text-sm font-medium text-gray-800">{pkg.name}</Text>
                              <Text className="block text-xs text-gray-400 mt-1">售价 ¥{pkg.price}</Text>
                            </View>
                            <View className="flex flex-row items-center bg-gray-50 rounded-lg px-3 py-2 w-32">
                              <Text className="text-sm text-gray-400 mr-1">¥</Text>
                              <Input
                                className="flex-1 text-sm"
                                placeholder="结算价"
                                type="digit"
                                value={pkg.settlement_price}
                                onInput={(e) => {
                                  const next = [...packagePrices];
                                  next[idx] = { ...next[idx], settlement_price: e.detail.value };
                                  setPackagePrices(next);
                                }}
                              />
                            </View>
                          </View>
                        ))}
                      </View>
                    )}
                    {packagePrices.length > 0 && (
                      <Text className="block text-xs text-gray-400 mt-2">每个套餐都必须填写结算价，留空将无法保存</Text>
                    )}
                  </View>
                )}
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
                className="flex-1 bg-[#FF4757]"
                onClick={handleSubmit}
                disabled={saving}
              >
                <Text className="text-white">{saving ? '保存中...' : '保存'}</Text>
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
                          <Text className="block text-sm text-[#FF4757]">已选择</Text>
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
                      ? 'bg-red-50'
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
                        ? 'text-[#FF4757] font-semibold'
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
              <Button className="w-full bg-[#FF4757] text-white" onClick={handleTimeConfirm}>
                确认
              </Button>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}
