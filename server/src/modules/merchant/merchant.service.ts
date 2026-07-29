import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { getSupabaseClient } from '@/storage/database/supabase-client';

/** 结算配置必填校验（系统管理员在商家编辑页配置，未填无法保存商家） */
function validateSettlementConfig(body: { settlement_type?: number; commission_rate?: number; settlement_price?: number }) {
  const type = Number(body.settlement_type);
  if (!type || (type !== 1 && type !== 2)) {
    throw new BadRequestException('请选择结算配置方式（佣金百分比或套餐结算价）');
  }
  if (type === 1) {
    const rate = Number(body.commission_rate);
    if (body.commission_rate === undefined || body.commission_rate === null || Number.isNaN(rate) || rate < 0 || rate > 100) {
      throw new BadRequestException('请填写有效的佣金百分比（0-100）');
    }
  }
  if (type === 2) {
    const price = Number(body.settlement_price);
    if (body.settlement_price === undefined || body.settlement_price === null || Number.isNaN(price) || price <= 0) {
      throw new BadRequestException('请填写有效的套餐结算价（需大于0）');
    }
  }
}

export interface CreateMerchantDto {
  name: string;
  logo?: string;
  images?: string[];
  address?: string;
  /** 前端表单使用 location 字段提交地址 */
  location?: string;
  phone?: string;
  business_hours?: string;
  category?: string;
  description?: string;
  latitude?: string;
  longitude?: string;
  admin_phone: string;
  admin_password: string;
  settlement_type: number;
  commission_rate?: number;
  settlement_price?: number;
}

export interface UpdateMerchantDto {
  name?: string;
  logo?: string;
  images?: string[];
  address?: string;
  /** 前端表单使用 location 字段提交地址 */
  location?: string;
  phone?: string;
  business_hours?: string;
  category?: string;
  description?: string;
  latitude?: string;
  longitude?: string;
  admin_phone?: string;
  admin_password?: string;
  settlement_type?: number;
  commission_rate?: number;
  settlement_price?: number;
}

export interface Merchant {
  id: number;
  name: string;
  logo?: string;
  address?: string;
  phone?: string;
  business_hours?: string;
  category?: string;
  description?: string;
  latitude?: string;
  longitude?: string;
  settlement_type?: number;
  commission_rate?: number;
  settlement_price?: number;
  created_at?: string;
  updated_at?: string;
}

@Injectable()
export class MerchantService {
  private client = getSupabaseClient();

  async findAll(): Promise<Merchant[]> {
    const { data, error } = await this.client
      .from('merchants')
      .select('*')
      .order('id', { ascending: true });
    if (error) throw new Error(`查询商家列表失败：${error.message}`);
    return (data as Merchant[]) || [];
  }

  async findById(id: number): Promise<Merchant | null> {
    const { data, error } = await this.client
      .from('merchants')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(`查询商家失败：${error.message}`);
    return data as Merchant | null;
  }

  /**
   * 商家详情 + 该商家上架奖品 + 团购套餐（商家首页用）
   */
  async getDetailWithPrizes(id: number) {
    const merchant = await this.findById(id);
    if (!merchant) return null;

    const { data: prizes, error: prizeError } = await this.client
      .from('prizes')
      .select('id, name, prize_type, image_url, coupon_amount, product_name, validity_hours, stock, probability')
      .eq('merchant_id', id)
      .eq('is_active', true)
      .eq('is_fallback', false)
      .order('probability', { ascending: false });

    if (prizeError) throw new Error(`查询商家奖品失败：${prizeError.message}`);

    const { data: packages, error: packageError } = await this.client
      .from('packages')
      .select('id, name, price, original_price, cover_image, badge, category, package_type')
      .eq('merchant_id', String(id))
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (packageError) throw new Error(`查询商家套餐失败：${packageError.message}`);

    // 中奖统计：该商家全部奖品（含已下架）关联的中奖记录
    const { data: allPrizes } = await this.client
      .from('prizes')
      .select('id, prize_type')
      .eq('merchant_id', id);

    const prizeIds = (allPrizes || []).map((p: { id: string }) => p.id);
    let totalWins = 0;
    let freeMealWins = 0;
    if (prizeIds.length > 0) {
      const { data: winRecords, error: winError } = await this.client
        .from('lottery_records')
        .select('prize_id')
        .in('prize_id', prizeIds)
        .eq('is_winner', true);
      if (winError) throw new Error(`查询中奖记录失败：${winError.message}`);
      const freeMealIds = new Set(
        (allPrizes || [])
          .filter((p: { prize_type: string }) => p.prize_type === 'free_meal')
          .map((p: { id: string }) => p.id),
      );
      totalWins = (winRecords || []).length;
      freeMealWins = (winRecords || []).filter((r: { prize_id: string }) =>
        freeMealIds.has(r.prize_id),
      ).length;
    }

    // 消费者端不暴露结算配置数字（仅系统管理员后台可见）
    const publicMerchant = { ...merchant } as Record<string, unknown>;
    delete publicMerchant.settlement_type;
    delete publicMerchant.commission_rate;
    delete publicMerchant.settlement_price;

    return {
      merchant: publicMerchant,
      prizes: prizes || [],
      packages: packages || [],
      winStats: { totalWins, freeMealWins },
    };
  }

  /** 霸王餐人气榜：按门店统计 free_meal 中奖次数，取前 N 名 */
  async getFreeMealRank(limit = 5) {
    // 1. 全部霸王餐奖品 → merchant_id 映射
    const { data: freeMealPrizes, error: prizeError } = await this.client
      .from('prizes')
      .select('id, merchant_id')
      .eq('prize_type', 'free_meal');
    if (prizeError) throw new Error(`查询霸王餐奖品失败：${prizeError.message}`);
    if (!freeMealPrizes || freeMealPrizes.length === 0) return [];

    const prizeMerchantMap = new Map<string, string>();
    freeMealPrizes.forEach((p: { id: string; merchant_id: string }) => {
      prizeMerchantMap.set(String(p.id), String(p.merchant_id));
    });

    // 2. 中奖记录（仅霸王餐奖品）
    const { data: records, error: recordError } = await this.client
      .from('lottery_records')
      .select('prize_id')
      .in('prize_id', freeMealPrizes.map((p: { id: string }) => p.id))
      .eq('is_winner', true);
    if (recordError) throw new Error(`查询中奖记录失败：${recordError.message}`);
    if (!records || records.length === 0) return [];

    // 3. 按门店聚合计数
    const countMap = new Map<string, number>();
    records.forEach((r: { prize_id: string }) => {
      const merchantId = prizeMerchantMap.get(String(r.prize_id));
      if (merchantId) {
        countMap.set(merchantId, (countMap.get(merchantId) || 0) + 1);
      }
    });

    // 4. 取前 N 名商家信息
    const topMerchantIds = [...countMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([merchantId]) => merchantId);
    if (topMerchantIds.length === 0) return [];

    const { data: merchants, error: merchantError } = await this.client
      .from('merchants')
      .select('id, name, logo, address')
      .in('id', topMerchantIds);
    if (merchantError) throw new Error(`查询商家信息失败：${merchantError.message}`);

    const merchantMap = new Map<string, { id: number; name: string; logo: string | null; address: string | null }>();
    (merchants || []).forEach((m: { id: number; name: string; logo: string | null; address: string | null }) => {
      merchantMap.set(String(m.id), m);
    });

    return topMerchantIds
      .map((merchantId) => {
        const merchant = merchantMap.get(merchantId);
        if (!merchant) return null;
        return {
          id: merchant.id,
          name: merchant.name,
          logo: merchant.logo,
          address: merchant.address,
          freeMealWins: countMap.get(merchantId) || 0,
        };
      })
      .filter(Boolean);
  }

  async create(body: CreateMerchantDto): Promise<Merchant> {
    if (!body.name) throw new BadRequestException('商家名称不能为空');
    if (!body.admin_phone) throw new BadRequestException('管理员手机号不能为空');
    if (!body.admin_password) throw new BadRequestException('管理员登录密码不能为空');
    validateSettlementConfig(body);

    const { data, error } = await this.client
      .from('merchants')
      .insert({
        name: body.name,
        logo: body.logo,
        images: body.images || [],
        address: body.location || body.address,
        phone: body.phone,
        business_hours: body.business_hours,
        category: body.category,
        description: body.description,
        settlement_type: body.settlement_type,
        commission_rate: body.settlement_type === 1 ? Number(body.commission_rate) : 0,
        settlement_price: body.settlement_type === 2 ? Number(body.settlement_price) : 0,
      })
      .select()
      .single();

    if (error) throw new Error(`创建商家失败：${error.message}`);
    const merchant = data as Merchant;

    // 创建商家管理员账号（该手机号已有账号则直接关联升级为商家身份，不再新建）
    try {
      const { data: existingUsers } = await this.client
        .from('users')
        .select('user_id, role')
        .eq('phone', body.admin_phone);

      if (existingUsers && existingUsers.length > 0) {
        // 已有账号：统一关联为商家管理员身份，确保该手机号登录后即为商家账号
        // （超级管理员账号只同步密码，不降级角色）
        const { error: updateError } = await this.client
          .from('users')
          .update({
            password: body.admin_password,
            role: 'merchant',
            merchant_id: merchant.id,
          })
          .eq('phone', body.admin_phone)
          .neq('role', 'admin');
        if (updateError) {
          console.error('[Merchant] 关联已有账号为商家管理员失败:', updateError.message);
        } else {
          console.log(`[Merchant] 已将已有账号关联为商家管理员: ${body.admin_phone} -> merchant_id=${merchant.id}（共 ${existingUsers.length} 个账号）`);
        }
        // 若其中有超级管理员账号，仅同步密码
        if (existingUsers.some(u => u.role === 'admin')) {
          await this.client
            .from('users')
            .update({ password: body.admin_password })
            .eq('phone', body.admin_phone)
            .eq('role', 'admin');
        }
      } else {
        // 无账号：新建商家管理员账号
        const { error: userError } = await this.client
          .from('users')
          .insert({
            user_id: `admin_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            nick_name: body.name,
            avatar_url: null,
            phone: body.admin_phone,
            password: body.admin_password,
            role: 'merchant',
            merchant_id: merchant.id,
          });
        if (userError) {
          console.error('[Merchant] 创建管理员账号失败:', userError.message);
        } else {
          console.log(`[Merchant] 商家管理员账号创建成功: ${body.admin_phone} -> merchant_id=${merchant.id}`);
        }
      }
    } catch (e: any) {
      console.error('[Merchant] 创建管理员账号异常:', e.message);
    }

    return merchant;
  }

  async update(id: number, body: UpdateMerchantDto): Promise<Merchant> {
    const { admin_phone, admin_password, location, ...restFields } = body;
    validateSettlementConfig(restFields);

    const type = Number(restFields.settlement_type);
    const { data, error } = await this.client
      .from('merchants')
      .update({
        ...restFields,
        ...(location !== undefined && { address: location }),
        settlement_type: type,
        commission_rate: type === 1 ? Number(restFields.commission_rate) : 0,
        settlement_price: type === 2 ? Number(restFields.settlement_price) : 0,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(`更新商家失败：${error.message}`);
    if (!data) throw new NotFoundException('商家不存在');

    // 同步更新商家管理员账号
    if (admin_phone || admin_password) {
      try {
        // 查找该商家现有管理员账号（可能存在历史多账号，取最近登录的一个）
        const { data: adminUsers } = await this.client
          .from('users')
          .select('*')
          .eq('merchant_id', id)
          .eq('role', 'merchant')
          .order('last_login_at', { ascending: false })
          .limit(1);

        const adminUser = adminUsers?.[0];

        if (adminUser) {
          // 更新现有管理员账号
          const updates: Record<string, string> = {};
          if (admin_password) updates.password = admin_password;
          if (admin_phone && admin_phone !== adminUser.phone) {
            // 手机号变更：检查新手机号是否已被占用
            const { data: existing } = await this.client
              .from('users')
              .select('user_id')
              .eq('phone', admin_phone)
              .neq('user_id', adminUser.user_id)
              .maybeSingle();
            if (existing) {
              throw new BadRequestException('该管理员手机号已被其他账号使用');
            }
            updates.phone = admin_phone;
          }
          if (Object.keys(updates).length > 0) {
            await this.client
              .from('users')
              .update(updates)
              .eq('user_id', adminUser.user_id);
            console.log(`[Merchant] 商家管理员账号已更新: merchant_id=${id}`);
          }
        } else if (admin_phone && admin_password) {
          // 商家暂无管理员账号，创建新账号
          const { data: existing } = await this.client
            .from('users')
            .select('user_id')
            .eq('phone', admin_phone)
            .maybeSingle();

          if (existing) {
            await this.client
              .from('users')
              .update({ password: admin_password, role: 'merchant', merchant_id: id })
              .eq('phone', admin_phone);
          } else {
            await this.client.from('users').insert({
              user_id: `admin_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              phone: admin_phone,
              password: admin_password,
              role: 'merchant',
              merchant_id: id,
              login_type: 'password',
              last_login_at: new Date().toISOString(),
            });
          }
          console.log(`[Merchant] 商家管理员账号已创建: ${admin_phone} -> merchant_id=${id}`);
        }
      } catch (e: any) {
        if (e instanceof BadRequestException) throw e;
        console.error('[Merchant] 更新管理员账号异常:', e.message);
      }
    }

    return data as Merchant;
  }

  async getAdmin(id: number): Promise<{ phone: string; password: string } | null> {
    const { data, error } = await this.client
      .from('users')
      .select('phone, password')
      .eq('merchant_id', id)
      .eq('role', 'merchant')
      .order('last_login_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(`查询商家管理员失败：${error.message}`);
    if (!data) return null;
    return { phone: data.phone, password: data.password };
  }

  async delete(id: number): Promise<void> {
    const { error } = await this.client
      .from('merchants')
      .delete()
      .eq('id', id);

    if (error) throw new Error(`删除商家失败：${error.message}`);
  }
}
