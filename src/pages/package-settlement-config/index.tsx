import { useState, useEffect } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import { Network } from '@/network';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Percent, Wallet, Save } from 'lucide-react-taro';

interface SettlementConfig {
  id?: string;
  package_id: string;
  settlement_type: number;
  commission_rate: number;
  settlement_price: number;
}

export default function PackageSettlementConfigPage() {
  const router = useRouter();
  const packageId = router.params.package_id || '';
  const [config, setConfig] = useState<SettlementConfig>({
    package_id: packageId,
    settlement_type: 1,
    commission_rate: 10,
    settlement_price: 0,
  });
  const [saving, setSaving] = useState(false);
  const [, setLoading] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    if (!packageId) return;
    try {
      setLoading(true);
      const res = await Network.request({
        url: `/api/settlement/config/${packageId}`,
        method: 'GET',
      });
      const data = (res.data as any)?.data;
      if (data) {
        setConfig({
          ...data,
          package_id: packageId,
        });
      }
    } catch (error) {
      console.error('获取结算配置失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    if (!packageId) return;
    try {
      setSaving(true);
      const res = await Network.request({
        url: '/api/settlement/config',
        method: 'POST',
        data: config,
      });
      const result = (res.data as any)?.data;
      if (result) {
        Taro.showToast({ title: '保存成功', icon: 'success' });
        setTimeout(() => Taro.navigateBack(), 1000);
      }
    } catch (error) {
      console.error('保存结算配置失败:', error);
      Taro.showToast({ title: '保存失败', icon: 'none' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <View className="min-h-screen bg-gray-50 pb-20">
      {/* 顶部导航 */}
      <View className="bg-white px-4 py-3 flex items-center border-b border-gray-200">
        <Text className="block text-lg font-semibold">套餐结算配置</Text>
      </View>

      <ScrollView scrollY className="flex-1">
        <View className="p-4">
          {/* 结算方式选择 */}
          <View className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
            <Text className="block text-base font-semibold text-gray-800 mb-4">结算方式</Text>
            
            <RadioGroup
              value={config.settlement_type.toString()}
              onValueChange={(value) => setConfig({ ...config, settlement_type: parseInt(value) })}
            >
              <View className="space-y-3">
                {/* 佣金百分比 */}
                <View className="flex items-center space-x-3 p-3 bg-gray-50 rounded-xl">
                  <RadioGroupItem value="1" id="type-1" />
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

                {/* 套餐结算价 */}
                <View className="flex items-center space-x-3 p-3 bg-gray-50 rounded-xl">
                  <RadioGroupItem value="2" id="type-2" />
                  <Label className="flex-1">
                    <View className="flex items-center">
                      <Wallet size={18} color="#4ECDC4" className="mr-2" />
                      <View>
                        <Text className="block text-sm font-medium text-gray-800">套餐结算价</Text>
                        <Text className="block text-xs text-gray-500">按固定价格与商家结算</Text>
                      </View>
                    </View>
                  </Label>
                </View>
              </View>
            </RadioGroup>
          </View>

          {/* 配置参数 */}
          <View className="bg-white rounded-2xl p-4 shadow-sm">
            <Text className="block text-base font-semibold text-gray-800 mb-4">配置参数</Text>

            {config.settlement_type === 1 ? (
              <View>
                <Label className="block text-sm text-gray-600 mb-2">佣金百分比 (%)</Label>
                <Input
                  type="number"
                  value={config.commission_rate.toString()}
                  onInput={(e) => setConfig({ ...config, commission_rate: parseFloat(e.detail.value) || 0 })}
                  placeholder="请输入佣金百分比（0-100）"
                  className="mb-2"
                />
                <Text className="block text-xs text-gray-400">
                  示例：10% 表示平台收取订单金额的 10% 作为佣金
                </Text>
              </View>
            ) : (
              <View>
                <Label className="block text-sm text-gray-600 mb-2">套餐结算价（元）</Label>
                <Input
                  type="digit"
                  value={config.settlement_price.toString()}
                  onInput={(e) => setConfig({ ...config, settlement_price: parseFloat(e.detail.value) || 0 })}
                  placeholder="请输入结算价"
                  className="mb-2"
                />
                <Text className="block text-xs text-gray-400">
                  商家按此价格与平台结算，超出部分归商家所有
                </Text>
              </View>
            )}
          </View>

          {/* 保存按钮 */}
          <View className="mt-6">
            <Button
              className="w-full bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-full h-12 text-base font-semibold"
              onClick={saveConfig}
              disabled={saving}
            >
              <Save size={18} color="#FF4757" className="mr-2" />
              {saving ? '保存中...' : '保存配置'}
            </Button>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
