import { View, Text } from '@tarojs/components';
import { useState } from 'react';
import Taro from '@tarojs/taro';
import { Network } from '@/network';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { User, Phone, Lock, MessageCircle, ShieldCheck } from 'lucide-react-taro';

type LoginTab = 'password' | 'sms';

const LoginPage = () => {
  const env = Taro.getEnv();
  const isMiniApp = env === Taro.ENV_TYPE.WEAPP || env === Taro.ENV_TYPE.TT;

  // 当前登录方式 tab
  const [loginTab, setLoginTab] = useState<LoginTab>('password');

  // 手机号密码登录
  const [pwdPhone, setPwdPhone] = useState('');
  const [password, setPassword] = useState('');
  const [pwdNickName, setPwdNickName] = useState('');

  // 手机验证码登录
  const [smsPhone, setSmsPhone] = useState('');
  const [smsCode, setSmsCode] = useState('');
  const [smsNickName, setSmsNickName] = useState('');
  const [countdown, setCountdown] = useState(0);

  const [loading, setLoading] = useState(false);

  const saveAndGoBack = (uid: string, name: string, avatar: string) => {
    Taro.setStorageSync('user_id', uid);
    Taro.setStorageSync('nick_name', name);
    Taro.setStorageSync('avatar_url', avatar);
    Taro.showToast({ title: '登录成功', icon: 'success' });
    setTimeout(() => { Taro.navigateBack(); }, 800);
  };

  const handleResponse = (res: { data?: { code?: number; data?: { user_id: string; nick_name: string; avatar_url: string } } }) => {
    console.log('[Login] response:', JSON.stringify(res.data));
    if (res.data?.code === 200 && res.data?.data) {
      const user = res.data.data;
      saveAndGoBack(user.user_id, user.nick_name || '', user.avatar_url || '');
    } else {
      Taro.showToast({ title: '登录失败，请重试', icon: 'none' });
    }
  };

  // ===== 手机号+密码登录 =====
  const handlePasswordLogin = async () => {
    if (!pwdPhone.trim()) {
      Taro.showToast({ title: '请输入手机号', icon: 'none' });
      return;
    }
    if (!/^1\d{10}$/.test(pwdPhone.trim())) {
      Taro.showToast({ title: '手机号格式不正确', icon: 'none' });
      return;
    }
    if (!password.trim()) {
      Taro.showToast({ title: '请输入密码', icon: 'none' });
      return;
    }
    if (password.trim().length < 6) {
      Taro.showToast({ title: '密码至少6位', icon: 'none' });
      return;
    }
    setLoading(true);
    try {
      const res = await Network.request({
        url: '/api/users/login/password',
        method: 'POST',
        data: {
          phone: pwdPhone.trim(),
          password: password.trim(),
          nick_name: pwdNickName.trim() || undefined
        }
      });
      handleResponse(res);
    } catch (e) {
      console.error('[Login] password login error:', e);
      const errMsg = (e as { data?: { message?: string } })?.data?.message || '登录失败，请重试';
      Taro.showToast({ title: errMsg, icon: 'none' });
    } finally {
      setLoading(false);
    }
  };

  // ===== 手机验证码登录 =====
  const handleSendSms = () => {
    if (!smsPhone.trim() || !/^1\d{10}$/.test(smsPhone.trim())) {
      Taro.showToast({ title: '请输入正确的手机号', icon: 'none' });
      return;
    }
    // 模拟发送验证码
    setCountdown(60);
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { clearInterval(timer); return 0; }
        return prev - 1;
      });
    }, 1000);
    Taro.showToast({ title: '验证码已发送', icon: 'success' });
  };

  const handleSmsLogin = async () => {
    if (!smsPhone.trim()) {
      Taro.showToast({ title: '请输入手机号', icon: 'none' });
      return;
    }
    if (!/^1\d{10}$/.test(smsPhone.trim())) {
      Taro.showToast({ title: '手机号格式不正确', icon: 'none' });
      return;
    }
    if (!smsCode.trim()) {
      Taro.showToast({ title: '请输入验证码', icon: 'none' });
      return;
    }
    setLoading(true);
    try {
      const res = await Network.request({
        url: '/api/users/login/sms',
        method: 'POST',
        data: {
          phone: smsPhone.trim(),
          code: smsCode.trim(),
          nick_name: smsNickName.trim() || undefined
        }
      });
      handleResponse(res);
    } catch (e) {
      console.error('[Login] sms login error:', e);
      const errMsg = (e as { data?: { message?: string } })?.data?.message || '登录失败，请重试';
      Taro.showToast({ title: errMsg, icon: 'none' });
    } finally {
      setLoading(false);
    }
  };

  // ===== 微信授权登录 =====
  const handleWxLogin = async () => {
    setLoading(true);
    try {
      const res = await Taro.getUserProfile({ desc: '用于完善用户资料', lang: 'zh_CN' });
      const { nickName: name, avatarUrl: avatar } = res.userInfo;
      // 生成 open_id（实际项目中应从微信登录凭证换区）
      let openId = Taro.getStorageSync('wx_open_id');
      if (!openId) {
        openId = `wx_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
        Taro.setStorageSync('wx_open_id', openId);
      }
      const loginRes = await Network.request({
        url: '/api/users/login/wechat',
        method: 'POST',
        data: { open_id: openId, nick_name: name, avatar_url: avatar }
      });
      handleResponse(loginRes);
    } catch (e) {
      console.log('[Login] wx login cancelled:', e);
      Taro.showToast({ title: '已取消授权', icon: 'none' });
    } finally {
      setLoading(false);
    }
  };

  // 渲染输入框
  const renderInput = (
    icon: React.ReactNode,
    placeholder: string,
    value: string,
    onChange: (v: string) => void,
    type: 'text' | 'number' | 'password' = 'text',
    maxLength?: number
  ) => (
    <View className="flex flex-row items-center bg-gray-50 rounded-xl px-4 border border-gray-200">
      {icon}
      <View className="flex-1 ml-3">
        <Input
          className="w-full bg-transparent border-0 text-base"
          style={{ height: '44px' }}
          placeholder={placeholder}
          type={type === 'password' ? 'text' : type}
          password={type === 'password'}
          maxlength={maxLength}
          value={value}
          onInput={(e) => onChange(e.detail.value)}
        />
      </View>
    </View>
  );

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
                  <MessageCircle size={20} color="#fff" />
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
              <Text className="text-xs text-gray-400">或使用以下方式登录</Text>
              <View className="flex-1 h-px bg-gray-200" />
            </View>
          )}

          {/* 登录方式切换 */}
          <View className="flex flex-row bg-gray-100 rounded-xl p-1 mb-6">
            <View
              className={`flex-1 rounded-lg py-2 flex items-center justify-center ${loginTab === 'password' ? 'bg-white' : ''}`}
              style={loginTab === 'password' ? { boxShadow: '0 1px 4px rgba(0,0,0,0.08)' } : undefined}
              onClick={() => setLoginTab('password')}
            >
              <Text className={`text-sm font-medium ${loginTab === 'password' ? 'text-red-500' : 'text-gray-500'}`}>密码登录</Text>
            </View>
            <View
              className={`flex-1 rounded-lg py-2 flex items-center justify-center ${loginTab === 'sms' ? 'bg-white' : ''}`}
              style={loginTab === 'sms' ? { boxShadow: '0 1px 4px rgba(0,0,0,0.08)' } : undefined}
              onClick={() => setLoginTab('sms')}
            >
              <Text className={`text-sm font-medium ${loginTab === 'sms' ? 'text-red-500' : 'text-gray-500'}`}>验证码登录</Text>
            </View>
          </View>

          {/* 密码登录表单 */}
          {loginTab === 'password' && (
            <View className="flex flex-col gap-4">
              {renderInput(
                <Phone size={18} color="#9CA3AF" />,
                '请输入手机号',
                pwdPhone,
                setPwdPhone,
                'number',
                11
              )}
              {renderInput(
                <Lock size={18} color="#9CA3AF" />,
                '请输入密码（至少6位）',
                password,
                setPassword,
                'password'
              )}
              {renderInput(
                <User size={18} color="#9CA3AF" />,
                '昵称（选填，注册时使用）',
                pwdNickName,
                setPwdNickName
              )}
              <Button
                className="w-full bg-gradient-to-r from-red-500 to-orange-500 text-white rounded-xl py-3 text-base font-medium mt-2 border-0"
                onClick={handlePasswordLogin}
                disabled={loading}
              >
                {loading ? '登录中...' : '登录 / 自动注册'}
              </Button>
              <Text className="text-xs text-gray-400 block text-center">未注册的手机号将自动创建账号</Text>
            </View>
          )}

          {/* 验证码登录表单 */}
          {loginTab === 'sms' && (
            <View className="flex flex-col gap-4">
              {renderInput(
                <Phone size={18} color="#9CA3AF" />,
                '请输入手机号',
                smsPhone,
                setSmsPhone,
                'number',
                11
              )}
              {/* 验证码输入 */}
              <View className="flex flex-row items-center gap-3">
                <View className="flex-1 flex flex-row items-center bg-gray-50 rounded-xl px-4 border border-gray-200">
                  <ShieldCheck size={18} color="#9CA3AF" />
                  <View className="flex-1 ml-3">
                    <Input
                      className="w-full bg-transparent border-0 text-base"
                      style={{ height: '44px' }}
                      placeholder="请输入验证码"
                      type="number"
                      maxlength={6}
                      value={smsCode}
                      onInput={(e) => setSmsCode(e.detail.value)}
                    />
                  </View>
                </View>
                <View
                  className={`rounded-xl px-4 flex items-center justify-center ${countdown > 0 ? 'bg-gray-200' : 'bg-gradient-to-r from-red-500 to-orange-500'}`}
                  style={{ height: '44px', minWidth: '100px' }}
                  onClick={countdown > 0 ? undefined : handleSendSms}
                >
                  <Text className={`text-sm font-medium ${countdown > 0 ? 'text-gray-400' : 'text-white'}`}>
                    {countdown > 0 ? `${countdown}s` : '获取验证码'}
                  </Text>
                </View>
              </View>
              {renderInput(
                <User size={18} color="#9CA3AF" />,
                '昵称（选填，注册时使用）',
                smsNickName,
                setSmsNickName
              )}
              <Button
                className="w-full bg-gradient-to-r from-red-500 to-orange-500 text-white rounded-xl py-3 text-base font-medium mt-2 border-0"
                onClick={handleSmsLogin}
                disabled={loading}
              >
                {loading ? '登录中...' : '登录 / 自动注册'}
              </Button>
              <Text className="text-xs text-gray-400 block text-center">未注册的手机号将自动创建账号</Text>
            </View>
          )}
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
