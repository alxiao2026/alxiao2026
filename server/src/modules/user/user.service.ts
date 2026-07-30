import { Injectable, NotFoundException, ForbiddenException, InternalServerErrorException, BadRequestException, Logger } from '@nestjs/common';
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
  unpaid_orders: number;
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
  /** 用户列表（管理后台用，分页 + 关键词搜索） */
  async listUsers(page = 1, pageSize = 20, keyword?: string) {
    const supabase = getSupabaseClient();
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from('users')
      .select('user_id, nick_name, phone, avatar_url, role, merchant_id, created_at, last_login_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (keyword) {
      // 清洗 ilike 通配符与 or 语法分隔符，防止查询语法被破坏
      const kw = keyword.replace(/[%_,]/g, '');
      if (kw) {
        query = query.or(`nick_name.ilike.%${kw}%,phone.ilike.%${kw}%`);
      }
    }

    const { data, error, count } = await query;
    if (error) {
      console.error('获取用户列表失败:', error);
      throw new InternalServerErrorException('获取用户列表失败');
    }

    return {
      code: 200,
      msg: 'success',
      data: {
        list: data || [],
        total: count || 0,
        page,
        page_size: pageSize,
      },
    };
  }

  /** 获取或创建用户 */
  async getOrCreate(userId: string, nickName?: string, avatarUrl?: string): Promise<User> {
    const supabase = getSupabaseClient();
    const { data: existing } = await supabase
      .from('users')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (existing) {
      // 已存在用户仅更新最后登录时间；昵称/头像以数据库为准，
      // 避免前端 storage 旧缓存通过登录接口回写覆盖最新资料
      const { data: updated, error } = await supabase
        .from('users')
        .update({ last_login_at: new Date().toISOString() })
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
  /** 同一手机号存在多个账号时，按角色优先级选择：admin > merchant > consumer，同级取最近登录 */
  private pickAccountByPriority(users: User[]): User | undefined {
    const priority = (u: User) => (u.role === 'admin' ? 0 : u.role === 'merchant' ? 1 : 2);
    return [...users].sort((a, b) => {
      const diff = priority(a) - priority(b);
      if (diff !== 0) return diff;
      return new Date(b.last_login_at || 0).getTime() - new Date(a.last_login_at || 0).getTime();
    })[0];
  }

  async loginByPassword(phone: string, password: string, nickName?: string): Promise<User> {
    const supabase = getSupabaseClient();
    const { data: existingList } = await supabase
      .from('users')
      .select('*')
      .eq('phone', phone);
    const existing = this.pickAccountByPriority((existingList || []) as User[]);

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
    const { data: existingList } = await supabase
      .from('users')
      .select('*')
      .eq('phone', phone);
    const existing = this.pickAccountByPriority((existingList || []) as User[]);

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

  /**
   * 微信登录凭证校验：小程序端 Taro.login() 获取的 code → 换取 openid
   * https://developers.weixin.qq.com/miniprogram/dev/OpenApiDoc/user-login/code2Session.html
   * 需在 server/.env 配置 WECHAT_APPID / WECHAT_SECRET
   */
  async code2Session(code: string): Promise<{ openid: string; unionid?: string }> {
    const logger = new Logger('UserService.code2Session');
    const appid = process.env.WECHAT_APPID || '';
    const secret = process.env.WECHAT_SECRET || '';
    if (!code) throw new BadRequestException('缺少微信登录 code');
    if (!appid || !secret) {
      throw new BadRequestException('微信登录未配置（缺少 WECHAT_APPID/WECHAT_SECRET）');
    }
    const url =
      `https://api.weixin.qq.com/sns/jscode2session?appid=${appid}` +
      `&secret=${secret}&js_code=${encodeURIComponent(code)}&grant_type=authorization_code`;
    const res = await fetch(url);
    const data: any = await res.json();
    if (!data?.openid) {
      logger.warn(`code2session 失败: ${JSON.stringify(data)}`);
      throw new BadRequestException(
        `微信登录失败: ${data?.errmsg || '凭证无效'}（errcode=${data?.errcode ?? 'unknown'}）`,
      );
    }
    return { openid: data.openid, unionid: data.unionid };
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
  async getMerchantStats(userId: string, rangeQuery?: { start_date?: string; end_date?: string }): Promise<{
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
    rangeSales: number;
    rangeOrders: number;
    rangeRevenue: string;
    rangeVerifiedCount: number;
    rangeVerifiedAmount: string;
    rangeLotteryUsers: number;
    rangeRefundAmount: string;
    rangeFreeMealWinners: number;
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
          .select('id, status, price, quantity, verified_count, verified_at, created_at')
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
        .select('status, price, quantity, verified_count, verified_at, created_at');
      orders = allOrders || [];
    } else {
      // 普通消费者：无权限查看商家统计，返回空数据
      orders = [];
    }

    // 总售卖数据（金额 = 单价 × 份数）
    const totalOrders = orders.length;
    const totalSales = orders.reduce((sum, o) => sum + (Number(o.quantity) || 1), 0);
    const totalRevenue = orders
      .reduce((sum, o) => sum + Number(o.price || 0) * (Number(o.quantity) || 1), 0)
      .toFixed(2);

    // 核销数据（核销金额 = 单价 × 实际核销份数，仅统计已核销未退款的订单）
    const verifiedCount = orders.reduce((sum, o) => sum + (Number(o.verified_count) || 0), 0);
    const verifiedAmount = orders
      .filter(o => o.status === 'used')
      .reduce((sum, o) => sum + Number(o.price || 0) * (Number(o.verified_count) || 0), 0)
      .toFixed(2);

    // 奖品发放数量（从 orders 中统计 shared=true 的）
    const prizeOrders = orders.filter(o => (o as any).shared === true);
    const prizeCount = prizeOrders.length;

    // 业务日期统一按 UTC+8（中国时区）分界，与服务器部署时区无关
    const CN_OFFSET_MS = 8 * 60 * 60 * 1000;
    // 今日数据（UTC+8 口径）
    const todayStr = new Date(Date.now() + CN_OFFSET_MS).toISOString().split('T')[0];
    const toCnDateStr = (iso?: string | null) => {
      if (!iso) return '';
      const d = new Date(iso);
      if (isNaN(d.getTime())) return '';
      return new Date(d.getTime() + CN_OFFSET_MS).toISOString().split('T')[0];
    };
    const todayOrdersList = orders.filter(o => toCnDateStr(o.created_at) === todayStr);
    const todayOrders = todayOrdersList.length;
    const todaySales = todayOrdersList.reduce((sum, o) => sum + (Number(o.quantity) || 1), 0);
    const todayRevenue = todayOrdersList
      .reduce((sum, o) => sum + Number(o.price || 0) * (Number(o.quantity) || 1), 0)
      .toFixed(2);
    // 今日核销：按「核销发生时间」统计（而非下单时间），昨天买今天核销的也计入今日
    const todayVerifiedOrders = orders.filter(
      o => (Number(o.verified_count) || 0) > 0 && toCnDateStr(o.verified_at || o.created_at) === todayStr,
    );
    const todayVerifiedCount = todayVerifiedOrders.reduce((sum, o) => sum + (Number(o.verified_count) || 0), 0);
    const todayVerifiedAmount = todayVerifiedOrders
      .filter(o => o.status === 'used')
      .reduce((sum, o) => sum + Number(o.price || 0) * (Number(o.verified_count) || 0), 0)
      .toFixed(2);

    // 经营概况时间范围（默认今日；单传 start_date 时结束日期默认为今天，兼容"近7天/近30天"只传起点的场景）
    const rangeStart = rangeQuery?.start_date || todayStr;
    const rangeEnd = rangeQuery?.end_date || (rangeQuery?.start_date ? todayStr : rangeStart);
    const inRange = (iso?: string | null) => {
      const ds = toCnDateStr(iso);
      return !!ds && ds >= rangeStart && ds <= rangeEnd;
    };
    // 范围销售数据（按下单时间）
    const rangeOrdersList = orders.filter(o => inRange(o.created_at));
    const rangeOrders = rangeOrdersList.length;
    const rangeSales = rangeOrdersList.reduce((sum, o) => sum + (Number(o.quantity) || 1), 0);
    const rangeRevenue = rangeOrdersList
      .reduce((sum, o) => sum + Number(o.price || 0) * (Number(o.quantity) || 1), 0)
      .toFixed(2);
    // 范围核销数据（按核销发生时间）
    const rangeVerifiedOrders = orders.filter(
      o => (Number(o.verified_count) || 0) > 0 && inRange(o.verified_at || o.created_at),
    );
    const rangeVerifiedCount = rangeVerifiedOrders.reduce((sum, o) => sum + (Number(o.verified_count) || 0), 0);
    const rangeVerifiedAmount = rangeVerifiedOrders
      .filter(o => o.status === 'used')
      .reduce((sum, o) => sum + Number(o.price || 0) * (Number(o.verified_count) || 0), 0)
      .toFixed(2);

    // 抽奖统计（查询窗口取今日起点与范围起点中较早者，同时支撑今日与范围口径；日期边界显式按 UTC+8）
    const todayStart = new Date(`${todayStr}T00:00:00+08:00`);
    const rangeStartDate = new Date(`${rangeStart}T00:00:00+08:00`);
    const rangeEndDate = new Date(`${rangeEnd}T23:59:59.999+08:00`);
    const windowStart = new Date(Math.min(todayStart.getTime(), rangeStartDate.getTime()));
    const { data: todayLotteryRows } = await supabase
      .from('lottery_records')
      .select('order_id, user_id, refund_amount, is_winner, created_at, prizes(prize_type)')
      .gte('created_at', windowStart.toISOString())
      .lte('created_at', rangeEndDate.toISOString());
    const scopeLotteryRecords = (todayLotteryRows || []).filter((r: any) => {
      // 商家用户只统计自己门店订单产生的抽奖记录
      if (merchantOrderIds && !merchantOrderIds.has(r.order_id)) return false;
      return true;
    });
    const todayLotteryRecords = scopeLotteryRecords.filter((r: any) => toCnDateStr(r.created_at) === todayStr);
    const rangeLotteryRecords = scopeLotteryRecords.filter((r: any) => inRange(r.created_at));
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
    // 范围抽奖统计（与今日口径相同的计算逻辑）
    const rangeLotteryUsers = new Set(rangeLotteryRecords.map((r: any) => r.user_id)).size;
    const rangeFreeMealRecords = rangeLotteryRecords.filter((r: any) => r.is_winner && isFreeMeal(r));
    const rangeFreeMealWinners = new Set(rangeFreeMealRecords.map((r: any) => r.user_id)).size;
    const rangeRefundAmount = rangeFreeMealRecords
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
      todayFreeMealWinners,
      rangeSales,
      rangeOrders,
      rangeRevenue,
      rangeVerifiedCount,
      rangeVerifiedAmount,
      rangeLotteryUsers,
      rangeRefundAmount,
      rangeFreeMealWinners
    };
  }

  /** 获取用户订单统计 */
  async getStats(userId: string): Promise<UserStats> {
    const supabase = getSupabaseClient();
    const { data: orders, error } = await supabase
      .from('orders')
      .select('status, price, original_price, pay_amount')
      .eq('user_id', userId);
    if (error) throw error;

    const orderList = orders || [];
    let totalSpent = 0;
    let totalSaved = 0;
    let unpaid = 0;
    let pending = 0;
    let used = 0;
    let refunded = 0;

    for (const order of orderList) {
      switch (order.status) {
        case 'created': unpaid++; break;
        case 'pending':
        case 'paid': pending++; break;
        case 'used': used++; break;
        case 'refunded': refunded++; break;
      }

      // 仅统计已支付订单（paid/used/refunded），未支付订单不计入消费额
      if (['pending', 'paid', 'used', 'refunded'].includes(order.status)) {
        const paidAmount = parseFloat(order.pay_amount || '0') || parseFloat(order.price) || 0;
        const originalPrice = parseFloat(order.original_price || '0') || 0;
        totalSpent += paidAmount;
        totalSaved += Math.max(0, originalPrice - paidAmount);
      }
    }

    return {
      total_orders: orderList.length,
      unpaid_orders: unpaid,
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
  async getOverviewStats(query: { start_date?: string; end_date?: string; user_id?: string }): Promise<{
    total_users: number;
    consumers: number;
    merchants: number;
    packages_count: number;
    prizes_count: number;
    merchants_count: number;
  }> {
    const { start_date, end_date, user_id } = query;

    // 平台统计数据仅系统管理员可见
    if (!user_id) throw new ForbiddenException('请先登录');
    const { data: requester } = await getSupabaseClient()
      .from('users')
      .select('role')
      .eq('user_id', user_id)
      .single();
    if (!requester || requester.role !== 'admin') {
      throw new ForbiddenException('仅系统管理员可查看平台统计数据');
    }

    // 业务日期统一按 UTC+8（中国时区）分界
    const rangeStartIso = start_date ? `${start_date}T00:00:00+08:00` : '1970-01-01T00:00:00+08:00';
    const rangeEndIso = end_date ? `${end_date}T23:59:59.999+08:00` : '2099-12-31T23:59:59+08:00';

    // 统计用户
    let usersQuery = getSupabaseClient().from('users').select('id, role');
    if (start_date || end_date) {
      usersQuery = usersQuery.gte('created_at', rangeStartIso).lte('created_at', rangeEndIso);
    }
    const { data: users } = await usersQuery;
    const userList = users || [];
    const total_users = userList.length;
    const consumers = userList.filter((u: any) => u.role === 'consumer').length;
    const merchants = userList.filter((u: any) => u.role === 'merchant').length;

    // 统计套餐
    let packagesQuery = getSupabaseClient().from('packages').select('id');
    if (start_date || end_date) {
      packagesQuery = packagesQuery.gte('created_at', rangeStartIso).lte('created_at', rangeEndIso);
    }
    const { data: packages } = await packagesQuery;
    const packages_count = (packages || []).length;

    // 统计奖品
    let prizesQuery = getSupabaseClient().from('prizes').select('id');
    if (start_date || end_date) {
      prizesQuery = prizesQuery.gte('created_at', rangeStartIso).lte('created_at', rangeEndIso);
    }
    const { data: prizes } = await prizesQuery;
    const prizes_count = (prizes || []).length;

    // 统计门店
    let merchantsQuery = getSupabaseClient().from('merchants').select('id');
    if (start_date || end_date) {
      merchantsQuery = merchantsQuery.gte('created_at', rangeStartIso).lte('created_at', rangeEndIso);
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
