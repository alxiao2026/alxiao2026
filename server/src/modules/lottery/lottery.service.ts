import { Injectable, NotFoundException, BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { S3Storage } from 'coze-coding-dev-sdk';
import * as crypto from 'crypto';
import * as QRCode from 'qrcode';

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
}

export interface LotteryRecord {
  id: string;
  order_id: string;
  user_id: string;
  prize_id: string | null;
  prize_name: string | null;
  is_winner: boolean;
  redemption_code: string;
  refund_amount: string;
  refund_status: string;
  user_weight: string;
  ip_address: string;
  created_at: string;
}

export interface LotterySettings {
  weight_enabled: boolean;
  weight_visitor: number;
  weight_ordered: number;
  weight_share_base: number;
  weight_share_increment: number;
  weight_social_post: number;
  weight_cap: number;
  rate_limit_enabled: boolean;
  rate_limit_max: number;
  captcha_enabled: boolean;
  redemption_expiry_hours: number;
}

const DEFAULT_SETTINGS: LotterySettings = {
  weight_enabled: true,
  weight_visitor: 1,
  weight_ordered: 2,
  weight_share_base: 3,
  weight_share_increment: 0.5,
  weight_social_post: 1,
  weight_cap: 20,
  rate_limit_enabled: true,
  rate_limit_max: 10,
  captcha_enabled: false,
  redemption_expiry_hours: 72,
};

@Injectable()
export class LotteryService {
  private client = getSupabaseClient();
  private storage = new S3Storage({
    endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
    accessKey: '',
    secretKey: '',
    bucketName: process.env.COZE_BUCKET_NAME,
    region: 'cn-beijing'
  });
  private settingsCache: { data: LotterySettings; expiry: number } | null = null;
  private static SETTINGS_CACHE_TTL = 30_000; // 30秒缓存

  // ========== 设置管理 ==========

  async getSettings(): Promise<LotterySettings> {
    if (this.settingsCache && Date.now() < this.settingsCache.expiry) {
      return this.settingsCache.data;
    }
    const { data, error } = await this.client
      .from('lottery_settings')
      .select('setting_key, setting_value');
    if (error) throw new Error(`查询抽奖设置失败: ${error.message}`);

    const map = new Map<string, string>();
    (data || []).forEach((row: any) => map.set(row.setting_key, row.setting_value));

    const settings: LotterySettings = {
      weight_enabled: (map.get('weight_enabled') || 'true') === 'true',
      weight_visitor: parseFloat(map.get('weight_visitor') || '1'),
      weight_ordered: parseFloat(map.get('weight_ordered') || '2'),
      weight_share_base: parseFloat(map.get('weight_share_base') || '3'),
      weight_share_increment: parseFloat(map.get('weight_share_increment') || '0.5'),
      weight_social_post: parseFloat(map.get('weight_social_post') || '1'),
      weight_cap: parseFloat(map.get('weight_cap') || '20'),
      rate_limit_enabled: (map.get('rate_limit_enabled') || 'true') === 'true',
      rate_limit_max: parseInt(map.get('rate_limit_max') || '10', 10),
      captcha_enabled: (map.get('captcha_enabled') || 'false') === 'true',
      redemption_expiry_hours: parseInt(map.get('redemption_expiry_hours') || '72', 10),
    };

    this.settingsCache = { data: settings, expiry: Date.now() + LotteryService.SETTINGS_CACHE_TTL };
    return settings;
  }

  async updateSettings(updates: Record<string, string>): Promise<LotterySettings> {
    for (const [key, value] of Object.entries(updates)) {
      const { error } = await this.client
        .from('lottery_settings')
        .upsert({ setting_key: key, setting_value: String(value), updated_at: new Date().toISOString() }, { onConflict: 'setting_key' });
      if (error) throw new Error(`更新设置失败 [${key}]: ${error.message}`);
    }
    this.settingsCache = null; // 清除缓存
    return this.getSettings();
  }

  // ========== CSPRNG 安全随机源 ==========

  /** 使用 crypto.randomInt 生成加密安全随机数 [min, max) */
  private secureRandom(min: number, max: number): number {
    return crypto.randomInt(min, max);
  }

  /** 生成 [0, 1) 的加密安全浮点随机数 */
  private secureRandomFloat(): number {
    const buf = crypto.randomBytes(4);
    const uint32 = buf.readUInt32BE(0);
    return uint32 / 0x100000000;
  }

  // ========== 用户权重计算 ==========

  async calculateUserWeight(userId: string): Promise<number> {
    const settings = await this.getSettings();
    if (!settings.weight_enabled) return 1;

    // 查询用户信息
    const { data: user } = await this.client
      .from('users')
      .select('share_count, social_post_count')
      .eq('user_id', userId)
      .maybeSingle();

    // 检查是否有订单
    const { data: orders } = await this.client
      .from('orders')
      .select('id')
      .eq('user_id', userId)
      .limit(1);

    const hasOrdered = (orders || []).length > 0;
    const shareCount = (user as any)?.share_count || 0;
    const socialPostCount = (user as any)?.social_post_count || 0;

    // 基础权重
    let weight = hasOrdered ? settings.weight_ordered : settings.weight_visitor;

    // 分享权重
    if (shareCount >= 1) {
      weight = settings.weight_share_base + (shareCount - 1) * settings.weight_share_increment;
    }

    // 社交媒体发布权重
    weight += socialPostCount * settings.weight_social_post;

    // 封顶
    return Math.min(weight, settings.weight_cap);
  }

  // ========== IP 限流 ==========

  private async checkRateLimit(ipAddress: string): Promise<void> {
    const settings = await this.getSettings();
    if (!settings.rate_limit_enabled) return;

    const now = new Date();
    const windowMs = 60_000; // 1分钟窗口
    const windowStart = new Date(now.getTime() - windowMs);

    // 查询当前IP的记录
    const { data: existing } = await this.client
      .from('lottery_rate_limits')
      .select('*')
      .eq('ip_address', ipAddress)
      .maybeSingle();

    if (existing) {
      const recordStart = new Date((existing as any).window_start);
      if (recordStart > windowStart) {
        // 仍在窗口期内
        const count = (existing as any).request_count || 0;
        if (count >= settings.rate_limit_max) {
          throw new HttpException('请求过于频繁，请稍后再试', HttpStatus.TOO_MANY_REQUESTS);
        }
        await this.client
          .from('lottery_rate_limits')
          .update({ request_count: count + 1 })
          .eq('ip_address', ipAddress);
        return;
      }
    }

    // 重置或新建窗口
    await this.client
      .from('lottery_rate_limits')
      .upsert({
        ip_address: ipAddress,
        request_count: 1,
        window_start: now.toISOString(),
      }, { onConflict: 'ip_address' });
  }

  // ========== 操作日志 ==========

  private async logOperation(log: {
    user_id: string;
    order_id?: string;
    action: string;
    user_weight: number;
    prize_id?: string;
    prize_name?: string;
    is_winner: boolean;
    ip_address: string;
    user_agent?: string;
    detail?: Record<string, any>;
  }): Promise<void> {
    try {
      await this.client.from('lottery_logs').insert({
        user_id: log.user_id,
        order_id: log.order_id || null,
        action: log.action,
        user_weight: log.user_weight,
        prize_id: log.prize_id || null,
        prize_name: log.prize_name || null,
        is_winner: log.is_winner,
        ip_address: log.ip_address,
        user_agent: log.user_agent || '',
        detail: log.detail || {},
      });
    } catch (e) {
      console.error('写入抽奖日志失败:', e);
    }
  }

  // ========== 加权抽奖算法 ==========

  /**
   * 加权奖池抽奖算法 + CSPRNG
   * 每个奖品的有效概率 = 基础概率 × 用户权重
   * 使用 crypto 安全随机源，防止结果被预测
   */
  private calculateWeightedLottery(prizes: Prize[], userWeight: number): { is_winner: boolean; prize: Prize | null } {
    const availablePrizes = prizes.filter(p => p.stock > 0);
    if (availablePrizes.length === 0) {
      return { is_winner: false, prize: null };
    }

    // 计算每个奖品的加权概率
    const weightedPrizes = availablePrizes.map(p => ({
      prize: p,
      weight: parseFloat(p.probability || '0') * userWeight,
    }));

    const totalWeight = weightedPrizes.reduce((sum, wp) => sum + wp.weight, 0);
    if (totalWeight <= 0) {
      return { is_winner: false, prize: null };
    }

    // CSPRNG 生成 [0, totalWeight) 的随机数
    const random = this.secureRandomFloat() * totalWeight;

    // 区间匹配
    let cumulative = 0;
    for (const wp of weightedPrizes) {
      cumulative += wp.weight;
      if (random < cumulative) {
        return { is_winner: true, prize: wp.prize };
      }
    }

    return { is_winner: true, prize: weightedPrizes[weightedPrizes.length - 1].prize };
  }

  // ========== 库存锁（原子扣减） ==========

  /** 原子扣减库存，防止并发超发。返回新库存，失败返回 -1 */
  private async atomicDecrementStock(prizeId: string): Promise<number> {
    // 先尝试 RPC 函数（如果 schema cache 已刷新）
    const { data: rpcData, error: rpcError } = await this.client.rpc('decrement_prize_stock', { prize_id_param: prizeId });
    if (!rpcError && rpcData !== null && rpcData !== undefined) {
      return rpcData as number;
    }

    // RPC 不可用时，使用乐观锁降级：先查后减
    const { data: prize, error: queryError } = await this.client
      .from('prizes')
      .select('stock')
      .eq('id', prizeId)
      .maybeSingle();

    if (queryError || !prize) {
      console.error('库存查询失败:', queryError?.message || 'prize not found');
      return -1;
    }

    const currentStock = (prize as any).stock as number;
    if (currentStock <= 0) {
      return -1;
    }

    // 乐观锁：只在 stock 仍为当前值时更新
    const { error: updateError } = await this.client
      .from('prizes')
      .update({ stock: currentStock - 1 })
      .eq('id', prizeId)
      .eq('stock', currentStock);

    if (updateError) {
      console.error('库存扣减失败:', updateError.message);
      return -1;
    }

    return currentStock - 1;
  }

  // ========== 抽奖主流程 ==========

  async draw(orderId: string, userId: string, ipAddress: string = '', userAgent: string = ''): Promise<{ is_winner: boolean; prize: Prize | null; record: LotteryRecord }> {
    // 0. IP 限流检查
    await this.checkRateLimit(ipAddress);

    // 1. 验证订单
    const { data: order, error: orderError } = await this.client
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .maybeSingle();
    if (orderError) throw new Error(`查询订单失败: ${orderError.message}`);
    if (!order) throw new NotFoundException('订单不存在');

    const orderData = order as any;
    if (orderData.user_id !== userId) {
      throw new BadRequestException('无权操作该订单');
    }

    // 2. 验证已分享
    if (!orderData.shared) {
      throw new BadRequestException('请先分享给好友再开奖');
    }

    // 3. 验证未重复抽奖
    const { data: existingRecord } = await this.client
      .from('lottery_records')
      .select('*')
      .eq('order_id', orderId)
      .maybeSingle();
    if (existingRecord) {
      throw new BadRequestException('该订单已抽过奖，不能重复抽奖');
    }

    // 4. 计算用户权重
    const userWeight = await this.calculateUserWeight(userId);

    // 5. 获取活动奖品列表（库存>0）
    const { data: prizes, error: prizesError } = await this.client
      .from('prizes')
      .select('*')
      .eq('is_active', true)
      .gt('stock', 0)
      .order('created_at', { ascending: true });
    if (prizesError) throw new Error(`查询奖品失败: ${prizesError.message}`);

    const orderTotal = parseFloat(orderData.price || '0') * (orderData.quantity || 1);

    // 5a. 预过滤：排除不满足条件的奖品（如消费券未达最低消费额），确保百分百中奖
    const eligiblePrizes = ((prizes as Prize[]) || []).filter(p => {
      if (p.prize_type === 'coupon') {
        const minSpend = parseFloat(p.coupon_min_spend || '0');
        const couponAmt = parseFloat(p.coupon_amount || '0');
        return orderTotal >= minSpend && couponAmt > 0;
      }
      return true; // product 和 free_meal 始终可抽
    });

    if (eligiblePrizes.length === 0) {
      throw new BadRequestException('当前没有可抽取的奖品');
    }

    // 6. 加权抽奖（CSPRNG）— 仅从符合条件的奖品中抽取
    let result = this.calculateWeightedLottery(eligiblePrizes, userWeight);

    // 7. 处理中奖模式逻辑
    let redemptionCode = '';
    let refundAmount = 0;
    let refundStatus = '';

    // 8. 中奖则原子扣减库存（防并发超发）；失败则从剩余奖品中重新抽取
    const triedPrizeIds = new Set<string>();
    while (result.is_winner && result.prize) {
      triedPrizeIds.add(result.prize.id);
      const newStock = await this.atomicDecrementStock(result.prize.id);
      if (newStock >= 0) {
        result.prize.stock = newStock;
        break; // 扣减成功
      }
      // 库存扣减失败，从剩余可抽奖品中重新抽取
      const remainingPrizes = eligiblePrizes.filter(p => !triedPrizeIds.has(p.id));
      if (remainingPrizes.length === 0) {
        // 所有奖品库存都已耗尽，无法继续
        result = { is_winner: false, prize: null };
        break;
      }
      result = this.calculateWeightedLottery(remainingPrizes, userWeight);
    }

    // 9. 处理中奖模式逻辑
    if (result.is_winner && result.prize) {
      const prize = result.prize;
      if (prize.prize_type === 'coupon') {
        refundAmount = parseFloat(prize.coupon_amount || '0');
        refundStatus = 'pending';
      } else if (prize.prize_type === 'product') {
        redemptionCode = `PRD-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
        refundStatus = 'pending';
      } else if (prize.prize_type === 'free_meal') {
        refundAmount = orderTotal;
        refundStatus = 'pending';
        redemptionCode = `BWC-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
      }
    }

    // 10. 记录抽奖结果
    const recordData: Record<string, any> = {
      order_id: orderId,
      user_id: userId,
      is_winner: result.is_winner,
      prize_name: result.prize?.name || null,
      prize_id: result.prize?.id || null,
      redemption_code: redemptionCode,
      refund_amount: refundAmount,
      refund_status: refundStatus,
      user_weight: userWeight,
      ip_address: ipAddress,
    };

    const { data: record, error: recordError } = await this.client
      .from('lottery_records')
      .insert(recordData)
      .select()
      .single();
    if (recordError) throw new Error(`保存抽奖记录失败: ${recordError.message}`);

    // 11. 写入操作日志
    await this.logOperation({
      user_id: userId,
      order_id: orderId,
      action: 'draw',
      user_weight: userWeight,
      prize_id: result.prize?.id,
      prize_name: result.prize?.name,
      is_winner: result.is_winner,
      ip_address: ipAddress,
      user_agent: userAgent,
      detail: {
        order_total: parseFloat(orderData.price || '0') * (orderData.quantity || 1),
        prize_type: result.prize?.prize_type,
        redemption_code: redemptionCode || undefined,
        refund_amount: refundAmount || undefined,
      },
    });

    return {
      is_winner: result.is_winner,
      prize: result.prize,
      record: record as LotteryRecord,
    };
  }

  // ========== 商品兑换码核销 ==========

  async redeemProduct(redemptionCode: string, merchantUserId: string, ipAddress: string = ''): Promise<LotteryRecord> {
    const { data: record, error } = await this.client
      .from('lottery_records')
      .select('*')
      .eq('redemption_code', redemptionCode)
      .eq('is_winner', true)
      .maybeSingle();
    if (error) throw new Error(`查询兑换记录失败: ${error.message}`);
    if (!record) throw new NotFoundException('兑换码无效');

    const recordData = record as LotteryRecord;
    if (recordData.refund_status === 'redeemed') {
      throw new BadRequestException('该商品已兑换过');
    }

    // 检查兑奖有效期
    const expiryHours = await this.getRedemptionExpiryHours();
    const createdAt = new Date(recordData.created_at).getTime();
    const expiresAt = createdAt + expiryHours * 3600 * 1000;
    if (Date.now() > expiresAt) {
      throw new BadRequestException(`兑奖已过期（有效期${expiryHours}小时）`);
    }

    const { data: updated, error: updateError } = await this.client
      .from('lottery_records')
      .update({ refund_status: 'redeemed', redeemed_at: new Date().toISOString(), redeemed_by: merchantUserId })
      .eq('id', recordData.id)
      .select()
      .single();
    if (updateError) throw new Error(`更新兑换状态失败: ${updateError.message}`);

    // 写入操作日志
    await this.logOperation({
      user_id: merchantUserId,
      action: 'redeem',
      user_weight: 0,
      prize_id: recordData.prize_id || undefined,
      prize_name: recordData.prize_name || undefined,
      is_winner: true,
      ip_address: ipAddress,
      detail: { redemption_code: redemptionCode, winner_user_id: recordData.user_id },
    });

    return updated as LotteryRecord;
  }

  /** 查询兑换码状态（商家扫码后先查状态，再确认核销） */
  async checkRedemptionCode(redemptionCode: string): Promise<{
    record_id: string;
    prize_name: string;
    product_name: string;
    product_value: number | null;
    user_id: string;
    redemption_code: string;
    refund_status: string;
    created_at: string;
    redeemed: boolean;
    expired: boolean;
    redemption_expiry_hours: number;
  }> {
    const { data: record, error } = await this.client
      .from('lottery_records')
      .select('id, prize_name, user_id, redemption_code, refund_status, created_at')
      .eq('redemption_code', redemptionCode)
      .eq('is_winner', true)
      .maybeSingle();
    if (error) throw new Error(`查询兑换码失败: ${error.message}`);
    if (!record) throw new NotFoundException('兑换码无效');

    // 补充奖品商品信息
    let productName = '';
    let productValue: number | null = null;
    const r = record as any;
    if (r.prize_name) {
      const { data: prize } = await this.client
        .from('prizes')
        .select('product_name, product_value')
        .eq('name', r.prize_name)
        .maybeSingle();
      if (prize) {
        productName = (prize as any).product_name || '';
        productValue = (prize as any).product_value ?? null;
      }
    }

    return {
      record_id: r.id,
      prize_name: r.prize_name || '',
      product_name: productName,
      product_value: productValue,
      user_id: r.user_id,
      redemption_code: r.redemption_code,
      refund_status: r.refund_status || '',
      created_at: r.created_at,
      redeemed: r.refund_status === 'redeemed',
      expired: this.isRedemptionExpired(r.created_at),
      redemption_expiry_hours: await this.getRedemptionExpiryHours(),
    };
  }

  /** 检查核销是否已过期 */
  private isRedemptionExpired(createdAt: string): boolean {
    const expiryHours = (this.settingsCache as any)?.redemption_expiry_hours ?? 72;
    const created = new Date(createdAt).getTime();
    const expiresAt = created + expiryHours * 3600 * 1000;
    return Date.now() > expiresAt;
  }

  /** 获取兑奖有效期（小时） */
  async getRedemptionExpiryHours(): Promise<number> {
    const { data } = await this.client
      .from('lottery_settings')
      .select('redemption_expiry_hours')
      .limit(1)
      .maybeSingle();
    return (data as any)?.redemption_expiry_hours ?? 72;
  }

  /** 生成核销二维码（上传到TOS，返回URL） */
  async generateRedemptionQRCode(recordId: string): Promise<{ qrcode: string; redemption_code: string; prize_name: string; expired: boolean; redemption_expiry_hours: number; expiry_date: string; expiry_hours: number; created_at: string }> {
    const { data: record, error } = await this.client
      .from('lottery_records')
      .select('id, redemption_code, prize_name, is_winner, refund_status, created_at')
      .eq('id', recordId)
      .maybeSingle();
    if (error) throw new Error(`查询记录失败: ${error.message}`);
    if (!record) throw new NotFoundException('抽奖记录不存在');

    const r = record as any;
    if (!r.is_winner) throw new BadRequestException('未中奖，无法生成核销码');
    if (!r.redemption_code) throw new BadRequestException('该奖品无核销码（仅商品类奖品支持核销）');

    // 生成 QR code PNG buffer
    const qrBuffer = await QRCode.toBuffer(r.redemption_code, {
      width: 400,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    });

    // 上传到 TOS
    const key = await this.storage.uploadFile({
      fileContent: qrBuffer,
      fileName: `lottery-qrcode-${r.redemption_code}.png`,
      contentType: 'image/png',
    });

    // 生成签名 URL（有效期 30 天）
    const qrcodeUrl = await this.storage.generatePresignedUrl({
      key,
      expireTime: 2592000, // 30 天
    });

    const expiryHours = await this.getRedemptionExpiryHours();
    const createdAt = new Date(r.created_at).getTime();
    const expiresAt = new Date(createdAt + expiryHours * 3600 * 1000);

    return {
      qrcode: qrcodeUrl,
      redemption_code: r.redemption_code,
      prize_name: r.prize_name || '',
      expired: this.isRedemptionExpired(r.created_at),
      redemption_expiry_hours: expiryHours,
      expiry_date: expiresAt.toISOString(),
      expiry_hours: expiryHours,
      created_at: r.created_at,
    };
  }

  // ========== 查询接口 ==========

  async getRecordByOrderId(orderId: string): Promise<LotteryRecord | null> {
    const { data, error } = await this.client
      .from('lottery_records')
      .select('*')
      .eq('order_id', orderId)
      .maybeSingle();
    if (error) throw new Error(`查询抽奖记录失败: ${error.message}`);
    return (data as LotteryRecord) || null;
  }

  async getRecordById(recordId: string): Promise<any> {
    const { data, error } = await this.client
      .from('lottery_records')
      .select('*')
      .eq('id', recordId)
      .maybeSingle();
    if (error) throw new Error(`查询抽奖记录失败: ${error.message}`);
    if (!data) return null;

    const record = data as any;

    // 联表补充奖品详情
    if (record.prize_id) {
      const { data: prize } = await this.client
        .from('prizes')
        .select('prize_type, product_name, product_value, coupon_amount, coupon_min_spend')
        .eq('id', record.prize_id)
        .maybeSingle();
      if (prize) {
        record.prize_type = (prize as any).prize_type;
        record.product_name = (prize as any).product_name;
        record.product_value = (prize as any).product_value;
        record.coupon_amount = (prize as any).coupon_amount;
        record.coupon_min_spend = (prize as any).coupon_min_spend;
      }
    }

    // 补充过期信息
    if (record.redemption_code) {
      record.expired = this.isRedemptionExpired(record.created_at);
      record.redemption_expiry_hours = await this.getRedemptionExpiryHours();
      // 计算过期时间
      const createdAt = new Date(record.created_at).getTime();
      const expiresAt = new Date(createdAt + record.redemption_expiry_hours * 3600 * 1000);
      record.expiry_date = expiresAt.toISOString();
      record.expiry_hours = record.redemption_expiry_hours;
    }

    return record;
  }

  async getUserRecords(userId: string): Promise<any[]> {
    const { data, error } = await this.client
      .from('lottery_records')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(`查询用户抽奖记录失败: ${error.message}`);
    const records = (data as LotteryRecord[]) || [];
    if (records.length === 0) return [];

    // 联表补充奖品详情（类型、优惠券金额、商品信息等）
    const prizeIds = [...new Set(records.map(r => r.prize_id).filter(Boolean))];
    const prizeMap = new Map<string, any>();
    if (prizeIds.length > 0) {
      const { data: prizes } = await this.client
        .from('prizes')
        .select('id, name, prize_type, coupon_amount, coupon_min_spend, product_name, product_value, image_url')
        .in('id', prizeIds);
      (prizes || []).forEach((p: any) => prizeMap.set(p.id, p));
    }

    // 对 id 匹配失败的记录（奖品被删除重建导致 prize_id 为孤儿引用），按奖品名称回退匹配
    const prizeNameMap = new Map<string, any>();
    const unmatchedNames = [
      ...new Set(
        records
          .filter(r => r.prize_id && !prizeMap.has(r.prize_id) && r.prize_name)
          .map(r => r.prize_name),
      ),
    ];
    if (unmatchedNames.length > 0) {
      const { data: namePrizes } = await this.client
        .from('prizes')
        .select('id, name, prize_type, coupon_amount, coupon_min_spend, product_name, product_value, image_url')
        .in('name', unmatchedNames);
      (namePrizes || []).forEach((p: any) => prizeNameMap.set(p.name, p));
    }

    return records.map(r => {
      const prize = (r.prize_id ? prizeMap.get(r.prize_id) : null) || (r.prize_name ? prizeNameMap.get(r.prize_name) : null);
      return {
        ...r,
        prize_type: prize?.prize_type || '',
        coupon_amount: prize?.coupon_amount ?? null,
        coupon_condition: prize?.coupon_min_spend ?? null,
        product_name: prize?.product_name || '',
        product_value: prize?.product_value ?? null,
        prize_image: prize?.image_url || '',
      };
    });
  }

  /** 获取往期中奖名单（中奖记录 + 用户昵称，按时间倒序，最多50条） */
  async getWinners(): Promise<Array<{
    id: string;
    prize_name: string;
    user_id: string;
    nick_name: string;
    created_at: string;
  }>> {
    const { data: records, error } = await this.client
      .from('lottery_records')
      .select('id, prize_name, user_id, created_at')
      .eq('is_winner', true)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw new Error(`查询中奖记录失败: ${error.message}`);

    const list = (records as LotteryRecord[]) || [];
    if (list.length === 0) return [];

    const userIds = [...new Set(list.map(r => r.user_id))];
    const { data: users } = await this.client
      .from('users')
      .select('user_id, nick_name')
      .in('user_id', userIds);
    const userMap = new Map<string, string>();
    (users || []).forEach((u: any) => userMap.set(u.user_id, u.nick_name || u.user_id));

    return list.map(r => ({
      id: r.id,
      prize_name: r.prize_name || '未领取',
      user_id: r.user_id,
      nick_name: userMap.get(r.user_id) || r.user_id,
      created_at: r.created_at,
    }));
  }

  /** 获取操作日志（管理后台） */
  async getLogs(limit: number = 100): Promise<any[]> {
    const { data, error } = await this.client
      .from('lottery_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw new Error(`查询操作日志失败: ${error.message}`);
    return data || [];
  }

  /** 更新用户分享次数 */
  async incrementShareCount(userId: string) {
    const { data: user } = await this.client
      .from('users')
      .select('share_count')
      .eq('user_id', userId)
      .maybeSingle();
    const current = (user as any)?.share_count || 0;
    const newCount = current + 1;
    await this.client
      .from('users')
      .update({ share_count: newCount })
      .eq('user_id', userId);
    return { share_count: newCount };
  }

  /** 更新用户社交媒体发布次数 */
  async incrementSocialPostCount(userId: string) {
    const { data: user } = await this.client
      .from('users')
      .select('social_post_count')
      .eq('user_id', userId)
      .maybeSingle();
    const current = (user as any)?.social_post_count || 0;
    const newCount = current + 1;
    await this.client
      .from('users')
      .update({ social_post_count: newCount })
      .eq('user_id', userId);
    return { social_post_count: newCount };
  }
}
