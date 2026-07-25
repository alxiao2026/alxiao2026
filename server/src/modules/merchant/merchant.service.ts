import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export interface CreateMerchantDto {
  name: string;
  logo?: string;
  images?: string[];
  address?: string;
  phone?: string;
  business_hours?: string;
  category?: string;
  description?: string;
  latitude?: string;
  longitude?: string;
  admin_phone: string;
  admin_password: string;
}

export interface UpdateMerchantDto {
  name?: string;
  logo?: string;
  images?: string[];
  address?: string;
  phone?: string;
  business_hours?: string;
  category?: string;
  description?: string;
  latitude?: string;
  longitude?: string;
  admin_phone?: string;
  admin_password?: string;
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
      .select('id, name, prize_type, image_url, coupon_amount, product_name, validity_hours, stock')
      .eq('merchant_id', id)
      .eq('is_active', true)
      .order('probability', { ascending: false });

    if (prizeError) throw new Error(`查询商家奖品失败：${prizeError.message}`);

    const { data: packages, error: packageError } = await this.client
      .from('packages')
      .select('id, name, price, original_price, cover_image, badge, category, package_type')
      .eq('merchant_id', String(id))
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (packageError) throw new Error(`查询商家套餐失败：${packageError.message}`);
    return { merchant, prizes: prizes || [], packages: packages || [] };
  }

  async create(body: CreateMerchantDto): Promise<Merchant> {
    if (!body.name) throw new BadRequestException('商家名称不能为空');
    if (!body.admin_phone) throw new BadRequestException('管理员手机号不能为空');
    if (!body.admin_password) throw new BadRequestException('管理员登录密码不能为空');

    const { data, error } = await this.client
      .from('merchants')
      .insert({
        name: body.name,
        logo: body.logo,
        images: body.images || [],
        address: body.address,
        phone: body.phone,
        business_hours: body.business_hours,
        category: body.category,
        description: body.description,
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
    const { admin_phone, admin_password, ...merchantFields } = body;

    const { data, error } = await this.client
      .from('merchants')
      .update({
        ...merchantFields,
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
