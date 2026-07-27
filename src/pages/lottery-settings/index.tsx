import { View, Text, ScrollView } from '@tarojs/components';
import { useState, useEffect } from 'react';
import Taro from '@tarojs/taro';
import { Minus, Plus } from 'lucide-react-taro';
import { Network } from '@/network';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';

/** 权重最小值与步进粒度 */
const MIN_WEIGHT = 0.5;
const WEIGHT_STEP = 0.5;

/** 将权重字符串规整为 0.5 粒度的展示值（1 -> "1"，1.5 -> "1.5"） */
const fmtWeight = (v?: string): string => {
  const n = parseFloat(v || '');
  if (Number.isNaN(n)) return String(MIN_WEIGHT);
  return String(Math.round(n * 2) / 2);
};

interface WeightStepperProps {
  label: string;
  value?: string;
  onStep: (delta: number) => void;
}

/** 权重加减步进器：点一次 ±0.5，最小 0.5 */
function WeightStepper({ label, value, onStep }: WeightStepperProps) {
  const current = parseFloat(fmtWeight(value));
  const isMin = current <= MIN_WEIGHT;
  return (
    <View className="flex flex-row items-center justify-between">
      <Text className="text-xs text-gray-500">{label}</Text>
      <View className="flex flex-row items-center gap-3">
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 rounded-full"
          disabled={isMin}
          onClick={() => { if (!isMin) onStep(-WEIGHT_STEP); }}
        >
          <Minus size={14} color={isMin ? '#9CA3AF' : '#374151'} />
        </Button>
        <Text className="w-10 text-center text-sm font-semibold text-black">{fmtWeight(value)}</Text>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 rounded-full"
          onClick={() => onStep(WEIGHT_STEP)}
        >
          <Plus size={14} color="#374151" />
        </Button>
      </View>
    </View>
  );
}

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
      if (data && typeof data === 'object') {
        // 统一规范化为字符串键值对，保证开关比较（'true'）与受控输入（string value）行为一致
        const normalized: Record<string, string> = {};
        Object.entries(data).forEach(([k, v]) => { normalized[k] = String(v); });
        setLotterySettings(normalized);
      }
    } catch (e) {
      console.error('获取抽奖设置失败:', e);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // 保存前统一转字符串，避免 number/boolean 混入后端
      const payload: Record<string, string> = {};
      Object.entries(lotterySettings).forEach(([k, v]) => { payload[k] = String(v); });
      await Network.request({
        url: '/api/lottery/settings',
        method: 'POST',
        data: payload,
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

  /** 权重步进：0.5 粒度、最小 0.5，整数步进避免浮点误差 */
  const stepSetting = (key: string) => (delta: number) => {
    setLotterySettings(prev => {
      const current = parseFloat(prev[key] || '');
      const base = Number.isNaN(current) ? MIN_WEIGHT : current;
      const next = Math.max(MIN_WEIGHT, Math.round((base + delta) * 2) / 2);
      return { ...prev, [key]: String(next) };
    });
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
            <View className="mb-3">
              <WeightStepper label="普通访客" value={lotterySettings.weight_visitor || '1'} onStep={stepSetting('weight_visitor')} />
            </View>
            <WeightStepper label="已下单客户" value={lotterySettings.weight_ordered || '2'} onStep={stepSetting('weight_ordered')} />
          </CardContent>
        </Card>

        {/* 分享权重设置 */}
        <Card className="mb-3">
          <CardContent className="p-4">
            <Text className="block text-sm font-medium text-black mb-3">分享权重</Text>
            <View className="mb-3">
              <WeightStepper label="分享1位" value={lotterySettings.weight_share_base || '3'} onStep={stepSetting('weight_share_base')} />
            </View>
            <WeightStepper label="每多1位递增" value={lotterySettings.weight_share_increment || '0.5'} onStep={stepSetting('weight_share_increment')} />
          </CardContent>
        </Card>

        {/* 社交媒体权重 */}
        <Card className="mb-3">
          <CardContent className="p-4">
            <WeightStepper label="每条社媒发布" value={lotterySettings.weight_social_post || '1'} onStep={stepSetting('weight_social_post')} />
            <Text className="block text-xs text-gray-400 mt-2">抖音/小红书/微视频，每项+1</Text>
          </CardContent>
        </Card>

        {/* 权重封顶 */}
        <Card className="mb-3">
          <CardContent className="p-4">
            <WeightStepper label="权重封顶值" value={lotterySettings.weight_cap || '20'} onStep={stepSetting('weight_cap')} />
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
                <Input type="digit" className="w-full" style={{ backgroundColor: 'transparent' }} value={lotterySettings.rate_limit_max || '10'} onInput={(e) => updateSetting('rate_limit_max', e.detail.value)} />
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
                <Input type="digit" className="w-full" style={{ backgroundColor: 'transparent' }} value={lotterySettings.redemption_expiry_hours || '72'} onInput={(e) => updateSetting('redemption_expiry_hours', e.detail.value)} />
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
