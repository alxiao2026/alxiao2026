import React, { useState } from 'react';
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { Button } from '@/components/ui/button';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Network } from '@/network';
import { ChevronLeft, Check, Phone, Lock, User } from 'lucide-react-taro';
import './index.css';

type UserRole = 'platform_admin' | 'merchant_admin' | 'user';

interface LoginUser {
  id?: string;
  user_id?: string;
  username?: string;
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

  // 视图：select = 登录方式选择（简洁首页），password = 手机号密码登录
  const [view, setView] = useState<'select' | 'password'>('select');
  const [agreed, setAgreed] = useState(false);

  // 密码登录
  const [pwdPhone, setPwdPhone] = useState('');
  const [password, setPassword] = useState('');
  const [pwdNickName, setPwdNickName] = useState('');

  const [loading, setLoading] = useState(false);

  const handleResponse = (res: { data: ApiResponse<LoginUser> }) => {
    console.log('[Login] response raw data:', res.data);
    const body = res.data;
    if (body.code === 200) {
      const user = body.data;
      // 后端返回的用户主键为 user_id（supabase snake_case），兼容 id 字段
      const userId = user?.user_id || user?.id;
      if (!user || !userId) {
        Taro.showToast({ title: '登录响应异常', icon: 'none' });
        return;
      }
      Taro.setStorageSync('is_logged_in', true);
      Taro.setStorageSync('user_id', userId);
      Taro.setStorageSync('user_role', user.role);
      Taro.setStorageSync('role_code', user.role_code);
      Taro.setStorageSync('merchant_id', user.merchant_id || '');
      Taro.setStorageSync('user_phone', user.phone || '');
      Taro.setStorageSync('nick_name', user.nick_name || '');
      Taro.setStorageSync('avatar_url', user.avatar_url || '');

      Taro.showToast({ title: '登录成功', icon: 'success' });
      setTimeout(() => {
        Taro.reLaunch({ url: '/pages/user-center/index' });
      }, 1200);
    } else {
      Taro.showToast({ title: body.msg || '登录失败', icon: 'none' });
    }
  };

  // ===== 微信一键登录：getPhoneNumber 授权（拒绝时降级为纯 code 静默登录）=====
  const handleWxOneTap = async (e: { detail?: { code?: string; errMsg?: string } }) => {
    if (!agreed) {
      Taro.showToast({ title: '请先勾选并同意协议', icon: 'none' });
      return;
    }
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
          phone_code: phoneCode || undefined
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

  const handlePasswordLogin = async () => {
    if (!agreed) {
      Taro.showToast({ title: '请先勾选并同意协议', icon: 'none' });
      return;
    }
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

  // 协议勾选区（两种视图共用）：整行可点击，扩大触控区域
  const renderAgreement = (
    <View
      className="flex flex-row items-center justify-center px-6 py-2"
      onClick={() => setAgreed(!agreed)}
    >
      <View
        className={`h-4 w-4 rounded-full border flex items-center justify-center shrink-0 mr-2 ${
          agreed ? 'bg-[#FF4757] border-[#FF4757]' : 'bg-white border-gray-300'
        }`}
      >
        {agreed && <Check size={10} color="#fff" strokeWidth={3} />}
      </View>
      <Text className="flex-1 text-xs text-gray-500 leading-5">
        我已阅读并同意
        <Text className="text-[#FF4757]">《用户服务协议》</Text>
        、
        <Text className="text-[#FF4757]">《隐私政策》</Text>
        ，未注册的手机号将自动创建账号
      </Text>
    </View>
  );

  // 带图标输入框（白底淡红边框 + 深色文字，输入内容清晰可见）
  const renderField = (
    icon: React.ReactNode,
    placeholder: string,
    value: string,
    onChange: (v: string) => void,
    options?: { password?: boolean; number?: boolean; maxLength?: number }
  ) => (
    <InputGroup className="h-12 rounded-full border-2 border-[#FFD6DC] bg-white">
      <InputGroupAddon align="inline-start" className="pl-4">
        {icon}
      </InputGroupAddon>
      <InputGroupInput
        className="text-base text-gray-900"
        placeholderClass="text-gray-400"
        placeholder={placeholder}
        password={options?.password}
        type={options?.number ? 'number' : 'text'}
        maxlength={options?.maxLength}
        value={value}
        onInput={(e) => onChange(e.detail.value)}
      />
    </InputGroup>
  );

  // ===== 视图二：手机号密码登录 =====
  if (view === 'password') {
    return (
      <View className="min-h-screen bg-gradient-to-b from-[#FFECEF] via-white to-white">
        {/* 顶部返回 */}
        <View className="flex flex-row items-center px-4 pt-4">
          <View className="p-2" onClick={() => setView('select')}>
            <ChevronLeft size={24} color="#1F2937" />
          </View>
          <Text className="text-lg font-semibold text-gray-900 ml-2">手机号登录</Text>
        </View>

        {/* 表单 */}
        <View className="px-8 mt-8 flex flex-col gap-4">
          {renderField(
            <Phone size={18} color="#FF4757" />,
            '请输入手机号',
            pwdPhone,
            setPwdPhone,
            { number: true, maxLength: 11 }
          )}
          {renderField(
            <Lock size={18} color="#FF4757" />,
            '请输入密码（至少6位）',
            password,
            setPassword,
            { password: true }
          )}
          {renderField(
            <User size={18} color="#FF4757" />,
            '昵称（选填，注册时使用）',
            pwdNickName,
            setPwdNickName
          )}

          <Button
            className="w-full h-12 rounded-full text-base font-semibold border-0 text-white mt-4"
            style={{ background: 'linear-gradient(90deg,#FF4757,#ff6b7a)', boxShadow: '0 6px 16px rgba(255,71,87,0.30)' }}
            onClick={handlePasswordLogin}
            disabled={loading}
          >
            {loading ? '登录中...' : '登录 / 自动注册'}
          </Button>
        </View>

        {/* 协议 */}
        <View className="mt-10">{renderAgreement}</View>
      </View>
    );
  }

  // ===== 视图一：登录方式选择（年轻活泼首页）=====
  return (
    <View className="min-h-screen bg-gradient-to-b from-[#FFECEF] via-white to-white flex flex-col relative overflow-hidden">
      {/* 漂浮 emoji 装饰 */}
      <Text className="absolute login-float" style={{ top: '72px', left: '28px', fontSize: '24px' }}>🎈</Text>
      <Text className="absolute login-float-delay" style={{ top: '52px', right: '32px', fontSize: '22px' }}>🎉</Text>
      <Text className="absolute login-float-delay" style={{ top: '190px', right: '54px', fontSize: '18px' }}>✨</Text>
      <Text className="absolute login-float" style={{ top: '210px', left: '46px', fontSize: '20px' }}>🎁</Text>

      {/* Logo 区 */}
      <View className="flex flex-col items-center mt-24">
        <View
          className="w-24 h-24 rounded-full flex items-center justify-center login-logo-breathe"
          style={{ background: 'linear-gradient(135deg,#FF4757,#FF8A5C)' }}
        >
          <Text className="text-4xl font-bold text-white">膨</Text>
        </View>
        <Text className="block text-2xl font-bold text-gray-900 mt-4">膨胀团</Text>
        <Text className="block text-sm text-gray-400 mt-1">给生活来点小惊喜 ✨</Text>
      </View>

      {/* 登录按钮区 */}
      <View className="px-8 mt-20">
        {/* 主按钮：微信授权登录（手机号一键登录） */}
        {isMiniApp && (
          <Button
            openType="getPhoneNumber"
            onGetPhoneNumber={handleWxOneTap}
            disabled={loading}
            className="w-full h-12 rounded-full text-base font-semibold border-0 text-white mb-4"
            style={{ background: 'linear-gradient(90deg,#FF4757,#ff6b7a)', boxShadow: '0 6px 16px rgba(255,71,87,0.30)' }}
          >
            {loading ? '登录中...' : '手机号一键登录'}
          </Button>
        )}

        {/* 次按钮：跳转到手机号密码登录 */}
        <Button
          variant="outline"
          className="w-full h-12 rounded-full text-base font-medium border-2 border-[#FFD6DC] text-[#FF4757] bg-white"
          onClick={() => setView('password')}
        >
          手机号登录/注册
        </Button>
      </View>

      {/* 协议勾选 */}
      <View className="mt-14">{renderAgreement}</View>
    </View>
  );
};

export default LoginPage;
