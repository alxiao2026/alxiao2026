import React, { useRef, useState } from 'react';
import { View, Text, Image } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Network } from '@/network';
import { uploadMiniAppImage } from '@/lib/upload-image';
import { ChevronLeft, Check, Camera, Phone, Lock, User } from 'lucide-react-taro';
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

  // 登录成功后的资料完善弹窗（微信头像 + 昵称）
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [wxAvatar, setWxAvatar] = useState(''); // 已上传到 TOS 的头像 URL
  const [wxAvatarLocal, setWxAvatarLocal] = useState(''); // chooseAvatar 返回的本地临时路径（预览用）
  const [wxNickname, setWxNickname] = useState('');
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const finishedRef = useRef(false);

  /** 登录流程收尾：提示并进入「我的」页面（防重入） */
  const finishLogin = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    Taro.showToast({ title: '登录成功', icon: 'success' });
    setTimeout(() => {
      Taro.reLaunch({ url: '/pages/user-center/index' });
    }, 500);
  };

  /** chooseAvatar 回调：拿到微信头像临时路径后立即上传 TOS */
  const handleChooseAvatar = async (e: { detail?: { avatarUrl?: string } }) => {
    const localPath = e.detail?.avatarUrl;
    console.log('[Login] chooseAvatar:', localPath);
    if (!localPath) return;
    setWxAvatarLocal(localPath);
    setAvatarUploading(true);
    try {
      // 优先 uploadFile 直传，失败自动降级 base64 通道（绕开真机域名白名单限制）
      const { url, errorMsg } = await uploadMiniAppImage(localPath);
      if (url) {
        setWxAvatar(url);
      } else {
        Taro.showToast({ title: errorMsg || '头像上传失败，可稍后再试', icon: 'none' });
      }
    } catch (err) {
      console.error('[Login] avatar upload error:', err);
      Taro.showToast({ title: '头像上传失败，可稍后再试', icon: 'none' });
    } finally {
      setAvatarUploading(false);
    }
  };

  /** 保存头像昵称到用户资料并收尾登录 */
  const handleSaveProfile = async () => {
    if (savingProfile) return;
    const userId = Taro.getStorageSync('user_id');
    const nickname = wxNickname.trim();
    if (!nickname && !wxAvatar) {
      finishLogin();
      return;
    }
    setSavingProfile(true);
    try {
      const body: Record<string, string> = {};
      if (nickname) body.nick_name = nickname;
      if (wxAvatar) body.avatar_url = wxAvatar;
      const res = await Network.request({ url: `/api/users/${userId}`, method: 'PUT', data: body });
      console.log('[Login] update profile response:', res.data);
      const rbody = res.data as { code?: number };
      if (rbody?.code === 200) {
        if (nickname) Taro.setStorageSync('nick_name', nickname);
        if (wxAvatar) Taro.setStorageSync('avatar_url', wxAvatar);
      }
    } catch (err) {
      console.error('[Login] update profile error:', err);
    } finally {
      setSavingProfile(false);
    }
    finishLogin();
  };

  const handleResponse = (res: { data: ApiResponse<LoginUser> }, options?: { skipProfileGuide?: boolean }) => {
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
      Taro.setStorageSync('login_via', 'page');
      Taro.setStorageSync('user_role', user.role);
      Taro.setStorageSync('role_code', user.role_code);
      Taro.setStorageSync('merchant_id', user.merchant_id || '');
      Taro.setStorageSync('user_phone', user.phone || '');
      Taro.setStorageSync('nick_name', user.nick_name || '');
      Taro.setStorageSync('avatar_url', user.avatar_url || '');

      // 资料缺失（无头像 / 无昵称 / 仍是系统随机昵称）时，引导完善微信头像昵称
      // 仅微信一键登录触发；密码登录直接进入个人中心，资料可在个人中心自行编辑
      const needProfile =
        !options?.skipProfileGuide &&
        isMiniApp &&
        (!user.avatar_url || !user.nick_name || String(user.nick_name).startsWith('邻居'));
      if (needProfile) {
        setProfileDialogOpen(true);
        return;
      }
      finishLogin();
    } else {
      // 透传后端真实错误（NestJS HTTP 错误返回 message 字段，业务信封返回 msg 字段）
      const errMsg = body?.msg || (body as { message?: string })?.message || '登录失败';
      Taro.showToast({ title: String(errMsg).slice(0, 30), icon: 'none' });
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
      handleResponse(res, { skipProfileGuide: true });
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

      {/* 登录成功后的微信资料完善弹窗（头像 + 昵称） */}
      <Dialog
        open={profileDialogOpen}
        onOpenChange={(open) => {
          if (!open) finishLogin();
        }}
      >
        <DialogContent className="rounded-3xl border-0 bg-white p-6">
          <View className="flex flex-col items-center w-full">
            <Text className="block text-lg font-bold text-gray-900 text-center">完善你的资料</Text>
            <Text className="block text-xs text-gray-400 text-center mt-1">
              头像和昵称将展示在团团活动中
            </Text>

            {/* 微信头像选择（chooseAvatar 默认提供微信头像） */}
            <View className="mt-6 mb-5 flex flex-col items-center">
              <Button
                plain
                openType="chooseAvatar"
                onChooseAvatar={handleChooseAvatar}
                className="w-20 h-20 rounded-full p-0 border-0 bg-transparent overflow-hidden"
              >
                {wxAvatarLocal ? (
                  <Image src={wxAvatarLocal} className="w-20 h-20 rounded-full" mode="aspectFill" />
                ) : (
                  <View className="w-20 h-20 rounded-full bg-[#FFF0F2] border-2 border-dashed border-[#FFB3BD] flex items-center justify-center">
                    <Camera size={28} color="#FF4757" />
                  </View>
                )}
              </Button>
              <Text className="block text-xs text-gray-400 text-center mt-2">
                {avatarUploading ? '头像上传中...' : '点圆圈选择微信头像'}
              </Text>
            </View>

            {/* 微信昵称输入（键盘上方可一键填入微信昵称） */}
            <InputGroup className="rounded-full h-11 border-2 border-[#FFD6DC] bg-white w-full">
              <InputGroupAddon align="inline-start" className="pl-3 pr-1">
                <User size={16} color="#FF4757" />
              </InputGroupAddon>
              <InputGroupInput
                type="nickname"
                className="text-gray-900"
                placeholder="点我填写微信昵称"
                placeholderClass="text-gray-400"
                value={wxNickname}
                onInput={(e) => setWxNickname(e.detail.value)}
              />
            </InputGroup>

            <Button
              className="w-full h-12 rounded-full text-base font-semibold text-white border-0 mt-5"
              style={{ background: 'linear-gradient(135deg, #FF4757 0%, #FF8A5C 100%)' }}
              disabled={savingProfile || avatarUploading}
              onClick={handleSaveProfile}
            >
              {savingProfile ? '保存中...' : '完成'}
            </Button>
            <Text className="block text-xs text-gray-400 text-center mt-3" onClick={finishLogin}>
              暂不设置，直接登录
            </Text>
          </View>
        </DialogContent>
      </Dialog>
    </View>
  );
};

export default LoginPage;
