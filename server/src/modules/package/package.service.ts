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
  auto_renew: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string | null;
  // 交易规则
  purchase_limit: number | null;
  purchase_limit_type: string | null;
  purchase_limit_per_person: number | null;
  purchase_limit_per_day: number | null;
  purchase_limit_per_month: number | null;
  valid_days: number | null;
  valid_from_purchase: boolean | null;
  valid_date_type: string | null;
  valid_date_start: string | null;
  valid_date_end: string | null;
  unavailable_dates: any;
  unavailable_date_type: string | null;
  unavailable_weekdays: any;
  unavailable_holidays: any;
  available_time_type: string | null;
  available_time_start: string | null;
  available_time_end: string | null;
  limit_usage_count: boolean | null;
  usage_count_limit: number | null;
  need_reservation: boolean | null;
  reservation_hours: number | null;
  // 消费规则
  other_discount: string | null;
  private_room: string | null;
  dine_in_type: string | null;
  has_extra_fee: boolean | null;
  extra_fees: any;
  other_notes: string | null;
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

    const packages = (data as Package[]) || [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 处理自动延期和过滤已下架套餐
    const activePackages: Package[] = [];
    for (const pkg of packages) {
      // 如果有售卖结束日期
      if (pkg.sale_end_date) {
        const endDate = new Date(pkg.sale_end_date);
        endDate.setHours(23, 59, 59, 999);

        // 如果已过期
        if (endDate < today) {
          // 如果勾选了自动延期，自动延期半年
          if (pkg.auto_renew) {
            const newEndDate = new Date(endDate);
            newEndDate.setMonth(newEndDate.getMonth() + 6);
            await this.client
              .from('packages')
              .update({ sale_end_date: newEndDate.toISOString().split('T')[0] })
              .eq('id', pkg.id);
            pkg.sale_end_date = newEndDate.toISOString().split('T')[0];
          } else {
            // 未勾选自动延期，下架套餐
            await this.client
              .from('packages')
              .update({ is_active: false })
              .eq('id', pkg.id);
            continue; // 跳过已下架的套餐
          }
        }
      }

      activePackages.push(pkg);
    }

    return activePackages;
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
    auto_renew?: boolean;
    category?: string;
    package_type?: string;
    merchant_id?: string;
    combinations?: any;
    // 交易规则
    purchase_limit?: number;
    purchase_limit_type?: string;
    purchase_limit_per_day?: number;
    purchase_limit_per_month?: number;
    valid_days?: number;
    valid_from_purchase?: boolean;
    valid_date_type?: string;
    valid_date_start?: string;
    valid_date_end?: string;
    unavailable_dates?: any;
    unavailable_date_type?: string;
    unavailable_weekdays?: any;
    unavailable_holidays?: any;
    available_time_type?: string;
    available_time_start?: string;
    available_time_end?: string;
    limit_usage_count?: boolean;
    usage_count_limit?: number;
    need_reservation?: boolean;
    // 消费规则
    other_discount?: string;
    private_room?: string;
    dine_in_type?: string;
    has_extra_fee?: boolean;
    extra_fees?: any;
    other_notes?: string;
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
        auto_renew: body.auto_renew || false,
        category: body.category || null,
        package_type: body.package_type || null,
        merchant_id: body.merchant_id || null,
        combinations: body.combinations || null,
        // 交易规则
        purchase_limit: body.purchase_limit || null,
        purchase_limit_type: body.purchase_limit_type || 'unlimited',
        purchase_limit_per_day: body.purchase_limit_per_day || null,
        purchase_limit_per_month: body.purchase_limit_per_month || null,
        valid_days: body.valid_days || 60,
        valid_from_purchase: body.valid_from_purchase !== undefined ? body.valid_from_purchase : true,
        valid_date_type: body.valid_date_type || 'days',
        valid_date_start: body.valid_date_start || null,
        valid_date_end: body.valid_date_end || null,
        unavailable_dates: body.unavailable_dates || null,
        unavailable_date_type: body.unavailable_date_type || 'all',
        unavailable_weekdays: body.unavailable_weekdays || null,
        unavailable_holidays: body.unavailable_holidays || null,
        available_time_type: body.available_time_type || 'business_hours',
        available_time_start: body.available_time_start || null,
        available_time_end: body.available_time_end || null,
        limit_usage_count: body.limit_usage_count || false,
        usage_count_limit: body.usage_count_limit || null,
        need_reservation: body.need_reservation || false,
        // 消费规则
        other_discount: body.other_discount || null,
        private_room: body.private_room || null,
        dine_in_type: body.dine_in_type || 'all',
        has_extra_fee: body.has_extra_fee || false,
        extra_fees: body.extra_fees || null,
        other_notes: body.other_notes || null,
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
    auto_renew: boolean;
    is_active: boolean;
    category: string;
    package_type: string;
    merchant_id: string;
    combinations: any;
    // 交易规则
    purchase_limit: number;
    purchase_limit_type: string;
    purchase_limit_per_day: number;
    purchase_limit_per_month: number;
    valid_days: number;
    valid_from_purchase: boolean;
    valid_date_type: string;
    valid_date_start: string;
    valid_date_end: string;
    unavailable_dates: any;
    unavailable_date_type: string;
    unavailable_weekdays: any;
    unavailable_holidays: any;
    available_time_type: string;
    available_time_start: string;
    available_time_end: string;
    limit_usage_count: boolean;
    usage_count_limit: number;
    need_reservation: boolean;
    // 消费规则
    other_discount: string;
    private_room: string;
    dine_in_type: string;
    has_extra_fee: boolean;
    extra_fees: any;
    other_notes: string;
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
    if (body.auto_renew !== undefined) updateData.auto_renew = body.auto_renew;
    if (body.is_active !== undefined) updateData.is_active = body.is_active;
    if (body.category !== undefined) updateData.category = body.category;
    if (body.package_type !== undefined) updateData.package_type = body.package_type;
    if (body.merchant_id !== undefined) updateData.merchant_id = body.merchant_id;
    if (body.combinations !== undefined) updateData.combinations = body.combinations;
    // 交易规则
    if (body.purchase_limit !== undefined) updateData.purchase_limit = body.purchase_limit;
    if (body.purchase_limit_type !== undefined) updateData.purchase_limit_type = body.purchase_limit_type;
    if (body.purchase_limit_per_day !== undefined) updateData.purchase_limit_per_day = body.purchase_limit_per_day;
    if (body.purchase_limit_per_month !== undefined) updateData.purchase_limit_per_month = body.purchase_limit_per_month;
    if (body.valid_days !== undefined) updateData.valid_days = body.valid_days;
    if (body.valid_from_purchase !== undefined) updateData.valid_from_purchase = body.valid_from_purchase;
    if (body.valid_date_type !== undefined) updateData.valid_date_type = body.valid_date_type;
    if (body.valid_date_start !== undefined) updateData.valid_date_start = body.valid_date_start;
    if (body.valid_date_end !== undefined) updateData.valid_date_end = body.valid_date_end;
    if (body.unavailable_dates !== undefined) updateData.unavailable_dates = body.unavailable_dates;
    if (body.unavailable_date_type !== undefined) updateData.unavailable_date_type = body.unavailable_date_type;
    if (body.unavailable_weekdays !== undefined) updateData.unavailable_weekdays = body.unavailable_weekdays;
    if (body.unavailable_holidays !== undefined) updateData.unavailable_holidays = body.unavailable_holidays;
    if (body.available_time_type !== undefined) updateData.available_time_type = body.available_time_type;
    if (body.available_time_start !== undefined) updateData.available_time_start = body.available_time_start;
    if (body.available_time_end !== undefined) updateData.available_time_end = body.available_time_end;
    if (body.limit_usage_count !== undefined) updateData.limit_usage_count = body.limit_usage_count;
    if (body.usage_count_limit !== undefined) updateData.usage_count_limit = body.usage_count_limit;
    if (body.need_reservation !== undefined) updateData.need_reservation = body.need_reservation;
    // 消费规则
    if (body.other_discount !== undefined) updateData.other_discount = body.other_discount;
    if (body.private_room !== undefined) updateData.private_room = body.private_room;
    if (body.dine_in_type !== undefined) updateData.dine_in_type = body.dine_in_type;
    if (body.has_extra_fee !== undefined) updateData.has_extra_fee = body.has_extra_fee;
    if (body.extra_fees !== undefined) updateData.extra_fees = body.extra_fees;
    if (body.other_notes !== undefined) updateData.other_notes = body.other_notes;
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
