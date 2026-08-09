import { View, Text, Image, ScrollView } from '@tarojs/components';
import { useState, useEffect } from 'react';
import Taro from '@tarojs/taro';
import { Network } from '@/network';
import { uploadMiniAppImage } from '@/lib/upload-image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Camera, User } from 'lucide-react-taro';

interface UserProfile {
  user_id: string;
  nick_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  gender: string;
  birthday: string | null;
}

const ProfileEditPage = () => {
  const [userId, setUserId] = useState('');
  const [nickName, setNickName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState('unknown');
  const [birthday, setBirthday] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const savedUserId = Taro.getStorageSync('user_id');
    if (!savedUserId) {
      Taro.showToast({ title: '请先登录', icon: 'none' });
      setLoading(false);
      return;
    }
    setUserId(savedUserId);

    const fetchProfile = async () => {
      try {
        const res = await Network.request({ url: `/api/users/${savedUserId}` });
        console.log('[ProfileEdit] profile:', res.data);
        if (res.data?.code === 200 && res.data?.data) {
          const p = res.data.data as UserProfile;
          setNickName(p.nick_name || '');
          setAvatarUrl(p.avatar_url || '');
          setPhone(p.phone || '');
          setGender(p.gender || 'unknown');
          setBirthday(p.birthday || '');
        }
      } catch (e) {
        console.error('获取用户信息失败:', e);
        // fallback to storage
        setNickName(Taro.getStorageSync('nick_name') || '');
        setAvatarUrl(Taro.getStorageSync('avatar_url') || '');
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  // 图片大小限制：5MB
  const MAX_IMAGE_SIZE = 5 * 1024 * 1024

  const checkImageSize = (size: number): boolean => {
    if (size > MAX_IMAGE_SIZE) {
      const sizeMB = (size / 1024 / 1024).toFixed(1)
      Taro.showModal({
        title: '图片过大',
        content: `当前图片 ${sizeMB}MB，超过 5MB 限制。建议选择 5MB 以内的图片，或使用图片压缩工具减小体积后重试。`,
        showCancel: false,
        confirmText: '知道了'
      })
      return false
    }
    return true
  }

  // 后端 Multer 限制 10MB
  const BACKEND_MAX_SIZE = 10 * 1024 * 1024

  // 小程序端：超过 5MB 的图片先自动压缩再上传
  // 压缩失败但原图在后端 10MB 限制内时，直接用原图上传
  const prepareUploadImage = async (
    filePath: string,
    size: number
  ): Promise<{ path: string; size: number } | null> => {
    if (size <= MAX_IMAGE_SIZE) return { path: filePath, size }
    let curPath = filePath
    let curSize = size
    for (const quality of [70, 40]) {
      try {
        const res = await Taro.compressImage({ src: curPath, quality })
        const info = await Taro.getFileInfo({ filePath: res.tempFilePath })
        curPath = res.tempFilePath
        curSize = (info as { size?: number }).size || 0
        console.log(`[ProfileEdit] 压缩图片 q=${quality}: ${(size / 1048576).toFixed(1)}MB -> ${(curSize / 1048576).toFixed(2)}MB`)
        if (curSize <= MAX_IMAGE_SIZE) return { path: curPath, size: curSize }
      } catch (e) {
        console.error('[ProfileEdit] 压缩图片失败，尝试用原图上传:', e)
        break
      }
    }
    // 压缩失败或仍超 5MB，但原图在后端 10MB 限制内 → 直接用原图
    if (size <= BACKEND_MAX_SIZE) {
      console.log('[ProfileEdit] 压缩未达标但原图在后端限制内，直接上传原图')
      return { path: filePath, size }
    }
    return null
  }

  const handleChooseAvatar = async () => {
    console.log('[ProfileEdit] 点击更换头像, env:', Taro.getEnv());
    // 上传周期内禁止重复触发
    if (uploading) return;
    const isH5 = Taro.getEnv() === Taro.ENV_TYPE.WEB;

    if (isH5) {
      // H5 端：手动创建 file input
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.style.display = 'none';
      document.body.appendChild(input);
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        input.remove();
        if (!file) return;
        if (!checkImageSize(file.size)) return;
        await uploadAvatarH5(file);
      };
      input.click();
      return;
    }

    // 小程序端：使用 chooseMedia（chooseImage 已废弃，部分安卓机选图后会回收小程序导致重启跳首页）
    try {
      const res = await Taro.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sizeType: ['compressed'],
        sourceType: ['album', 'camera']
      });
      const tempFile = res.tempFiles[0];
      if (!tempFile) return;
      // 大图先自动压缩再上传
      const prepared = await prepareUploadImage(tempFile.tempFilePath, tempFile.size);
      if (!prepared) {
        Taro.showModal({
          title: '图片过大',
          content: '图片压缩后仍超过 5MB 限制，建议裁剪图片或更换其他图片后重试。',
          showCancel: false,
          confirmText: '知道了'
        });
        return;
      }
      await uploadAvatarMini(prepared.path);
    } catch (err) {
      const errMsg = (err as { errMsg?: string })?.errMsg || '';
      // 用户取消选择不提示
      if (errMsg.includes('cancel')) return;
      console.error('[ProfileEdit] chooseMedia error:', err);
      Taro.showToast({ title: '选择图片失败，请重试', icon: 'none' });
    }
  };

  const uploadAvatarMini = async (tempFilePath: string) => {
    setUploading(true);
    Taro.showLoading({ title: '上传中...', mask: true });
    try {
      // 优先 uploadFile 直传，失败自动降级 base64 通道（绕开真机域名白名单限制）
      const { url, errorMsg } = await uploadMiniAppImage(tempFilePath);
      if (url) {
        setAvatarUrl(url);
        Taro.showToast({ title: '头像已更新', icon: 'success' });
      } else {
        Taro.showToast({ title: errorMsg || '上传失败，请重试', icon: 'none' });
      }
    } catch (e) {
      console.error('上传头像失败:', e);
      Taro.showToast({ title: '上传失败，请检查网络后重试', icon: 'none' });
    } finally {
      Taro.hideLoading();
      setUploading(false);
    }
  };

  const uploadAvatarH5 = async (file: File) => {
    setUploading(true);
    Taro.showLoading({ title: '上传中...', mask: true });
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      console.log('[ProfileEdit] H5 upload:', data);
      if (data.code === 200 && data.data?.url) {
        setAvatarUrl(data.data.url);
        Taro.showToast({ title: '头像已更新', icon: 'success' });
      } else {
        Taro.showToast({ title: data.msg || '上传失败，请重试', icon: 'none' });
      }
    } catch (e) {
      console.error('H5上传头像失败:', e);
      Taro.showToast({ title: '上传失败，请检查网络后重试', icon: 'none' });
    } finally {
      Taro.hideLoading();
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!userId) return;
    setSaving(true);
    try {
      const res = await Network.request({
        url: `/api/users/${userId}`,
        method: 'PUT',
        data: {
          nick_name: nickName || undefined,
          avatar_url: avatarUrl || undefined,
          phone: phone || undefined,
          gender,
          birthday: birthday || undefined
        }
      });
      console.log('[ProfileEdit] save:', res.data);
      if (res.data?.code === 200) {
        // 同步到本地存储
        Taro.setStorageSync('nick_name', nickName);
        Taro.setStorageSync('avatar_url', avatarUrl);
        Taro.showToast({ title: '保存成功', icon: 'success' });
        setTimeout(() => Taro.navigateBack(), 800);
      } else {
        Taro.showToast({ title: '保存失败', icon: 'none' });
      }
    } catch (e) {
      console.error('保存失败:', e);
      Taro.showToast({ title: '保存失败', icon: 'none' });
    } finally {
      setSaving(false);
    }
  };

  const genderOptions = [
    { value: 'unknown', label: '保密' },
    { value: 'male', label: '男' },
    { value: 'female', label: '女' }
  ];

  if (loading) {
    return (
      <View className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Text className="text-gray-400">加载中...</Text>
      </View>
    );
  }

  return (
    <ScrollView scrollY className="min-h-screen bg-gray-50">
      {/* 头像区域 */}
      <View className="bg-white px-4 py-8 flex flex-col items-center">
        <View className="relative" onClick={handleChooseAvatar}>
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              className="w-24 h-24 rounded-full"
              mode="aspectFill"
            />
          ) : (
            <View className="w-24 h-24 rounded-full bg-gray-100 flex items-center justify-center">
              <User size={40} color="#D1D5DB" />
            </View>
          )}
          <View className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-[#FF4757] flex items-center justify-center border-2 border-white">
            <Camera size={14} color="#FFFFFF" />
          </View>
        </View>
        <Text className="text-sm text-gray-400 mt-3">点击更换头像</Text>
        <Text className="text-xs text-gray-300 mt-1">支持 JPG/PNG，不超过 5MB</Text>
      </View>

      {/* 表单区域 */}
      <View className="mx-4 mt-4 bg-white rounded-2xl overflow-hidden">
        {/* 昵称 */}
        <View className="px-4 py-4 border-b border-gray-50">
          <Text className="text-sm text-gray-500 block mb-2">昵称</Text>
          <View className="bg-gray-50 rounded-xl px-4 py-3">
            <Input
              className="w-full bg-transparent text-sm"
              placeholder="请输入昵称"
              value={nickName}
              onInput={(e) => setNickName(e.detail.value)}
              maxlength={20}
            />
          </View>
        </View>

        {/* 手机号 */}
        <View className="px-4 py-4 border-b border-gray-50">
          <Text className="text-sm text-gray-500 block mb-2">手机号</Text>
          <View className="bg-gray-50 rounded-xl px-4 py-3">
            <Input
              className="w-full bg-transparent text-sm"
              placeholder="请输入手机号"
              type="number"
              value={phone}
              onInput={(e) => setPhone(e.detail.value)}
              maxlength={11}
            />
          </View>
        </View>

        {/* 性别 */}
        <View className="px-4 py-4 border-b border-gray-50">
          <Text className="text-sm text-gray-500 block mb-3">性别</Text>
          <View className="flex flex-row gap-3">
            {genderOptions.map((opt) => (
              <View
                key={opt.value}
                className={`flex-1 py-2 rounded-xl flex items-center justify-center ${
                  gender === opt.value ? 'bg-red-50 border border-red-200' : 'bg-gray-50'
                }`}
                onClick={() => setGender(opt.value)}
              >
                <Text className={`text-sm font-medium ${gender === opt.value ? 'text-[#FF4757]' : 'text-gray-500'}`}>
                  {opt.label}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* 生日 */}
        <View className="px-4 py-4">
          <Text className="text-sm text-gray-500 block mb-2">生日</Text>
          <View className="bg-gray-50 rounded-xl px-4 py-3">
            <Input
              className="w-full bg-transparent text-sm"
              placeholder="格式：1990-01-01"
              value={birthday}
              onInput={(e) => setBirthday(e.detail.value)}
              maxlength={10}
            />
          </View>
        </View>
      </View>

      {/* 保存按钮 */}
      <View className="mx-4 mt-6 mb-8">
        <Button
          className="w-full bg-[#FF4757] text-white rounded-full py-3 border-0"
          disabled={saving}
          onClick={handleSave}
        >
          <Text className="text-white font-semibold">{saving ? '保存中...' : '保存修改'}</Text>
        </Button>
      </View>
    </ScrollView>
  );
};

export default ProfileEditPage;
