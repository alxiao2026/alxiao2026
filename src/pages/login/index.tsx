import { View, Text } from '@tarojs/components';
import { useState } from 'react';
import Taro from '@tarojs/taro';
import { Network } from '@/network';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { User, Phone } from 'lucide-react-taro';

const LoginPage = () => {
  const env = Taro.getEnv();
  const isMiniApp = env === Taro.ENV_TYPE.WEAPP || env === Taro.ENV_TYPE.TT;
  const [nickName, setNickName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  const generateUserId = () => `user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const saveAndGoBack = (uid: string, name: string, avatar: string) => {
    Taro.setStorageSync('user_id', uid);
    Taro.setStorageSync('nick_name', name);
    Taro.setStorageSync('avatar_url', avatar);
    Taro.showToast({ title: '登录成功', icon: 'success' });
    setTimeout(() => {
      Taro.navigateBack();
    }, 800);
  };

  const registerToBackend = async (uid: string, name: string, avatar: string) => {
    try {
      const res = await Network.request({
        url: '/api/users/login',
        method: 'POST',
        data: { user_id: uid, nick_name: name, avatar_url: avatar }
      });
      console.log('[Login] register:', res.data);
      if (res.data?.code === 200 && res.data?.data) {
        saveAndGoBack(uid, name, avatar);
      } else {
        Taro.showToast({ title: '登录失败，请重试', icon: 'none' });
      }
    } catch (e) {
      console.error('登录失败:', e);
      Taro.showToast({ title: '网络异常，请重试', icon: 'none' });
    } finally {
      setLoading(false);
    }
  };

  // 微信授权登录
  const handleWxLogin = async () => {
    setLoading(true);
    try {
      const res = await Taro.getUserProfile({ desc: '用于完善用户资料', lang: 'zh_CN' });
      const { nickName: name, avatarUrl: avatar } = res.userInfo;
      let uid = Taro.getStorageSync('user_id');
      if (!uid) {
        uid = generateUserId();
      }
      await registerToBackend(uid, name, avatar);
    } catch (e) {
      console.log('用户取消授权:', e);
      Taro.showToast({ title: '已取消授权', icon: 'none' });
      setLoading(false);
    }
  };

  // 账号注册登录
  const handleRegister = async () => {
    if (!nickName.trim()) {
      Taro.showToast({ title: '请输入昵称', icon: 'none' });
      return;
    }
    if (!phone.trim()) {
      Taro.showToast({ title: '请输入手机号', icon: 'none' });
      return;
    }
    if (!/^1\d{10}$/.test(phone.trim())) {
      Taro.showToast({ title: '手机号格式不正确', icon: 'none' });
      return;
    }
    setLoading(true);
    let uid = Taro.getStorageSync('user_id');
    if (!uid) {
      uid = generateUserId();
    }
    await registerToBackend(uid, nickName.trim(), '');
  };

  return (
    <View className="min-h-screen bg-gray-50">
      {/* 顶部品牌区 */}
      <View className="bg-gradient-to-br from-red-500 to-orange-500 px-6 pt-20 pb-16 flex flex-col items-center">
        <View className="w-20 h-20 rounded-full bg-white flex items-center justify-center mb-4" style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.15)' }}>
          <Text className="text-3xl font-bold" style={{ color: '#ff6a00' }}>膨</Text>
        </View>
        <Text className="text-white text-xl font-bold block">膨胀团</Text>
        <Text className="text-white text-sm block mt-1" style={{ opacity: 0.7 }}>本地生活 · 有奖销售</Text>
      </View>

      {/* 登录区域 */}
      <View className="px-5 -mt-6">
        <View className="bg-white rounded-2xl p-6" style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          <Text className="text-lg font-bold text-gray-900 block text-center mb-1">登录 / 注册</Text>
          <Text className="text-sm text-gray-400 block text-center mb-6">登录后查看订单和会员权益</Text>

          {/* 微信授权登录（小程序端） */}
          {isMiniApp && (
            <View className="mb-6">
              <Button
                className="w-full rounded-xl py-3 text-base font-medium"
                style={{ backgroundColor: '#07C160', color: '#fff' }}
                onClick={handleWxLogin}
                disabled={loading}
              >
                <View className="flex flex-row items-center justify-center gap-2">
                  <User size={20} color="#fff" />
                  <Text className="text-white font-medium">{loading ? '授权中...' : '微信一键登录'}</Text>
                </View>
              </Button>
              <Text className="text-xs text-gray-400 block text-center mt-2">授权后自动获取微信头像和昵称</Text>
            </View>
          )}

          {/* 分隔线 */}
          {isMiniApp && (
            <View className="flex flex-row items-center gap-3 mb-6">
              <View className="flex-1 h-px bg-gray-200" />
              <Text className="text-xs text-gray-400">或使用账号注册</Text>
              <View className="flex-1 h-px bg-gray-200" />
            </View>
          )}

          {/* 账号注册表单 */}
          <View className="flex flex-col gap-4">
            <View>
              <Text className="text-sm font-medium text-gray-700 block mb-2">昵称</Text>
              <View className="flex flex-row items-center bg-gray-50 rounded-xl px-4 border border-gray-200">
                <User size={18} color="#9CA3AF" />
                <View className="flex-1 ml-3">
                  <Input
                    className="w-full bg-transparent border-0 text-base"
                    style={{ height: '44px' }}
                    placeholder="请输入昵称"
                    value={nickName}
                    onInput={(e) => setNickName(e.detail.value)}
                  />
                </View>
              </View>
            </View>

            <View>
              <Text className="text-sm font-medium text-gray-700 block mb-2">手机号</Text>
              <View className="flex flex-row items-center bg-gray-50 rounded-xl px-4 border border-gray-200">
                <Phone size={18} color="#9CA3AF" />
                <View className="flex-1 ml-3">
                  <Input
                    className="w-full bg-transparent border-0 text-base"
                    style={{ height: '44px' }}
                    placeholder="请输入手机号"
                    type="number"
                    maxlength={11}
                    value={phone}
                    onInput={(e) => setPhone(e.detail.value)}
                  />
                </View>
              </View>
            </View>

            <Button
              className="w-full bg-gradient-to-r from-red-500 to-orange-500 text-white rounded-xl py-3 text-base font-medium mt-2 border-0"
              onClick={handleRegister}
              disabled={loading}
            >
              {loading ? '注册中...' : '注册 / 登录'}
            </Button>
          </View>
        </View>

        {/* 底部说明 */}
        <View className="mt-6 px-4">
          <Text className="text-xs text-gray-400 block text-center">登录即代表同意《用户协议》和《隐私政策》</Text>
        </View>
      </View>
    </View>
  );
};

export default LoginPage;
