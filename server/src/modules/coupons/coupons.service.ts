import { Injectable, BadRequestException } from '@nestjs/common';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export interface DiscountCoupon {
  id: string;
  code: string;
  user_id: string;
  merchant_id: number;
  package_id: string | null;
  title: string;
  discount_rate: string;
  discount_cap: string;
  min_spend: string;
  status: string;
  source: string;
  group_id: string | null;
  used_order_id: string | null;
  locked_at: string | null;
  used_at: string | null;
  expire_at: string | null;
  created_at: string;
  merchant_name?: string | null;
}

@Injectable()
export class CouponsService {
  private client = getSupabaseClient();

  /** 查询我的优惠券列表（含门店名，自动识别过期） */
  async getMyCoupons(userId: string): Promise<DiscountCoupon[]> {
    if (!userId) throw new BadRequestException('缺少 user_id');
    const { data, error } = await this.client
      .from('discount_coupons')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(`查询优惠券失败: ${error.message}`);
    const coupons = (data || []) as any[];
    if (coupons.length === 0) return [];

    // 补齐门店名
    const merchantIds = [...new Set(coupons.map((c) => Number(c.merchant_id)).filter(Boolean))];
    let nameMap: Record<number, string> = {};
    if (merchantIds.length > 0) {
      const { data: merchants } = await this.client
        .from('merchants')
        .select('id, name')
        .in('id', merchantIds);
      nameMap = Object.fromEntries((merchants || []).map((m: any) => [Number(m.id), m.name]));
    }

    return coupons.map((c: any) => {
      const expired =
        c.status === 'unused' && c.expire_at && new Date(c.expire_at) < new Date();
      return {
        ...c,
        merchant_name: nameMap[Number(c.merchant_id)] || null,
        status: expired ? 'expired' : c.status,
      };
    });
  }

  /** 预下单前置校验（不锁券）：校验券归属/门店/状态/有效期/门槛，返回券信息 */
  async getCouponForPrepay(
    code: string,
    userId: string,
    merchantId: number,
    orderAmount: number,
  ): Promise<DiscountCoupon> {
    const { data: c } = await this.client
      .from('discount_coupons')
      .select('*')
      .eq('code', code)
      .maybeSingle();
    if (!c) throw new BadRequestException('优惠券不存在');
    if (c.user_id !== userId) throw new BadRequestException('无权使用该优惠券');
    if (Number(c.merchant_id) !== Number(merchantId)) {
      throw new BadRequestException('该优惠券仅限指定门店使用');
    }
    if (c.status === 'locked' && c.used_order_id) return c as DiscountCoupon; // 幂等复用
    if (c.status !== 'unused') throw new BadRequestException('该优惠券已被使用');
    if (c.expire_at && new Date(c.expire_at) < new Date()) {
      await this.client
        .from('discount_coupons')
        .update({ status: 'expired' })
        .eq('id', c.id);
      throw new BadRequestException('该优惠券已过期');
    }
    if (Number(c.min_spend) > orderAmount) {
      throw new BadRequestException(`该券满 ${Number(c.min_spend)} 元可用，当前订单未达门槛`);
    }
    return c as DiscountCoupon;
  }

  /** 计算优惠券抵扣金额：原价 × (10 - 折扣率) / 10，受封顶金额与实付下限约束 */
  calculateDiscount(coupon: DiscountCoupon, orderAmount: number): number {
    const rate = parseFloat(coupon.discount_rate || '0');
    const cap = parseFloat(coupon.discount_cap || '0');
    let discount = Math.round((orderAmount * (10 - rate) / 10) * 100) / 100;
    if (cap > 0 && discount > cap) discount = Math.round(cap * 100) / 100;
    discount = Math.min(discount, Math.max(orderAmount - 0.01, 0));
    return Math.round(discount * 100) / 100;
  }

  /** 换券/取消选券时同步锁券：先解锁本订单旧券，再锁定当前选中券（幂等） */
  async syncCouponLock(code: string | null, orderId: string, userId: string) {
    await this.client
      .from('discount_coupons')
      .update({ status: 'unused', used_order_id: null, locked_at: null })
      .eq('used_order_id', orderId)
      .eq('status', 'locked')
      .neq('code', code || '');
    if (!code) return;
    const { data: c } = await this.client
      .from('discount_coupons')
      .select('*')
      .eq('code', code)
      .maybeSingle();
    if (!c || c.user_id !== userId) return;
    if (c.status === 'locked' && c.used_order_id === orderId) return;
    if (c.status !== 'unused') return;
    await this.client
      .from('discount_coupons')
      .update({ status: 'locked', used_order_id: orderId, locked_at: new Date().toISOString() })
      .eq('id', c.id)
      .eq('status', 'unused');
  }

  /** 支付成功核销：locked → used */
  async redeemCoupon(code: string, orderId: string) {
    const now = new Date().toISOString();
    await this.client
      .from('discount_coupons')
      .update({ status: 'used', used_at: now, used_order_id: orderId })
      .eq('code', code)
      .eq('status', 'locked');
  }

  /** 订单超时/取消时解锁其锁定的优惠券 */
  async unlockCouponsByOrder(orderId: string) {
    await this.client
      .from('discount_coupons')
      .update({ status: 'unused', used_order_id: null, locked_at: null })
      .eq('used_order_id', orderId)
      .eq('status', 'locked');
  }
}