import { useState } from 'react';
import Taro, { useDidShow } from '@tarojs/taro';
import { View, Text } from '@tarojs/components';
import {
  Bell,
  BellOff,
  Wallet,
  ShoppingBag,
  CircleCheck,
  Clock,
  Gift,
  RotateCcw,
  Share2,
  Ticket,
  CheckCheck,
} from 'lucide-react-taro';
import { Network } from '@/network';
import { Button } from '@/components/ui/button';

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

const TYPE_CONFIG: Record<string, { icon: any; color: string; bg: string }> = {
  withdraw_arrived: { icon: Wallet, color: '#10b981', bg: '#ecfdf5' },
  withdraw_submitted: { icon: Wallet, color: '#3b82f6', bg: '#eff6ff' },
  order_created: { icon: ShoppingBag, color: '#8b5cf6', bg: '#f5f3ff' },
  order_paid: { icon: ShoppingBag, color: '#10b981', bg: '#ecfdf5' },
  order_verified: { icon: CircleCheck, color: '#10b981', bg: '#ecfdf5' },
  order_expiring: { icon: Clock, color: '#f59e0b', bg: '#fffbeb' },
  coupon_expiring: { icon: Ticket, color: '#f59e0b', bg: '#fffbeb' },
  prize_expiring: { icon: Clock, color: '#f59e0b', bg: '#fffbeb' },
  prize_won: { icon: Gift, color: '#ec4899', bg: '#fdf2f8' },
  prize_redeemed: { icon: Gift, color: '#10b981', bg: '#ecfdf5' },
  merchant_refund_success: { icon: RotateCcw, color: '#ef4444', bg: '#fef2f2' },
  customer_refund_success: { icon: RotateCcw, color: '#ef4444', bg: '#fef2f2' },
  share_success: { icon: Share2, color: '#8b5cf6', bg: '#f5f3ff' },
};

const DEFAULT_CONFIG = { icon: Bell, color: '#6b7280', bg: '#f3f4f6' };

function formatTime(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  if (isToday) return `${hh}:${mm}`;
  return `${d.getMonth() + 1}-${String(d.getDate()).padStart(2, '0')} ${hh}:${mm}`;
}

export default function NotificationCenterPage() {
  const [list, setList] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    const userId = Taro.getStorageSync('user_id');
    if (!userId) {
      setLoading(false);
      return;
    }
    try {
      const [listRes, countRes] = await Promise.all([
        Network.request({ url: `/api/notifications?user_id=${userId}&pageSize=50` }),
        Network.request({ url: `/api/notifications/unread-count?user_id=${userId}` }),
      ]);
      console.log('通知列表响应:', listRes.data);
      console.log('未读数响应:', countRes.data);
      const listData = (listRes.data as any)?.data;
      setList(listData?.list || []);
      setUnread((countRes.data as any)?.data?.count || 0);
    } catch (e) {
      console.error('加载通知失败:', e);
    } finally {
      setLoading(false);
    }
  };

  useDidShow(() => {
    fetchData();
  });

  const markRead = async (item: NotificationItem) => {
    if (item.is_read) return;
    const userId = Taro.getStorageSync('user_id');
    setList((prev) => prev.map((n) => (n.id === item.id ? { ...n, is_read: true } : n)));
    setUnread((prev) => Math.max(0, prev - 1));
    try {
      await Network.request({
        url: `/api/notifications/${item.id}/read`,
        method: 'POST',
        data: { user_id: userId },
      });
    } catch (e) {
      console.error('标记已读失败:', e);
    }
  };

  const markAllRead = async () => {
    const userId = Taro.getStorageSync('user_id');
    if (!userId || unread === 0) return;
    setList((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnread(0);
    try {
      await Network.request({
        url: '/api/notifications/read-all',
        method: 'POST',
        data: { user_id: userId },
      });
    } catch (e) {
      console.error('全部已读失败:', e);
    }
  };

  return (
    <View className="min-h-screen bg-gray-50 pb-8">
      {/* 顶部统计栏 */}
      <View className="bg-white px-4 py-3 flex flex-row items-center justify-between">
        <View className="flex flex-row items-center gap-2">
          <Bell size={18} color="#FF4757" />
          <Text className="text-sm text-gray-600">
            {unread > 0 ? `${unread} 条未读消息` : '没有未读消息'}
          </Text>
        </View>
        {unread > 0 && (
          <Button
            size="sm"
            variant="ghost"
            className="text-[#FF4757]"
            onClick={markAllRead}
          >
            <View className="flex flex-row items-center gap-1">
              <CheckCheck size={14} color="#FF4757" />
              <Text className="text-xs text-[#FF4757]">全部已读</Text>
            </View>
          </Button>
        )}
      </View>

      {loading ? (
        <View className="flex items-center justify-center py-20">
          <Text className="text-sm text-gray-400">加载中...</Text>
        </View>
      ) : list.length === 0 ? (
        <View className="flex flex-col items-center justify-center py-24">
          <BellOff size={48} color="#d1d5db" />
          <Text className="block text-sm text-gray-400 mt-4">暂无消息通知</Text>
          <Text className="block text-xs text-gray-300 mt-1">下单、中奖、退款等消息会在这里提醒你</Text>
        </View>
      ) : (
        <View className="px-3 pt-3">
          {list.map((item) => {
            const cfg = TYPE_CONFIG[item.type] || DEFAULT_CONFIG;
            const IconComp = cfg.icon;
            return (
              <View
                key={item.id}
                className="bg-white rounded-xl p-3 mb-2 flex flex-row gap-3"
                onClick={() => markRead(item)}
              >
                <View
                  className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                  style={{ backgroundColor: cfg.bg }}
                >
                  <IconComp size={20} color={cfg.color} />
                </View>
                <View className="flex-1 min-w-0">
                  <View className="flex flex-row items-center justify-between">
                    <View className="flex flex-row items-center gap-1 flex-1 min-w-0">
                      {!item.is_read && (
                        <View className="w-2 h-2 rounded-full bg-[#FF4757] shrink-0" />
                      )}
                      <Text
                        className={`text-sm truncate ${
                          item.is_read ? 'text-gray-500' : 'text-gray-800 font-medium'
                        }`}
                      >
                        {item.title}
                      </Text>
                    </View>
                    <Text className="text-xs text-gray-300 ml-2 shrink-0">
                      {formatTime(item.created_at)}
                    </Text>
                  </View>
                  <Text
                    className={`block text-xs mt-1 ${
                      item.is_read ? 'text-gray-400' : 'text-gray-500'
                    }`}
                  >
                    {item.content}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}
