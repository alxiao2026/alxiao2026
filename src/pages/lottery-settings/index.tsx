import { View, Text, ScrollView } from '@tarojs/components';
import { useState, useEffect } from 'react';
import Taro from '@tarojs/taro';
import { Network } from '@/network';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';

export default function LotterySettingsPage() {
  const [lotterySettings, setLotterySettings] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchLotterySettings();
  }, []);

  const fetchLotterySettings = async () => {
    try {
      const res = await Network.request({ url: '/api/lottery/settings' });
      const data = (res.data as any)?.data || res.data;
      if (data && typeof data === 'object') setLotterySettings(data);
    } catch (e) {
      console.error('获取抽奖设置失败:', e);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await Network.request({
        url: '/api/lottery/settings',
        method: 'POST',
        data: lotterySettings as unknown as Record<string, string>,
      });
      Taro.showToast({ title: '保存成功', icon: 'success' });
    } catch {
      Taro.showToast({ title: '保存失败', icon: 'none' });
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = (key: string, value: string) => {
    setLotterySettings(prev => ({ ...prev, [key]: value }));
  };

  const toggleSetting = (key: string) => {
    setLotterySettings(prev => ({ ...prev, [key]: prev[key] === 'true' ? 'false' : 'true' }));
  };

  return (
    <View className="min-h-screen bg-gray-50">
      <ScrollView scrollY className="px-4 pt-3 pb-20">
        {/* 加权抽奖开关 */}
        <Card className="mb-3">
          <CardContent className="p-4">
            <View className="flex flex-row items-center justify-between py-2">
              <View>
                <Text className="block text-sm font-medium text-black">启用加权抽奖</Text>
                <Text className="block text-xs text-gray-400 mt-1">开启后按用户权重影响中奖概率</Text>
              </View>
              <Switch checked={lotterySettings.weight_enabled === 'true'} onCheckedChange={() => toggleSetting('weight_enabled')} />
            </View>
          </CardContent>
        </Card>

        {/* 基础权重设置 */}
        <Card className="mb-3">
          <CardContent className="p-4">
            <Text className="block text-sm font-medium text-black mb-3">基础权重</Text>
            <View className="flex flex-row items-center gap-3 mb-3">
              <Text className="text-xs text-gray-500 w-20">普通访客</Text>
              <View className="flex-1 bg-gray-50 rounded-xl px-3 py-2 border border-gray-200">
                <Input className="w-full" style={{ backgroundColor: 'transparent' }} value={lotterySettings.weight_visitor || '1'} onInput={(e) => updateSetting('weight_visitor', e.detail.value)} />
              </View>
            </View>
            <View className="flex flex-row items-center gap-3">
              <Text className="text-xs text-gray-500 w-20">已下单客户</Text>
              <View className="flex-1 bg-gray-50 rounded-xl px-3 py-2 border border-gray-200">
                <Input className="w-full" style={{ backgroundColor: 'transparent' }} value={lotterySettings.weight_ordered || '2'} onInput={(e) => updateSetting('weight_ordered', e.detail.value)} />
              </View>
            </View>
          </CardContent>
        </Card>

        {/* 分享权重设置 */}
        <Card className="mb-3">
          <CardContent className="p-4">
            <Text className="block text-sm font-medium text-black mb-3">分享权重</Text>
            <View className="flex flex-row items-center gap-3 mb-3">
              <Text className="text-xs text-gray-500 w-20">分享1位</Text>
              <View className="flex-1 bg-gray-50 rounded-xl px-3 py-2 border border-gray-200">
                <Input className="w-full" style={{ backgroundColor: 'transparent' }} value={lotterySettings.weight_share_base || '3'} onInput={(e) => updateSetting('weight_share_base', e.detail.value)} />
              </View>
            </View>
            <View className="flex flex-row items-center gap-3">
              <Text className="text-xs text-gray-500 w-20">每多1位递增</Text>
              <View className="flex-1 bg-gray-50 rounded-xl px-3 py-2 border border-gray-200">
                <Input className="w-full" style={{ backgroundColor: 'transparent' }} value={lotterySettings.weight_share_increment || '0.5'} onInput={(e) => updateSetting('weight_share_increment', e.detail.value)} />
              </View>
            </View>
          </CardContent>
        </Card>

        {/* 社交媒体权重 */}
        <Card className="mb-3">
          <CardContent className="p-4">
            <View className="flex flex-row items-center gap-3">
              <Text className="text-xs text-gray-500 w-24">每条社媒发布</Text>
              <View className="flex-1 bg-gray-50 rounded-xl px-3 py-2 border border-gray-200">
                <Input className="w-full" style={{ backgroundColor: 'transparent' }} value={lotterySettings.weight_social_post || '1'} onInput={(e) => updateSetting('weight_social_post', e.detail.value)} />
              </View>
            </View>
            <Text className="block text-xs text-gray-400 mt-2">抖音/小红书/微视频，每项+1</Text>
          </CardContent>
        </Card>

        {/* 权重封顶 */}
        <Card className="mb-3">
          <CardContent className="p-4">
            <View className="flex flex-row items-center gap-3">
              <Text className="text-xs text-gray-500 w-20">权重封顶值</Text>
              <View className="flex-1 bg-gray-50 rounded-xl px-3 py-2 border border-gray-200">
                <Input className="w-full" style={{ backgroundColor: 'transparent' }} value={lotterySettings.weight_cap || '20'} onInput={(e) => updateSetting('weight_cap', e.detail.value)} />
              </View>
            </View>
          </CardContent>
        </Card>

        {/* 限流设置 */}
        <Card className="mb-3">
          <CardContent className="p-4">
            <View className="flex flex-row items-center justify-between py-2 mb-3">
              <View>
                <Text className="block text-sm font-medium text-black">IP限流</Text>
                <Text className="block text-xs text-gray-400 mt-1">防止同一IP高频请求</Text>
              </View>
              <Switch checked={lotterySettings.rate_limit_enabled === 'true'} onCheckedChange={() => toggleSetting('rate_limit_enabled')} />
            </View>
            <View className="flex flex-row items-center gap-3">
              <Text className="text-xs text-gray-500 w-24">每分钟最大请求</Text>
              <View className="flex-1 bg-gray-50 rounded-xl px-3 py-2 border border-gray-200">
                <Input className="w-full" style={{ backgroundColor: 'transparent' }} value={lotterySettings.rate_limit_max || '10'} onInput={(e) => updateSetting('rate_limit_max', e.detail.value)} />
              </View>
            </View>
          </CardContent>
        </Card>

        {/* 兑奖有效期设置 */}
        <Card className="mb-3">
          <CardContent className="p-4">
            <View className="flex flex-row items-center gap-3">
              <Text className="text-xs text-gray-500 w-24">兑奖有效期</Text>
              <View className="flex-1 bg-gray-50 rounded-xl px-3 py-2 border border-gray-200">
                <Input className="w-full" style={{ backgroundColor: 'transparent' }} value={lotterySettings.redemption_expiry_hours || '72'} onInput={(e) => updateSetting('redemption_expiry_hours', e.detail.value)} />
              </View>
              <Text className="text-xs text-gray-400">小时</Text>
            </View>
            <Text className="block text-xs text-gray-400 mt-2">中奖后需在此时间内到店核销，过期后无法兑奖</Text>
          </CardContent>
        </Card>
      </ScrollView>

      {/* 底部固定保存按钮 */}
      <View style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '12px 16px', backgroundColor: '#fff', borderTop: '1px solid #f3f4f6', zIndex: 100 }}>
        <View className="bg-[#FF4757] rounded-full py-3 flex items-center justify-center" onClick={() => { if (!saving) handleSave(); }}>
          <Text className="block text-white text-sm font-medium">{saving ? '保存中...' : '保存设置'}</Text>
        </View>
      </View>
    </View>
  );
}
