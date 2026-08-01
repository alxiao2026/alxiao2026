import React, { useState } from 'react';
import { View, Text, Image } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Network } from '@/network';
import { MessageCircle, Phone, Lock, User, ShieldCheck, Camera } from 'lucide-react-taro';
import './index.css';

type UserRole = 'platform_admin' | 'merchant_admin' | 'user';

interface LoginUser {
  id: string;
  username: string;
  nick_name: string;
  phone: string;
  role: UserRole;
  role_code: number;
  merchant_id: string | null;
  open_id?: string | null;
  avatar_url?: string | null;
}

interface ApiResponse<T> {
  code: number;
  msg: string;
  data: T;
}

const LoginPage: React.FC = () => {
  const isMiniApp = Taro.getEnv() === Taro.ENV_TYPE.WEAPP;
  const [loginTab, setLoginTab] = useState<'password' | 'sms'>('password');

  // 密码登录
  const [pwdPhone, setPwdPhone] = useState('');
  const [password, setPassword] = useState('');
  const [pwdNickName, setPwdNickName] = useState('');

  // 验证码登录
  const [smsPhone, setSmsPhone] = useState('');
  const [smsCode, setSmsCode] = useState('');
  const [smsNickName, setSmsNickName] = useState('');
  const [countdown, setCountdown] = useState(0);

  // 微信资料（chooseAvatar 头像 + nickname 昵称）
  const [wxAvatar, setWxAvatar] = useState('');          // 已上传的永久 URL（提交用）
  const [wxAvatarLocal, setWxAvatarLocal] = useState(''); // 本地临时路径（预览用）
  const [wxNickname, setWxNickname] = useState('');
  const [avatarUploading, setAvatarUploading] = useState(false);

  const [loading, setLoading] = useState(false);

  const handleResponse = (res: { data: ApiResponse<LoginUser> }) => {
    console.log('[Login] response raw data:', res.data);
    const body = res.data;
    if (body.code === 200) {
      const user = body.data;
      if (!user || !user.id) {
        Taro.showToast({ title: '登录响应异常', icon: 'none' });
        return;
      }
      Taro.setStorageSync('user_id', user.id);
      Taro.setStorageSync('user_role', user.role);
      Taro.setStorageSync('role_code', user.role_code);
      Taro.setStorageSync('merchant_id', user.merchant_id || '');
      Taro.setStorageSync('user_phone', user.phone || '');
      Taro.setStorageSync('nick_name', user.nick_name || '');

      Taro.showToast({ title: '登录成功', icon: 'success' });
      setTimeout(() => {
        Taro.reLaunch({ url: '/pages/user-center/index' });
      }, 1200);
    } else {
      Taro.showToast({ title: body.msg || '登录失败', icon: 'none' });
    }
  };

  const handlePasswordLogin = async () => {
    if (!pwdPhone.trim()) {
      Taro.showToast({ title: '请输入手机号', icon: 'none' });
      return;
    }
    if (!/^1\d{10}$/.test(pwdPhone.trim())) {
      Taro.showToast({ title: '手机号格式不正确', icon: 'none' });
      return;
    }
    if (!password) {
      Taro.showToast({ title: '请输入密码', icon: 'none' });
      return;
    }
    if (password.length < 6) {
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
          password,
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

  const handleSendSms = () => {
    if (!smsPhone.trim() || !/^1\d{10}$/.test(smsPhone.trim())) {
      Taro.showToast({ title: '请输入正确的手机号', icon: 'none' });
      return;
    }
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

  // ===== 微信头像选择（chooseAvatar 原生能力）：选完即上传换永久 URL =====
  const handleChooseAvatar = async (e: { detail?: { avatarUrl?: string } }) => {
    const tempPath = e?.detail?.avatarUrl;
    if (!tempPath) return;
    setWxAvatarLocal(tempPath);
    setAvatarUploading(true);
    try {
      const res = await Network.uploadFile({
        url: '/api/upload',
        filePath: tempPath,
        name: 'file'
      });
      // uploadFile 的 data 是字符串，需要解析
      const parsed = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
      const url = parsed?.data?.url;
      console.log('[Login] 头像上传结果:', url);
      if (url) {
        setWxAvatar(url);
      } else {
        Taro.showToast({ title: '头像上传失败，可登录后更换', icon: 'none' });
      }
    } catch (err) {
      console.error('[Login] 头像上传异常:', err);
      Taro.showToast({ title: '头像上传失败，可登录后更换', icon: 'none' });
    } finally {
      setAvatarUploading(false);
    }
  };

  // ===== 微信一键登录：getPhoneNumber 授权（拒绝时降级为纯 code 静默登录）=====
  const handleWxOneTap = async (e: { detail?: { code?: string; errMsg?: string } }) => {
    const phoneCode = e?.detail?.code;
    console.log(
      '[Login] getPhoneNumber 回调:',
      phoneCode ? '已授权手机号' : `未授权（${e?.detail?.errMsg || '未知'}），降级静默登录`
    );
    setLoading(true);
    try {
      const wxLoginRes = await Taro.login();
      if (!wxLoginRes.code) {
        throw new Error('未获取到微信登录凭证');
      }
      const res = await Network.request({
        url: '/api/users/login/wechat',
        method: 'POST',
        data: {
          code: wxLoginRes.code,
          phone_code: phoneCode || undefined,
          nick_name: wxNickname.trim() || undefined,
          avatar_url: wxAvatar || undefined
        }
      });
      handleResponse(res);
    } catch (err) {
      console.error('[Login] wx login error:', err);
      const errMsg =
        (err as { data?: { message?: string } })?.data?.message ||
        (err as Error)?.message ||
        '微信登录失败，请重试';
      Taro.showToast({ title: errMsg, icon: 'none' });
    } finally {
      setLoading(false);
    }
  };

  // 渲染带图标的输入框（InputGroup 标准方案）
  const renderInput = (
    icon: React.ReactNode,
    placeholder: string,
    value: string,
    onChange: (v: string) => void,
    type: 'text' | 'number' | 'password' = 'text',
    maxLength?: number
  ) => (
    <InputGroup className="h-11 rounded-2xl border-gray-200 bg-gray-50">
      <InputGroupAddon align="inline-start" className="pl-4">
        {icon}
      </InputGroupAddon>
      <InputGroupInput
        className="text-base"
        placeholder={placeholder}
        type={type === 'password' ? 'text' : type}
        password={type === 'password'}
        maxlength={maxLength}
        value={value}
        onInput={(e) => onChange(e.detail.value)}
      />
    </InputGroup>
  );

  return (
    <View className="min-h-screen bg-gray-50">
      {/* 顶部品牌区：渐变 + 漂浮装饰 */}
      <View className="relative bg-gradient-to-br from-[#FF4757] via-[#FF5F6D] to-[#FF8A5C] px-6 pt-6 pb-10 flex flex-col items-center overflow-hidden">
        {/* 漂浮 emoji 装饰 */}
        <Text className="absolute login-float" style={{ top: '16px', left: '24px', fontSize: '24px' }}>🎈</Text>
        <Text className="absolute login-float-delay" style={{ top: '12px', right: '30px', fontSize: '22px' }}>🎉</Text>
        <Text className="absolute login-float-delay" style={{ bottom: '20px', left: '44px', fontSize: '18px' }}>✨</Text>
        <Text className="absolute login-float" style={{ bottom: '28px', right: '52px', fontSize: '20px' }}>🎁</Text>

        <View className="w-14 h-14 rounded-full bg-white flex items-center justify-center mb-2 login-logo-breathe">
          <Text className="text-2xl font-bold" style={{ color: '#ff6a00' }}>膨</Text>
        </View>
        <Text className="text-white text-xl font-bold block tracking-wider">膨胀团</Text>
        <Text className="text-white text-xs block mt-1" style={{ opacity: 0.85 }}>给生活来点小惊喜 ✨</Text>
      </View>

      {/* 登录卡片 */}
      <View className="px-5 -mt-5">
        <View className="bg-white rounded-3xl p-4" style={{ boxShadow: '0 8px 24px rgba(255,71,87,0.10)' }}>
          <Text className="text-lg font-bold text-gray-900 block">Hi，团友 👋</Text>
          <Text className="text-xs text-gray-400 block mt-1 mb-4">登录解锁抽奖 · 霸王餐 · 会员权益</Text>

          {/* 微信资料区（小程序端）：头像 + 昵称 */}
          {isMiniApp && (
            <View className="flex flex-row items-center gap-3 mb-4 rounded-2xl p-3" style={{ backgroundColor: '#FFF7F8' }}>
              <Button
                openType="chooseAvatar"
                onChooseAvatar={handleChooseAvatar}
                className="w-14 h-14 rounded-full p-0 border-0 bg-transparent shrink-0"
              >
                {wxAvatarLocal ? (
                  <Image src={wxAvatarLocal} className="w-14 h-14 rounded-full" mode="aspectFill" />
                ) : (
                  <View className="w-14 h-14 rounded-full border-2 border-dashed border-[#FF8FA3] bg-white flex flex-col items-center justify-center">
                    <Camera size={18} color="#FF4757" />
                    <Text className="block text-xs text-[#FF4757] mt-1">头像</Text>
                  </View>
                )}
              </Button>
              <View className="flex-1">
                <Input
                  type="nickname"
                  className="h-11 rounded-xl border-[#FFE0E5] bg-white text-base"
                  placeholder="点我填写微信昵称"
                  value={wxNickname}
                  onInput={(e) => setWxNickname(e.detail.value)}
                />
                <Text className="text-xs text-gray-400 block mt-2">
                  {avatarUploading ? '头像上传中...' : '选填，头像昵称将展示在中奖名单'}
                </Text>
              </View>
            </View>
          )}

          {/* 微信一键登录（小程序端，getPhoneNumber 授权） */}
          {isMiniApp && (
            <View className="mb-4">
              <Button
                openType="getPhoneNumber"
                onGetPhoneNumber={handleWxOneTap}
                disabled={loading || avatarUploading}
                className="w-full rounded-2xl py-2 text-base font-semibold border-0"
                style={{ background: 'linear-gradient(90deg,#07C160,#2ee37f)', boxShadow: '0 6px 16px rgba(7,193,96,0.35)' }}
              >
                <View className="flex flex-row items-center justify-center gap-2">
                  <MessageCircle size={20} color="#fff" />
                  <Text className="text-white font-semibold">{loading ? '登录中...' : '微信一键登录'}</Text>
                </View>
              </Button>
              <Text className="text-xs text-gray-400 block text-center mt-2">授权手机号一键登录，新用户自动注册</Text>
            </View>
          )}

          {/* 分隔线 */}
          {isMiniApp && (
            <View className="flex flex-row items-center gap-3 mb-4">
              <View className="flex-1 h-px bg-gray-200" />
              <Text className="text-xs text-gray-400">或使用以下方式登录</Text>
              <View className="flex-1 h-px bg-gray-200" />
            </View>
          )}

          {/* 登录方式切换 */}
          <View className="flex flex-row bg-gray-100 rounded-2xl p-1 mb-4">
            <View
              className={`flex-1 rounded-xl py-2 flex items-center justify-center ${loginTab === 'password' ? 'bg-white' : ''}`}
              style={loginTab === 'password' ? { boxShadow: '0 1px 4px rgba(0,0,0,0.08)' } : undefined}
              onClick={() => setLoginTab('password')}
            >
              <Text className={`text-sm font-medium ${loginTab === 'password' ? 'text-[#FF4757]' : 'text-gray-500'}`}>密码登录</Text>
            </View>
            <View
              className={`flex-1 rounded-xl py-2 flex items-center justify-center ${loginTab === 'sms' ? 'bg-white' : ''}`}
              style={loginTab === 'sms' ? { boxShadow: '0 1px 4px rgba(0,0,0,0.08)' } : undefined}
              onClick={() => setLoginTab('sms')}
            >
              <Text className={`text-sm font-medium ${loginTab === 'sms' ? 'text-[#FF4757]' : 'text-gray-500'}`}>验证码登录</Text>
            </View>
          </View>

          {/* 密码登录表单 */}
          {loginTab === 'password' && (
            <View className="flex flex-col gap-3">
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
                className="w-full bg-gradient-to-r from-[#FF4757] to-[#ff6b7a] text-white rounded-2xl py-2 text-base font-medium mt-1 border-0"
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
            <View className="flex flex-col gap-3">
              {renderInput(
                <Phone size={18} color="#9CA3AF" />,
                '请输入手机号',
                smsPhone,
                setSmsPhone,
                'number',
                11
              )}
              <View className="flex flex-row items-center gap-3">
                <View className="flex-1">
                  <InputGroup className="h-11 rounded-2xl border-gray-200 bg-gray-50">
                    <InputGroupAddon align="inline-start" className="pl-4">
                      <ShieldCheck size={18} color="#9CA3AF" />
                    </InputGroupAddon>
                    <InputGroupInput
                      className="text-base"
                      placeholder="请输入验证码"
                      type="number"
                      maxlength={6}
                      value={smsCode}
                      onInput={(e) => setSmsCode(e.detail.value)}
                    />
                  </InputGroup>
                </View>
                <View
                  className={`rounded-2xl px-4 flex items-center justify-center h-11 shrink-0 ${countdown > 0 ? 'bg-gray-200' : 'bg-gradient-to-r from-[#FF4757] to-[#ff6b7a]'}`}
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
                className="w-full bg-gradient-to-r from-[#FF4757] to-[#ff6b7a] text-white rounded-2xl py-2 text-base font-medium mt-1 border-0"
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
        <View className="mt-4 px-4 pb-6">
          <Text className="text-xs text-gray-400 block text-center">登录即代表同意《用户协议》和《隐私政策》</Text>
        </View>
      </View>
    </View>
  );
};

export default LoginPage;
