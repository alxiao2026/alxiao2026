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
  verified_count: number;
  verification_code: string | null;
  verified_at: string | null;
  expire_at: string | null;
  shop_name: string | null;
  order_no: string | null;
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

// 使用本地时区生成 YYYY-MM-DD 日期字符串
function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// 使用本地时区生成 HH:MM 时间字符串
function localTimeStr(d: Date): string {
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

@Injectable()
export class OrderService {
  private client = getSupabaseClient();

  async findByMerchant(merchantId: string, status?: string, startDate?: string, endDate?: string): Promise<Order[]> {
    // 先查该商家的所有套餐ID
    const { data: packages, error: pkgError } = await this.client
      .from('packages')
      .select('id')
      .eq('merchant_id', merchantId);
    if (pkgError) throw new Error(`查询商家套餐失败: ${pkgError.message}`);
    const packageIds = (packages || []).map((p: any) => p.id);
    if (packageIds.length === 0) return [];

    let query = this.client
      .from('orders')
      .select('*')
      .in('package_id', packageIds)
      .order('created_at', { ascending: false });

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }
    if (startDate) {
      query = query.gte('created_at', `${startDate}T00:00:00`);
    }
    if (endDate) {
      query = query.lte('created_at', `${endDate}T23:59:59`);
    }

    const { data, error } = await query;
    if (error) throw new Error(`查询商家订单失败: ${error.message}`);
    const orders = (data as Order[]) || [];
    await this.refundExpiredOrders(orders);
    return orders;
  }

  async findAll(): Promise<Order[]> {
    const { data, error } = await this.client
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw new Error(`查询订单列表失败: ${error.message}`);
    const orders = (data as Order[]) || [];
    await this.refundExpiredOrders(orders);
    return orders;
  }

  async findByUserId(userId: string): Promise<Order[]> {
    const { data, error } = await this.client
      .from('orders')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(`查询用户订单失败: ${error.message}`);
    const orders = (data as Order[]) || [];
    await this.refundExpiredOrders(orders);
    return orders;
  }

  /** 获取用户未参与抽奖的订单（有效状态且无抽奖记录），补充套餐封面与订单总额 */
  async findUnparticipatedByUserId(userId: string): Promise<any[]> {
    // 1. 获取用户有效状态的订单（pending 待使用 / completed 已完成）
    const { data: orders, error } = await this.client
      .from('orders')
      .select('*')
      .eq('user_id', userId)
      .in('status', ['pending', 'completed'])
      .order('created_at', { ascending: false });
    if (error) throw new Error(`查询用户订单失败: ${error.message}`);
    const allOrders = (orders as Order[]) || [];
    if (allOrders.length === 0) return [];

    // 2. 获取这些订单中已有抽奖记录的 order_id
    const orderIds = allOrders.map(o => o.id);
    const { data: records } = await this.client
      .from('lottery_records')
      .select('order_id')
      .in('order_id', orderIds);
    const participatedIds = new Set((records || []).map((r: any) => r.order_id));

    // 3. 过滤出未参与抽奖的订单
    const unparticipated = allOrders.filter(o => !participatedIds.has(o.id));
    if (unparticipated.length === 0) return [];

    // 4. 联表补充套餐封面图，计算订单总额
    const packageIds = [...new Set(unparticipated.map(o => o.package_id).filter(Boolean))] as string[];
    const pkgMap = new Map<string, any>();
    if (packageIds.length > 0) {
      const { data: packages } = await this.client
        .from('packages')
        .select('id, cover_image')
        .in('id', packageIds);
      (packages || []).forEach((p: any) => pkgMap.set(p.id, p));
    }

    return unparticipated.map(o => ({
      ...o,
      package_cover: pkgMap.get(o.package_id || '')?.cover_image || '',
      total_amount: (parseFloat(o.price || '0') * (o.quantity || 1)).toFixed(2),
    }));
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

    // 生成订单编号：6位随机数 + YYYYMMDD + 5位随机数，共19位
    const randDigits = (len: number): string => {
      let s = String(Math.floor(1 + Math.random() * 9));
      for (let i = 1; i < len; i++) s += String(Math.floor(Math.random() * 10));
      return s;
    };
    const today = new Date();
    const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
    const orderNo = `${randDigits(6)}${dateStr}${randDigits(5)}`;

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
        order_no: orderNo,
        status: 'pending',
      })
      .select()
      .single();
    if (error) throw new Error(`创建订单失败: ${error.message}`);

    // 扣减库存
    if (body.package_id) {
      const { data: pkg } = await this.client
        .from('packages')
        .select('stock')
        .eq('id', body.package_id)
        .maybeSingle();
      if (pkg) {
        const currentStock = Number(pkg.stock || 0);
        if (currentStock > 0) {
          const newStock = Math.max(0, currentStock - quantity);
          const { error: stockError } = await this.client
            .from('packages')
            .update({ stock: newStock, updated_at: new Date().toISOString() })
            .eq('id', body.package_id);
          if (stockError) console.error(`[订单] 扣减库存失败: ${stockError.message}`);
          else console.log(`[订单] 套餐 ${body.package_id} 库存 ${currentStock} -> ${newStock}（购买${quantity}份）`);
        }
      }
    }

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

    // 不限购时跳过所有限购校验，直接返回库存
    if (pkg.purchase_limit_type !== 'limited') {
      const remaining = stock > 0 ? stock : 999;
      return { can_buy: true, remaining };
    }

    // 以下为限购模式（purchase_limit_type === 'limited'）
    // 检查总限购
    const purchaseLimit = Number(pkg.purchase_limit || 0);
    if (purchaseLimit > 0) {
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
    if (purchaseLimit > 0) {
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

  async verify(code: string, verifyCount = 1, merchantUserId?: string): Promise<Order> {
    if (!code) throw new BadRequestException('核销码不能为空');

    const { data: order, error: findError } = await this.client
      .from('orders')
      .select('*')
      .eq('verification_code', code)
      .maybeSingle();

    if (findError) throw new Error(`查询订单失败: ${findError.message}`);
    if (!order) throw new NotFoundException('核销码无效，未找到对应订单');

    if (order.status === 'refunded') throw new BadRequestException('该订单已退款');
    if (order.status === 'expired') throw new BadRequestException('该订单已过期，无法核销');

    // 获取套餐信息进行核销规则校验
    if (order.package_id) {
      const { data: pkg, error: pkgError } = await this.client
        .from('packages')
        .select('*')
        .eq('id', order.package_id)
        .maybeSingle();

      if (!pkgError && pkg) {
        // 商家身份和门店关联验证（超级管理员可核销所有门店订单）
        if (merchantUserId) {
          const { data: merchantUser } = await this.client
            .from('users')
            .select('role, merchant_id')
            .eq('user_id', merchantUserId)
            .maybeSingle();

          if (!merchantUser || (merchantUser.role !== 'merchant' && merchantUser.role !== 'admin')) {
            throw new BadRequestException('您不是商家用户，无权核销');
          }

          if (merchantUser.role === 'merchant') {
            if (!merchantUser.merchant_id) {
              throw new BadRequestException('您的账号未绑定门店，无法核销');
            }
            if (Number(pkg.merchant_id) !== Number(merchantUser.merchant_id)) {
              const { data: merchant } = await this.client
                .from('merchants')
                .select('name')
                .eq('id', merchantUser.merchant_id)
                .maybeSingle();
              const merchantName = merchant?.name || `门店${merchantUser.merchant_id}`;
              throw new BadRequestException(`该订单属于其他门店，您只能核销「${merchantName}」的订单`);
            }
          }
        }

        const now = new Date();
        const todayStr = localDateStr(now); // YYYY-MM-DD 本地时区
        const currentTime = localTimeStr(now); // HH:MM 本地时区
        const currentWeekday = now.getDay(); // 0=Sunday, 1=Monday...

        // 1. 可用日期校验
        if (pkg.valid_date_type === 'days' && pkg.valid_days) {
          // 自购买日起N天有效
          const purchaseDate = new Date(order.created_at);
          const expireDate = new Date(purchaseDate);
          expireDate.setDate(expireDate.getDate() + pkg.valid_days);
          const expireStr = localDateStr(expireDate);
          if (todayStr > expireStr) {
            // 过期自动退款
            await this.autoRefundOrder(order);
            throw new BadRequestException(`该订单已于 ${expireStr} 过期，已自动发起退款`);
          }
        } else if (pkg.valid_date_type === 'range' && pkg.valid_date_start && pkg.valid_date_end) {
          // 指定日期范围
          if (todayStr < pkg.valid_date_start) {
            throw new BadRequestException(`该套餐 ${pkg.valid_date_start} 才可使用，当前日期不可核销`);
          }
          if (todayStr > pkg.valid_date_end) {
            // 过期自动退款
            await this.autoRefundOrder(order);
            throw new BadRequestException(`该套餐已于 ${pkg.valid_date_end} 过期，已自动发起退款`);
          }
        }

        // 2. 不可用日期校验
        if (pkg.unavailable_date_type === 'partial') {
          // 检查指定日期不可用
          if (Array.isArray(pkg.unavailable_dates) && pkg.unavailable_dates.length > 0) {
            if (pkg.unavailable_dates.includes(todayStr)) {
              throw new BadRequestException(`该套餐在 ${todayStr} 不可用，当前日期不可核销`);
            }
          }

          // 检查星期几不可用
          if (Array.isArray(pkg.unavailable_weekdays) && pkg.unavailable_weekdays.length > 0) {
            if (pkg.unavailable_weekdays.includes(currentWeekday)) {
              const weekdayNames = ['日', '一', '二', '三', '四', '五', '六'];
              throw new BadRequestException(`该套餐每周${pkg.unavailable_weekdays.map(d => weekdayNames[d]).join('、')}不可用，今天不可核销`);
            }
          }

          // 检查节假日不可用
          if (Array.isArray(pkg.unavailable_holidays) && pkg.unavailable_holidays.length > 0) {
            const holidayDates = this.getHolidayDates();
            for (const holidayId of pkg.unavailable_holidays) {
              const dates = holidayDates[holidayId];
              if (dates && todayStr >= dates.start && todayStr <= dates.end) {
                throw new BadRequestException(`该套餐在${dates.name}期间不可用，当前日期不可核销`);
              }
            }
          }
        }

        // 3. 每日可用时段校验
        if (pkg.available_time_type === 'custom' && pkg.available_time_start && pkg.available_time_end) {
          if (currentTime < pkg.available_time_start || currentTime > pkg.available_time_end) {
            throw new BadRequestException(`该套餐每日可用时段为 ${pkg.available_time_start} ~ ${pkg.available_time_end}，当前时间不可核销`);
          }
        }

        // 4. 限制使用张数校验
        if (pkg.limit_usage_count && pkg.usage_count_limit) {
          if (verifyCount > pkg.usage_count_limit) {
            throw new BadRequestException(`该套餐每次最多核销${pkg.usage_count_limit}份，请减少核销份数`);
          }
        }
      }
    }

    const totalQty = order.quantity || 1;
    const currentVerified = order.verified_count || 0;
    const remaining = totalQty - currentVerified;

    if (remaining <= 0) throw new BadRequestException('该订单已全部核销');
    if (verifyCount > remaining) throw new BadRequestException(`剩余可核销份数为 ${remaining}，不能超过`);

    const newVerifiedCount = currentVerified + verifyCount;
    const isAllVerified = newVerifiedCount >= totalQty;

    const { data, error } = await this.client
      .from('orders')
      .update({
        verified_count: newVerifiedCount,
        status: isAllVerified ? 'used' : 'pending',
        verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', order.id)
      .select()
      .single();

    if (error) throw new Error(`核销失败: ${error.message}`);
    return data as Order;
  }

  /** 根据奖品兑换码查询中奖记录及奖品信息 */
  private async findPrizeByRedemptionCode(code: string): Promise<{
    record_id: string;
    prize_id: string | null;
    prize_name: string;
    product_name: string;
    product_value: number | null;
    nick_name: string;
    redemption_code: string;
    refund_status: string;
    redeemed: boolean;
    expired: boolean;
    created_at: string;
  } | null> {
    const { data: record, error } = await this.client
      .from('lottery_records')
      .select('id, prize_id, prize_name, user_id, redemption_code, refund_status, created_at')
      .eq('redemption_code', code)
      .eq('is_winner', true)
      .maybeSingle();
    if (error) throw new Error(`查询奖品兑换码失败: ${error.message}`);
    if (!record) return null;

    const r = record as any;

    // 补充奖品商品信息与单品有效期
    let productName = '';
    let productValue: number | null = null;
    let validityHours: number | null = null;
    if (r.prize_id) {
      const { data: prize } = await this.client
        .from('prizes')
        .select('product_name, product_value, validity_hours')
        .eq('id', r.prize_id)
        .maybeSingle();
      if (prize) {
        productName = (prize as any).product_name || '';
        productValue = (prize as any).product_value ?? null;
        const vh = (prize as any).validity_hours;
        validityHours = typeof vh === 'number' && vh > 0 ? vh : null;
      }
    }

    // 中奖用户昵称
    let nickName = '';
    if (r.user_id) {
      const { data: user } = await this.client
        .from('users')
        .select('nick_name')
        .eq('user_id', r.user_id)
        .maybeSingle();
      nickName = (user as any)?.nick_name || '';
    }

    // 有效期：优先奖品单品有效期，其次全局设置，默认 72 小时
    let expiryHours = validityHours;
    if (!expiryHours) {
      const { data: settings } = await this.client
        .from('lottery_settings')
        .select('redemption_expiry_hours')
        .limit(1)
        .maybeSingle();
      expiryHours = (settings as any)?.redemption_expiry_hours ?? 72;
    }
    const expiresAt = new Date(r.created_at).getTime() + (expiryHours || 72) * 3600 * 1000;

    return {
      record_id: r.id,
      prize_id: r.prize_id || null,
      prize_name: r.prize_name || '',
      product_name: productName,
      product_value: productValue,
      nick_name: nickName,
      redemption_code: r.redemption_code,
      refund_status: r.refund_status || '',
      redeemed: r.refund_status === 'redeemed',
      expired: Date.now() > expiresAt,
      created_at: r.created_at,
    };
  }

  /** 统一核销查询：自动识别团购订单码或奖品兑换码 */
  async unifiedLookup(code: string): Promise<
    | { type: 'order'; order: Order }
    | { type: 'prize'; prize: NonNullable<Awaited<ReturnType<OrderService['findPrizeByRedemptionCode']>>> }
    | null
  > {
    let order: Order | null = null;
    try {
      order = await this.findByVerificationCode(code);
    } catch {
      order = null;
    }
    if (order) return { type: 'order', order };

    const prize = await this.findPrizeByRedemptionCode(code);
    if (prize) return { type: 'prize', prize };

    return null;
  }

  /** 统一核销：自动识别团购订单码或奖品兑换码并执行核销 */
  async unifiedVerify(code: string, verifyCount: number = 1, merchantUserId?: string): Promise<{ type: 'order' | 'prize'; data: any }> {
    // 1. 优先按团购订单码核销
    let order: Order | null = null;
    try {
      order = await this.findByVerificationCode(code);
    } catch {
      order = null;
    }
    if (order) {
      const verified = await this.verify(code, verifyCount, merchantUserId);
      return { type: 'order', data: verified };
    }

    // 2. 按抽奖奖品兑换码核销
    const prize = await this.findPrizeByRedemptionCode(code);
    if (!prize) throw new NotFoundException('未找到该核销码对应的订单或奖品');

    // 商家权限校验：admin 可核销所有；商家只能核销本店奖品
    if (merchantUserId) {
      const { data: merchantUser } = await this.client
        .from('users')
        .select('role, merchant_id')
        .eq('user_id', merchantUserId)
        .maybeSingle();
      const isAdmin = (merchantUser as any)?.role === 'admin';
      if (!isAdmin) {
        if (!merchantUser || (merchantUser as any).role !== 'merchant' || !(merchantUser as any).merchant_id) {
          throw new BadRequestException('您不是商家用户，无权核销');
        }
        if (prize.prize_id) {
          const { data: prizeRow } = await this.client
            .from('prizes')
            .select('merchant_id')
            .eq('id', prize.prize_id)
            .maybeSingle();
          const prizeMerchantId = (prizeRow as any)?.merchant_id;
          if (prizeMerchantId && prizeMerchantId !== (merchantUser as any).merchant_id) {
            throw new BadRequestException('该奖品属于其他门店，您只能核销本店奖品');
          }
        }
      }
    }

    if (prize.redeemed) throw new BadRequestException('该奖品已核销过');

    const { data: updated, error } = await this.client
      .from('lottery_records')
      .update({
        refund_status: 'redeemed',
        redeemed_at: new Date().toISOString(),
        redeemed_by: merchantUserId || null,
      })
      .eq('id', prize.record_id)
      .select()
      .single();
    if (error) throw new Error(`奖品核销失败: ${error.message}`);

    return { type: 'prize', data: { ...prize, redeemed: true, redeemed_at: (updated as any).redeemed_at } };
  }

  // 节假日日期映射表
  private getHolidayDates(): Record<string, { name: string; start: string; end: string }> {
    return {
      qixi: { name: '七夕节', start: '2026-08-19', end: '2026-08-19' },
      zhongqiu: { name: '中秋节', start: '2026-09-25', end: '2026-09-27' },
      guoqing: { name: '国庆节', start: '2026-10-01', end: '2026-10-07' },
      shengdan: { name: '圣诞节', start: '2026-12-25', end: '2026-12-25' },
      yuandan: { name: '元旦', start: '2027-01-01', end: '2027-01-01' },
      chunjie: { name: '春节', start: '2027-01-28', end: '2027-02-03' },
    };
  }

  // 过期订单自动退款
  private async autoRefundOrder(order: Order): Promise<void> {
    if (order.status === 'refunded' || order.status === 'expired') return;
    await this.client
      .from('orders')
      .update({
        status: 'refunded',
        updated_at: new Date().toISOString(),
      })
      .eq('id', order.id);
  }

  // 批量检测过期订单并自动退款
  private async refundExpiredOrders(orders: Order[]): Promise<void> {
    const pendingOrders = orders.filter(o => o.status === 'pending' && o.package_id);
    if (pendingOrders.length === 0) return;

    // 获取所有相关套餐的可用日期配置
    const packageIds = [...new Set(pendingOrders.map(o => o.package_id!))];
    const { data: packages } = await this.client
      .from('packages')
      .select('id, valid_date_type, valid_days, valid_date_start, valid_date_end')
      .in('id', packageIds);

    if (!packages) return;
    const pkgMap = new Map(packages.map(p => [p.id, p]));
    const todayStr = localDateStr(new Date());

    for (const order of pendingOrders) {
      const pkg = pkgMap.get(order.package_id!);
      if (!pkg) continue;

      let expired = false;
      if (pkg.valid_date_type === 'days' && pkg.valid_days) {
        const purchaseDate = new Date(order.created_at);
        const expireDate = new Date(purchaseDate);
        expireDate.setDate(expireDate.getDate() + pkg.valid_days);
        if (todayStr > localDateStr(expireDate)) {
          expired = true;
        }
      } else if (pkg.valid_date_type === 'range' && pkg.valid_date_end) {
        if (todayStr > pkg.valid_date_end) {
          expired = true;
        }
      }

      if (expired) {
        await this.client
          .from('orders')
          .update({ status: 'refunded', updated_at: new Date().toISOString() })
          .eq('id', order.id);
        order.status = 'refunded';
      }
    }
  }

  async findByVerificationCode(code: string): Promise<Order & { verify_warning?: string }> {
    const { data, error } = await this.client
      .from('orders')
      .select('*')
      .eq('verification_code', code)
      .maybeSingle();
    if (error) throw new Error(`查询订单失败: ${error.message}`);
    if (!data) throw new NotFoundException('核销码无效');

    const order = data as Order & { verify_warning?: string };

    // 如果订单是 pending 状态，检查核销规则并返回提示信息
    if (order.status === 'pending' && order.package_id) {
      const { data: pkg } = await this.client
        .from('packages')
        .select('*')
        .eq('id', order.package_id)
        .maybeSingle();

      if (pkg) {
        const now = new Date();
        const todayStr = localDateStr(now);
        const currentTime = localTimeStr(now);
        const currentWeekday = now.getDay();
        const warnings: string[] = [];

        // 可用日期
        if (pkg.valid_date_type === 'days' && pkg.valid_days) {
          const purchaseDate = new Date(order.created_at);
          const expireDate = new Date(purchaseDate);
          expireDate.setDate(expireDate.getDate() + pkg.valid_days);
          const expireStr = localDateStr(expireDate);
          if (todayStr > expireStr) {
            warnings.push(`已于${expireStr}过期`);
          }
        } else if (pkg.valid_date_type === 'range' && pkg.valid_date_start && pkg.valid_date_end) {
          if (todayStr < pkg.valid_date_start) {
            warnings.push(`${pkg.valid_date_start}起可用`);
          } else if (todayStr > pkg.valid_date_end) {
            warnings.push(`已于${pkg.valid_date_end}过期`);
          }
        }

        // 不可用日期
        if (pkg.unavailable_date_type === 'partial') {
          if (Array.isArray(pkg.unavailable_dates) && pkg.unavailable_dates.includes(todayStr)) {
            warnings.push(`${todayStr}不可用`);
          }
          if (Array.isArray(pkg.unavailable_weekdays) && pkg.unavailable_weekdays.includes(currentWeekday)) {
            const weekdayNames = ['日', '一', '二', '三', '四', '五', '六'];
            warnings.push(`每周${pkg.unavailable_weekdays.map((d: number) => weekdayNames[d]).join('、')}不可用`);
          }
          if (Array.isArray(pkg.unavailable_holidays) && pkg.unavailable_holidays.length > 0) {
            const holidayDates = this.getHolidayDates();
            for (const hid of pkg.unavailable_holidays) {
              const dates = holidayDates[hid];
              if (dates && todayStr >= dates.start && todayStr <= dates.end) {
                warnings.push(`${dates.name}期间不可用`);
              }
            }
          }
        }

        // 可用时段
        if (pkg.available_time_type === 'custom' && pkg.available_time_start && pkg.available_time_end) {
          if (currentTime < pkg.available_time_start || currentTime > pkg.available_time_end) {
            warnings.push(`可用时段${pkg.available_time_start}~${pkg.available_time_end}`);
          }
        }

        if (warnings.length > 0) {
          order.verify_warning = warnings.join('；');
        }
      }
    }

    return order;
  }
}
