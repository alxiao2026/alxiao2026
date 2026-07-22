import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export interface CreateMerchantDto {
  name: string;
  logo?: string;
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
  address?: string;
  phone?: string;
  business_hours?: string;
  category?: string;
  description?: string;
  latitude?: string;
  longitude?: string;
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

  async create(body: CreateMerchantDto): Promise<Merchant> {
    if (!body.name) throw new BadRequestException('商家名称不能为空');
    if (!body.admin_phone) throw new BadRequestException('管理员手机号不能为空');
    if (!body.admin_password) throw new BadRequestException('管理员登录密码不能为空');

    const { data, error } = await this.client
      .from('merchants')
      .insert({
        name: body.name,
        logo: body.logo,
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

    // 创建商家管理员账号
    try {
      const { data: userData, error: userError } = await this.client
        .from('users')
        .insert({
          user_id: `admin_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          nick_name: `${body.name}管理员`,
          avatar_url: null,
          phone: body.admin_phone,
          password: body.admin_password,
          role: 'merchant',
          merchant_id: merchant.id,
        })
        .select()
        .single();

      if (userError) {
        console.error('[Merchant] 创建管理员账号失败:', userError.message);
        // 如果手机号已存在，尝试更新该用户
        if (userError.message.includes('unique') || userError.message.includes('duplicate')) {
          await this.client
            .from('users')
            .update({
              password: body.admin_password,
              role: 'merchant',
              merchant_id: merchant.id,
            })
            .eq('phone', body.admin_phone);
        }
      } else {
        console.log(`[Merchant] 商家管理员账号创建成功: ${body.admin_phone} -> merchant_id=${merchant.id}`);
      }
    } catch (e: any) {
      console.error('[Merchant] 创建管理员账号异常:', e.message);
    }

    return merchant;
  }

  async update(id: number, body: UpdateMerchantDto): Promise<Merchant> {
    const { data, error } = await this.client
      .from('merchants')
      .update({
        ...body,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(`更新商家失败：${error.message}`);
    if (!data) throw new NotFoundException('商家不存在');
    return data as Merchant;
  }

  async delete(id: number): Promise<void> {
    const { error } = await this.client
      .from('merchants')
      .delete()
      .eq('id', id);

    if (error) throw new Error(`删除商家失败：${error.message}`);
  }
}
