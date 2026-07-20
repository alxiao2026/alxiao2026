import { Injectable, NotFoundException } from '@nestjs/common';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export interface User {
  id: string;
  user_id: string;
  nick_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  password: string | null;
  login_type: string;
  open_id: string | null;
  gender: string;
  birthday: string | null;
  member_level: string;
  points: number;
  total_orders: number;
  total_spent: string;
  is_active: boolean;
  role: 'consumer' | 'merchant';
  merchant_id: number | null;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MerchantInfo {
  id: number;
  name: string;
  address: string | null;
  phone: string | null;
  logo: string | null;
}

export interface UserStats {
  total_orders: number;
  pending_orders: number;
  used_orders: number;
  refunded_orders: number;
  total_spent: string;
  total_saved: string;
}

export interface UpdateUserBody {
  nick_name?: string;
  avatar_url?: string;
  phone?: string;
  gender?: string;
  birthday?: string;
}

@Injectable()
export class UserService {
  /** 获取或创建用户 */
  async getOrCreate(userId: string, nickName?: string, avatarUrl?: string): Promise<User> {
    const supabase = getSupabaseClient();
    const { data: existing } = await supabase
      .from('users')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (existing) {
      // 更新最后登录时间
      const { data: updated, error } = await supabase
        .from('users')
        .update({
          last_login_at: new Date().toISOString(),
          ...(nickName && { nick_name: nickName }),
          ...(avatarUrl && { avatar_url: avatarUrl })
        })
        .eq('user_id', userId)
        .select()
        .single();
      if (error) throw error;
      return updated as User;
    }

    const { data: created, error } = await supabase
      .from('users')
      .insert({
        user_id: userId,
        nick_name: nickName || null,
        avatar_url: avatarUrl || null,
        last_login_at: new Date().toISOString()
      })
      .select()
      .single();
    if (error) throw error;
    return created as User;
  }

  /** 手机号+密码登录（有记录直接登录，无记录自动注册） */
  async loginByPassword(phone: string, password: string, nickName?: string): Promise<User> {
    const supabase = getSupabaseClient();
    const { data: existing } = await supabase
      .from('users')
      .select('*')
      .eq('phone', phone)
      .single();

    if (existing) {
      if (existing.password && existing.password !== password) {
        throw new NotFoundException('密码错误');
      }
      const updateData: Record<string, unknown> = {
        last_login_at: new Date().toISOString()
      };
      if (!existing.password) {
        updateData.password = password;
      }
      if (nickName && !existing.nick_name) {
        updateData.nick_name = nickName;
      }
      const { data: updated, error } = await supabase
        .from('users')
        .update(updateData)
        .eq('user_id', existing.user_id)
        .select()
        .single();
      if (error) throw error;
      return updated as User;
    }

    const userId = `user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const { data: created, error } = await supabase
      .from('users')
      .insert({
        user_id: userId,
        phone: phone,
        password: password,
        nick_name: nickName || null,
        login_type: 'password',
        last_login_at: new Date().toISOString()
      })
      .select()
      .single();
    if (error) throw error;
    return created as User;
  }

  /** 手机验证码登录（有记录直接登录，无记录自动注册） */
  async loginBySms(phone: string, code: string, nickName?: string): Promise<User> {
    if (code !== '8888' && !/^\d{4,6}$/.test(code)) {
      throw new NotFoundException('验证码不正确');
    }

    const supabase = getSupabaseClient();
    const { data: existing } = await supabase
      .from('users')
      .select('*')
      .eq('phone', phone)
      .single();

    if (existing) {
      const updateData: Record<string, unknown> = {
        last_login_at: new Date().toISOString()
      };
      if (nickName && !existing.nick_name) {
        updateData.nick_name = nickName;
      }
      const { data: updated, error } = await supabase
        .from('users')
        .update(updateData)
        .eq('user_id', existing.user_id)
        .select()
        .single();
      if (error) throw error;
      return updated as User;
    }

    const userId = `user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const { data: created, error } = await supabase
      .from('users')
      .insert({
        user_id: userId,
        phone: phone,
        nick_name: nickName || null,
        login_type: 'sms',
        last_login_at: new Date().toISOString()
      })
      .select()
      .single();
    if (error) throw error;
    return created as User;
  }

  /** 微信授权登录（有记录直接登录，无记录自动注册） */
  async loginByWechat(openId: string, nickName?: string, avatarUrl?: string): Promise<User> {
    const supabase = getSupabaseClient();
    const { data: existing } = await supabase
      .from('users')
      .select('*')
      .eq('open_id', openId)
      .single();

    if (existing) {
      const updateData: Record<string, unknown> = {
        last_login_at: new Date().toISOString()
      };
      if (nickName) updateData.nick_name = nickName;
      if (avatarUrl) updateData.avatar_url = avatarUrl;
      const { data: updated, error } = await supabase
        .from('users')
        .update(updateData)
        .eq('user_id', existing.user_id)
        .select()
        .single();
      if (error) throw error;
      return updated as User;
    }

    const userId = `user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const { data: created, error } = await supabase
      .from('users')
      .insert({
        user_id: userId,
        open_id: openId,
        nick_name: nickName || null,
        avatar_url: avatarUrl || null,
        login_type: 'wechat',
        last_login_at: new Date().toISOString()
      })
      .select()
      .single();
    if (error) throw error;
    return created as User;
  }

  /** 根据 user_id 获取用户 */
  async findByUserId(userId: string): Promise<User> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('user_id', userId)
      .single();
    if (error || !data) throw new NotFoundException('用户不存在');
    return data as User;
  }

  /** 更新用户资料 */
  async update(userId: string, body: UpdateUserBody): Promise<User> {
    const supabase = getSupabaseClient();
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString()
    };
    if (body.nick_name !== undefined) updateData.nick_name = body.nick_name;
    if (body.avatar_url !== undefined) updateData.avatar_url = body.avatar_url;
    if (body.phone !== undefined) updateData.phone = body.phone;
    if (body.gender !== undefined) updateData.gender = body.gender;
    if (body.birthday !== undefined) updateData.birthday = body.birthday;

    const { data, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('user_id', userId)
      .select()
      .single();
    if (error || !data) throw new NotFoundException('用户不存在');
    return data as User;
  }

  /** 绑定门店（商家用户） */
  async bindMerchant(userId: string, merchantId: number): Promise<User> {
    const supabase = getSupabaseClient();
    // 验证门店存在
    const { data: merchant } = await supabase
      .from('merchants')
      .select('id, name')
      .eq('id', merchantId)
      .single();
    if (!merchant) throw new NotFoundException('门店不存在');

    const { data, error } = await supabase
      .from('users')
      .update({
        role: 'merchant',
        merchant_id: merchantId,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .select()
      .single();
    if (error || !data) throw new NotFoundException('用户不存在');
    return data as User;
  }

  /** 解绑门店（变回消费者） */
  async unbindMerchant(userId: string): Promise<User> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('users')
      .update({
        role: 'consumer',
        merchant_id: null,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .select()
      .single();
    if (error || !data) throw new NotFoundException('用户不存在');
    return data as User;
  }

  /** 获取用户关联的门店信息 */
  async getMerchantInfo(userId: string): Promise<MerchantInfo | null> {
    const supabase = getSupabaseClient();
    const { data: user } = await supabase
      .from('users')
      .select('merchant_id, role')
      .eq('user_id', userId)
      .single();
    if (!user || user.role !== 'merchant' || !user.merchant_id) return null;

    const { data: merchant } = await supabase
      .from('merchants')
      .select('id, name, address, phone, logo')
      .eq('id', user.merchant_id)
      .single();
    return merchant as MerchantInfo | null;
  }

  /** 获取所有门店列表 */
  async getMerchantList(): Promise<MerchantInfo[]> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('merchants')
      .select('id, name, address, phone, logo')
      .order('id');
    if (error) throw error;
    return (data || []) as MerchantInfo[];
  }

  /** 获取商家统计数据 */
  async getMerchantStats(userId: string): Promise<{
    totalSales: number;
    totalOrders: number;
    totalRevenue: string;
    verifiedAmount: string;
    verifiedCount: number;
    prizeCount: number;
    todaySales: number;
    todayOrders: number;
    todayRevenue: string;
    todayVerifiedAmount: string;
    todayVerifiedCount: number;
  }> {
    const supabase = getSupabaseClient();

    // 获取用户关联的 merchant_id
    const { data: user } = await supabase
      .from('users')
      .select('merchant_id, role')
      .eq('user_id', userId)
      .single();
    if (!user || user.role !== 'merchant' || !user.merchant_id) {
      return {
        totalSales: 0, totalOrders: 0, totalRevenue: '0.00',
        verifiedAmount: '0.00', verifiedCount: 0, prizeCount: 0,
        todaySales: 0, todayOrders: 0, todayRevenue: '0.00',
        todayVerifiedAmount: '0.00', todayVerifiedCount: 0
      };
    }

    const merchantId = user.merchant_id;

    // 获取该商家所有套餐
    const { data: packages } = await supabase
      .from('packages')
      .select('id')
      .eq('merchant_id', merchantId);
    const packageIds = (packages || []).map(p => p.id);

    if (packageIds.length === 0) {
      return {
        totalSales: 0, totalOrders: 0, totalRevenue: '0.00',
        verifiedAmount: '0.00', verifiedCount: 0, prizeCount: 0,
        todaySales: 0, todayOrders: 0, todayRevenue: '0.00',
        todayVerifiedAmount: '0.00', todayVerifiedCount: 0
      };
    }

    // 获取该商家所有订单
    const { data: allOrders } = await supabase
      .from('orders')
      .select('status, price, quantity, verified_count, created_at')
      .in('package_id', packageIds);
    const orders = allOrders || [];

    // 总售卖数据
    const totalOrders = orders.length;
    const totalSales = orders.reduce((sum, o) => sum + (Number(o.quantity) || 1), 0);
    const totalRevenue = orders.reduce((sum, o) => sum + Number(o.price || 0), 0).toFixed(2);

    // 核销数据
    const verifiedOrders = orders.filter(o => o.status === 'used' || o.status === 'refunded');
    const verifiedCount = orders.reduce((sum, o) => sum + (Number(o.verified_count) || 0), 0);
    const verifiedAmount = verifiedOrders
      .filter(o => o.status === 'used')
      .reduce((sum, o) => sum + Number(o.price || 0), 0).toFixed(2);

    // 奖品发放数量（从 orders 中统计 shared=true 的）
    const prizeOrders = orders.filter(o => (o as any).shared === true);
    const prizeCount = prizeOrders.length;

    // 今日数据
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayOrdersList = orders.filter(o => o.created_at >= todayStr);
    const todayOrders = todayOrdersList.length;
    const todaySales = todayOrdersList.reduce((sum, o) => sum + (Number(o.quantity) || 1), 0);
    const todayRevenue = todayOrdersList.reduce((sum, o) => sum + Number(o.price || 0), 0).toFixed(2);
    const todayVerified = todayOrdersList.filter(o => o.status === 'used' || o.status === 'refunded');
    const todayVerifiedCount = todayOrdersList.reduce((sum, o) => sum + (Number(o.verified_count) || 0), 0);
    const todayVerifiedAmount = todayVerified
      .filter(o => o.status === 'used')
      .reduce((sum, o) => sum + Number(o.price || 0), 0).toFixed(2);

    return {
      totalSales,
      totalOrders,
      totalRevenue,
      verifiedAmount,
      verifiedCount,
      prizeCount,
      todaySales,
      todayOrders,
      todayRevenue,
      todayVerifiedAmount,
      todayVerifiedCount
    };
  }

  /** 获取用户订单统计 */
  async getStats(userId: string): Promise<UserStats> {
    const supabase = getSupabaseClient();
    const { data: orders, error } = await supabase
      .from('orders')
      .select('status, price, original_price')
      .eq('user_id', userId);
    if (error) throw error;

    const orderList = orders || [];
    let totalSpent = 0;
    let totalSaved = 0;
    let pending = 0;
    let used = 0;
    let refunded = 0;

    for (const order of orderList) {
      const price = parseFloat(order.price) || 0;
      const originalPrice = parseFloat(order.original_price || '0') || 0;
      totalSpent += price;
      totalSaved += Math.max(0, originalPrice - price);

      switch (order.status) {
        case 'pending': pending++; break;
        case 'used': used++; break;
        case 'refunded': refunded++; break;
      }
    }

    return {
      total_orders: orderList.length,
      pending_orders: pending,
      used_orders: used,
      refunded_orders: refunded,
      total_spent: totalSpent.toFixed(2),
      total_saved: totalSaved.toFixed(2)
    };
  }
}
