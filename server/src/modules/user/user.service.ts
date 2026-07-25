import { Injectable, NotFoundException } from '@nestjs/common';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 角色编码：0=普通消费者，1=商家用户，2=系统管理员
export const ROLE_CONSUMER = 0;
export const ROLE_MERCHANT = 1;
export const ROLE_ADMIN = 2;

export function roleToCode(role: string): number {
  if (role === 'merchant') return ROLE_MERCHANT;
  if (role === 'admin') return ROLE_ADMIN;
  return ROLE_CONSUMER;
}

export interface UserPermissions {
  role_code: number;
  role: string;
  merchant_id: number | null;
  can_access_admin: boolean;      // 是否可访问管理后台（商家或管理员）
  can_view_all_merchants: boolean; // 是否可查看全平台数据（仅管理员）
  can_manage_own_store: boolean;   // 是否可管理本店（仅商家）
}

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
  role: 'consumer' | 'merchant' | 'admin';
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

  /** 获取用户权限信息（前端仅做显示/隐藏控制） */
  async getUserPermissions(userId: string): Promise<UserPermissions> {
    const supabase = getSupabaseClient();
    const { data: user } = await supabase
      .from('users')
      .select('role, merchant_id')
      .eq('user_id', userId)
      .single();

    const role = user?.role || 'consumer';
    const merchantId = user?.merchant_id || null;
    const roleCode = roleToCode(role);

    return {
      role_code: roleCode,
      role,
      merchant_id: merchantId,
      can_access_admin: roleCode === ROLE_MERCHANT || roleCode === ROLE_ADMIN,
      can_view_all_merchants: roleCode === ROLE_ADMIN,
      can_manage_own_store: roleCode === ROLE_MERCHANT && merchantId !== null,
    };
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
    todayLotteryUsers: number;
    todayRefundAmount: string;
    todayFreeMealWinners: number;
  }> {
    const supabase = getSupabaseClient();

    // 获取用户关联的 merchant_id
    const { data: user } = await supabase
      .from('users')
      .select('merchant_id, role')
      .eq('user_id', userId)
      .single();

    let orders: any[] = [];
    let merchantOrderIds: Set<string> | null = null;

    if (user && user.role === 'merchant' && user.merchant_id) {
      // 商家用户：只统计关联门店的数据
      const merchantId = user.merchant_id;
      const { data: packages } = await supabase
        .from('packages')
        .select('id')
        .eq('merchant_id', merchantId);
      const packageIds = (packages || []).map(p => p.id);

      if (packageIds.length > 0) {
        const { data: allOrders } = await supabase
          .from('orders')
          .select('id, status, price, quantity, verified_count, created_at')
          .in('package_id', packageIds);
        orders = allOrders || [];
        merchantOrderIds = new Set(orders.map(o => o.id));
      } else {
        merchantOrderIds = new Set();
      }
    } else if (user && user.role === 'admin') {
      // 系统管理员：返回全平台统计数据
      const { data: allOrders } = await supabase
        .from('orders')
        .select('status, price, quantity, verified_count, created_at');
      orders = allOrders || [];
    } else {
      // 普通消费者：无权限查看商家统计，返回空数据
      orders = [];
    }

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

    // 今日数据（使用本地时区）
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const todayOrdersList = orders.filter(o => {
      const d = new Date(o.created_at);
      const orderDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return orderDate === todayStr;
    });
    const todayOrders = todayOrdersList.length;
    const todaySales = todayOrdersList.reduce((sum, o) => sum + (Number(o.quantity) || 1), 0);
    const todayRevenue = todayOrdersList.reduce((sum, o) => sum + Number(o.price || 0), 0).toFixed(2);
    const todayVerified = todayOrdersList.filter(o => o.status === 'used' || o.status === 'refunded');
    const todayVerifiedCount = todayOrdersList.reduce((sum, o) => sum + (Number(o.verified_count) || 0), 0);
    const todayVerifiedAmount = todayVerified
      .filter(o => o.status === 'used')
      .reduce((sum, o) => sum + Number(o.price || 0), 0).toFixed(2);

    // 今日抽奖统计（抽奖人数 / 返还金额 / 霸王餐中奖人数）
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const { data: todayLotteryRows } = await supabase
      .from('lottery_records')
      .select('order_id, user_id, refund_amount, is_winner, created_at, prizes(prize_type)')
      .gte('created_at', todayStart.toISOString());
    const todayLotteryRecords = (todayLotteryRows || []).filter((r: any) => {
      const d = new Date(r.created_at);
      const recordDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (recordDate !== todayStr) return false;
      // 商家用户只统计自己门店订单产生的抽奖记录
      if (merchantOrderIds && !merchantOrderIds.has(r.order_id)) return false;
      return true;
    });
    const todayLotteryUsers = new Set(todayLotteryRecords.map((r: any) => r.user_id)).size;
    const isFreeMeal = (r: any) => {
      const prizeType = Array.isArray(r.prizes) ? r.prizes[0]?.prize_type : r.prizes?.prize_type;
      return prizeType === 'free_meal';
    };
    const todayFreeMealRecords = todayLotteryRecords.filter((r: any) => r.is_winner && isFreeMeal(r));
    // 中奖人数按去重用户统计（同一用户多次中奖只算 1 人）
    const todayFreeMealWinners = new Set(todayFreeMealRecords.map((r: any) => r.user_id)).size;
    const todayRefundAmount = todayFreeMealRecords
      .reduce((sum: number, r: any) => sum + Number(r.refund_amount || 0), 0)
      .toFixed(2);

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
      todayVerifiedCount,
      todayLotteryUsers,
      todayRefundAmount,
      todayFreeMealWinners
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

  /**
   * 获取综合统计数据（支持时间筛选）
   */
  async getOverviewStats(query: { start_date?: string; end_date?: string }): Promise<{
    total_users: number;
    consumers: number;
    merchants: number;
    packages_count: number;
    prizes_count: number;
    merchants_count: number;
  }> {
    const { start_date, end_date } = query;

    // 构建时间筛选条件
    let dateFilter: any = {};
    if (start_date) {
      dateFilter.created_at = { $gte: new Date(start_date).toISOString() };
    }
    if (end_date) {
      const endDate = new Date(end_date);
      endDate.setHours(23, 59, 59, 999);
      dateFilter.created_at = { ...dateFilter.created_at, $lte: endDate.toISOString() };
    }

    // 统计用户
    let usersQuery = getSupabaseClient().from('users').select('id, role');
    if (start_date || end_date) {
      usersQuery = usersQuery.gte('created_at', start_date || '1970-01-01').lte('created_at', end_date || '2099-12-31');
    }
    const { data: users } = await usersQuery;
    const userList = users || [];
    const total_users = userList.length;
    const consumers = userList.filter((u: any) => u.role === 'consumer').length;
    const merchants = userList.filter((u: any) => u.role === 'merchant').length;

    // 统计套餐
    let packagesQuery = getSupabaseClient().from('packages').select('id');
    if (start_date || end_date) {
      packagesQuery = packagesQuery.gte('created_at', start_date || '1970-01-01').lte('created_at', end_date || '2099-12-31');
    }
    const { data: packages } = await packagesQuery;
    const packages_count = (packages || []).length;

    // 统计奖品
    let prizesQuery = getSupabaseClient().from('prizes').select('id');
    if (start_date || end_date) {
      prizesQuery = prizesQuery.gte('created_at', start_date || '1970-01-01').lte('created_at', end_date || '2099-12-31');
    }
    const { data: prizes } = await prizesQuery;
    const prizes_count = (prizes || []).length;

    // 统计门店
    let merchantsQuery = getSupabaseClient().from('merchants').select('id');
    if (start_date || end_date) {
      merchantsQuery = merchantsQuery.gte('created_at', start_date || '1970-01-01').lte('created_at', end_date || '2099-12-31');
    }
    const { data: merchantsList } = await merchantsQuery;
    const merchants_count = (merchantsList || []).length;

    return {
      total_users,
      consumers,
      merchants,
      packages_count,
      prizes_count,
      merchants_count,
    };
  }
}
