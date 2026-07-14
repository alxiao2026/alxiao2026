import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export interface Package {
  id: string;
  name: string;
  description: string | null;
  price: string;
  original_price: string | null;
  badge: string | null;
  features: string | null;
  cover_image: string | null;
  environment_images: string | null;
  stock: number;
  sale_start_date: string | null;
  sale_end_date: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string | null;
}

@Injectable()
export class PackageService {
  private client = getSupabaseClient();

  async findAll(): Promise<Package[]> {
    const { data, error } = await this.client
      .from('packages')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) throw new Error(`查询套餐列表失败：${error.message}`);
    return (data as Package[]) || [];
  }

  async findActive(): Promise<Package[]> {
    const { data, error } = await this.client
      .from('packages')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: true });
    if (error) throw new Error(`查询活动套餐失败：${error.message}`);
    return (data as Package[]) || [];
  }

  async findOne(id: string): Promise<Package> {
    const { data, error } = await this.client
      .from('packages')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(`查询套餐失败：${error.message}`);
    if (!data) throw new NotFoundException('套餐不存在');
    return data as Package;
  }

  async create(body: {
    name: string;
    description?: string;
    price?: string;
    original_price?: string;
    badge?: string;
    features?: string;
    cover_image?: string;
    environment_images?: string;
    stock?: number;
    sale_start_date?: string;
    sale_end_date?: string;
  }): Promise<Package> {
    if (!body.name) throw new BadRequestException('套餐名称不能为空');

    const { data, error } = await this.client
      .from('packages')
      .insert({
        name: body.name,
        description: body.description || null,
        price: body.price || '9.90',
        original_price: body.original_price || null,
        badge: body.badge || null,
        features: body.features || null,
        cover_image: body.cover_image || null,
        environment_images: body.environment_images || null,
        stock: body.stock || 0,
        sale_start_date: body.sale_start_date || null,
        sale_end_date: body.sale_end_date || null,
      })
      .select()
      .single();
    if (error) throw new Error(`创建套餐失败：${error.message}`);
    return data as Package;
  }

  async update(id: string, body: Partial<{
    name: string;
    description: string;
    price: string;
    original_price: string;
    badge: string;
    features: string;
    cover_image: string;
    environment_images: string;
    stock: number;
    sale_start_date: string;
    sale_end_date: string;
    is_active: boolean;
  }>): Promise<Package> {
    await this.findOne(id);

    const updateData: Record<string, any> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.price !== undefined) updateData.price = body.price;
    if (body.original_price !== undefined) updateData.original_price = body.original_price;
    if (body.badge !== undefined) updateData.badge = body.badge;
    if (body.features !== undefined) updateData.features = body.features;
    if (body.cover_image !== undefined) updateData.cover_image = body.cover_image;
    if (body.environment_images !== undefined) updateData.environment_images = body.environment_images;
    if (body.stock !== undefined) updateData.stock = body.stock;
    if (body.sale_start_date !== undefined) updateData.sale_start_date = body.sale_start_date;
    if (body.sale_end_date !== undefined) updateData.sale_end_date = body.sale_end_date;
    if (body.is_active !== undefined) updateData.is_active = body.is_active;
    updateData.updated_at = new Date().toISOString();

    const { data, error } = await this.client
      .from('packages')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error(`更新套餐失败：${error.message}`);
    return data as Package;
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);

    const { error } = await this.client
      .from('packages')
      .delete()
      .eq('id', id);
    if (error) throw new Error(`删除套餐失败：${error.message}`);
  }
}
