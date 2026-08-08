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
  discount_rate: string;
  discount_cap: string;
  product_name: string;
  product_value: string;
  merchant_id: number | null;
  validity_hours: number | null;
  daily_quota: number | null;
  is_fallback: boolean;
  created_at: string;
  updated_at: string | null;
}

@Injectable()
export class PrizeService {
  private client = getSupabaseClient();

  async findAll(merchantId?: string): Promise<Prize[]> {
    let query = this.client
      .from('prizes')
      .select('*');
    if (merchantId) {
      query = query.eq('merchant_id', Number(merchantId));
    }
    const { data, error } = await query.order('created_at', { ascending: true });
    if (error) throw new Error(`查询奖品列表失败: ${error.message}`);
    return (data as Prize[]) || [];
  }

  async findActive(merchantId?: string | number | null): Promise<Prize[]> {
    // C 端展示接口：兜底奖不在前端展示（仅后台参与候补抽奖），常规奖需有库存才展示
    let query = this.client
      .from('prizes')
      .select('*')
      .eq('is_active', true)
      .eq('is_fallback', false)
      .gt('stock', 0);
    if (merchantId !== undefined && merchantId !== null && `${merchantId}` !== '') {
      query = query.eq('merchant_id', Number(merchantId));
    }
    const { data, error } = await query.order('created_at', { ascending: true });
    if (error) throw new Error(`查询活动奖品失败: ${error.message}`);
    return (data as Prize[]) || [];
  }

  /** 通过订单解析所属商家（订单 → 套餐 → 商家），用于按商家隔离奖池 */
  async resolveMerchantIdByOrderId(orderId: string): Promise<string | number | null> {
    const { data: order } = await this.client
      .from('orders')
      .select('package_id')
      .eq('id', orderId)
      .maybeSingle();
    const packageId = (order as any)?.package_id;
    if (!packageId) return null;
    const { data: pkg } = await this.client
      .from('packages')
      .select('merchant_id')
      .eq('id', packageId)
      .maybeSingle();
    return (pkg as any)?.merchant_id ?? null;
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
    discount_rate?: number;
    discount_cap?: number;
    product_name?: string;
    product_value?: number;
    merchant_id?: number | null;
    validity_hours?: number | null;
    daily_quota?: number | null;
    is_fallback?: boolean;
  }): Promise<Prize> {
    if (!body.name) throw new BadRequestException('奖品名称不能为空');
    if ((body.prize_type || 'coupon') === 'coupon') {
      const rate = body.discount_rate ?? 0;
      if (!(rate >= 1 && rate <= 9.9)) {
        throw new BadRequestException('折扣券的折扣比例必须在 1.0 ~ 9.9 折之间');
      }
    }

    const { data, error } = await this.client
      .from('prizes')
      .insert({
        name: body.name,
        description: body.description || null,
        probability: body.probability || '0',
        image_url: body.image_url || null,
        stock: body.stock ?? 0,
        merchant_id: body.merchant_id ?? null,
        prize_type: body.prize_type || 'coupon',
        coupon_amount: body.coupon_amount ?? 0,
        coupon_min_spend: body.coupon_min_spend ?? 0,
        discount_rate: body.discount_rate ?? 0,
        discount_cap: body.discount_cap ?? 0,
        product_name: body.product_name || '',
        product_value: body.product_value ?? 0,
        validity_hours: body.validity_hours ?? null,
        daily_quota: body.daily_quota ?? null,
        is_fallback: body.is_fallback ?? false,
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
    discount_rate: number;
    discount_cap: number;
    product_name: string;
    product_value: number;
    merchant_id: number | null;
    validity_hours: number | null;
    daily_quota: number | null;
    is_fallback: boolean;
  }>): Promise<Prize> {
    const existing = await this.findOne(id);

    // 折扣券校验：折扣比例必须在 1.0 ~ 9.9 折之间
    const targetType = body.prize_type ?? existing.prize_type;
    const targetRate = body.discount_rate ?? parseFloat(String((existing as Prize & { discount_rate?: string }).discount_rate || '0'));
    if (targetType === 'coupon' && !(targetRate >= 1 && targetRate <= 9.9)) {
      throw new BadRequestException('折扣券的折扣比例必须在 1.0 ~ 9.9 折之间');
    }

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
    if (body.discount_rate !== undefined) updateData.discount_rate = body.discount_rate;
    if (body.discount_cap !== undefined) updateData.discount_cap = body.discount_cap;
    if (body.product_name !== undefined) updateData.product_name = body.product_name;
    if (body.product_value !== undefined) updateData.product_value = body.product_value;
    if (body.merchant_id !== undefined) updateData.merchant_id = body.merchant_id;
    if (body.validity_hours !== undefined) updateData.validity_hours = body.validity_hours;
    if (body.daily_quota !== undefined) updateData.daily_quota = body.daily_quota;
    if (body.is_fallback !== undefined) updateData.is_fallback = body.is_fallback;
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
