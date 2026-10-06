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
  // type === 2（套餐结算价）：结算价按套餐逐个配置，保存商家时由前端逐套餐调用配置接口，此处仅要求选择结算方式
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
  /** 店内免费 WiFi 名称（系统管理员在商家编辑页配置） */
  wifi_ssid?: string;
  /** 店内免费 WiFi 密码 */
  wifi_password?: string;
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
  /** 店内免费 WiFi 名称 */
  wifi_ssid?: string;
  /** 店内免费 WiFi 密码 */
  wifi_password?: string;
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
  wifi_ssid?: string;
  wifi_password?: string;
  /** 商家唯一编码，格式 PP + 9 位数字 */
  merchant_code?: string;
  created_at?: string;
  updated_at?: string;
}

export interface SaveQualificationDto {
  business_license_url?: string;
  food_license_url?: string;
  other_license_urls?: string[];
  bank_account_name?: string;
  bank_card_no?: string;
  bank_name?: string;
  bank_branch?: string;
}

@Injectable()
export class MerchantService {
  private client = getSupabaseClient();

  // ==================== 商家资质与收款信息 ====================

  /** 获取商家资质与收款银行卡信息 */
  async getQualification(merchantId: number) {
    if (!merchantId || Number.isNaN(merchantId)) {
      throw new BadRequestException('商家 ID 无效');
    }
    const { data, error } = await this.client
      .from('merchant_qualifications')
      .select('*')
      .eq('merchant_id', merchantId)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  }

  /** 保存/更新商家资质与收款银行卡信息（按 merchant_id 覆盖更新） */
  async saveQualification(merchantId: number, body: SaveQualificationDto) {
    if (!merchantId || Number.isNaN(merchantId)) {
      throw new BadRequestException('商家 ID 无效');
    }
    // 确认商家存在
    const { data: merchant } = await this.client
      .from('merchants')
      .select('id')
      .eq('id', merchantId)
      .maybeSingle();
    if (!merchant) {
      throw new NotFoundException('商家不存在');
    }

    const bankCardNo = (body.bank_card_no || '').replace(/\s+/g, '');
    if (bankCardNo && !/^\d{8,32}$/.test(bankCardNo)) {
      throw new BadRequestException('银行卡号格式不正确（8-32 位数字）');
    }

    const payload = {
      merchant_id: merchantId,
      business_license_url: (body.business_license_url || '').trim() || null,
      food_license_url: (body.food_license_url || '').trim() || null,
      other_license_urls: Array.isArray(body.other_license_urls)
        ? body.other_license_urls.filter((u) => typeof u === 'string' && u.trim()).map((u) => u.trim())
        : [],
      bank_account_name: (body.bank_account_name || '').trim() || null,
      bank_card_no: bankCardNo || null,
      bank_name: (body.bank_name || '').trim() || null,
      bank_branch: (body.bank_branch || '').trim() || null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await this.client
      .from('merchant_qualifications')
      .upsert(payload, { onConflict: 'merchant_id' })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

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

  async findByCode(code: string): Promise<Merchant | null> {
    const normalized = (code || '').trim().toUpperCase();
    if (!normalized) throw new BadRequestException('商家编码不能为空');
    if (!/^PP\d{9}$/.test(normalized)) {
      throw new BadRequestException('商家编码格式不正确，应为 PP + 9 位数字');
    }
    const { data, error } = await this.client
      .from('merchants')
      .select('*')
      .eq('merchant_code', normalized)
      .maybeSingle();
    if (error) throw new Error(`按编码查询商家失败：${error.message}`);
    return data as Merchant | null;
  }

  /** 生成唯一商家编码：PP + 9 位数字 */
  private async generateMerchantCode(retries = 10): Promise<string> {
    for (let i = 0; i < retries; i++) {
      const suffix = Math.floor(Math.random() * 1_000_000_000)
        .toString()
        .padStart(9, '0');
      const code = `PP${suffix}`;
      const existing = await this.findByCode(code);
      if (!existing) return code;
    }
    throw new Error('生成商家编码失败，请重试');
  }

  /** 消费者端获取店内免费 WiFi 信息（小程序 connectWifi 需要真实账号密码） */
  async getWifiInfo(id: number) {
    const { data, error } = await this.client
      .from('merchants')
      .select('id, name, wifi_ssid, wifi_password')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(`查询商家 WiFi 失败：${error.message}`);
    if (!data) throw new NotFoundException('商家不存在');
    return {
      merchant_id: data.id,
      merchant_name: data.name,
      has_wifi: !!data.wifi_ssid,
      ssid: data.wifi_ssid || '',
      password: data.wifi_password || '',
    };
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
  // 霸王餐榜单进程内缓存：数据量小、仅在新中奖产生时变化，60s 内直接复用，避免冷启动重复慢查询
  private freeMealRankCache: {
    data: Array<{ id: number; name: string; logo: string | null; address: string | null; freeMealWins: number }>;
    ts: number;
  } | null = null;

  async getFreeMealRank(limit = 5) {
    const cached = this.freeMealRankCache;
    if (cached && Date.now() - cached.ts < 60_000) {
      return cached.data.slice(0, limit);
    }

    // 单次 JOIN：中奖记录内联霸王餐奖品取 merchant_id（替代原先 3 次串行远程往返）
    const { data: rows, error } = await this.client
      .from('lottery_records')
      .select('prize_id, prizes!inner(merchant_id)')
      .eq('is_winner', true)
      .eq('prizes.prize_type', 'free_meal');
    if (error) throw new Error(`查询霸王餐榜单失败：${error.message}`);

    // 按门店聚合计数（PostgREST many-to-one 内联运行时可能返回对象或单元素数组，两种形态均兼容）
    const countMap = new Map<string, number>();
    const winnerRows = (rows || []) as Array<{
      prize_id: string;
      prizes: { merchant_id: string | number } | Array<{ merchant_id: string | number }> | null;
    }>;
    winnerRows.forEach((r) => {
      const embedded = r && r.prizes;
      let merchantId = '';
      if (Array.isArray(embedded)) {
        merchantId = embedded.length > 0 ? String(embedded[0].merchant_id) : '';
      } else if (embedded) {
        merchantId = String(embedded.merchant_id);
      }
      if (merchantId) {
        countMap.set(merchantId, (countMap.get(merchantId) || 0) + 1);
      }
    });
    if (countMap.size === 0) {
      this.freeMealRankCache = { data: [], ts: Date.now() };
      return [];
    }

    // 第 2 次往返：取上榜商家信息（prizes 与 merchants 间无外键，无法继续内联）
    const topMerchantIds = [...countMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([merchantId]) => merchantId);

    const { data: merchants, error: merchantError } = await this.client
      .from('merchants')
      .select('id, name, logo, address')
      .in('id', topMerchantIds);
    if (merchantError) throw new Error(`查询商家信息失败：${merchantError.message}`);

    const merchantMap = new Map<string, { id: number; name: string; logo: string | null; address: string | null }>();
    (merchants || []).forEach((m: { id: number; name: string; logo: string | null; address: string | null }) => {
      merchantMap.set(String(m.id), m);
    });

    const result = topMerchantIds
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
      .filter(Boolean) as Array<{ id: number; name: string; logo: string | null; address: string | null; freeMealWins: number }>;

    this.freeMealRankCache = { data: result, ts: Date.now() };
    return result;
  }

  async create(body: CreateMerchantDto): Promise<Merchant> {
    if (!body.name) throw new BadRequestException('商家名称不能为空');
    if (!body.admin_phone) throw new BadRequestException('管理员手机号不能为空');
    if (!body.admin_password) throw new BadRequestException('管理员登录密码不能为空');
    validateSettlementConfig(body);

    const merchantCode = await this.generateMerchantCode();

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
        latitude: body.latitude ?? null,
        longitude: body.longitude ?? null,
        settlement_type: body.settlement_type,
        commission_rate: body.settlement_type === 1 ? Number(body.commission_rate) : 0,
        settlement_price: 0,
        wifi_ssid: (body.wifi_ssid || '').trim() || null,
        wifi_password: (body.wifi_password || '').trim() || null,
        merchant_code: merchantCode,
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
        ...(restFields.wifi_ssid !== undefined && { wifi_ssid: (restFields.wifi_ssid || '').trim() || null }),
        ...(restFields.wifi_password !== undefined && { wifi_password: (restFields.wifi_password || '').trim() || null }),
        settlement_type: type,
        commission_rate: type === 1 ? Number(restFields.commission_rate) : 0,
        settlement_price: 0,
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
