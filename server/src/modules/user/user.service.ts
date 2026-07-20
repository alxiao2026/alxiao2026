import { Injectable, NotFoundException } from '@nestjs/common';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export interface User {
  id: string;
  user_id: string;
  nick_name: string | null;
  avatar_url: string | null;
  phone: string | null;
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
