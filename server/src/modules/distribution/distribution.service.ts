import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { getSupabaseClient } from '@/storage/database/supabase-client';

/**
 * 三级分销服务（独立模块）
 *
 * 关系模型：
 * - distribution_members.inviter_id 记录直接上级（一级）
 * - 二级 = 上级的上级，三级 = 上级的上级的上级
 *
 * 分佣模型：
 * - 订单实付金额 × 各级比例（distribution_configs）
 * - 一级默认 10%、二级 5%、三级 2%（后台可调）
 * - distribution_commissions 以 (order_no, beneficiary_id, level) 唯一约束保证幂等
 *
 * 提现模型：
 * - 申请即冻结（available_commission 扣减）
 * - 审核通过 → withdrawn_commission 累加
 * - 审核驳回 → available_commission 回补
 */
@Injectable()
export class DistributionService {
  private readonly logger = new Logger(DistributionService.name);

  /** 获取分销配置（无记录时返回默认） */
  async getConfig() {
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from('distribution_configs')
      .select('id, enabled, level1_rate, level2_rate, level3_rate, min_withdraw')
      .order('id', { ascending: true })
      .limit(1)
      .maybeSingle();
    return {
      enabled: data?.enabled ?? true,
      level1_rate: Number(data?.level1_rate ?? 10),
      level2_rate: Number(data?.level2_rate ?? 5),
      level3_rate: Number(data?.level3_rate ?? 2),
      min_withdraw: Number(data?.min_withdraw ?? 10),
    };
  }

  async updateConfig(body: { enabled?: boolean; level1_rate?: number; level2_rate?: number; level3_rate?: number; min_withdraw?: number }) {
    const supabase = getSupabaseClient();
    const rates = [body.level1_rate, body.level2_rate, body.level3_rate].filter((v) => v !== undefined);
    if (rates.some((v) => isNaN(Number(v)) || Number(v) < 0 || Number(v) > 100)) {
      throw new BadRequestException('佣金比例必须在 0-100 之间');
    }
    const current = await this.getConfig();
    const merged = { ...current, ...body, updated_at: new Date().toISOString() };
    const { data: existing } = await supabase.from('distribution_configs').select('id').limit(1).maybeSingle();
    if (existing?.id) {
      await supabase.from('distribution_configs').update(merged).eq('id', existing.id);
    } else {
      await supabase.from('distribution_configs').insert(merged);
    }
    return this.getConfig();
  }

  /** 确保成员记录存在（首次接触分销体系时建档） */
  private async ensureMember(userId: string, inviterId?: string | null) {
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from('distribution_members')
      .select('id, user_id, inviter_id, status, total_commission, available_commission, withdrawn_commission')
      .eq('user_id', userId)
      .maybeSingle();
    if (data) return data;
    const { data: created, error } = await supabase
      .from('distribution_members')
      .insert({ user_id: userId, inviter_id: inviterId || null })
      .select('id, user_id, inviter_id, status, total_commission, available_commission, withdrawn_commission')
      .single();
    if (error) {
      // 并发下唯一冲突 → 重查
      const { data: again } = await supabase
        .from('distribution_members')
        .select('id, user_id, inviter_id, status, total_commission, available_commission, withdrawn_commission')
        .eq('user_id', userId)
        .maybeSingle();
      return again;
    }
    return created;
  }

  /**
   * 绑定上级（一级邀请人）
   * 规则：① 不能绑定自己 ② 已绑定不可改 ③ 不能形成环（上级的上级链上不能是自己）
   */
  async bindInviter(userId: string, inviterId: string) {
    if (!userId || !inviterId) throw new BadRequestException('user_id 与 inviter_id 均不能为空');
    if (userId === inviterId) throw new BadRequestException('不能邀请自己');

    const existing = await this.ensureMember(userId);
    if (existing?.inviter_id) {
      return { bound: false, inviter_id: existing.inviter_id, message: '已绑定过邀请人，不可更改' };
    }

    // 环检测：沿 inviter 向上最多走 3 级，遇到自己则拒绝
    const supabase = getSupabaseClient();
    let cursor: string | null = inviterId;
    for (let i = 0; i < 3 && cursor; i++) {
      if (cursor === userId) throw new BadRequestException('绑定失败：不能形成循环邀请');
      const { data: node } = await supabase
        .from('distribution_members')
        .select('inviter_id')
        .eq('user_id', cursor)
        .maybeSingle();
      cursor = node?.inviter_id || null;
    }

    // 确保上级也建档
    await this.ensureMember(inviterId);
    await supabase
      .from('distribution_members')
      .update({ inviter_id: inviterId, updated_at: new Date().toISOString() })
      .eq('user_id', userId);
    this.logger.log(`分销绑定: ${userId} ← ${inviterId}`);
    return { bound: true, inviter_id: inviterId };
  }

  /** 向上取三级上级链 */
  private async getUplineChain(userId: string): Promise<{ level: number; userId: string }[]> {
    const supabase = getSupabaseClient();
    const chain: { level: number; userId: string }[] = [];
    let cursor: string | null = userId;
    for (let level = 1; level <= 3; level++) {
      const { data: node } = await supabase
        .from('distribution_members')
        .select('inviter_id')
        .eq('user_id', cursor)
        .maybeSingle();
      const up: string | null = node?.inviter_id || null;
      if (!up) break;
      chain.push({ level, userId: up });
      cursor = up;
    }
    return chain;
  }

  /**
   * 订单分佣（幂等）
   * 触发点：支付成功回调 / 核销完成。以订单实付金额为基数。
   */
  async settleOrder(orderNo: string) {
    const supabase = getSupabaseClient();
    const { data: order } = await supabase
      .from('orders')
      .select('id, order_no, user_id, pay_amount, status')
      .eq('order_no', orderNo)
      .maybeSingle();
    if (!order) throw new BadRequestException('订单不存在');
    if (!['paid', 'verified', 'settled'].includes(order.status)) {
      return { settled: false, message: `订单状态 ${order.status} 不参与分佣` };
    }

    const config = await this.getConfig();
    if (!config.enabled) return { settled: false, message: '分销功能未启用' };

    const buyerId = order.user_id;
    await this.ensureMember(buyerId);
    const chain = await this.getUplineChain(buyerId);
    if (chain.length === 0) return { settled: false, message: '无上级，不产生佣金' };

    const rateMap: Record<number, number> = { 1: config.level1_rate, 2: config.level2_rate, 3: config.level3_rate };
    const base = Number(order.pay_amount) || 0;
    const results: any[] = [];

    for (const { level, userId } of chain) {
      const rate = rateMap[level] || 0;
      const commission = Math.round(base * rate) / 100; // 保留两位小数
      if (commission <= 0) continue;

      // 唯一索引 (order_no, beneficiary_id, level) 保证幂等
      const { error } = await supabase.from('distribution_commissions').insert({
        order_no: orderNo,
        buyer_id: buyerId,
        beneficiary_id: userId,
        level,
        order_amount: base,
        commission_amount: commission,
        status: 'settled',
      });
      if (error) {
        if (String(error.code) === '23505' || String(error.message).includes('duplicate')) {
          this.logger.log(`佣金已结算过，跳过: ${orderNo} L${level} → ${userId}`);
          continue;
        }
        this.logger.error(`佣金写入失败: ${error.message}`);
        continue;
      }

      // 累加到受益人账户
      const member = await this.ensureMember(userId);
      if (member) {
        await supabase
          .from('distribution_members')
          .update({
            total_commission: Number(member.total_commission || 0) + commission,
            available_commission: Number(member.available_commission || 0) + commission,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId);
      }
      results.push({ level, beneficiary_id: userId, commission });
    }

    this.logger.log(`订单分佣完成: ${orderNo} 基数¥${base} 共 ${results.length} 笔`);
    return { settled: true, base, commissions: results };
  }

  /** 我的分销概览 */
  async getOverview(userId: string) {
    if (!userId) throw new BadRequestException('userId 不能为空');
    const supabase = getSupabaseClient();
    const member = await this.ensureMember(userId);

    // 三级团队人数
    const { data: l1 } = await supabase.from('distribution_members').select('user_id').eq('inviter_id', userId);
    const l1Ids = (l1 || []).map((r: any) => r.user_id);
    let l2Ids: string[] = [];
    if (l1Ids.length > 0) {
      const { data: l2 } = await supabase.from('distribution_members').select('user_id').in('inviter_id', l1Ids);
      l2Ids = (l2 || []).map((r: any) => r.user_id);
    }
    let l3Count = 0;
    if (l2Ids.length > 0) {
      const { count } = await supabase
        .from('distribution_members')
        .select('id', { count: 'exact', head: true })
        .in('inviter_id', l2Ids);
      l3Count = count || 0;
    }

    // 今日佣金
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const { data: todayRows } = await supabase
      .from('distribution_commissions')
      .select('commission_amount')
      .eq('beneficiary_id', userId)
      .eq('status', 'settled')
      .gte('created_at', todayStart.toISOString());
    const todayCommission = (todayRows || []).reduce((s: number, r: any) => s + Number(r.commission_amount || 0), 0);

    const config = await this.getConfig();
    return {
      user_id: userId,
      inviter_id: member?.inviter_id || null,
      total_commission: Number(member?.total_commission || 0),
      available_commission: Number(member?.available_commission || 0),
      withdrawn_commission: Number(member?.withdrawn_commission || 0),
      today_commission: Math.round(todayCommission * 100) / 100,
      team: { level1: l1Ids.length, level2: l2Ids.length, level3: l3Count },
      rates: { level1: config.level1_rate, level2: config.level2_rate, level3: config.level3_rate },
      min_withdraw: config.min_withdraw,
    };
  }

  /** 团队列表（按层级，附昵称头像） */
  async getTeam(userId: string, level: number) {
    if (!userId) throw new BadRequestException('userId 不能为空');
    const supabase = getSupabaseClient();

    // 先拿直接下级
    const { data: l1 } = await supabase
      .from('distribution_members')
      .select('user_id, created_at')
      .eq('inviter_id', userId);
    const l1Rows = l1 || [];
    if (level === 1) return this.attachProfiles(l1Rows);

    const l1Ids = l1Rows.map((r: any) => r.user_id);
    if (l1Ids.length === 0) return [];
    const { data: l2 } = await supabase
      .from('distribution_members')
      .select('user_id, created_at')
      .in('inviter_id', l1Ids);
    const l2Rows = l2 || [];
    if (level === 2) return this.attachProfiles(l2Rows);

    const l2Ids = l2Rows.map((r: any) => r.user_id);
    if (l2Ids.length === 0) return [];
    const { data: l3 } = await supabase
      .from('distribution_members')
      .select('user_id, created_at')
      .in('inviter_id', l2Ids);
    return this.attachProfiles(l3 || []);
  }

  private async attachProfiles(rows: any[]) {
    if (rows.length === 0) return [];
    const supabase = getSupabaseClient();
    const ids = rows.map((r) => r.user_id);
    const { data: users } = await supabase.from('users').select('id, nick_name, avatar_url').in('id', ids);
    const map = new Map((users || []).map((u: any) => [u.id, u]));
    return rows.map((r) => ({
      user_id: r.user_id,
      nick_name: (map.get(r.user_id) as any)?.nick_name || '用户',
      avatar_url: (map.get(r.user_id) as any)?.avatar_url || null,
      joined_at: r.created_at,
    }));
  }

  /** 佣金明细 */
  async getCommissions(userId: string, page = 1, pageSize = 20) {
    if (!userId) throw new BadRequestException('userId 不能为空');
    const supabase = getSupabaseClient();
    const from = (page - 1) * pageSize;
    const { data, count } = await supabase
      .from('distribution_commissions')
      .select('id, order_no, buyer_id, level, order_amount, commission_amount, status, created_at', { count: 'exact' })
      .eq('beneficiary_id', userId)
      .order('created_at', { ascending: false })
      .range(from, from + pageSize - 1);
    return { list: data || [], total: count || 0, page, pageSize };
  }

  /** 申请提现 */
  async applyWithdraw(userId: string, amount: number) {
    if (!userId) throw new BadRequestException('user_id 不能为空');
    const num = Math.round(Number(amount) * 100) / 100;
    if (!num || num <= 0) throw new BadRequestException('提现金额无效');

    const config = await this.getConfig();
    if (num < config.min_withdraw) {
      throw new BadRequestException(`提现金额不能低于 ¥${config.min_withdraw}`);
    }

    const member = await this.ensureMember(userId);
    const available = Number(member?.available_commission || 0);
    if (num > available) {
      throw new BadRequestException(`可提现余额不足（当前 ¥${available.toFixed(2)}）`);
    }

    const supabase = getSupabaseClient();
    // 先冻结扣减
    await supabase
      .from('distribution_members')
      .update({ available_commission: Math.round((available - num) * 100) / 100, updated_at: new Date().toISOString() })
      .eq('user_id', userId);

    const { data, error } = await supabase
      .from('distribution_withdraws')
      .insert({ user_id: userId, amount: num, status: 'pending' })
      .select('id, amount, status, created_at')
      .single();
    if (error) {
      // 回补
      await supabase
        .from('distribution_members')
        .update({ available_commission: available, updated_at: new Date().toISOString() })
        .eq('user_id', userId);
      throw new BadRequestException('提现申请失败，请重试');
    }
    this.logger.log(`提现申请: ${userId} ¥${num}`);
    return data;
  }

  /** 我的提现记录 */
  async getWithdraws(userId: string) {
    if (!userId) throw new BadRequestException('userId 不能为空');
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from('distribution_withdraws')
      .select('id, amount, status, reject_reason, created_at, processed_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);
    return data || [];
  }

  /** 管理员：提现审核列表 */
  async adminWithdraws(status?: string) {
    const supabase = getSupabaseClient();
    let query = supabase
      .from('distribution_withdraws')
      .select('id, user_id, amount, status, reject_reason, created_at, processed_at')
      .order('created_at', { ascending: false })
      .limit(200);
    if (status) query = query.eq('status', status);
    const { data } = await query;
    // 附昵称
    const rows = data || [];
    const ids = [...new Set(rows.map((r: any) => r.user_id))];
    if (ids.length > 0) {
      const { data: users } = await supabase.from('users').select('id, nick_name').in('id', ids);
      const map = new Map((users || []).map((u: any) => [u.id, u.nick_name]));
      rows.forEach((r: any) => (r.nick_name = map.get(r.user_id) || '用户'));
    }
    return rows;
  }

  /** 管理员：审核提现 */
  async auditWithdraw(id: string, action: 'approve' | 'reject', rejectReason?: string) {
    const supabase = getSupabaseClient();
    const { data: record } = await supabase
      .from('distribution_withdraws')
      .select('id, user_id, amount, status')
      .eq('id', id)
      .maybeSingle();
    if (!record) throw new BadRequestException('提现记录不存在');
    if (record.status !== 'pending') throw new BadRequestException('该申请已处理过');

    const member = await this.ensureMember(record.user_id);
    if (action === 'approve') {
      await supabase
        .from('distribution_withdraws')
        .update({ status: 'approved', processed_at: new Date().toISOString() })
        .eq('id', id);
      await supabase
        .from('distribution_members')
        .update({
          withdrawn_commission: Math.round((Number(member?.withdrawn_commission || 0) + Number(record.amount)) * 100) / 100,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', record.user_id);
      this.logger.log(`提现已通过: ${id} ${record.user_id} ¥${record.amount}`);
      return { status: 'approved' };
    }

    // 驳回：回补可用余额
    await supabase
      .from('distribution_withdraws')
      .update({ status: 'rejected', reject_reason: rejectReason || '', processed_at: new Date().toISOString() })
      .eq('id', id);
    await supabase
      .from('distribution_members')
      .update({
        available_commission: Math.round((Number(member?.available_commission || 0) + Number(record.amount)) * 100) / 100,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', record.user_id);
    this.logger.log(`提现已驳回: ${id} ${record.user_id} ¥${record.amount} 原因:${rejectReason || '-'}`);
    return { status: 'rejected' };
  }
}
