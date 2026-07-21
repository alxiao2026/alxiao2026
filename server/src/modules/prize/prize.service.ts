import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export type PrizeType = 'coupon' | 'product' | 'free_meal';

export interface Prize {
  id: string;
  name: string;
  description: string | null;
  probability: string;
  image_url: string | null;
  stock: number;
  is_active: boolean;
  prize_type: PrizeType;
  coupon_amount: string;
  coupon_min_spend: string;
  product_name: string;
  product_value: string;
  created_at: string;
  updated_at: string | null;
}

@Injectable()
export class PrizeService {
  private client = getSupabaseClient();

  async findAll(): Promise<Prize[]> {
    const { data, error } = await this.client
      .from('prizes')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) throw new Error(`查询奖品列表失败: ${error.message}`);
    return (data as Prize[]) || [];
  }

  async findActive(): Promise<Prize[]> {
    const { data, error } = await this.client
      .from('prizes')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: true });
    if (error) throw new Error(`查询活动奖品失败: ${error.message}`);
    return (data as Prize[]) || [];
  }

  async findOne(id: string): Promise<Prize> {
    const { data, error } = await this.client
      .from('prizes')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(`查询奖品失败: ${error.message}`);
    if (!data) throw new NotFoundException('奖品不存在');
    return data as Prize;
  }

  async create(body: {
    name: string;
    description?: string;
    probability?: string;
    image_url?: string;
    stock?: number;
    prize_type?: PrizeType;
    coupon_amount?: number;
    coupon_min_spend?: number;
    product_name?: string;
    product_value?: number;
  }): Promise<Prize> {
    if (!body.name) throw new BadRequestException('奖品名称不能为空');

    const { data, error } = await this.client
      .from('prizes')
      .insert({
        name: body.name,
        description: body.description || null,
        probability: body.probability || '0',
        image_url: body.image_url || null,
        stock: body.stock ?? 0,
        prize_type: body.prize_type || 'coupon',
        coupon_amount: body.coupon_amount ?? 0,
        coupon_min_spend: body.coupon_min_spend ?? 0,
        product_name: body.product_name || '',
        product_value: body.product_value ?? 0,
      })
      .select()
      .single();
    if (error) throw new Error(`创建奖品失败: ${error.message}`);
    return data as Prize;
  }

  async update(id: string, body: Partial<{
    name: string;
    description: string;
    probability: string;
    image_url: string;
    stock: number;
    is_active: boolean;
    prize_type: PrizeType;
    coupon_amount: number;
    coupon_min_spend: number;
    product_name: string;
    product_value: number;
  }>): Promise<Prize> {
    const existing = await this.findOne(id);

    const updateData: Record<string, any> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.probability !== undefined) updateData.probability = body.probability;
    if (body.image_url !== undefined) updateData.image_url = body.image_url;
    if (body.stock !== undefined) updateData.stock = body.stock;
    if (body.is_active !== undefined) updateData.is_active = body.is_active;
    if (body.prize_type !== undefined) updateData.prize_type = body.prize_type;
    if (body.coupon_amount !== undefined) updateData.coupon_amount = body.coupon_amount;
    if (body.coupon_min_spend !== undefined) updateData.coupon_min_spend = body.coupon_min_spend;
    if (body.product_name !== undefined) updateData.product_name = body.product_name;
    if (body.product_value !== undefined) updateData.product_value = body.product_value;
    updateData.updated_at = new Date().toISOString();

    const { data, error } = await this.client
      .from('prizes')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error(`更新奖品失败: ${error.message}`);
    return data as Prize;
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);

    const { error } = await this.client
      .from('prizes')
      .delete()
      .eq('id', id);
    if (error) throw new Error(`删除奖品失败: ${error.message}`);
  }
}
