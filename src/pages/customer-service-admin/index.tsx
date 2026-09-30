import { useEffect, useState } from 'react';
import { View, Text, Image } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { Network } from '@/network';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { uploadLocalImage, chooseImageH5, isMiniAppEnv, ensurePrivacyAuthorized } from '@/lib/upload-image';
import { Headphones, ImagePlus, RefreshCw } from 'lucide-react-taro';

interface CustomerServiceConfig {
  enabled: boolean;
  qrcode_url: string | null;
  title: string;
  welcome_text: string;
  service_id: string | null;
  community_enabled: boolean;
  community_title: string;
  community_subtitle: string;
  community_button_text: string;
  community_qrcode_url: string | null;
}

const CustomerServiceAdminPage = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [qrcodeUrl, setQrcodeUrl] = useState('');
  const [title, setTitle] = useState('联系客服');
  const [welcomeText, setWelcomeText] = useState('扫码添加客服企业微信，有问题随时找我们');
  const [serviceId, setServiceId] = useState('');
  const [communityEnabled, setCommunityEnabled] = useState(false);
  const [communityTitle, setCommunityTitle] = useState('加店长领券享88折');
  const [communitySubtitle, setCommunitySubtitle] = useState('进群抽免单，天天享9折');
  const [communityButtonText, setCommunityButtonText] = useState('长按识别二维码加店长');
  const [communityQrcodeUrl, setCommunityQrcodeUrl] = useState('');
  const [communityUploading, setCommunityUploading] = useState(false);

  const fetchConfig = async () => {
    try {
      const res = await Network.request({ url: '/api/customer-service/config', method: 'GET' });
      const body = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
      const cfg: CustomerServiceConfig | undefined = body?.data;
      if (cfg) {
        setEnabled(!!cfg.enabled);
        setQrcodeUrl(cfg.qrcode_url || '');
        setTitle(cfg.title || '联系客服');
        setWelcomeText(cfg.welcome_text || '');
        setServiceId(cfg.service_id || '');
        setCommunityEnabled(!!cfg.community_enabled);
        setCommunityTitle(cfg.community_title || '加店长领券享88折');
        setCommunitySubtitle(cfg.community_subtitle || '进群抽免单，天天享9折');
        setCommunityButtonText(cfg.community_button_text || '长按识别二维码加店长');
        setCommunityQrcodeUrl(cfg.community_qrcode_url || '');
      }
    } catch {
      Taro.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchConfig(); }, []);

  const handleChooseCommunityQrcode = async () => {
    if (communityUploading) return;
    setCommunityUploading(true);
    try {
      let url: string | null = null;
      if (isMiniAppEnv()) {
        console.log('[CustomerService] 调起 chooseMedia 选社群二维码');
        await ensurePrivacyAuthorized();
        const choose = await Taro.chooseMedia({ count: 1, mediaType: ['image'], sizeType: ['compressed'], sourceType: ['album', 'camera'] });
        const path = choose.tempFiles?.[0]?.tempFilePath;
        console.log('[CustomerService] 选图结果 path:', path);
        if (path) url = await uploadLocalImage(path);
      } else {
        const picked = await chooseImageH5();
        if (picked) url = await uploadLocalImage(picked.localUrl, picked.file);
      }
      if (url) {
        setCommunityQrcodeUrl(url);
        Taro.showToast({ title: '二维码已上传', icon: 'success' });
      }
    } catch {
      // 用户取消选择
    } finally {
      setCommunityUploading(false);
    }
  };

  const handleChooseQrcode = async () => {
    if (uploading) return;
    setUploading(true);
    try {
      let url: string | null = null;
      if (isMiniAppEnv()) {
        // 使用 chooseMedia（chooseImage 在部分安卓机选图后会回收小程序导致重启/无响应）
        console.log('[CustomerService] 调起 chooseMedia 选图');
        await ensurePrivacyAuthorized();
        const choose = await Taro.chooseMedia({ count: 1, mediaType: ['image'], sizeType: ['compressed'], sourceType: ['album', 'camera'] });
        const path = choose.tempFiles?.[0]?.tempFilePath;
        console.log('[CustomerService] 选图结果 path:', path);
        if (path) url = await uploadLocalImage(path);
      } else {
        const picked = await chooseImageH5();
        if (picked) url = await uploadLocalImage(picked.localUrl, picked.file);
      }
      if (url) {
        setQrcodeUrl(url);
        Taro.showToast({ title: '二维码已上传', icon: 'success' });
      }
    } catch {
      // 用户取消选择
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const res = await Network.request({
        url: '/api/customer-service/config',
        method: 'PUT',
        data: {
          enabled,
          qrcode_url: qrcodeUrl || null,
          title: title.trim() || '联系客服',
          welcome_text: welcomeText.trim(),
          service_id: serviceId.trim() || null,
          community_enabled: communityEnabled,
          community_title: communityTitle.trim(),
          community_subtitle: communitySubtitle.trim(),
          community_button_text: communityButtonText.trim(),
          community_qrcode_url: communityQrcodeUrl || null
        }
      });
      const body = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
      if (body?.code === 200) {
        Taro.showToast({ title: '保存成功', icon: 'success' });
      } else {
        Taro.showToast({ title: body?.msg || '保存失败', icon: 'none' });
      }
    } catch {
      Taro.showToast({ title: '保存失败', icon: 'none' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Text className="text-sm text-gray-400">加载中...</Text>
      </View>
    );
  }

  return (
    <View className="min-h-screen bg-gray-50 pb-10">
      {/* 头部 */}
      <View className="px-5 pt-6 pb-4" style={{ background: 'linear-gradient(135deg,#FF6B9D 0%,#A06BFF 100%)' }}>
        <View className="flex items-center gap-2">
          <Headphones size={24} color="#fff" />
          <Text className="text-xl font-bold text-white">客服配置</Text>
        </View>
        <Text className="block text-xs mt-1" style={{ color: 'rgba(255,255,255,0.9)' }}>
          配置个人中心「联系客服」弹窗的企微二维码与文案
        </Text>
      </View>

      <View className="px-4 mt-4 flex flex-col gap-4">
        {/* 启用开关 */}
        <View className="bg-white rounded-2xl p-4 shadow-sm flex flex-row items-center justify-between">
          <View>
            <Text className="block text-sm font-semibold text-gray-800">启用客服入口</Text>
            <Text className="block text-xs text-gray-400 mt-1">关闭后用户点击联系客服将提示暂未开通</Text>
          </View>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </View>

        {/* 企微二维码 */}
        <View className="bg-white rounded-2xl p-4 shadow-sm">
          <Text className="block text-sm font-semibold text-gray-800 mb-1">企业微信二维码</Text>
          <Text className="block text-xs text-gray-400 mb-3">建议上传清晰的正方形二维码图片，用户长按识别添加</Text>
          <View className="flex flex-row items-center gap-4">
            {qrcodeUrl ? (
              <View className="rounded-xl overflow-hidden bg-gray-50 p-2 border border-gray-100">
                <Image src={qrcodeUrl} className="w-32 h-32" mode="aspectFit" />
              </View>
            ) : (
              <View className="w-32 h-32 rounded-xl bg-gray-50 border border-dashed border-gray-200 flex items-center justify-center">
                <Text className="text-xs text-gray-300">未上传</Text>
              </View>
            )}
            <View className="flex-1">
              <Button
                className="w-full bg-[#A06BFF] text-white rounded-xl"
                disabled={uploading}
                onClick={handleChooseQrcode}
              >
                <View className="flex flex-row items-center justify-center gap-1">
                  {qrcodeUrl ? <RefreshCw size={16} color="#fff" /> : <ImagePlus size={16} color="#fff" />}
                  <Text className="text-white text-sm">{uploading ? '上传中...' : qrcodeUrl ? '重新上传' : '上传二维码'}</Text>
                </View>
              </Button>
            </View>
          </View>
        </View>

        {/* 文案配置 */}
        <View className="bg-white rounded-2xl p-4 shadow-sm flex flex-col gap-4">
          <View>
            <Text className="block text-sm font-semibold text-gray-800 mb-2">弹窗标题</Text>
            <Input
              className="bg-gray-50 rounded-xl border-0"
              placeholder="如：联系客服"
              value={title}
              onInput={(e) => setTitle(e.detail.value)}
            />
          </View>

          <View>
            <Text className="block text-sm font-semibold text-gray-800 mb-2">欢迎文案</Text>
            <Textarea
              className="bg-gray-50 rounded-xl border-0 min-h-20"
              placeholder="展示在二维码下方的引导文案"
              maxlength={100}
              value={welcomeText}
              onInput={(e) => setWelcomeText(e.detail.value)}
            />
          </View>

          <View>
            <Text className="block text-sm font-semibold text-gray-800 mb-2">企微号（选填）</Text>
            <Input
              className="bg-gray-50 rounded-xl border-0"
              placeholder="展示给用户的客服企微号"
              value={serviceId}
              onInput={(e) => setServiceId(e.detail.value)}
            />
          </View>
        </View>

        {/* 社群营销配置 */}
        <View className="bg-white rounded-2xl p-4 shadow-sm flex flex-col gap-4">
          <View className="flex flex-row items-center justify-between">
            <View>
              <Text className="block text-sm font-semibold text-gray-800">社群营销配置</Text>
              <Text className="block text-xs text-gray-400 mt-1">在订单详情页展示加群/加店长引导卡片</Text>
            </View>
            <Switch checked={communityEnabled} onCheckedChange={setCommunityEnabled} />
          </View>

          {communityEnabled && (
            <>
              <View>
                <Text className="block text-sm font-semibold text-gray-800 mb-2">主标题</Text>
                <Input
                  className="bg-gray-50 rounded-xl border-0"
                  placeholder="如：加店长领券享88折"
                  value={communityTitle}
                  onInput={(e) => setCommunityTitle(e.detail.value)}
                />
              </View>

              <View>
                <Text className="block text-sm font-semibold text-gray-800 mb-2">副标题</Text>
                <Input
                  className="bg-gray-50 rounded-xl border-0"
                  placeholder="如：进群抽免单，天天享9折"
                  value={communitySubtitle}
                  onInput={(e) => setCommunitySubtitle(e.detail.value)}
                />
              </View>

              <View>
                <Text className="block text-sm font-semibold text-gray-800 mb-2">按钮文案</Text>
                <Input
                  className="bg-gray-50 rounded-xl border-0"
                  placeholder="如：长按识别二维码加店长"
                  value={communityButtonText}
                  onInput={(e) => setCommunityButtonText(e.detail.value)}
                />
              </View>

              <View>
                <Text className="block text-sm font-semibold text-gray-800 mb-1">社群二维码</Text>
                <Text className="block text-xs text-gray-400 mb-3">建议上传清晰的正方形二维码图片，用户长按识别加群</Text>
                <View className="flex flex-row items-center gap-4">
                  {communityQrcodeUrl ? (
                    <View className="rounded-xl overflow-hidden bg-gray-50 p-2 border border-gray-100">
                      <Image src={communityQrcodeUrl} className="w-32 h-32" mode="aspectFit" />
                    </View>
                  ) : (
                    <View className="w-32 h-32 rounded-xl bg-gray-50 border border-dashed border-gray-200 flex items-center justify-center">
                      <Text className="text-xs text-gray-300">未上传</Text>
                    </View>
                  )}
                  <View className="flex-1">
                    <Button
                      className="w-full bg-[#FF6B7A] text-white rounded-xl"
                      disabled={communityUploading}
                      onClick={handleChooseCommunityQrcode}
                    >
                      <View className="flex flex-row items-center justify-center gap-1">
                        {communityQrcodeUrl ? <RefreshCw size={16} color="#fff" /> : <ImagePlus size={16} color="#fff" />}
                        <Text className="text-white text-sm">{communityUploading ? '上传中...' : communityQrcodeUrl ? '重新上传' : '上传二维码'}</Text>
                      </View>
                    </Button>
                  </View>
                </View>
              </View>
            </>
          )}
        </View>

        {/* 保存 */}
        <Button
          className="w-full rounded-full py-3 text-white font-semibold"
          style={{ background: 'linear-gradient(90deg,#FF6B9D 0%,#A06BFF 100%)' }}
          disabled={saving}
          onClick={handleSave}
        >
          <Text className="text-white">{saving ? '保存中...' : '保存配置'}</Text>
        </Button>
      </View>
    </View>
  );
};

export default CustomerServiceAdminPage;
