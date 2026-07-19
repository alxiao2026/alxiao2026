import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import * as QRCode from 'qrcode';

export interface Order {
  id: string;
  user_id: string;
  nick_name: string | null;
  avatar_url: string | null;
  package_id: string | null;
  package_name: string;
  price: string;
  original_price: string | null;
  status: string;
  shared: boolean;
  quantity: number;
  verification_code: string | null;
  verified_at: string | null;
  expire_at: string | null;
  shop_name: string | null;
  created_at: string;
  updated_at: string | null;
}

function generateVerificationCode(): string {
  // 生成12位数字核销码，每4位一组用-分隔
  const segments: string[] = [];
  for (let i = 0; i < 3; i++) {
    segments.push(String(Math.floor(1000 + Math.random() * 9000)));
  }
  return segments.join('');
}

@Injectable()
export class OrderService {
  private client = getSupabaseClient();

  async findAll(): Promise<Order[]> {
    const { data, error } = await this.client
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw new Error(`查询订单列表失败: ${error.message}`);
    return (data as Order[]) || [];
  }

  async findByUserId(userId: string): Promise<Order[]> {
    const { data, error } = await this.client
      .from('orders')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(`查询用户订单失败: ${error.message}`);
    return (data as Order[]) || [];
  }

  async findOne(id: string): Promise<Order> {
    const { data, error } = await this.client
      .from('orders')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(`查询订单失败: ${error.message}`);
    if (!data) throw new NotFoundException('订单不存在');
    return data as Order;
  }

  async create(body: {
    user_id: string;
    nick_name?: string;
    avatar_url?: string;
    package_id?: string;
    package_name?: string;
    price?: string;
    original_price?: string;
    shop_name?: string;
    quantity?: number;
  }): Promise<Order> {
    if (!body.user_id) throw new BadRequestException('用户ID不能为空');

    const quantity = Math.max(1, Math.floor(body.quantity || 1));

    const verificationCode = generateVerificationCode();

    const { data, error } = await this.client
      .from('orders')
      .insert({
        user_id: body.user_id,
        nick_name: body.nick_name || null,
        avatar_url: body.avatar_url || null,
        package_id: body.package_id || null,
        package_name: body.package_name || '基础套餐',
        price: body.price || '9.90',
        original_price: body.original_price || null,
        quantity,
        verification_code: verificationCode,
        shop_name: body.shop_name || null,
        status: 'pending',
      })
      .select()
      .single();
    if (error) throw new Error(`创建订单失败: ${error.message}`);
    return data as Order;
  }

  async checkPurchase(body: {
    user_id: string;
    package_id: string;
    quantity: number;
  }): Promise<{ can_buy: boolean; reason?: string; remaining?: number }> {
    if (!body.user_id) throw new BadRequestException('用户ID不能为空');
    if (!body.package_id) throw new BadRequestException('套餐ID不能为空');
    const quantity = Math.max(1, Math.floor(body.quantity || 1));

    // 查询套餐信息
    const { data: pkg, error: pkgError } = await this.client
      .from('packages')
      .select('*')
      .eq('id', body.package_id)
      .maybeSingle();
    if (pkgError) throw new Error(`查询套餐失败: ${pkgError.message}`);
    if (!pkg) throw new NotFoundException('套餐不存在');

    // 检查套餐状态
    if (pkg.is_active === false) {
      return { can_buy: false, reason: '该套餐已下架' };
    }

    // 检查库存
    const stock = Number(pkg.stock || 0);
    if (stock > 0 && quantity > stock) {
      return { can_buy: false, reason: `库存不足，仅剩${stock}份`, remaining: stock };
    }

    // 检查售卖日期
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    if (pkg.sale_start_date && today < pkg.sale_start_date) {
      return { can_buy: false, reason: `该套餐${pkg.sale_start_date}开始售卖` };
    }
    if (pkg.sale_end_date && !pkg.auto_renew && today > pkg.sale_end_date) {
      return { can_buy: false, reason: '该套餐已停止售卖' };
    }

    // 查询用户已购买该套餐的订单
    const { data: existingOrders, error: orderError } = await this.client
      .from('orders')
      .select('quantity, created_at')
      .eq('user_id', body.user_id)
      .eq('package_id', body.package_id)
      .in('status', ['pending', 'used']);
    if (orderError) throw new Error(`查询购买记录失败: ${orderError.message}`);

    const orders = existingOrders || [];

    // 检查总限购
    const purchaseLimit = Number(pkg.purchase_limit || 0);
    if (pkg.purchase_limit_type === 'limited' && purchaseLimit > 0) {
      const totalBought = orders.reduce((sum, o) => sum + (Number(o.quantity) || 1), 0);
      if (totalBought + quantity > purchaseLimit) {
        const remaining = Math.max(0, purchaseLimit - totalBought);
        return { can_buy: false, reason: `每人限购${purchaseLimit}份，您已购买${totalBought}份`, remaining };
      }
    }

    // 检查每日限购
    const perDayLimit = Number(pkg.purchase_limit_per_day || 0);
    if (perDayLimit > 0) {
      const todayStart = `${today}T00:00:00`;
      const todayOrders = orders.filter(o => o.created_at >= todayStart);
      const todayBought = todayOrders.reduce((sum, o) => sum + (Number(o.quantity) || 1), 0);
      if (todayBought + quantity > perDayLimit) {
        const remaining = Math.max(0, perDayLimit - todayBought);
        return { can_buy: false, reason: `每人每天限购${perDayLimit}份，今天已购买${todayBought}份`, remaining };
      }
    }

    // 检查每月限购
    const perMonthLimit = Number(pkg.purchase_limit_per_month || 0);
    if (perMonthLimit > 0) {
      const monthStart = today.slice(0, 7) + '-01T00:00:00';
      const monthOrders = orders.filter(o => o.created_at >= monthStart);
      const monthBought = monthOrders.reduce((sum, o) => sum + (Number(o.quantity) || 1), 0);
      if (monthBought + quantity > perMonthLimit) {
        const remaining = Math.max(0, perMonthLimit - monthBought);
        return { can_buy: false, reason: `每人每月限购${perMonthLimit}份，本月已购买${monthBought}份`, remaining };
      }
    }

    // 计算剩余可购数量
    let remaining = stock > 0 ? stock : 999;
    if (pkg.purchase_limit_type === 'limited' && purchaseLimit > 0) {
      const totalBought = orders.reduce((sum, o) => sum + (Number(o.quantity) || 1), 0);
      remaining = Math.min(remaining, Math.max(0, purchaseLimit - totalBought));
    }
    if (perDayLimit > 0) {
      const todayStart = `${today}T00:00:00`;
      const todayBought = orders.filter(o => o.created_at >= todayStart).reduce((sum, o) => sum + (Number(o.quantity) || 1), 0);
      remaining = Math.min(remaining, Math.max(0, perDayLimit - todayBought));
    }
    if (perMonthLimit > 0) {
      const monthStart = today.slice(0, 7) + '-01T00:00:00';
      const monthBought = orders.filter(o => o.created_at >= monthStart).reduce((sum, o) => sum + (Number(o.quantity) || 1), 0);
      remaining = Math.min(remaining, Math.max(0, perMonthLimit - monthBought));
    }

    return { can_buy: true, remaining };
  }

  async markShared(id: string): Promise<Order> {
    const order = await this.findOne(id);
    if (order.shared) throw new BadRequestException('该订单已分享过');

    const { data, error } = await this.client
      .from('orders')
      .update({ shared: true, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error(`标记分享失败: ${error.message}`);
    return data as Order;
  }

  async generateQRCode(id: string): Promise<{ qrcode: string; verification_code: string }> {
    const order = await this.findOne(id);
    if (!order.verification_code) throw new BadRequestException('该订单无核销码');

    const qrDataUrl = await QRCode.toDataURL(order.verification_code, {
      width: 400,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    });

    return { qrcode: qrDataUrl, verification_code: order.verification_code };
  }

  async verify(code: string): Promise<Order> {
    if (!code) throw new BadRequestException('核销码不能为空');

    const { data: order, error: findError } = await this.client
      .from('orders')
      .select('*')
      .eq('verification_code', code)
      .maybeSingle();

    if (findError) throw new Error(`查询订单失败: ${findError.message}`);
    if (!order) throw new NotFoundException('核销码无效，未找到对应订单');

    if (order.status === 'used') throw new BadRequestException('该订单已核销');
    if (order.status === 'refunded') throw new BadRequestException('该订单已退款');

    const { data, error } = await this.client
      .from('orders')
      .update({
        status: 'used',
        verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', order.id)
      .select()
      .single();

    if (error) throw new Error(`核销失败: ${error.message}`);
    return data as Order;
  }

  async findByVerificationCode(code: string): Promise<Order> {
    const { data, error } = await this.client
      .from('orders')
      .select('*')
      .eq('verification_code', code)
      .maybeSingle();
    if (error) throw new Error(`查询订单失败: ${error.message}`);
    if (!data) throw new NotFoundException('核销码无效');
    return data as Order;
  }
}
