import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SettlementService {
  private readonly supabase: SupabaseClient = getSupabaseClient();

  // ==================== 套餐结算配置 ====================

  /** 获取套餐结算配置 */
  async getConfig(packageId: string) {
    const { data, error } = await this.supabase
      .from('package_settlement_configs')
      .select('*')
      .eq('package_id', packageId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    return data;
  }

  /** 保存套餐结算配置 */
  async saveConfig(body: {
    package_id: string;
    settlement_type: number;
    commission_rate?: number;
    settlement_price?: number;
  }) {
    const { package_id, settlement_type, commission_rate, settlement_price } = body;

    // 检查是否已存在配置
    const { data: existing } = await this.supabase
      .from('package_settlement_configs')
      .select('id')
      .eq('package_id', package_id)
      .single();

    if (existing) {
      // 更新
      const { data, error } = await this.supabase
        .from('package_settlement_configs')
        .update({
          settlement_type,
          commission_rate: settlement_type === 1 ? commission_rate : 0,
          settlement_price: settlement_type === 2 ? settlement_price : 0,
          updated_at: new Date().toISOString(),
        })
        .eq('package_id', package_id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } else {
      // 新建
      const { data, error } = await this.supabase
        .from('package_settlement_configs')
        .insert({
          package_id,
          settlement_type,
          commission_rate: settlement_type === 1 ? commission_rate : 0,
          settlement_price: settlement_type === 2 ? settlement_price : 0,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    }
  }

  /** 获取商家的套餐结算配置列表 */
  async getConfigsByMerchant(merchantId: string) {
    const { data: packages, error: pkgError } = await this.supabase
      .from('packages')
      .select('id, title, price, cover_image')
      .eq('merchant_id', merchantId);

    if (pkgError) throw pkgError;

    const packageIds = packages?.map((p) => p.id) || [];
    if (packageIds.length === 0) return [];

    const { data: configs, error: configError } = await this.supabase
      .from('package_settlement_configs')
      .select('*')
      .in('package_id', packageIds);

    if (configError) throw configError;

    const configMap = new Map(configs?.map((c) => [c.package_id, c]) || []);

    return packages?.map((pkg) => ({
      ...pkg,
      config: configMap.get(pkg.id) || null,
    }));
  }

  // ==================== 商家余额 ====================

  /** 获取商家余额 */
  async getBalance(merchantId: string) {
    const { data, error } = await this.supabase
      .from('merchant_balances')
      .select('*')
      .eq('merchant_id', merchantId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    // 如果不存在，创建初始余额
    if (!data) {
      const { data: newBalance, error: createError } = await this.supabase
        .from('merchant_balances')
        .insert({ merchant_id: merchantId })
        .select()
        .single();

      if (createError) throw createError;
      return newBalance;
    }

    return data;
  }

  // ==================== 结算记录 ====================

  /** 获取商家结算记录列表 */
  async getRecords(options: {
    merchantId: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    page: number;
    pageSize: number;
  }) {
    const { merchantId, status, startDate, endDate, page, pageSize } = options;

    let query = this.supabase
      .from('settlement_records')
      .select(`
        *,
        orders:order_id (id, order_no, created_at),
        packages:package_id (id, title, price, cover_image)
      `)
      .eq('merchant_id', merchantId)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }
    if (startDate) {
      query = query.gte('settlement_date', startDate);
    }
    if (endDate) {
      query = query.lte('settlement_date', endDate);
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) throw error;

    // 统计
    const { data: stats } = await this.supabase
      .from('settlement_records')
      .select('status, settlement_amount')
      .eq('merchant_id', merchantId);

    const statsMap = {
      pending: { count: 0, amount: 0 },
      settled: { count: 0, amount: 0 },
      withdrawn: { count: 0, amount: 0 },
    };

    stats?.forEach((item) => {
      if (statsMap[item.status]) {
        statsMap[item.status].count++;
        statsMap[item.status].amount += Number(item.settlement_amount) || 0;
      }
    });

    return {
      list: data,
      total: count || 0,
      page,
      pageSize,
      stats: statsMap,
    };
  }

  /** 获取结算记录详情 */
  async getRecordById(id: string) {
    const { data, error } = await this.supabase
      .from('settlement_records')
      .select(`
        *,
        orders:order_id (*),
        packages:package_id (*)
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  }

  /** 导出商家结算记录 */
  async exportRecords(options: {
    merchantId: string;
    startDate?: string;
    endDate?: string;
  }) {
    const { merchantId, startDate, endDate } = options;

    let query = this.supabase
      .from('settlement_records')
      .select(`
        *,
        orders:order_id (id, order_no, created_at, pay_time),
        packages:package_id (id, title, price)
      `)
      .eq('merchant_id', merchantId)
      .order('created_at', { ascending: false });

    if (startDate) {
      query = query.gte('settlement_date', startDate);
    }
    if (endDate) {
      query = query.lte('settlement_date', endDate);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data;
  }

  // ==================== 提现 ====================

  /** 申请提现 */
  async withdraw(body: { merchant_id: string; amount: number }) {
    const { merchant_id, amount } = body;

    if (amount <= 0) {
      throw new BadRequestException('提现金额必须大于0');
    }

    // 查询余额
    const balance = await this.getBalance(merchant_id);

    if (balance.balance < amount) {
      throw new BadRequestException('余额不足');
    }

    // 创建提现记录
    const { data: record, error: recordError } = await this.supabase
      .from('withdrawal_records')
      .insert({
        merchant_id,
        amount,
        status: 'pending',
      })
      .select()
      .single();

    if (recordError) throw recordError;

    // 扣减余额
    const { error: balanceError } = await this.supabase
      .from('merchant_balances')
      .update({
        balance: balance.balance - amount,
        total_withdrawn: balance.total_withdrawn + amount,
        updated_at: new Date().toISOString(),
      })
      .eq('merchant_id', merchant_id);

    if (balanceError) throw balanceError;

    return record;
  }

  /** 获取提现记录列表 */
  async getWithdrawals(options: { merchantId: string; status?: string }) {
    const { merchantId, status } = options;

    let query = this.supabase
      .from('withdrawal_records')
      .select('*')
      .eq('merchant_id', merchantId)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data;
  }

  // ==================== 平台佣金 ====================

  /** 获取平台佣金明细列表 */
  async getCommissionRecords(options: {
    startDate?: string;
    endDate?: string;
    page: number;
    pageSize: number;
  }) {
    const { startDate, endDate, page, pageSize } = options;

    let query = this.supabase
      .from('settlement_records')
      .select(`
        *,
        orders:order_id (id, order_no, created_at),
        packages:package_id (id, title),
        merchants:merchant_id (id, name)
      `)
      .order('created_at', { ascending: false });

    if (startDate) {
      query = query.gte('settlement_date', startDate);
    }
    if (endDate) {
      query = query.lte('settlement_date', endDate);
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) throw error;

    return {
      list: data,
      total: count || 0,
      page,
      pageSize,
    };
  }

  /** 导出平台佣金明细 */
  async exportCommissionRecords(options: {
    startDate?: string;
    endDate?: string;
  }) {
    const { startDate, endDate } = options;

    let query = this.supabase
      .from('settlement_records')
      .select(`
        *,
        orders:order_id (id, order_no, created_at),
        packages:package_id (id, title),
        merchants:merchant_id (id, name)
      `)
      .order('created_at', { ascending: false });

    if (startDate) {
      query = query.gte('settlement_date', startDate);
    }
    if (endDate) {
      query = query.lte('settlement_date', endDate);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data;
  }

  /** 获取平台佣金统计 */
  async getCommissionStats(options: { startDate?: string; endDate?: string }) {
    const { startDate, endDate } = options;

    let query = this.supabase
      .from('settlement_records')
      .select('commission_amount, settlement_amount, status');

    if (startDate) {
      query = query.gte('settlement_date', startDate);
    }
    if (endDate) {
      query = query.lte('settlement_date', endDate);
    }

    const { data, error } = await query;

    if (error) throw error;

    const stats = {
      totalCommission: 0,
      totalSettlement: 0,
      pendingCount: 0,
      settledCount: 0,
      withdrawnCount: 0,
    };

    data?.forEach((item) => {
      stats.totalCommission += Number(item.commission_amount) || 0;
      stats.totalSettlement += Number(item.settlement_amount) || 0;
      if (item.status === 'pending') stats.pendingCount++;
      if (item.status === 'settled') stats.settledCount++;
      if (item.status === 'withdrawn') stats.withdrawnCount++;
    });

    return stats;
  }

  // ==================== 订单结算 ====================

  /** 订单结算（订单支付成功后调用） */
  async createSettlementRecord(orderId: string) {
    // 查询订单
    const { data: order, error: orderError } = await this.supabase
      .from('orders')
      .select('*, packages:package_id (*)')
      .eq('id', orderId)
      .single();

    if (orderError) throw orderError;
    if (!order) throw new NotFoundException('订单不存在');

    // 查询结算配置
    const { data: config } = await this.supabase
      .from('package_settlement_configs')
      .select('*')
      .eq('package_id', order.package_id)
      .single();

    // 计算结算金额
    let commissionAmount = 0;
    let settlementAmount = 0;

    if (config) {
      if (config.settlement_type === 1) {
        // 佣金百分比
        commissionAmount = (order.final_amount * config.commission_rate) / 100;
        settlementAmount = order.final_amount - commissionAmount;
      } else {
        // 套餐结算价
        settlementAmount = config.settlement_price * order.quantity;
        commissionAmount = order.final_amount - settlementAmount;
      }
    } else {
      // 默认无佣金
      commissionAmount = 0;
      settlementAmount = order.final_amount;
    }

    // 计算结算日期（T+7）
    const settlementDate = new Date();
    settlementDate.setDate(settlementDate.getDate() + 7);

    // 创建结算记录
    const { data: record, error: recordError } = await this.supabase
      .from('settlement_records')
      .insert({
        order_id: orderId,
        merchant_id: order.merchant_id,
        package_id: order.package_id,
        order_amount: order.final_amount,
        settlement_type: config?.settlement_type || 1,
        commission_rate: config?.commission_rate || 0,
        commission_amount: commissionAmount,
        settlement_amount: settlementAmount,
        settlement_date: settlementDate.toISOString().split('T')[0],
        status: 'pending',
      })
      .select()
      .single();

    if (recordError) throw recordError;

    return record;
  }

  /** 结算打款（T+7自动结算） */
  async settleRecord(recordId: string) {
    const { data: record, error: recordError } = await this.supabase
      .from('settlement_records')
      .select('*')
      .eq('id', recordId)
      .single();

    if (recordError) throw recordError;
    if (!record) throw new NotFoundException('结算记录不存在');
    if (record.status !== 'pending') {
      throw new BadRequestException('该记录已结算或已提现');
    }

    // 更新记录状态
    const { error: updateError } = await this.supabase
      .from('settlement_records')
      .update({
        status: 'settled',
        settled_at: new Date().toISOString(),
      })
      .eq('id', recordId);

    if (updateError) throw updateError;

    // 更新商家余额
    const balance = await this.getBalance(record.merchant_id);
    const { error: balanceError } = await this.supabase
      .from('merchant_balances')
      .update({
        balance: balance.balance + record.settlement_amount,
        total_settled: balance.total_settled + record.settlement_amount,
        updated_at: new Date().toISOString(),
      })
      .eq('merchant_id', record.merchant_id);

    if (balanceError) throw balanceError;

    return record;
  }
}
