import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { getSupabaseClient } from '@/storage/database/supabase-client';

/**
 * 二级分销 + 分账体系（符合微信小程序审核要求）
 *
 * 合规说明：分销层级严格限制为两级（一级种草官 / 二级种草官），不向下延伸，
 * 规避多级分销（≥3 级）被微信判定为类传销的审核风险。
 *
 * 关系模型：
 * - distribution_members.inviter_id 记录直接上级（一级）
 * - 二级 = 上级的上级，最多取两级
 *
 * 分账模型（订单金额三分，默认 70/20/10，可由后台调整）：
 * - 商家基础收入 = 订单实付 × merchant_rate（默认 70%），核销后解冻给商家
 * - 分销激励池   = 订单实付 × pool_rate（默认 20%），在池内按比例拆分给两级种草官
 *     · 一级 = 池 × level1_rate（默认 60%）
 *     · 二级 = 池 × level2_rate（默认 40%）
 *     例：100 元订单 → 池 20 元 → 一级 12 元、二级 8 元
 * - 平台服务费   = 订单实付 × platform_rate（默认 10%）
 *
 * 佣金状态机（防退款/防羊毛的核心）：
 * - 支付成功 → 产生佣金，settle_status = 'pending'（待入账），available_at = 当下 + cooling_days(默认 7 天)
 * - 冷静期内用户退款 → 该订单 pending 佣金被 revokeByOrder 回收（settle_status = 'revoked'）
 * - 超过冷静期 → releaseMatured 将 pending 转为 'settled'（可提现），并划入 available_commission
 *
 * 账户模型（distribution_members）：
 * - total_commission      累计佣金（含待入账）
 * - pending_commission    待入账（冷静期内，不可提）
 * - available_commission  可提现（已过冷静期）
 * - withdrawn_commission  已提现
 *
 * 说明：真实微信支付服务商分账（资金冻结/解冻/转账到零钱）需商户号与资质，
 * 本模块实现完整记账与状态流转，结构可在持资质后平滑对接微信分账接口。
 */
@Injectable()
export class DistributionService {
  private readonly logger = new Logger(DistributionService.name);

  /** 获取分销/分账配置（无记录时返回默认） */
  async getConfig() {
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from('distribution_configs')
      .select('id, enabled, level1_rate, level2_rate, min_withdraw, bind_expire_days, merchant_rate, pool_rate, platform_rate, cooling_days')
      .order('id', { ascending: true })
      .limit(1)
      .maybeSingle();
    return {
      enabled: data?.enabled ?? true,
      // 一级/二级：占「分销激励池」的比例（默认 60/40）
      level1_rate: Number(data?.level1_rate ?? 60),
      level2_rate: Number(data?.level2_rate ?? 40),
      // 订单金额三分：商家/分销池/平台（默认 70/20/10）
      merchant_rate: Number(data?.merchant_rate ?? 70),
      pool_rate: Number(data?.pool_rate ?? 20),
      platform_rate: Number(data?.platform_rate ?? 10),
      // 冷静期天数（防退款），默认 7
      cooling_days: Number(data?.cooling_days ?? 7),
      min_withdraw: Number(data?.min_withdraw ?? 1),
      bind_expire_days: Number(data?.bind_expire_days ?? 0),
    };
  }

  async updateConfig(body: {
    enabled?: boolean;
    level1_rate?: number;
    level2_rate?: number;
    merchant_rate?: number;
    pool_rate?: number;
    platform_rate?: number;
    cooling_days?: number;
    min_withdraw?: number;
    bind_expire_days?: number;
  }) {
    const supabase = getSupabaseClient();
    const current = await this.getConfig();
    const merged = { ...current, ...body };

    // 池内占比校验：一级 + 二级 = 100
    const l1 = Number(merged.level1_rate);
    const l2 = Number(merged.level2_rate);
    if ([l1, l2].some((v) => isNaN(v) || v < 0 || v > 100)) {
      throw new BadRequestException('一级/二级比例须在 0-100 之间');
    }
    if (Math.abs(l1 + l2 - 100) > 0.001) {
      throw new BadRequestException(`一级 + 二级比例须等于 100%（当前 ${l1 + l2}%）`);
    }
    // 订单三分校验：商家 + 分销池 + 平台 = 100
    const mr = Number(merged.merchant_rate);
    const pr = Number(merged.pool_rate);
    const pfr = Number(merged.platform_rate);
    if ([mr, pr, pfr].some((v) => isNaN(v) || v < 0 || v > 100)) {
      throw new BadRequestException('商家/分销池/平台比例须在 0-100 之间');
    }
    if (Math.abs(mr + pr + pfr - 100) > 0.001) {
      throw new BadRequestException(`商家 + 分销池 + 平台比例须等于 100%（当前 ${mr + pr + pfr}%）`);
    }
    if (merged.cooling_days !== undefined && (isNaN(Number(merged.cooling_days)) || Number(merged.cooling_days) < 0)) {
      throw new BadRequestException('冷静期天数必须为不小于 0 的整数');
    }
    if (merged.bind_expire_days !== undefined && (isNaN(Number(merged.bind_expire_days)) || Number(merged.bind_expire_days) < 0)) {
      throw new BadRequestException('绑定有效天数必须为不小于 0 的整数（0 表示永久有效）');
    }

    const payload = { ...merged, updated_at: new Date().toISOString() };
    const { data: existing } = await supabase.from('distribution_configs').select('id').limit(1).maybeSingle();
    if (existing?.id) {
      await supabase.from('distribution_configs').update(payload).eq('id', existing.id);
    } else {
      await supabase.from('distribution_configs').insert(payload);
    }
    return this.getConfig();
  }

  /** 确保成员记录存在（首次接触分销体系时建档） */
  private async ensureMember(userId: string, inviterId?: string | null) {
    const supabase = getSupabaseClient();
    const cols = 'id, user_id, inviter_id, status, total_commission, pending_commission, available_commission, withdrawn_commission, bound_at';
    const { data } = await supabase.from('distribution_members').select(cols).eq('user_id', userId).maybeSingle();
    if (data) return data;
    const { data: created, error } = await supabase
      .from('distribution_members')
      .insert({ user_id: userId, inviter_id: inviterId || null, bound_at: inviterId ? new Date().toISOString() : null })
      .select(cols)
      .single();
    if (error) {
      // 并发下唯一冲突 → 重查
      const { data: again } = await supabase.from('distribution_members').select(cols).eq('user_id', userId).maybeSingle();
      return again;
    }
    return created;
  }

  /**
   * 判断绑定关系是否在有效期内
   * @param boundAt 绑定时间（null 兼容历史数据，视为有效）
   * @param expireDays 有效天数（0 表示永久有效）
   */
  private isBindingActive(boundAt: string | null | undefined, expireDays: number): boolean {
    if (!expireDays || expireDays <= 0) return true;
    if (!boundAt) return true;
    const expireMs = new Date(boundAt).getTime() + expireDays * 86400000;
    return Date.now() < expireMs;
  }

  /**
   * 绑定上级（一级邀请人）
   * 规则：① 不能绑定自己 ② 已绑定不可改（过期可重绑）③ 不能形成环
   */
  async bindInviter(userId: string, inviterId: string) {
    if (!userId || !inviterId) throw new BadRequestException('user_id 与 inviter_id 均不能为空');
    if (userId === inviterId) throw new BadRequestException('不能邀请自己');

    const existing = await this.ensureMember(userId);
    if (existing?.inviter_id) {
      // 已绑定且在有效期内 → 幂等返回；已过期 → 允许重新绑定新上级
      const config = await this.getConfig();
      if (this.isBindingActive((existing as any).bound_at, config.bind_expire_days)) {
        return { bound: false, inviter_id: existing.inviter_id, message: '已绑定过邀请人，不可更改' };
      }
      this.logger.log(`绑定已过期(${config.bind_expire_days}天)，允许重新绑定: ${userId}`);
    }

    // 环检测：沿 inviter 向上最多走 3 级，遇到自己则拒绝
    const supabase = getSupabaseClient();
    let cursor: string | null = inviterId;
    for (let i = 0; i < 3 && cursor; i++) {
      if (cursor === userId) throw new BadRequestException('绑定失败：不能形成循环邀请');
      const { data: node } = await supabase.from('distribution_members').select('inviter_id').eq('user_id', cursor).maybeSingle();
      cursor = node?.inviter_id || null;
    }

    // 确保上级也建档
    await this.ensureMember(inviterId);
    await supabase
      .from('distribution_members')
      .update({ inviter_id: inviterId, bound_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('user_id', userId);
    this.logger.log(`分销绑定: ${userId} ← ${inviterId}`);
    return { bound: true, inviter_id: inviterId };
  }

  /**
   * 向上取两级有效上级链（合规：严格两级）。
   * 绑定已过期（超过 bind_expire_days）则断链，不再向上分佣。
   */
  private async getUplineChain(userId: string): Promise<{ level: number; userId: string }[]> {
    const supabase = getSupabaseClient();
    const config = await this.getConfig();
    const expireDays = config.bind_expire_days;
    const chain: { level: number; userId: string }[] = [];
    let cursor: string | null = userId;
    for (let level = 1; level <= 2; level++) {
      const { data: node } = await supabase
        .from('distribution_members')
        .select('inviter_id, bound_at')
        .eq('user_id', cursor)
        .maybeSingle();
      const up: string | null = node?.inviter_id || null;
      if (!up) break;
      // 该级绑定已过期 → 断链，本级及以上均不再分佣
      if (!this.isBindingActive(node?.bound_at || null, expireDays)) break;
      chain.push({ level, userId: up });
      cursor = up;
    }
    return chain;
  }

  /**
   * 订单分账/分佣（幂等）
   * 触发点：支付成功回调。以订单实付金额为基数，按「分销池」拆分给两级种草官。
   * 佣金初始为「待入账」(pending)，冷静期后可提现。
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

    const base = Math.round((Number(order.pay_amount) || 0) * 100) / 100;
    // 订单金额三分
    const merchantShare = Math.round(base * config.merchant_rate) / 100;
    const pool = Math.round(base * config.pool_rate) / 100;
    const platformShare = Math.round(base * config.platform_rate) / 100;

    const availableAt = new Date(Date.now() + config.cooling_days * 86400000).toISOString();
    const rateMap: Record<number, number> = { 1: config.level1_rate, 2: config.level2_rate };
    const results: any[] = [];

    for (const { level, userId } of chain) {
      const rate = rateMap[level] || 0;
      const commission = Math.round(pool * rate) / 100; // 池内拆分，保留两位小数
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
        settle_status: 'pending',
        available_at: availableAt,
      });
      if (error) {
        if (String(error.code) === '23505' || String(error.message).includes('duplicate')) {
          this.logger.log(`佣金已结算过，跳过: ${orderNo} L${level} → ${userId}`);
          continue;
        }
        this.logger.error(`佣金写入失败: ${error.message}`);
        continue;
      }

      // 累加到受益人：total + pending（待入账，冷静期后才可提）
      const member = await this.ensureMember(userId);
      if (member) {
        await supabase
          .from('distribution_members')
          .update({
            total_commission: Math.round((Number(member.total_commission || 0) + commission) * 100) / 100,
            pending_commission: Math.round((Number(member.pending_commission || 0) + commission) * 100) / 100,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId);
      }
      results.push({ level, beneficiary_id: userId, commission, available_at: availableAt });
    }

    this.logger.log(
      `订单分账完成: ${orderNo} 实付¥${base} 商家¥${merchantShare} 分销池¥${pool} 平台¥${platformShare} 佣金 ${results.length} 笔`,
    );
    return { settled: true, base, merchant_share: merchantShare, pool, platform_share: platformShare, commissions: results };
  }

  /**
   * 释放已过冷静期的佣金：pending → settled，划入可提现余额。
   * 懒触发：在概览/明细/提现前调用；传 userId 仅处理该用户，否则全量。
   */
  async releaseMatured(userId?: string) {
    const supabase = getSupabaseClient();
    const now = new Date().toISOString();
    let query = supabase
      .from('distribution_commissions')
      .select('id, beneficiary_id, commission_amount')
      .eq('settle_status', 'pending')
      .lte('available_at', now);
    if (userId) query = query.eq('beneficiary_id', userId);
    const { data: matured } = await query;
    if (!matured || matured.length === 0) return { released: 0 };

    let released = 0;
    for (const row of matured) {
      const amount = Number(row.commission_amount || 0);
      const { error } = await supabase
        .from('distribution_commissions')
        .update({ settle_status: 'settled' })
        .eq('id', row.id)
        .eq('settle_status', 'pending'); // 幂等：仅当仍是 pending 才转
      if (error) continue;
      const member = await this.ensureMember(row.beneficiary_id);
      if (member) {
        await supabase
          .from('distribution_members')
          .update({
            pending_commission: Math.max(0, Math.round((Number(member.pending_commission || 0) - amount) * 100) / 100),
            available_commission: Math.round((Number(member.available_commission || 0) + amount) * 100) / 100,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', row.beneficiary_id);
      }
      released++;
    }
    if (released > 0) this.logger.log(`佣金释放: ${released} 笔 pending→settled`);
    return { released };
  }

  /**
   * 退款逆向分账：回收该订单所有佣金。
   * - 仍处冷静期(pending)：直接作废并扣回 pending。
   * - 已过冷静期(settled)/已提现：从 available 扣减（允许为负，下次佣金抵扣），记 remark。
   */
  async revokeByOrder(orderNo: string, reason = '退款回收') {
    const supabase = getSupabaseClient();
    const { data: rows } = await supabase
      .from('distribution_commissions')
      .select('id, beneficiary_id, commission_amount, settle_status')
      .eq('order_no', orderNo)
      .neq('settle_status', 'revoked');
    if (!rows || rows.length === 0) return { revoked: 0 };

    let revoked = 0;
    for (const row of rows) {
      const amount = Number(row.commission_amount || 0);
      const member = await this.ensureMember(row.beneficiary_id);
      await supabase
        .from('distribution_commissions')
        .update({ settle_status: 'revoked', remark: reason })
        .eq('id', row.id);
      if (member) {
        if (row.settle_status === 'pending') {
          await supabase
            .from('distribution_members')
            .update({
              total_commission: Math.max(0, Math.round((Number(member.total_commission || 0) - amount) * 100) / 100),
              pending_commission: Math.max(0, Math.round((Number(member.pending_commission || 0) - amount) * 100) / 100),
              updated_at: new Date().toISOString(),
            })
            .eq('user_id', row.beneficiary_id);
        } else {
          // 已结算/已提现 → 从可提现余额扣回（可为负，后续佣金抵扣）
          await supabase
            .from('distribution_members')
            .update({
              total_commission: Math.max(0, Math.round((Number(member.total_commission || 0) - amount) * 100) / 100),
              available_commission: Math.round((Number(member.available_commission || 0) - amount) * 100) / 100,
              updated_at: new Date().toISOString(),
            })
            .eq('user_id', row.beneficiary_id);
        }
      }
      revoked++;
    }
    this.logger.log(`退款逆向分账: ${orderNo} 回收 ${revoked} 笔佣金`);
    return { revoked };
  }

  /** 我的分销概览（两级） */
  async getOverview(userId: string) {
    if (!userId) throw new BadRequestException('userId 不能为空');
    // 懒释放到期佣金，保证展示的是最新可提余额
    await this.releaseMatured(userId);
    const supabase = getSupabaseClient();
    const member = await this.ensureMember(userId);

    // 两级团队人数
    const { data: l1 } = await supabase.from('distribution_members').select('user_id').eq('inviter_id', userId);
    const l1Ids = (l1 || []).map((r: any) => r.user_id);
    let l2Ids: string[] = [];
    if (l1Ids.length > 0) {
      const { data: l2 } = await supabase.from('distribution_members').select('user_id').in('inviter_id', l1Ids);
      l2Ids = (l2 || []).map((r: any) => r.user_id);
    }

    // 今日预估收入（今日产生的佣金，含待入账）
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const { data: todayRows } = await supabase
      .from('distribution_commissions')
      .select('commission_amount')
      .eq('beneficiary_id', userId)
      .neq('settle_status', 'revoked')
      .gte('created_at', todayStart.toISOString());
    const todayCommission = (todayRows || []).reduce((s: number, r: any) => s + Number(r.commission_amount || 0), 0);

    const config = await this.getConfig();
    return {
      user_id: userId,
      inviter_id: member?.inviter_id || null,
      total_commission: Number(member?.total_commission || 0),
      pending_commission: Number(member?.pending_commission || 0),
      available_commission: Number(member?.available_commission || 0),
      withdrawn_commission: Number(member?.withdrawn_commission || 0),
      today_commission: Math.round(todayCommission * 100) / 100,
      team: { level1: l1Ids.length, level2: l2Ids.length },
      team_total: l1Ids.length + l2Ids.length,
      rates: {
        level1: config.level1_rate,
        level2: config.level2_rate,
        merchant: config.merchant_rate,
        pool: config.pool_rate,
        platform: config.platform_rate,
        cooling_days: config.cooling_days,
      },
      min_withdraw: config.min_withdraw,
    };
  }

  /** 团队列表（按层级，附昵称头像；合规仅支持一/二级） */
  async getTeam(userId: string, level: number) {
    if (!userId) throw new BadRequestException('userId 不能为空');
    const supabase = getSupabaseClient();

    // 直接下级（一级）
    const { data: l1 } = await supabase
      .from('distribution_members')
      .select('user_id, created_at')
      .eq('inviter_id', userId);
    const l1Rows = l1 || [];
    if (level === 1) return this.attachProfiles(l1Rows);

    // 间接下级（二级）
    const l1Ids = l1Rows.map((r: any) => r.user_id);
    if (l1Ids.length === 0) return [];
    const { data: l2 } = await supabase
      .from('distribution_members')
      .select('user_id, created_at')
      .in('inviter_id', l1Ids);
    return this.attachProfiles(l2 || []);
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

  /** 佣金明细（含资金状态与可提时间，供前端进度环展示） */
  async getCommissions(userId: string, page = 1, pageSize = 20) {
    if (!userId) throw new BadRequestException('userId 不能为空');
    await this.releaseMatured(userId);
    const supabase = getSupabaseClient();
    const from = (page - 1) * pageSize;
    const { data, count } = await supabase
      .from('distribution_commissions')
      .select('id, order_no, buyer_id, level, order_amount, commission_amount, status, settle_status, available_at, remark, created_at', { count: 'exact' })
      .eq('beneficiary_id', userId)
      .order('created_at', { ascending: false })
      .range(from, from + pageSize - 1);

    // 附买家昵称/头像，前端展示「XX 通过你的链接购买」
    const rows = data || [];
    const buyerIds = [...new Set(rows.map((r: any) => r.buyer_id))];
    if (buyerIds.length > 0) {
      const { data: users } = await supabase.from('users').select('id, nick_name, avatar_url').in('id', buyerIds);
      const map = new Map((users || []).map((u: any) => [u.id, u]));
      rows.forEach((r: any) => {
        r.buyer_nick_name = (map.get(r.buyer_id) as any)?.nick_name || '好友';
        r.buyer_avatar = (map.get(r.buyer_id) as any)?.avatar_url || null;
      });
    }
    return { list: rows, total: count || 0, page, pageSize };
  }

  /** 申请提现（仅可提已过冷静期的 available 部分） */
  async applyWithdraw(userId: string, amount: number) {
    if (!userId) throw new BadRequestException('user_id 不能为空');
    // 先释放到期佣金
    await this.releaseMatured(userId);

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

  /** 管理员：待结算/资金看板（各状态佣金汇总 + 待入账明细） */
  async adminFunds() {
    const supabase = getSupabaseClient();
    const { data: rows } = await supabase
      .from('distribution_commissions')
      .select('beneficiary_id, commission_amount, settle_status, available_at, created_at')
      .order('created_at', { ascending: false })
      .limit(500);
    const list = rows || [];
    const sum = (s: string) =>
      Math.round(list.filter((r: any) => r.settle_status === s).reduce((a: number, r: any) => a + Number(r.commission_amount || 0), 0) * 100) / 100;
    const pending = list.filter((r: any) => r.settle_status === 'pending');
    return {
      pending_amount: sum('pending'),
      settled_amount: sum('settled'),
      revoked_amount: sum('revoked'),
      pending_count: pending.length,
      pending_list: pending.slice(0, 100),
    };
  }

  /** 管理员：手动释放某笔/全部到期佣金 */
  async adminRelease(userId?: string) {
    return this.releaseMatured(userId);
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
