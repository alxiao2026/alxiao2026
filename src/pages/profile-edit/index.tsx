import { View, Text, Image, ScrollView } from '@tarojs/components';
import { useState, useEffect } from 'react';
import Taro from '@tarojs/taro';
import { Network } from '@/network';
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

  const handleChooseAvatar = async () => {
    try {
      const res = await Taro.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera']
      });
      const tempFilePath = res.tempFilePaths[0];

      // 检查文件大小
      const fileInfo = await Taro.getFileInfo({ filePath: tempFilePath });
      const fileSize = (fileInfo as { size?: number }).size || 0;
      if (fileSize > 5 * 1024 * 1024) {
        Taro.showToast({ title: '图片不能超过5MB', icon: 'none' });
        return;
      }

      Taro.showLoading({ title: '上传中...' });
      try {
        const uploadRes = await Network.uploadFile({
          url: '/api/upload/image',
          filePath: tempFilePath,
          name: 'file'
        });
        const data = JSON.parse(uploadRes.data);
        console.log('[ProfileEdit] upload:', data);
        if (data.code === 200 && data.data?.url) {
          setAvatarUrl(data.data.url);
          Taro.showToast({ title: '头像已更新', icon: 'success' });
        } else {
          Taro.showToast({ title: '上传失败', icon: 'none' });
        }
      } catch (e) {
        console.error('上传头像失败:', e);
        Taro.showToast({ title: '上传失败', icon: 'none' });
      } finally {
        Taro.hideLoading();
      }
    } catch {
      // 用户取消选择
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
          <View className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-red-500 flex items-center justify-center border-2 border-white">
            <Camera size={14} color="#FFFFFF" />
          </View>
        </View>
        <Text className="text-sm text-gray-400 mt-3">点击更换头像</Text>
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
                <Text className={`text-sm font-medium ${gender === opt.value ? 'text-red-500' : 'text-gray-500'}`}>
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
          className="w-full bg-red-500 text-white rounded-full py-3 border-0"
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
