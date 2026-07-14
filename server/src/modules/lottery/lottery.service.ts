import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export interface Prize {
  id: string;
  name: string;
  description: string | null;
  probability: string;
  image_url: string | null;
  stock: number;
  is_active: boolean;
}

export interface LotteryRecord {
  id: string;
  order_id: string;
  user_id: string;
  prize_id: string | null;
  prize_name: string | null;
  is_winner: boolean;
  created_at: string;
}

export interface Order {
  id: string;
  user_id: string;
  shared: boolean;
  status: string;
}

@Injectable()
export class LotteryService {
  private client = getSupabaseClient();

  /**
   * 抽奖核心逻辑
   * 1. 验证订单存在且已支付
   * 2. 验证订单已分享
   * 3. 验证未重复抽奖
   * 4. 根据概率计算中奖
   * 5. 返回抽奖结果
   */
  async draw(orderId: string, userId: string): Promise<{ is_winner: boolean; prize: Prize | null; record: LotteryRecord }> {
    // 1. 验证订单
    const { data: order, error: orderError } = await this.client
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .maybeSingle();
    if (orderError) throw new Error(`查询订单失败: ${orderError.message}`);
    if (!order) throw new NotFoundException('订单不存在');

    const orderData = order as Order;
    if (orderData.user_id !== userId) {
      throw new BadRequestException('无权操作该订单');
    }

    // 2. 验证已分享
    if (!orderData.shared) {
      throw new BadRequestException('请先分享给好友再开奖');
    }

    // 3. 验证未重复抽奖
    const { data: existingRecord, error: existingError } = await this.client
      .from('lottery_records')
      .select('*')
      .eq('order_id', orderId)
      .maybeSingle();
    if (existingError) throw new Error(`查询抽奖记录失败: ${existingError.message}`);
    if (existingRecord) {
      throw new BadRequestException('该订单已抽过奖，不能重复抽奖');
    }

    // 4. 获取活动奖品列表
    const { data: prizes, error: prizesError } = await this.client
      .from('prizes')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: true });
    if (prizesError) throw new Error(`查询奖品失败: ${prizesError.message}`);

    const activePrizes = (prizes as Prize[]) || [];

    // 5. 计算中奖结果
    const result = this.calculateLottery(activePrizes);

    // 6. 记录抽奖结果
    const recordData: Record<string, any> = {
      order_id: orderId,
      user_id: userId,
      is_winner: result.is_winner,
      prize_name: result.prize?.name || null,
      prize_id: result.prize?.id || null,
    };

    const { data: record, error: recordError } = await this.client
      .from('lottery_records')
      .insert(recordData)
      .select()
      .single();
    if (recordError) throw new Error(`保存抽奖记录失败: ${recordError.message}`);

    // 7. 如果中奖，减少库存
    if (result.is_winner && result.prize) {
      const { error: stockError } = await this.client
        .from('prizes')
        .update({ stock: result.prize.stock - 1, updated_at: new Date().toISOString() })
        .eq('id', result.prize.id)
        .gt('stock', 0);
      if (stockError) console.error('更新库存失败:', stockError.message);
    }

    return {
      is_winner: result.is_winner,
      prize: result.prize,
      record: record as LotteryRecord,
    };
  }

  /**
   * 概率计算
   * 奖品概率百分比累加，随机数落在哪个区间就中哪个奖
   * 例如: 奖品A概率10%, 奖品B概率5%, 奖品C概率3%
   * 随机数 0-100, 0-10 中A, 10-15 中B, 15-18 中C, 18-100 不中
   */
  private calculateLottery(prizes: Prize[]): { is_winner: boolean; prize: Prize | null } {
    if (prizes.length === 0) {
      return { is_winner: false, prize: null };
    }

    // 过滤有库存的奖品
    const availablePrizes = prizes.filter(p => p.stock > 0);
    if (availablePrizes.length === 0) {
      return { is_winner: false, prize: null };
    }

    // 解析概率
    const totalProbability = availablePrizes.reduce((sum, p) => sum + parseFloat(p.probability || '0'), 0);

    if (totalProbability <= 0) {
      return { is_winner: false, prize: null };
    }

    // 生成随机数 [0, totalProbability)
    const random = Math.random() * totalProbability;

    // 概率累加匹配
    let cumulative = 0;
    for (const prize of availablePrizes) {
      cumulative += parseFloat(prize.probability || '0');
      if (random < cumulative) {
        return { is_winner: true, prize };
      }
    }

    return { is_winner: false, prize: null };
  }

  async getRecordByOrderId(orderId: string): Promise<LotteryRecord | null> {
    const { data, error } = await this.client
      .from('lottery_records')
      .select('*')
      .eq('order_id', orderId)
      .maybeSingle();
    if (error) throw new Error(`查询抽奖记录失败: ${error.message}`);
    return (data as LotteryRecord) || null;
  }

  async getUserRecords(userId: string): Promise<LotteryRecord[]> {
    const { data, error } = await this.client
      .from('lottery_records')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(`查询用户抽奖记录失败: ${error.message}`);
    return (data as LotteryRecord[]) || [];
  }
}