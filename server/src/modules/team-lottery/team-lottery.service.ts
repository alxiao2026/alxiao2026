import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import * as crypto from 'crypto';

export interface UpdateTeamLotteryConfigDto {
  enabled?: boolean;
  team_size?: number;
  duration_hours?: number;
  leader_prize_id?: string | null;
  member_prize_ids?: string[];
  leader_bonus_prize_ids?: string[];
  leader_bonus_rate?: number;
  share_title?: string;
  share_desc?: string;
  share_image_url?: string | null;
  logo_image_url?: string | null;
}

export interface CreateGroupDto {
  merchant_id: number;
  package_id: string;
  order_id: string;
  user_id: string;
}

export interface JoinGroupDto {
  user_id: string;
}

export interface DrawPrizeDto {
  user_id: string;
}

@Injectable()
export class TeamLotteryService {
  private client = getSupabaseClient();

  private now() {
    return new Date().toISOString();
  }

  private addHours(hours: number) {
    const d = new Date();
    d.setHours(d.getHours() + hours);
    return d.toISOString();
  }

  private randomCode(prefix: string, len = 5) {
    const rand = crypto.randomBytes(4).toString('hex').toUpperCase().slice(0, len);
    return `${prefix}${Date.now()}${rand}`;
  }

  private generateInviteCode() {
    return crypto.randomBytes(4).toString('hex').toUpperCase();
  }

  private async getMerchant(merchantId: number) {
    const { data, error } = await this.client
      .from('merchants')
      .select('id, name, marketing_features, wifi_enabled')
      .eq('id', merchantId)
      .maybeSingle();
    if (error) throw new Error(`查询商家失败: ${error.message}`);
    if (!data) throw new NotFoundException('商家不存在');
    return data as any;
  }

  private async getConfigRow(merchantId: number) {
    const { data, error } = await this.client
      .from('merchant_team_lottery_configs')
      .select('*')
      .eq('merchant_id', merchantId)
      .maybeSingle();
    if (error) throw new Error(`查询组队抽奖配置失败: ${error.message}`);
    return data as any;
  }

  /** 获取商家组队抽奖配置（管理端） */
  async getConfig(merchantId: number) {
    const merchant = await this.getMerchant(merchantId);
    const config = await this.getConfigRow(merchantId);
    const features = (merchant.marketing_features as Record<string, boolean>) || {};
    return {
      merchant_id: merchantId,
      marketing_feature_enabled: !!features.team_lottery,
      enabled: !!config?.enabled,
      team_size: config?.team_size || 3,
      duration_hours: config?.duration_hours || 24,
      leader_prize_id: config?.leader_prize_id || null,
      member_prize_ids: (config?.member_prize_ids as string[]) || [],
      leader_bonus_prize_ids: (config?.leader_bonus_prize_ids as string[]) || [],
      leader_bonus_rate: Number(config?.leader_bonus_rate ?? 0),
      share_title: config?.share_title || '组队抽大奖',
      share_desc: config?.share_desc || '我组了个队，快来一起免费抽奖',
      share_image_url: config?.share_image_url || null,
      logo_image_url: config?.logo_image_url || null,
    };
  }

  /** 更新商家组队抽奖配置（管理端） */
  async updateConfig(merchantId: number, dto: UpdateTeamLotteryConfigDto) {
    await this.getMerchant(merchantId);
    const existing = await this.getConfigRow(merchantId);
    const teamSize = Math.max(2, Math.min(20, Number(dto.team_size ?? existing?.team_size ?? 3)));
    const durationHours = Math.max(1, Math.min(168, Number(dto.duration_hours ?? existing?.duration_hours ?? 24)));
    const memberPrizeIds = Array.isArray(dto.member_prize_ids)
      ? dto.member_prize_ids.filter((id) => typeof id === 'string' && id.length > 0).slice(0, 10)
      : (existing?.member_prize_ids as string[]) || [];
    const leaderBonusPrizeIds = Array.isArray(dto.leader_bonus_prize_ids)
      ? dto.leader_bonus_prize_ids.filter((id) => typeof id === 'string' && id.length > 0).slice(0, 10)
      : (existing?.leader_bonus_prize_ids as string[]) || [];
    const leaderBonusRate = Math.max(0, Math.min(100, Number(dto.leader_bonus_rate ?? existing?.leader_bonus_rate ?? 0)));
    const payload = {
      merchant_id: merchantId,
      enabled: dto.enabled ?? existing?.enabled ?? false,
      team_size: teamSize,
      duration_hours: durationHours,
      leader_prize_id: dto.leader_prize_id ?? existing?.leader_prize_id ?? null,
      member_prize_ids: memberPrizeIds,
      leader_bonus_prize_ids: leaderBonusPrizeIds,
      leader_bonus_rate: leaderBonusRate,
      share_title: dto.share_title?.trim() || existing?.share_title || '组队抽大奖',
      share_desc: dto.share_desc?.trim() || existing?.share_desc || '我组了个队，快来一起免费抽奖',
      share_image_url: dto.share_image_url ?? existing?.share_image_url ?? null,
      logo_image_url: dto.logo_image_url ?? existing?.logo_image_url ?? null,
      updated_at: this.now(),
    };

    let data: any;
    if (existing) {
      const { data: updated, error } = await this.client
        .from('merchant_team_lottery_configs')
        .update(payload)
        .eq('id', existing.id)
        .select()
        .single();
      if (error) throw new Error(`更新配置失败: ${error.message}`);
      data = updated;
    } else {
      const { data: created, error } = await this.client
        .from('merchant_team_lottery_configs')
        .insert(payload)
        .select()
        .single();
      if (error) throw new Error(`创建配置失败: ${error.message}`);
      data = created;
    }

    return {
      id: data.id,
      merchant_id: data.merchant_id,
      enabled: data.enabled,
      team_size: data.team_size,
      duration_hours: data.duration_hours,
      leader_prize_id: data.leader_prize_id,
      member_prize_ids: data.member_prize_ids as string[],
      leader_bonus_prize_ids: (data.leader_bonus_prize_ids as string[]) || [],
      leader_bonus_rate: Number(data.leader_bonus_rate ?? 0),
      share_title: data.share_title,
      share_desc: data.share_desc,
      share_image_url: data.share_image_url,
      logo_image_url: data.logo_image_url,
    };
  }

  /** 获取商家可选奖品列表（管理端配置用） */
  async getPrizes(merchantId: number) {
    const { data, error } = await this.client
      .from('prizes')
      .select('id, name, prize_type, stock, coupon_amount, coupon_min_spend, product_name, product_value, is_active, image_url')
      .eq('merchant_id', merchantId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    if (error) throw new Error(`查询奖品失败: ${error.message}`);
    return (data || []).map((p: any) => ({
      id: p.id,
      name: p.name,
      prize_type: p.prize_type,
      stock: Number(p.stock || 0),
      coupon_amount: Number(p.coupon_amount || 0),
      coupon_min_spend: Number(p.coupon_min_spend || 0),
      product_name: p.product_name,
      product_value: Number(p.product_value || 0),
      image_url: p.image_url,
    }));
  }

  /** 查询奖品详情（返回百分比概率） */
  private async getPrizeDetails(prizeIds: string[]): Promise<any[]> {
    if (!prizeIds?.length) return [];
    const validIds = prizeIds.filter((id) => typeof id === 'string' && id.length > 0);
    if (!validIds.length) return [];
    const { data, error } = await this.client
      .from('prizes')
      .select('id, name, probability, image_url, prize_type')
      .in('id', validIds)
      .eq('is_active', true);
    if (error) throw new Error(`查询奖品详情失败: ${error.message}`);
    return (data || []).map((p: any) => ({
      id: p.id,
      name: p.name,
      // 数据库中 probability 已按百分比存储（如 30 表示 30%）
      probability: Number(p.probability || 0),
      image_url: p.image_url || null,
      prize_type: p.prize_type || 'coupon',
    }));
  }

  /** C端：查询商家组队抽奖是否可用 */
  async getMerchantStatus(merchantId: number, packageId?: string) {
    const merchant = await this.getMerchant(merchantId);
    const features = (merchant.marketing_features as Record<string, boolean>) || {};

    const merchantInfo = {
      id: merchant.id,
      name: merchant.name || '',
      address: merchant.address || null,
      phone: merchant.phone || null,
      logo: merchant.logo || null,
    };

    if (!features.team_lottery) {
      return {
        enabled: false,
        team_size: 3,
        duration_hours: 24,
        share_title: '',
        share_desc: '',
        share_image_url: null,
        logo_image_url: null,
        merchant: merchantInfo,
        package: null,
        leader_prize: null,
        member_prizes: [],
        leader_bonus_prizes: [],
        leader_bonus_rate: 0,
      };
    }
    const config = await this.getConfigRow(merchantId);
    if (!config || !config.enabled) {
      return {
        enabled: false,
        team_size: 3,
        duration_hours: 24,
        share_title: '',
        share_desc: '',
        share_image_url: null,
        logo_image_url: null,
        merchant: merchantInfo,
        package: null,
        leader_prize: null,
        member_prizes: [],
        leader_bonus_prizes: [],
        leader_bonus_rate: 0,
      };
    }

    // 查询套餐信息：优先使用传入的 package_id，否则取商家第一个有效套餐
    let packageInfo: any = null;
    if (packageId) {
      const { data: pkg } = await this.client.from('packages').select('*').eq('id', packageId).maybeSingle();
      if (pkg) {
        packageInfo = {
          id: pkg.id,
          name: pkg.name,
          description: pkg.description || null,
          price: Number(pkg.price || 0),
          original_price: pkg.original_price ? Number(pkg.original_price) : null,
          cover_image: pkg.cover_image || pkg.coverImage || null,
        };
      }
    }
    if (!packageInfo) {
      const { data: pkg } = await this.client
        .from('packages')
        .select('*')
        .eq('merchant_id', merchantId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (pkg) {
        packageInfo = {
          id: pkg.id,
          name: pkg.name,
          description: pkg.description || null,
          price: Number(pkg.price || 0),
          original_price: pkg.original_price ? Number(pkg.original_price) : null,
          cover_image: pkg.cover_image || pkg.coverImage || null,
        };
      }
    }

    const [leaderPrizeDetails, memberPrizeDetails, leaderBonusPrizeDetails] = await Promise.all([
      config.leader_prize_id ? this.getPrizeDetails([config.leader_prize_id as string]) : Promise.resolve([]),
      this.getPrizeDetails((config.member_prize_ids as string[]) || []),
      this.getPrizeDetails((config.leader_bonus_prize_ids as string[]) || []),
    ]);

    return {
      enabled: true,
      team_size: config.team_size || 3,
      duration_hours: config.duration_hours || 24,
      share_title: config.share_title || '',
      share_desc: config.share_desc || '',
      share_image_url: config.share_image_url || null,
      logo_image_url: config.logo_image_url || null,
      merchant: merchantInfo,
      package: packageInfo,
      leader_prize: leaderPrizeDetails[0] || null,
      member_prizes: memberPrizeDetails,
      leader_bonus_prizes: leaderBonusPrizeDetails,
      leader_bonus_rate: Number(config.leader_bonus_rate ?? 0),
    };
  }

  /** C端：查询用户在某商家的可开团订单 */
  async getUserOrders(userId: string, merchantId: number) {
    const { data: packages, error: pkgError } = await this.client
      .from('packages')
      .select('id')
      .eq('merchant_id', merchantId);
    if (pkgError) throw new Error(`查询商家套餐失败: ${pkgError.message}`);
    const packageIds = (packages || []).map((p: any) => p.id);
    if (packageIds.length === 0) return [];

    const { data: orders, error } = await this.client
      .from('orders')
      .select('id, package_id, package_name, status, paid_at, created_at')
      .eq('user_id', userId)
      .in('package_id', packageIds)
      .in('status', ['paid', 'used'])
      .order('created_at', { ascending: false });
    if (error) throw new Error(`查询订单失败: ${error.message}`);
    return (orders || []).map((o: any) => ({
      id: o.id,
      package_id: o.package_id,
      package_name: o.package_name,
      status: o.status,
      paid_at: o.paid_at,
    }));
  }

  /** 检查并解散过期队伍 */
  async expireGroups() {
    const now = this.now();
    const { data, error } = await this.client
      .from('team_lottery_groups')
      .update({ status: 'expired', updated_at: now })
      .lt('expires_at', now)
      .in('status', ['active', 'full'])
      .select('id');
    if (error) throw new Error(`解散过期队伍失败: ${error.message}`);
    return { expired_count: (data || []).length };
  }

  private async refreshGroupStatus(groupId: string) {
    const { data: group } = await this.client
      .from('team_lottery_groups')
      .select('*')
      .eq('id', groupId)
      .maybeSingle();
    if (!group) return null;
    const g = group as any;
    if (g.status === 'active' && g.expires_at < this.now()) {
      const { data: updated } = await this.client
        .from('team_lottery_groups')
        .update({ status: 'expired', updated_at: this.now() })
        .eq('id', groupId)
        .select()
        .single();
      return updated;
    }
    return g;
  }

  private async getPrizeById(prizeId: string) {
    const { data, error } = await this.client
      .from('prizes')
      .select('*')
      .eq('id', prizeId)
      .maybeSingle();
    if (error) throw new Error(`查询奖品失败: ${error.message}`);
    return data as any;
  }

  private async atomicDecrementStock(prizeId: string) {
    const { data: prize } = await this.client
      .from('prizes')
      .select('stock')
      .eq('id', prizeId)
      .single();
    const current = Number((prize as any)?.stock ?? 0);
    if (current <= 0) return -1;
    const { data: updated } = await this.client
      .from('prizes')
      .update({ stock: current - 1, updated_at: this.now() })
      .eq('id', prizeId)
      .eq('stock', current)
      .select('stock')
      .single();
    return updated ? Number((updated as any).stock) : -1;
  }

  private async issueCoupon(userId: string, prize: any) {
    const code = this.randomCode('TL', 5).slice(0, 32);
    const expireAt = this.addHours(168); // 7天有效
    const defId = `TL${String(prize.id).slice(0, 18)}`;
    const { data, error } = await this.client
      .from('orchard_coupons')
      .insert({
        code,
        user_id: userId,
        def_id: defId,
        type: 'amount',
        title: prize.name,
        threshold: String(prize.coupon_min_spend || 0),
        amount: String(prize.coupon_amount || 0),
        status: 'unused',
        expire_at: expireAt,
        from_tree: 0,
      })
      .select()
      .single();
    if (error) throw new Error(`发放优惠券失败: ${error.message}`);
    return { code, data };
  }

  private async issueProduct(userId: string, prize: any) {
    const redemptionCode = `TLP-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    return { code: redemptionCode };
  }

  private async grantPrize(userId: string, prize: any) {
    if (!prize) return null;
    if (prize.prize_type === 'coupon') {
      const { code } = await this.issueCoupon(userId, prize);
      return {
        is_winner: true,
        prize_id: prize.id,
        prize_name: prize.name,
        prize_type: prize.prize_type,
        coupon_code: code,
      };
    }
    if (prize.prize_type === 'product') {
      const { code } = await this.issueProduct(userId, prize);
      return {
        is_winner: true,
        prize_id: prize.id,
        prize_name: prize.name,
        prize_type: prize.prize_type,
        redemption_code: code,
      };
    }
    return { is_winner: false, prize_id: null, prize_name: null, prize_type: null };
  }

  private async pickMemberPrize(config: any) {
    const ids = (config.member_prize_ids as string[]) || [];
    if (ids.length === 0) return null;
    // 过滤库存>0且激活的奖品
    const { data: prizes } = await this.client
      .from('prizes')
      .select('*')
      .in('id', ids)
      .eq('is_active', true);
    const pool = (prizes || []).filter((p: any) => Number(p.stock || 0) > 0);
    if (pool.length === 0) return null;
    const idx = crypto.randomInt(0, pool.length);
    return pool[idx] as any;
  }

  /** 团长抽奖：先按配置概率抽加码奖品（更高层级奖品，如霸王餐），未抽中或无库存则必得团长奖品 */
  private async drawLeaderPrize(config: any): Promise<any | null> {
    const rate = Number(config?.leader_bonus_rate ?? 0);
    const bonusIds = (config?.leader_bonus_prize_ids as string[]) || [];
    const leaderPrize = config?.leader_prize_id ? await this.getPrizeById(config.leader_prize_id) : null;

    if (rate > 0 && bonusIds.length > 0) {
      if (Math.random() * 100 < rate) {
        const { data: prizes } = await this.client
          .from('prizes')
          .select('*')
          .in('id', bonusIds)
          .eq('is_active', true);
        const pool = (prizes || []).filter(
          (p: any) => Number(p.stock || 0) > 0 && (!leaderPrize || p.id !== leaderPrize.id),
        );
        if (pool.length > 0) {
          return pool[crypto.randomInt(0, pool.length)] as any;
        }
      }
    }

    return leaderPrize;
  }

  /** 创建队伍（团长） */
  async createGroup(dto: CreateGroupDto) {
    const merchant = await this.getMerchant(dto.merchant_id);
    const features = (merchant.marketing_features as Record<string, boolean>) || {};
    if (!features.team_lottery) {
      throw new BadRequestException('该商家未开启组队抽奖');
    }
    const config = await this.getConfigRow(dto.merchant_id);
    if (!config || !config.enabled) {
      throw new BadRequestException('该商家未开启组队抽奖');
    }

    // 校验订单
    const { data: order, error: orderError } = await this.client
      .from('orders')
      .select('*')
      .eq('id', dto.order_id)
      .maybeSingle();
    if (orderError) throw new Error(`查询订单失败: ${orderError.message}`);
    if (!order) throw new NotFoundException('订单不存在');
    const orderData = order as any;
    if (orderData.user_id !== dto.user_id) {
      throw new BadRequestException('无权操作该订单');
    }
    if (!['paid', 'used'].includes(orderData.status)) {
      throw new BadRequestException('订单支付成功后才能发起组队');
    }
    if (String(orderData.package_id || '') !== dto.package_id) {
      throw new BadRequestException('订单与套餐不匹配');
    }

    // 资格互斥：订单已用于普通抽奖，不能再发起组队
    const { data: usedLottery } = await this.client
      .from('lottery_records')
      .select('id')
      .eq('order_id', dto.order_id)
      .limit(1);
    if (usedLottery && usedLottery.length > 0) {
      throw new BadRequestException('该订单已参与普通抽奖，不能再发起组队');
    }

    // 校验是否已创建
    const { data: existingGroup } = await this.client
      .from('team_lottery_groups')
      .select('id')
      .eq('leader_order_id', dto.order_id)
      .maybeSingle();
    if (existingGroup) {
      throw new BadRequestException('该订单已发起组队');
    }

    const expiresAt = this.addHours(Number(config.duration_hours || 24));
    const teamSize = Number(config.team_size || 3);
    const inviteCode = this.generateInviteCode();

    const { data: group, error: groupError } = await this.client
      .from('team_lottery_groups')
      .insert({
        merchant_id: dto.merchant_id,
        package_id: dto.package_id,
        leader_order_id: dto.order_id,
        leader_user_id: dto.user_id,
        team_size: teamSize,
        current_count: 1,
        invite_code: inviteCode,
        status: 'active',
        expires_at: expiresAt,
      })
      .select()
      .single();
    if (groupError) throw new Error(`创建队伍失败: ${groupError.message}`);

    const { error: memberError } = await this.client
      .from('team_lottery_members')
      .insert({
        group_id: (group as any).id,
        user_id: dto.user_id,
        order_id: dto.order_id,
      });
    if (memberError) throw new Error(`创建团长记录失败: ${memberError.message}`);

    return this.getGroupDetail((group as any).id, dto.user_id);
  }

  private async buildMemberView(members: any[], leaderUserId: string, currentUserId?: string) {
    const userIds = members.map((m) => m.user_id);
    let users: any[] = [];
    if (userIds.length > 0) {
      const { data } = await this.client.from('users').select('id, nick_name, avatar_url').in('id', userIds);
      users = data || [];
    }
    return members.map((m) => {
      const u = users.find((x) => x.id === m.user_id);
      const isLeader = m.user_id === leaderUserId;
      return {
        id: m.id,
        user_id: m.user_id,
        role: isLeader ? 'leader' : 'member',
        nick_name: u?.nick_name || '神秘好友',
        avatar_url: u?.avatar_url || '',
        is_self: currentUserId ? m.user_id === currentUserId : false,
        is_leader: isLeader,
        is_winner: m.is_winner,
        prize_name: m.prize_name,
        prize_type: m.prize_type,
        redemption_code: m.redemption_code,
        coupon_code: m.coupon_code,
        drew_at: m.drew_at,
        joined_at: m.created_at,
      };
    });
  }

  /** 获取队伍详情 */
  async getGroupDetail(groupId: string, currentUserId?: string) {
    let group = await this.refreshGroupStatus(groupId);
    if (!group) throw new NotFoundException('队伍不存在');
    const g = group as any;

    const { data: members, error: membersError } = await this.client
      .from('team_lottery_members')
      .select('*')
      .eq('group_id', groupId)
      .order('created_at', { ascending: true });
    if (membersError) throw new Error(`查询成员失败: ${membersError.message}`);

    const isLeader = currentUserId ? g.leader_user_id === currentUserId : false;
    const isMember = (members || []).some((m: any) => m.user_id === currentUserId);
    const leftCount = Math.max(0, g.team_size - g.current_count);

    let leaderPrizeName: string | null = null;
    const config = await this.getConfigRow(g.merchant_id);
    if (config?.leader_prize_id) {
      const prize = await this.getPrizeById(config.leader_prize_id);
      leaderPrizeName = prize?.name || null;
    }

    // 查询队伍关联的商家、套餐、奖品详情
    const [merchantRow, packageRow] = await Promise.all([
      this.client.from('merchants').select('id, name, address, phone, logo').eq('id', g.merchant_id).maybeSingle(),
      this.client.from('packages').select('*').eq('id', g.package_id).maybeSingle(),
    ]);

    const merchantInfo = merchantRow.data
      ? {
          id: merchantRow.data.id,
          name: merchantRow.data.name || '',
          address: merchantRow.data.address || null,
          phone: merchantRow.data.phone || null,
          logo: merchantRow.data.logo || null,
        }
      : null;

    const packageInfo = packageRow.data
      ? {
          id: packageRow.data.id,
          name: packageRow.data.name,
          description: packageRow.data.description || null,
          price: Number(packageRow.data.price || 0),
          original_price: packageRow.data.original_price ? Number(packageRow.data.original_price) : null,
          cover_image: packageRow.data.cover_image || packageRow.data.coverImage || null,
        }
      : null;

    const [leaderPrizeDetails, memberPrizeDetails, leaderBonusPrizeDetails] = await Promise.all([
      config?.leader_prize_id ? this.getPrizeDetails([config.leader_prize_id as string]) : Promise.resolve([]),
      this.getPrizeDetails((config?.member_prize_ids as string[]) || []),
      this.getPrizeDetails((config?.leader_bonus_prize_ids as string[]) || []),
    ]);

    return {
      id: g.id,
      merchant_id: g.merchant_id,
      package_id: g.package_id,
      leader_user_id: g.leader_user_id,
      invite_code: g.invite_code,
      team_size: g.team_size,
      current_count: g.current_count,
      left_count: leftCount,
      status: g.status,
      expires_at: g.expires_at,
      created_at: g.created_at,
      is_leader: isLeader,
      is_member: isMember,
      leader_prize_name: leaderPrizeName,
      members: await this.buildMemberView(members || [], g.leader_user_id, currentUserId),
      merchant: merchantInfo,
      package: packageInfo,
      leader_prize: leaderPrizeDetails[0] || null,
      member_prizes: memberPrizeDetails,
      leader_bonus_prizes: leaderBonusPrizeDetails,
      leader_bonus_rate: Number(config?.leader_bonus_rate ?? 0),
    };
  }

  /** 通过邀请码查询队伍 */
  async getGroupByInviteCode(inviteCode: string, currentUserId?: string) {
    const { data: group, error } = await this.client
      .from('team_lottery_groups')
      .select('*')
      .eq('invite_code', inviteCode)
      .maybeSingle();
    if (error) throw new Error(`查询队伍失败: ${error.message}`);
    if (!group) throw new NotFoundException('邀请码无效');
    return this.getGroupDetail((group as any).id, currentUserId);
  }

  /** 加入队伍（支持 groupId 或 invite_code） */
  async joinGroup(groupId: string, dto: JoinGroupDto) {
    let group = await this.refreshGroupStatus(groupId);
    if (!group) {
      // 尝试按邀请码查询
      const { data: g2, error } = await this.client
        .from('team_lottery_groups')
        .select('*')
        .eq('invite_code', groupId)
        .maybeSingle();
      if (error) throw new Error(`查询队伍失败: ${error.message}`);
      if (!g2) throw new NotFoundException('队伍不存在');
      group = await this.refreshGroupStatus((g2 as any).id);
      if (!group) throw new NotFoundException('队伍不存在');
    }
    const g = group as any;
    if (g.status !== 'active') {
      if (g.status === 'expired' && g.leader_refunded) {
        throw new BadRequestException('团长的订单已退款，该队伍已解散，无法加入');
      }
      throw new BadRequestException(g.status === 'expired' ? '队伍已过期解散' : '队伍已满');
    }
    if (g.leader_user_id === dto.user_id) {
      throw new BadRequestException('你是团长，不能加入自己的队伍');
    }

    // 后续操作统一使用真实队伍 id（入参可能是邀请码）
    const actualGroupId = (group as any).id as string;

    const { data: existing } = await this.client
      .from('team_lottery_members')
      .select('id')
      .eq('group_id', actualGroupId)
      .eq('user_id', dto.user_id)
      .maybeSingle();
    if (existing) {
      throw new BadRequestException('你已加入该队伍');
    }

    // 并发控制：再次检查并更新 current_count
    const { data: freshGroup } = await this.client
      .from('team_lottery_groups')
      .select('*')
      .eq('id', actualGroupId)
      .eq('status', 'active')
      .single();
    if (!freshGroup) throw new BadRequestException('队伍状态已变化，请重试');
    const fg = freshGroup as any;
    if (fg.current_count >= fg.team_size) {
      throw new BadRequestException('队伍已满');
    }

    const { data: member, error: memberError } = await this.client
      .from('team_lottery_members')
      .insert({ group_id: actualGroupId, user_id: dto.user_id })
      .select()
      .single();
    if (memberError) throw new Error(`加入队伍失败: ${memberError.message}`);

    const newCount = fg.current_count + 1;
    const isFull = newCount >= fg.team_size;
    const { data: updatedGroup, error: updateError } = await this.client
      .from('team_lottery_groups')
      .update({
        current_count: newCount,
        status: isFull ? 'full' : 'active',
        updated_at: this.now(),
      })
      .eq('id', actualGroupId)
      .eq('current_count', fg.current_count)
      .select()
      .single();
    if (updateError) {
      // 回滚成员记录
      await this.client.from('team_lottery_members').delete().eq('id', (member as any).id);
      throw new BadRequestException('加入失败，请重试');
    }

    return this.getGroupDetail(actualGroupId, dto.user_id);
  }

  /** 队员抽奖 */
  async drawPrize(groupId: string, dto: DrawPrizeDto) {
    let group = await this.refreshGroupStatus(groupId);
    if (!group) throw new NotFoundException('队伍不存在');
    const g = group as any;
    if (g.status !== 'full') {
      if (g.status === 'expired' && g.leader_refunded) {
        throw new BadRequestException('团长的订单已退款，该队伍已结束，无法抽奖');
      }
      throw new BadRequestException('队伍未满，还不能抽奖');
    }

    const { data: member, error: memberError } = await this.client
      .from('team_lottery_members')
      .select('*')
      .eq('group_id', groupId)
      .eq('user_id', dto.user_id)
      .maybeSingle();
    if (memberError) throw new Error(`查询成员失败: ${memberError.message}`);
    if (!member) throw new BadRequestException('你不是队伍成员');
    const m = member as any;
    if (m.drew_at || m.prize_id) {
      throw new BadRequestException('你已经抽过奖了');
    }

    const config = await this.getConfigRow(g.merchant_id);
    if (!config) throw new BadRequestException('商家配置不存在');

    // 团长参加抽奖：先按概率抽加码奖品（更高层级奖品，如霸王餐），未中则必得团长奖品；队员从队员奖品池随机抽
    const isLeader = g.leader_user_id === dto.user_id;
    let prize: any = null;
    if (isLeader) {
      prize = await this.drawLeaderPrize(config);
    } else {
      prize = await this.pickMemberPrize(config);
    }
    if (!prize) {
      throw new BadRequestException(isLeader ? '团长奖品库存不足' : '奖品已发完');
    }

    const newStock = await this.atomicDecrementStock(prize.id);
    if (newStock < 0) {
      throw new BadRequestException('奖品库存不足');
    }

    const result = await this.grantPrize(dto.user_id, prize);
    if (!result || !result.is_winner) {
      throw new BadRequestException('奖品发放失败');
    }

    const { error: updateError } = await this.client
      .from('team_lottery_members')
      .update({
        is_winner: true,
        prize_id: result.prize_id,
        prize_name: result.prize_name,
        prize_type: result.prize_type,
        coupon_code: result.coupon_code || null,
        redemption_code: result.redemption_code || null,
        drew_at: this.now(),
      })
      .eq('id', m.id);
    if (updateError) throw new Error(`保存中奖记录失败: ${updateError.message}`);

    return result;
  }

  /** 查询用户参与/创建的队伍列表 */
  async listMyGroups(userId: string, merchantId?: number) {
    let query = this.client
      .from('team_lottery_members')
      .select('group_id')
      .eq('user_id', userId);
    if (merchantId !== undefined) {
      // 需要 join group 表；先查 group 再过滤
    }
    const { data, error } = await query.order('created_at', { ascending: false }).limit(50);
    if (error) throw new Error(`查询队伍失败: ${error.message}`);
    const groupIds = (data || []).map((d: any) => d.group_id);
    const details: any[] = [];
    for (const gid of groupIds) {
      try {
        details.push(await this.getGroupDetail(gid, userId));
      } catch {
        // ignore
      }
    }
    return details;
  }
}
