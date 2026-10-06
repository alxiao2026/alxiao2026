import { Injectable } from '@nestjs/common';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export interface CreateMarketingActivityDto {
  merchant_id: string;
  type?: string;
  title: string;
  description?: string;
  status?: string;
  start_time?: string;
  end_time?: string;
  config?: Record<string, any>;
  sort_order?: number;
}

export interface UpdateMarketingActivityDto {
  type?: string;
  title?: string;
  description?: string;
  status?: string;
  start_time?: string;
  end_time?: string;
  config?: Record<string, any>;
  sort_order?: number;
}

@Injectable()
export class MerchantMarketingService {
  async findByMerchant(merchantId: string) {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('merchant_marketing_activities')
      .select('*')
      .eq('merchant_id', merchantId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async create(dto: CreateMarketingActivityDto) {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('merchant_marketing_activities')
      .insert({
        merchant_id: dto.merchant_id,
        type: dto.type || 'coupon',
        title: dto.title,
        description: dto.description || null,
        status: dto.status || 'draft',
        start_time: dto.start_time || null,
        end_time: dto.end_time || null,
        config: dto.config || {},
        sort_order: dto.sort_order || 0,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async update(id: string, dto: UpdateMarketingActivityDto) {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('merchant_marketing_activities')
      .update({
        ...dto,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateStatus(id: string, status: string) {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('merchant_marketing_activities')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async remove(id: string) {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from('merchant_marketing_activities')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return { id };
  }
}
