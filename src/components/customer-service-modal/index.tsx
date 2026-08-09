import { useEffect, useState } from 'react';
import { View, Text, Image } from '@tarojs/components';
import { Network } from '@/network';
import { X, MessageCircleHeart, Sparkles, QrCode } from 'lucide-react-taro';

interface CustomerServiceConfig {
  enabled: boolean;
  qrcode_url: string | null;
  title: string;
  welcome_text: string;
  service_id: string | null;
}

interface CustomerServiceModalProps {
  visible: boolean;
  onClose: () => void;
}

/**
 * 企微客服弹窗（年轻化设计）
 * 渐变头部 + 二维码卡片 + 长按识别添加企微
 */
export function CustomerServiceModal({ visible, onClose }: CustomerServiceModalProps) {
  const [config, setConfig] = useState<CustomerServiceConfig | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await Network.request({ url: '/api/customer-service/config', method: 'GET' });
        const body = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
        if (!cancelled && body?.data) setConfig(body.data);
      } catch {
        // 静默失败，用默认文案
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [visible]);

  if (!visible) return null;

  const title = config?.title || '联系客服';
  const welcome = config?.welcome_text || '扫码添加客服企业微信，有问题随时找我们';
  const qrcode = config?.qrcode_url || '';

  return (
    <View
      className="fixed inset-0 z-[999] flex items-center justify-center"
      style={{ backgroundColor: 'rgba(15,10,30,0.55)', backdropFilter: 'blur(2px)' }}
      onClick={onClose}
    >
      <View
        className="w-4/5 max-w-sm rounded-3xl overflow-hidden bg-white shadow-2xl"
        style={{ animation: 'csPop 0.28s cubic-bezier(0.34,1.56,0.64,1)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 顶部渐变区 */}
        <View
          className="relative px-6 pt-7 pb-10"
          style={{ background: 'linear-gradient(135deg,#FF6B9D 0%,#A06BFF 55%,#FF8A5C 100%)' }}
        >
          {/* 装饰圆点 */}
          <View className="absolute rounded-full" style={{ top: 14, left: 20, width: 10, height: 10, backgroundColor: 'rgba(255,255,255,0.5)' }} />
          <View className="absolute rounded-full" style={{ top: 40, right: 56, width: 6, height: 6, backgroundColor: 'rgba(255,255,255,0.45)' }} />
          <View className="absolute rounded-full" style={{ bottom: 22, left: 44, width: 7, height: 7, backgroundColor: 'rgba(255,255,255,0.35)' }} />
          {/* 关闭 */}
          <View
            className="absolute flex items-center justify-center rounded-full"
            style={{ top: 12, right: 12, width: 28, height: 28, backgroundColor: 'rgba(255,255,255,0.25)' }}
            onClick={onClose}
          >
            <X size={16} color="#fff" />
          </View>

          <View className="flex items-center gap-2">
            <MessageCircleHeart size={26} color="#fff" />
            <Text className="text-xl font-bold text-white">{title}</Text>
          </View>
          <View className="flex items-center gap-1 mt-2">
            <Sparkles size={14} color="#FFE9A8" />
            <Text className="text-xs" style={{ color: 'rgba(255,255,255,0.92)' }}>有问题随时撩，客服在线等你哦</Text>
          </View>
        </View>

        {/* 二维码区 */}
        <View className="px-6 pb-6 -mt-5 flex flex-col items-center">
          <View className="bg-white rounded-2xl p-4 shadow-lg w-full flex flex-col items-center">
            {qrcode ? (
              <View className="rounded-xl overflow-hidden bg-gray-50 p-2">
                <Image
                  src={qrcode}
                  className="w-48 h-48"
                  mode="aspectFit"
                  showMenuByLongpress
                  onError={() => setConfig((c) => (c ? { ...c, qrcode_url: null } : c))}
                />
              </View>
            ) : (
              <View className="w-48 h-48 rounded-xl bg-gray-50 flex flex-col items-center justify-center gap-2">
                <QrCode size={44} color="#C9CDD4" />
                <Text className="text-xs text-gray-400">{loaded ? '客服码配置中，敬请期待' : '加载中...'}</Text>
              </View>
            )}

            <Text className="block text-center text-sm text-gray-700 mt-4 leading-relaxed">{welcome}</Text>
            {config?.service_id ? (
              <View className="mt-2 px-3 py-1 rounded-full" style={{ backgroundColor: '#FFF0F5' }}>
                <Text className="text-xs" style={{ color: '#FF5A7A' }}>企微号：{config.service_id}</Text>
              </View>
            ) : null}

            {qrcode ? (
              <Text className="block text-center text-xs text-gray-400 mt-3">长按识别二维码，添加客服企业微信</Text>
            ) : null}
          </View>

          {/* 底部按钮 */}
          <View
            className="w-full mt-5 rounded-full py-3 flex items-center justify-center active:opacity-90"
            style={{ background: 'linear-gradient(90deg,#FF6B9D 0%,#A06BFF 100%)' }}
            onClick={onClose}
          >
            <Text className="text-white text-base font-semibold">我知道了</Text>
          </View>
        </View>
      </View>

      <style>{`
        @keyframes csPop {
          0% { transform: scale(0.85); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </View>
  );
}

export default CustomerServiceModal;
