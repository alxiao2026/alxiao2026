import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export interface Order {
  id: string;
  user_id: string;
  nick_name: string | null;
  avatar_url: string | null;
  package_name: string;
  price: string;
  status: string;
  shared: boolean;
  created_at: string;
  updated_at: string | null;
}

@Injectable()
export class OrderService {
  private client = getSupabaseClient();

  async findAll(): Promise<Order[]> {
    const { data, error } = await this.client
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw new Error(`查询订单列表失败: ${error.message}`);
    return (data as Order[]) || [];
  }

  async findByUserId(userId: string): Promise<Order[]> {
    const { data, error } = await this.client
      .from('orders')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(`查询用户订单失败: ${error.message}`);
    return (data as Order[]) || [];
  }

  async findOne(id: string): Promise<Order> {
    const { data, error } = await this.client
      .from('orders')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(`查询订单失败: ${error.message}`);
    if (!data) throw new NotFoundException('订单不存在');
    return data as Order;
  }

  async create(body: { user_id: string; nick_name?: string; avatar_url?: string; package_name?: string; price?: string }): Promise<Order> {
    if (!body.user_id) throw new BadRequestException('用户ID不能为空');

    const { data, error } = await this.client
      .from('orders')
      .insert({
        user_id: body.user_id,
        nick_name: body.nick_name || null,
        avatar_url: body.avatar_url || null,
        package_name: body.package_name || '基础套餐',
        price: body.price || '9.90',
      })
      .select()
      .single();
    if (error) throw new Error(`创建订单失败: ${error.message}`);
    return data as Order;
  }

  async markShared(id: string): Promise<Order> {
    const order = await this.findOne(id);
    if (order.shared) throw new BadRequestException('该订单已分享过');

    const { data, error } = await this.client
      .from('orders')
      .update({ shared: true, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error(`标记分享失败: ${error.message}`);
    return data as Order;
  }
}