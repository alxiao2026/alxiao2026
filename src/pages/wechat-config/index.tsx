import { useEffect, useState } from 'react';
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Network } from '@/network';
import { ShieldCheck, CircleCheck, CircleAlert, KeyRound, Save, RefreshCw } from 'lucide-react-taro';

interface WechatConfigInfo {
  appid: string;
  secret_masked: string;
  source: 'env' | 'db' | 'none';
  configured: boolean;
}

const SOURCE_LABEL: Record<string, string> = {
  env: '环境变量',
  db: '数据库配置',
  none: '未配置',
};

export default function WechatConfigPage() {
  const [info, setInfo] = useState<WechatConfigInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [appid, setAppid] = useState('');
  const [secret, setSecret] = useState('');

  const fetchConfig = async () => {
    const adminUserId = Taro.getStorageSync('user_id') || '';
    if (!adminUserId) {
      Taro.showToast({ title: '请先登录', icon: 'none' });
      return;
    }
    setLoading(true);
    try {
      const res = await Network.request({
        url: `/api/users/admin/wechat-config?admin_user_id=${encodeURIComponent(adminUserId)}`,
      });
      const body = res.data as any;
      if ((res.statusCode && res.statusCode >= 400) || body?.code !== 200) {
        throw new Error(body?.msg || body?.message || '加载失败');
      }
      const data = body?.data as WechatConfigInfo;
      setInfo(data);
      setAppid(data?.appid || '');
    } catch (e: any) {
      Taro.showToast({ title: e?.message || '加载失败', icon: 'none' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const handleSave = async () => {
    if (saving) return;
    if (!appid.trim()) {
      Taro.showToast({ title: '请填写 AppID', icon: 'none' });
      return;
    }
    const adminUserId = Taro.getStorageSync('user_id') || '';
    setSaving(true);
    try {
      const res = await Network.request({
        url: '/api/users/admin/wechat-config',
        method: 'POST',
        data: {
          admin_user_id: adminUserId,
          appid: appid.trim(),
          secret: secret.trim(),
        },
      });
      const body = res.data as any;
      if ((res.statusCode && res.statusCode >= 400) || body?.code !== 200) {
        throw new Error(body?.msg || body?.message || '保存失败');
      }
      setInfo(body?.data as WechatConfigInfo);
      setSecret('');
      Taro.showToast({ title: '已保存', icon: 'success' });
    } catch (e: any) {
      Taro.showToast({ title: e?.message || '保存失败', icon: 'none' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <View className="min-h-screen bg-gray-50 pb-8">
      {/* 顶部状态卡 */}
      <View className="bg-white px-4 py-5 mb-3">
        <View className="flex flex-row items-center">
          <ShieldCheck size={22} color="#16a34a" />
          <Text className="block text-base font-bold text-gray-800 ml-2">微信平台配置</Text>
        </View>
        <Text className="block text-xs text-gray-400 mt-2 leading-5">
          用于微信授权登录、订阅消息等能力。优先读取服务器环境变量；当部署环境缺少环境变量时，自动使用此处保存到数据库的配置。
        </Text>
      </View>

      {/* 当前状态 */}
      <View className="px-4 mb-3">
        <Card>
          <CardContent className="p-4">
            <View className="flex flex-row items-center justify-between mb-3">
              <Text className="block text-sm font-semibold text-gray-700">当前生效配置</Text>
              {info && (
                <Badge className={info.configured ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}>
                  {info.configured ? '已配置' : '未配置'}
                </Badge>
              )}
            </View>
            {loading && !info ? (
              <Text className="block text-sm text-gray-400 py-4 text-center">加载中...</Text>
            ) : info ? (
              <View>
                <View className="flex flex-row items-center mb-2">
                  <CircleCheck size={15} color={info.appid ? '#16a34a' : '#d1d5db'} />
                  <Text className="block text-sm text-gray-600 ml-2">AppID：{info.appid || '未设置'}</Text>
                </View>
                <View className="flex flex-row items-center mb-2">
                  <CircleCheck size={15} color={info.secret_masked ? '#16a34a' : '#d1d5db'} />
                  <Text className="block text-sm text-gray-600 ml-2">AppSecret：{info.secret_masked || '未设置'}</Text>
                </View>
                <View className="flex flex-row items-center">
                  {info.source === 'none' ? (
                    <CircleAlert size={15} color="#dc2626" />
                  ) : (
                    <CircleCheck size={15} color="#16a34a" />
                  )}
                  <Text className="block text-sm text-gray-600 ml-2">
                    配置来源：{SOURCE_LABEL[info.source] || info.source}
                  </Text>
                </View>
              </View>
            ) : null}
          </CardContent>
        </Card>
      </View>

      {/* 编辑表单 */}
      <View className="px-4 mb-3">
        <Card>
          <CardContent className="p-4">
            <Text className="block text-sm font-semibold text-gray-700 mb-3">数据库兜底配置</Text>
            <Text className="block text-xs text-gray-400 mb-2">AppID（小程序 AppID，wx 开头）</Text>
            <View className="bg-gray-50 rounded-lg px-3 py-2 mb-3">
              <Input
                className="w-full bg-transparent text-sm"
                placeholder="请输入微信 AppID"
                value={appid}
                onInput={(e) => setAppid(e.detail.value)}
              />
            </View>
            <Text className="block text-xs text-gray-400 mb-2">
              AppSecret（留空则保留已有值；公众平台 → 开发管理 → 开发设置）
            </Text>
            <View className="bg-gray-50 rounded-lg px-3 py-2 mb-4">
              <Input
                className="w-full bg-transparent text-sm"
                placeholder={info?.secret_masked ? `当前：${info.secret_masked}` : '请输入 AppSecret'}
                password
                value={secret}
                onInput={(e) => setSecret(e.detail.value)}
              />
            </View>
            <Button
              className="w-full bg-green-600 text-white rounded-full"
              onClick={handleSave}
              disabled={saving}
            >
              <View className="flex flex-row items-center justify-center">
                <Save size={16} color="#ffffff" />
                <Text className="text-white text-sm ml-1">{saving ? '保存中...' : '保存配置'}</Text>
              </View>
            </Button>
          </CardContent>
        </Card>
      </View>

      {/* 底部说明 + 刷新 */}
      <View className="px-4">
        <View className="flex flex-row items-start mb-4">
          <KeyRound size={14} color="#9ca3af" className="mt-1" />
          <Text className="block text-xs text-gray-400 ml-2 leading-5 flex-1">
            保存后 1 分钟内自动生效。环境变量（WECHAT_APPID/WECHAT_SECRET）存在时优先使用环境变量；仅当环境变量缺失（如线上部署未同步）时，才使用此处保存的配置。
          </Text>
        </View>
        <Button
          className="w-full bg-white text-gray-600 border border-gray-200 rounded-full"
          onClick={fetchConfig}
          disabled={loading}
        >
          <View className="flex flex-row items-center justify-center">
            <RefreshCw size={15} color="#4b5563" />
            <Text className="text-gray-600 text-sm ml-1">刷新状态</Text>
          </View>
        </Button>
      </View>
    </View>
  );
}
