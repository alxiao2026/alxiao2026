import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { SupabaseClient } from '@supabase/supabase-js';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class SettlementService {
  private readonly supabase: SupabaseClient = getSupabaseClient();

  constructor(private readonly notificationService: NotificationService) {}

  /** 商家端数据脱敏：剔除结算配置数字（佣金率/结算价仅平台管理员可见） */
  private stripConfigFields<T extends Record<string, any>>(rows: T[] | null): T[] {
    return (rows || []).map((row) => {
      const { settlement_type, commission_rate, settlement_price, ...rest } = row;
      return rest as T;
    });
  }

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
      .select('id, name, price, cover_image')
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
    merchantId?: string;
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
        packages:package_id (id, name, price, cover_image)
      `, { count: 'exact' })
      .order('created_at', { ascending: false });

    // merchant_id 可选：商家查本店，超管不传查看全部
    if (merchantId) {
      query = query.eq('merchant_id', merchantId);
    }

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
      list: this.stripConfigFields(data),
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
        packages:package_id (id, name, price)
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
    return this.stripConfigFields(data);
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

    // 通知2：商户资金提交提现成功通知
    await this.notificationService.notifyMerchant(merchant_id, 'withdraw_submitted', { amount });

    return record;
  }

  /** 管理员确认打款：提现已到账（通知1：商户资金提现到账通知）。强制要求打款凭证 */
  async markWithdrawalPaid(
    withdrawalId: string,
    adminUserId: string,
    proof: { payment_proof_image?: string; payment_transaction_no?: string; payment_proof_note?: string } = {},
  ) {
    await this.assertAdmin(adminUserId);

    // 强制打款凭证关卡：凭证图片 / 打款单号 / 文字说明，至少提供一项
    const proofImage = (proof.payment_proof_image || '').trim();
    const transactionNo = (proof.payment_transaction_no || '').trim();
    const proofNote = (proof.payment_proof_note || '').trim();
    if (!proofImage && !transactionNo && !proofNote) {
      throw new BadRequestException('请先上传打款凭证（凭证图片、打款单号或文字说明，至少提供一项）');
    }

    const { data: record, error: findError } = await this.supabase
      .from('withdrawal_records')
      .select('*')
      .eq('id', withdrawalId)
      .single();

    if (findError || !record) throw new NotFoundException('提现记录不存在');
    if (record.status === 'success') return record;
    if (record.status !== 'pending') {
      throw new BadRequestException('当前状态不可确认打款');
    }

    const { data, error } = await this.supabase
      .from('withdrawal_records')
      .update({
        status: 'success',
        payment_proof_image: proofImage || null,
        payment_transaction_no: transactionNo || null,
        payment_proof_note: proofNote || null,
        processed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', withdrawalId)
      .select()
      .single();

    if (error) throw error;

    // 通知1：商户资金提现到账通知
    await this.notificationService.notifyMerchant(record.merchant_id, 'withdraw_arrived', {
      amount: record.amount,
    });

    return data;
  }

  /** 获取提现记录列表 */
  /** 拒绝提现申请（超管）：状态置 rejected，金额退回商家余额 */
  async rejectWithdrawal(withdrawalId: string, adminUserId: string, reason?: string) {
    await this.assertAdmin(adminUserId);
    const { data: record, error: findError } = await this.supabase
      .from('withdrawal_records')
      .select('*')
      .eq('id', withdrawalId)
      .single();

    if (findError || !record) throw new NotFoundException('提现记录不存在');
    if (record.status !== 'pending') {
      throw new BadRequestException('该提现申请已处理，请勿重复操作');
    }

    const { data, error } = await this.supabase
      .from('withdrawal_records')
      .update({ status: 'rejected', updated_at: new Date().toISOString() })
      .eq('id', withdrawalId)
      .select()
      .single();
    if (error) throw error;

    // 退回余额：balance 加回、total_withdrawn 扣回
    const { data: balanceRow } = await this.supabase
      .from('merchant_balances')
      .select('balance, total_withdrawn')
      .eq('merchant_id', record.merchant_id)
      .maybeSingle();
    const currentBalance = Number(balanceRow?.balance || 0);
    const currentWithdrawn = Number(balanceRow?.total_withdrawn || 0);
    const refundAmount = Number(record.amount || 0);
    await this.supabase.from('merchant_balances').upsert(
      {
        merchant_id: record.merchant_id,
        balance: Math.round((currentBalance + refundAmount) * 100) / 100,
        total_withdrawn: Math.max(0, Math.round((currentWithdrawn - refundAmount) * 100) / 100),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'merchant_id' },
    );

    // 通知商户：提现被拒绝，金额已退回
    try {
      await this.notificationService.notifyMerchant(record.merchant_id, 'withdraw_rejected', {
        amount: record.amount,
        reason: reason || '',
      });
    } catch (e) {
      console.warn('[rejectWithdrawal] 通知发送失败:', (e as Error)?.message);
    }

    return data;
  }

  /** 超管权限校验（users.role === 'admin'） */
  private async assertAdmin(adminUserId: string) {
    if (!adminUserId) throw new ForbiddenException('缺少管理员身份');
    const { data: adminUser } = await this.supabase
      .from('users')
      .select('role')
      .eq('user_id', adminUserId)
      .maybeSingle();
    const roleText = String((adminUser as any)?.role || '').toLowerCase();
    if (!adminUser || roleText !== 'admin') {
      throw new ForbiddenException('仅平台管理员可执行此操作');
    }
  }

  async getWithdrawals(options: { merchantId?: string; status?: string; adminUserId?: string }) {
    const { merchantId, status, adminUserId } = options;

    let query = this.supabase
      .from('withdrawal_records')
      .select('*')
      .order('created_at', { ascending: false });

    if (adminUserId) {
      // 平台管理员：查看全部提现申请
      await this.assertAdmin(adminUserId);
    } else {
      if (!merchantId) throw new BadRequestException('缺少 merchant_id');
      query = query.eq('merchant_id', merchantId);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) throw error;
    const rows = data || [];

    // 关联门店名称 + 商家收款银行卡信息（管理员打款时使用）
    const merchantIds = [...new Set(rows.map((r: any) => Number(r.merchant_id)).filter(Boolean))];
    const nameMap: Record<number, string> = {};
    const bankMap: Record<number, { bank_account_name?: string; bank_card_no?: string; bank_name?: string; bank_branch?: string }> = {};
    if (merchantIds.length > 0) {
      const { data: merchants } = await this.supabase
        .from('merchants')
        .select('id, name')
        .in('id', merchantIds);
      (merchants || []).forEach((m: any) => {
        nameMap[Number(m.id)] = m.name;
      });

      const { data: quals, error: qualError } = await this.supabase
        .from('merchant_qualifications')
        .select('merchant_id, bank_account_name, bank_card_no, bank_name, bank_branch')
        .in('merchant_id', merchantIds);
      if (qualError) {
        console.warn('[getWithdrawals] 查询商家收款信息失败:', qualError.message);
      }
      (quals || []).forEach((q: any) => {
        bankMap[Number(q.merchant_id)] = q;
      });
    }

    return rows.map((r: any) => {
      const bank = bankMap[Number(r.merchant_id)] || {};
      return {
        ...r,
        merchant_name: nameMap[Number(r.merchant_id)] || '',
        bank_account_name: bank.bank_account_name || '',
        bank_card_no: bank.bank_card_no || '',
        bank_name: bank.bank_name || '',
        bank_branch: bank.bank_branch || '',
      };
    });
  }

  // ==================== 平台佣金 ====================

  /** 获取平台佣金明细列表 */
  /** 平台佣金汇总（全部记录，不分页） */
  async getCommissionSummary() {
    const { data, error } = await this.supabase
      .from('settlement_records')
      .select('commission_amount, settlement_amount')
      .neq('status', 'revoked');

    if (error) throw error;

    const summary = {
      total_commission: 0,
      total_settlement: 0,
      total_orders: (data || []).length,
    };
    (data || []).forEach((item) => {
      summary.total_commission += Number(item.commission_amount) || 0;
      summary.total_settlement += Number(item.settlement_amount) || 0;
    });
    return summary;
  }

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
        orders:order_id (id, order_no, created_at, paid_at, verified_at),
        packages:package_id (id, name),
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
        orders:order_id (id, order_no, created_at, paid_at, verified_at),
        packages:package_id (id, name),
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
      .select('commission_amount, settlement_amount, status')
      .neq('status', 'revoked');

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

    // 商家ID：orders 表无 merchant_id 列，需从关联套餐获取（packages.merchant_id 为 varchar）
    const merchantId = order.packages?.merchant_id
      ? Number(order.packages.merchant_id)
      : null;

    // 以商家当前结算模式为准（佣金百分比 / 套餐结算价互斥，切换后另一种模式自动失效）
    const { data: merchantConfig } = merchantId
      ? await this.supabase
          .from('merchants')
          .select('settlement_type, commission_rate')
          .eq('id', merchantId)
          .single()
      : { data: null };

    let settlementType: number;
    let commissionRate = 0;
    let settlementPrice = 0;

    if (merchantConfig?.settlement_type === 2) {
      // 结算价模式：取该套餐的结算价配置，未配置则无法结算
      const { data: packageConfig } = await this.supabase
        .from('package_settlement_configs')
        .select('settlement_price')
        .eq('package_id', order.package_id)
        .single();
      if (!packageConfig || packageConfig.settlement_price == null || Number(packageConfig.settlement_price) <= 0) {
        throw new BadRequestException('该套餐未配置结算价，请先在管理后台编辑商家完成套餐结算价设置');
      }
      settlementType = 2;
      settlementPrice = Number(packageConfig.settlement_price);
    } else if (merchantConfig?.settlement_type === 1 && merchantConfig.commission_rate != null) {
      // 佣金百分比模式：使用商家级佣金率
      settlementType = 1;
      commissionRate = Number(merchantConfig.commission_rate);
    } else {
      throw new BadRequestException('商家未配置结算方式，请先在管理后台编辑商家完成结算配置');
    }

    // 计算结算金额
    let commissionAmount = 0;
    let settlementAmount = 0;

    if (settlementType === 1) {
      // 佣金百分比
      commissionAmount = (order.pay_amount * commissionRate) / 100;
      settlementAmount = order.pay_amount - commissionAmount;
    } else {
      // 套餐结算价
      settlementAmount = settlementPrice * order.quantity;
      commissionAmount = order.pay_amount - settlementAmount;
    }

    // 计算结算日期（T+7）
    const settlementDate = new Date();
    settlementDate.setDate(settlementDate.getDate() + 7);

    // 创建结算记录
    const { data: record, error: recordError } = await this.supabase
      .from('settlement_records')
      .insert({
        order_id: orderId,
        merchant_id: merchantId,
        package_id: order.package_id,
        order_amount: order.pay_amount,
        settlement_type: settlementType,
        commission_rate: commissionRate,
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

  // ==================== 核销结算（订单核销时由 OrderService 调用） ====================

  /**
   * 核销结算：按套餐结算配置生成结算记录并更新商家余额
   * 容错设计：内部捕获异常，不影响核销主流程
   * @param order 订单对象（需含 id/package_id/quantity/pay_amount/price）
   * @param verifyCount 本次核销份数
   */
  async settleOrder(order: any, verifyCount: number): Promise<void> {
    try {
      if (!order?.package_id || !order?.id || verifyCount <= 0) return;

      const { data: pkg } = await this.supabase
        .from('packages')
        .select('id, merchant_id, name')
        .eq('id', order.package_id)
        .maybeSingle();
      if (!pkg || (pkg as any).merchant_id === null || (pkg as any).merchant_id === undefined) return;
      const merchantId = Number((pkg as any).merchant_id);

      // 查结算配置
      const { data: config } = await this.supabase
        .from('package_settlement_configs')
        .select('*')
        .eq('package_id', order.package_id)
        .maybeSingle();

      // 本次核销份数对应的订单金额（按实付均摊到每份）
      const payAmount = Number(order.pay_amount ?? order.price ?? 0);
      const qty = Math.max(Number(order.quantity) || 1, 1);
      const orderAmount = Math.round((payAmount / qty) * verifyCount * 100) / 100;

      let settlementType = 1;
      let commissionRate = 0;
      let commissionAmount = 0;
      let settlementAmount = orderAmount;

      if (config) {
        settlementType = Number((config as any).settlement_type) || 1;
        const settlementPrice = (config as any).settlement_price;
        if (settlementType === 2 && settlementPrice !== null && settlementPrice !== undefined) {
          // 协议结算价模式：商家按协议价结算，实付与协议价的差额为平台佣金
          settlementAmount = Math.round(Number(settlementPrice) * verifyCount * 100) / 100;
          commissionAmount = Math.round((orderAmount - settlementAmount) * 100) / 100;
          if (commissionAmount < 0) commissionAmount = 0; // 协议价高于实付时平台不倒贴
          commissionRate = orderAmount > 0 ? Math.round((commissionAmount / orderAmount) * 10000) / 100 : 0;
        } else {
          // 佣金比例模式（百分比）
          commissionRate = Number((config as any).commission_rate) || 0;
          commissionAmount = Math.round(orderAmount * commissionRate) / 100;
          settlementAmount = Math.round((orderAmount - commissionAmount) * 100) / 100;
        }
      }

      // 创建/更新结算记录（order_id 有唯一约束）：
      // 1) 同一订单分多次部分核销 → 在原记录上累计金额
      // 2) 撤销核销后重新核销 → 复活原记录（revoked → settled，按本次金额重新计算）
      const now = new Date();
      const { data: existing } = await this.supabase
        .from('settlement_records')
        .select('id, status, order_amount, commission_amount, settlement_amount')
        .eq('order_id', order.id)
        .maybeSingle();

      let finalOrderAmount = orderAmount;
      let finalCommission = commissionAmount;
      let finalSettlement = settlementAmount;
      if (existing && (existing as any).status !== 'revoked') {
        finalOrderAmount = Math.round((Number((existing as any).order_amount) + orderAmount) * 100) / 100;
        finalCommission = Math.round((Number((existing as any).commission_amount) + commissionAmount) * 100) / 100;
        finalSettlement = Math.round((Number((existing as any).settlement_amount) + settlementAmount) * 100) / 100;
      }
      const finalRate = finalOrderAmount > 0 ? Math.round((finalCommission / finalOrderAmount) * 10000) / 100 : 0;

      const { error: saveError } = await this.supabase.from('settlement_records').upsert({
        order_id: order.id,
        merchant_id: merchantId,
        package_id: order.package_id,
        order_amount: finalOrderAmount,
        settlement_type: settlementType,
        commission_rate: finalRate,
        commission_amount: finalCommission,
        settlement_amount: finalSettlement,
        settlement_date: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`,
        status: 'settled',
        settled_at: now.toISOString(),
      }, { onConflict: 'order_id' });
      if (saveError) throw new Error(saveError.message);

      // 更新商家余额（不存在则创建）
      const { data: balanceRow } = await this.supabase
        .from('merchant_balances')
        .select('*')
        .eq('merchant_id', merchantId)
        .maybeSingle();

      if (balanceRow) {
        const { error: updateError } = await this.supabase
          .from('merchant_balances')
          .update({
            balance: Math.round((Number((balanceRow as any).balance) + settlementAmount) * 100) / 100,
            total_settled: Math.round((Number((balanceRow as any).total_settled) + settlementAmount) * 100) / 100,
            updated_at: now.toISOString(),
          })
          .eq('merchant_id', merchantId);
        if (updateError) throw new Error(updateError.message);
      } else {
        const { error: createError } = await this.supabase.from('merchant_balances').insert({
          merchant_id: merchantId,
          balance: settlementAmount,
          total_settled: settlementAmount,
          total_withdrawn: 0,
        });
        if (createError) throw new Error(createError.message);
      }
    } catch (e) {
      console.error('[settleOrder] 核销结算失败:', e);
    }
  }

  /**
   * 回滚订单结算：撤销核销时调用，容错设计不影响撤销主流程
   * - 全部撤销（revokeCount >= verifiedCountBefore 或未传）：记录标记 revoked、金额清零、全额扣回商家余额（幂等）
   * - 部分撤销（revokeCount < verifiedCountBefore）：按份数比例回滚佣金/结算额并扣回对应余额，记录保持 settled
   */
  async rollbackOrderSettlement(
    orderId: string,
    revokeCount?: number,
    verifiedCountBefore?: number,
  ): Promise<void> {
    try {
      const { data: records } = await this.supabase
        .from('settlement_records')
        .select('id, merchant_id, order_amount, commission_amount, settlement_amount')
        .eq('order_id', orderId)
        .neq('status', 'revoked');
      if (!records || records.length === 0) return;

      const record = records[0] as any;
      const merchantId = Number(record.merchant_id);
      const recordCommission = Number(record.commission_amount) || 0;
      const recordSettlement = Number(record.settlement_amount) || 0;
      const recordOrderAmount = Number(record.order_amount) || 0;

      // 是否部分回滚
      const isPartial =
        !!revokeCount &&
        !!verifiedCountBefore &&
        revokeCount > 0 &&
        revokeCount < verifiedCountBefore;

      let rollbackSettlement = recordSettlement;

      if (isPartial) {
        // 按撤销份数占撤销前核销份数的比例回滚
        const ratio = revokeCount / (verifiedCountBefore as number);
        const rbCommission = Math.round(recordCommission * ratio * 100) / 100;
        const rbSettlement = Math.round(recordSettlement * ratio * 100) / 100;
        const rbOrderAmount = Math.round(recordOrderAmount * ratio * 100) / 100;
        rollbackSettlement = rbSettlement;

        const newCommission = Math.round((recordCommission - rbCommission) * 100) / 100;
        const newSettlement = Math.round((recordSettlement - rbSettlement) * 100) / 100;
        const newOrderAmount = Math.round((recordOrderAmount - rbOrderAmount) * 100) / 100;
        const newRate = newOrderAmount > 0
          ? Math.round((newCommission / newOrderAmount) * 10000) / 100
          : 0;

        await this.supabase
          .from('settlement_records')
          .update({
            order_amount: newOrderAmount,
            commission_amount: newCommission,
            settlement_amount: newSettlement,
            commission_rate: newRate,
          })
          .eq('id', record.id);
      } else {
        // 全部撤销：标记 revoked，佣金与结算额清零（不结算佣金），保留历史轨迹
        await this.supabase
          .from('settlement_records')
          .update({ status: 'revoked', commission_amount: 0, settlement_amount: 0 })
          .eq('order_id', orderId)
          .neq('status', 'revoked');
      }

      if (rollbackSettlement > 0) {
        const { data: balanceRow } = await this.supabase
          .from('merchant_balances')
          .select('*')
          .eq('merchant_id', merchantId)
          .maybeSingle();
        if (balanceRow) {
          const newBalance = Math.max(
            0,
            Math.round((Number((balanceRow as any).balance) - rollbackSettlement) * 100) / 100,
          );
          const newTotalSettled = Math.max(
            0,
            Math.round((Number((balanceRow as any).total_settled) - rollbackSettlement) * 100) / 100,
          );
          await this.supabase
            .from('merchant_balances')
            .update({
              balance: newBalance,
              total_settled: newTotalSettled,
              updated_at: new Date().toISOString(),
            })
            .eq('merchant_id', merchantId);
        }
      }
    } catch (e) {
      console.error('[rollbackOrderSettlement] 结算回滚失败:', e);
    }
  }

  /**
   * 历史补账：为已核销但缺少结算记录的订单补建结算（仅超级管理员）
   */
  async backfillSettlements(adminUserId: string) {
    // user_id 可能存在多条记录，maybeSingle 会返回 null，改用 limit(1)
    const { data: adminUsers, error: userError } = await this.supabase
      .from('users')
      .select('role')
      .eq('user_id', adminUserId)
      .limit(1);
    if (userError) console.warn(`补账权限查询失败: ${userError.message}`);
    const adminUser = adminUsers && adminUsers[0];
    // 角色编码：2=系统管理员；role 原始值兼容 admin / super_admin 两种写法
    const roleCode = Number((adminUser as any)?.role_code ?? -1);
    const roleText = String((adminUser as any)?.role ?? '');
    const isAdmin = roleCode === 2 || roleText === 'admin' || roleText === 'super_admin';
    if (!isAdmin) throw new BadRequestException('仅超级管理员可执行补账');

    const { data: orders, error } = await this.supabase
      .from('orders')
      .select('id, package_id, quantity, verified_count, pay_amount, price, status')
      .gt('verified_count', 0);
    if (error) throw new Error(error.message);

    let created = 0;
    let skipped = 0;
    for (const order of orders || []) {
      const { data: existing } = await this.supabase
        .from('settlement_records')
        .select('order_id')
        .eq('order_id', (order as any).id)
        .limit(1);
      if (existing && existing.length > 0) {
        skipped++;
        continue;
      }
      // 走统一的结算逻辑（金额计算容错，不抛异常）
      await this.settleOrder(order, Number((order as any).verified_count) || 1);
      created++;
    }

    return { total: (orders || []).length, created, skipped };
  }
}
