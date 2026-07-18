import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import * as QRCode from 'qrcode';

export interface Order {
  id: string;
  user_id: string;
  nick_name: string | null;
  avatar_url: string | null;
  package_id: string | null;
  package_name: string;
  price: string;
  original_price: string | null;
  status: string;
  shared: boolean;
  verification_code: string | null;
  verified_at: string | null;
  expire_at: string | null;
  shop_name: string | null;
  created_at: string;
  updated_at: string | null;
}

function generateVerificationCode(): string {
  // 生成12位数字核销码，每4位一组用-分隔
  const segments: string[] = [];
  for (let i = 0; i < 3; i++) {
    segments.push(String(Math.floor(1000 + Math.random() * 9000)));
  }
  return segments.join('');
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

  async create(body: {
    user_id: string;
    nick_name?: string;
    avatar_url?: string;
    package_id?: string;
    package_name?: string;
    price?: string;
    original_price?: string;
    shop_name?: string;
  }): Promise<Order> {
    if (!body.user_id) throw new BadRequestException('用户ID不能为空');

    const verificationCode = generateVerificationCode();

    const { data, error } = await this.client
      .from('orders')
      .insert({
        user_id: body.user_id,
        nick_name: body.nick_name || null,
        avatar_url: body.avatar_url || null,
        package_id: body.package_id || null,
        package_name: body.package_name || '基础套餐',
        price: body.price || '9.90',
        original_price: body.original_price || null,
        verification_code: verificationCode,
        shop_name: body.shop_name || null,
        status: 'pending',
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

  async generateQRCode(id: string): Promise<{ qrcode: string; verification_code: string }> {
    const order = await this.findOne(id);
    if (!order.verification_code) throw new BadRequestException('该订单无核销码');

    const qrDataUrl = await QRCode.toDataURL(order.verification_code, {
      width: 400,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    });

    return { qrcode: qrDataUrl, verification_code: order.verification_code };
  }

  async verify(code: string): Promise<Order> {
    if (!code) throw new BadRequestException('核销码不能为空');

    const { data: order, error: findError } = await this.client
      .from('orders')
      .select('*')
      .eq('verification_code', code)
      .maybeSingle();

    if (findError) throw new Error(`查询订单失败: ${findError.message}`);
    if (!order) throw new NotFoundException('核销码无效，未找到对应订单');

    if (order.status === 'used') throw new BadRequestException('该订单已核销');
    if (order.status === 'refunded') throw new BadRequestException('该订单已退款');

    const { data, error } = await this.client
      .from('orders')
      .update({
        status: 'used',
        verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', order.id)
      .select()
      .single();

    if (error) throw new Error(`核销失败: ${error.message}`);
    return data as Order;
  }

  async findByVerificationCode(code: string): Promise<Order> {
    const { data, error } = await this.client
      .from('orders')
      .select('*')
      .eq('verification_code', code)
      .maybeSingle();
    if (error) throw new Error(`查询订单失败: ${error.message}`);
    if (!data) throw new NotFoundException('核销码无效');
    return data as Order;
  }
}
