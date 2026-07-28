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
  discount_rate: string; // 折扣券折扣（如 8.5 表示 8.5 折），coupon 类型使用
  discount_cap: string; // 单笔最高优惠金额（0 表示不封顶），coupon 类型使用
  product_name: string;
  product_value: string;
  daily_quota: number | null; // 每日最多中出份数（null/0 表示不限）
  is_fallback: boolean; // 兜底奖标记：永远有货，承接兜底区间
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
  // 折扣券附加信息（draw 响应时注入，非数据库字段）
  discount_capped?: boolean;
  discount_rate?: number;
  discount_cap?: number;
  order_total?: number;
}

export interface LotterySettings {
  weight_enabled: boolean;
  weight_visitor: number;
  weight_ordered: number;
  weight_share_base: number;
  weight_share_increment: number;
  weight_social_post: number;
  weight_cap: number;
  share_boost_per_count: number; // 每分享1位好友对霸王餐的权重加成（默认0.5）
  share_boost_max_count: number; // 分享加成最多计入的好友数（默认10）
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
  share_boost_per_count: 0.5,
  share_boost_max_count: 10,
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
      share_boost_per_count: parseFloat(map.get('share_boost_per_count') || '0.5'),
      share_boost_max_count: parseInt(map.get('share_boost_max_count') || '10', 10),
      rate_limit_enabled: (map.get('rate_limit_enabled') || 'true') === 'true',
      rate_limit_max: parseInt(map.get('rate_limit_max') || '10', 10),
      captcha_enabled: (map.get('captcha_enabled') || 'false') === 'true',
      redemption_expiry_hours: parseInt(map.get('redemption_expiry_hours') || '72', 10),
    };

    this.settingsCache = { data: settings, expiry: Date.now() + LotteryService.SETTINGS_CACHE_TTL };
    return settings;
  }

  /** 以字符串键值对形式返回全部设置（供设置页回显，保证开关/数值均为字符串契约） */
  async getSettingsMap(): Promise<Record<string, string>> {
    const { data, error } = await this.client
      .from('lottery_settings')
      .select('setting_key, setting_value');
    if (error) throw new Error(`查询抽奖设置失败: ${error.message}`);

    const map: Record<string, string> = {
      weight_enabled: 'true',
      weight_visitor: '1',
      weight_ordered: '2',
      weight_share_base: '3',
      weight_share_increment: '0.5',
      weight_social_post: '1',
      weight_cap: '20',
      share_boost_per_count: '0.5',
      share_boost_max_count: '10',
      rate_limit_enabled: 'true',
      rate_limit_max: '10',
      captcha_enabled: 'false',
      redemption_expiry_hours: '72',
    };
    (data || []).forEach((row: any) => {
      if (row.setting_key) map[row.setting_key] = String(row.setting_value);
    });
    return map;
  }

  async updateSettings(updates: Record<string, string>): Promise<Record<string, string>> {
    for (const [key, value] of Object.entries(updates)) {
      const { error } = await this.client
        .from('lottery_settings')
        .upsert({ setting_key: key, setting_value: String(value), updated_at: new Date().toISOString() }, { onConflict: 'setting_key' });
      if (error) throw new Error(`更新设置失败 [${key}]: ${error.message}`);
    }
    this.settingsCache = null; // 清除缓存
    return this.getSettingsMap();
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

    // 分享加成：每分享 1 位好友 +0.5，最多计入 10 位（叠加在基础权重上）
    const effectiveShares = Math.min(Math.max(0, shareCount), settings.share_boost_max_count);
    weight += effectiveShares * settings.share_boost_per_count;

    // 社交媒体发布权重
    weight += socialPostCount * settings.weight_social_post;

    // 封顶
    return Math.min(weight, settings.weight_cap);
  }

  /**
   * 霸王餐分享加成系数：1 + min(分享次数, 上限) × 每位加成
   * 仅作用于霸王餐类奖品，分享越多霸王餐中奖概率越高，其余奖品不受影响
   */
  async getShareBoost(userId: string): Promise<number> {
    const settings = await this.getSettings();
    if (!settings.weight_enabled) return 1;
    const { data: user } = await this.client
      .from('users')
      .select('share_count')
      .eq('user_id', userId)
      .maybeSingle();
    const shareCount = Math.max(0, (user as any)?.share_count || 0);
    const effectiveShares = Math.min(shareCount, settings.share_boost_max_count);
    return 1 + effectiveShares * settings.share_boost_per_count;
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
   * 固定概率轮盘 + 用户权重放大 + 兜底吸收（四层保护模型）+ CSPRNG
   *
   * 规则：
   * 1. 每个奖品的基础中奖率 = 后台设置的 probability（百分比），不随其他奖品库存减少而改变
   * 2. 用户权重 userWeight 实打实放大全部奖品的中奖概率（权重 2 = 中奖率 ×2），由 weight_enabled 开关控制
   * 3. 兜底区间 = 100% − Σ可用奖品概率，承接权重/分享加成的放大部分与库存/配额耗尽奖品的份额
   * 4. 分享加成仅额外放大霸王餐（free_meal），多出部分同样从兜底区扣减
   * 5. 返回 null 表示摇中兜底区间（由调用方决定发兜底奖或"再接再厉"）
   *
   * 注意：库存可用性由调用方判定，本函数只按传入奖品的固定概率摇奖
   */
  private calculateWeightedLottery(prizes: Prize[], freeMealBoost: number, userWeight: number = 1): Prize | null {
    const weight = Math.max(0, userWeight);
    const segments: { prize: Prize; prob: number }[] = [];
    let usedProb = 0;
    for (const p of prizes) {
      const base = parseFloat(p.probability || '0');
      if (base <= 0) continue;
      const boosted = base * weight;
      const prob = p.prize_type === 'free_meal' ? boosted * freeMealBoost : boosted;
      segments.push({ prize: p, prob });
      usedProb += prob;
    }

    if (segments.length === 0) return null;

    // 兜底段：补足到 100%；若奖品概率总和超过 100%（配置超出或加成放大），兜底为 0
    const fallbackProb = Math.max(0, 100 - usedProb);
    const totalProb = usedProb + fallbackProb;

    // CSPRNG 生成 [0, totalProb) 的随机数
    const random = this.secureRandomFloat() * totalProb;

    // 区间匹配（未命中任何奖品段即落入兜底段）
    let cumulative = 0;
    for (const seg of segments) {
      cumulative += seg.prob;
      if (random < cumulative) {
        return seg.prize;
      }
    }

    return null; // 兜底区间
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

    // 2.5 订单状态门槛：仅已支付(paid)/已核销(used)订单可抽奖
    // 先付后抽：必须支付成功才能抽奖，中奖的折扣券/霸王餐即时返还原账户
    if (!['paid', 'used'].includes(orderData.status)) {
      throw new BadRequestException('订单支付成功后才可参与抽奖');
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

    // 4. 计算用户权重（留痕）与霸王餐分享加成系数
    const userWeight = await this.calculateUserWeight(userId);
    const shareBoost = await this.getShareBoost(userId);

    // 5. 获取活动奖品列表（库存>0，按订单所属商家隔离奖池：订单 → 套餐 → 商家）
    let poolMerchantId: string | number | null = null;
    if (orderData.package_id) {
      const { data: pkg } = await this.client
        .from('packages')
        .select('merchant_id')
        .eq('id', orderData.package_id)
        .maybeSingle();
      poolMerchantId = (pkg as any)?.merchant_id ?? null;
    }

    let prizesQuery = this.client
      .from('prizes')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: true });
    if (poolMerchantId !== null && poolMerchantId !== undefined && `${poolMerchantId}` !== '') {
      prizesQuery = prizesQuery.eq('merchant_id', poolMerchantId);
    }
    const { data: prizes, error: prizesError } = await prizesQuery;
    if (prizesError) throw new Error(`查询奖品失败: ${prizesError.message}`);

    const orderTotal = parseFloat(orderData.price || '0') * (orderData.quantity || 1);

    // 5a. 奖池分类：兜底奖（永远有货，承接兜底区间）与常规奖
    const pool = (prizes as Prize[]) || [];
    let fallbackPrize: Prize | null = pool.find(p => p.is_fallback) || null;

    // 5b. 每日配额检查：今日已中数量达到 daily_quota 的奖品视为不可用（份额归兜底）
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const isQuotaExhausted = async (prizeId: string, quota: number | null): Promise<boolean> => {
      if (!quota || quota <= 0) return false;
      const { count } = await this.client
        .from('lottery_records')
        .select('id', { count: 'exact', head: true })
        .eq('prize_id', prizeId)
        .eq('is_winner', true)
        .gte('created_at', todayStart.toISOString());
      return (count || 0) >= quota;
    };

    // 5c. 常规奖可用性过滤：库存、每日配额、消费券门槛
    //     不可用奖品的概率份额自动归入兜底区间，其他奖品中奖率保持不变
    const eligiblePrizes: Prize[] = [];
    for (const p of pool.filter(x => !x.is_fallback)) {
      if (p.stock <= 0) continue; // 库存耗尽 → 份额归兜底
      if (await isQuotaExhausted(p.id, p.daily_quota)) continue; // 今日配额用尽 → 份额归兜底
      if (p.prize_type === 'coupon') {
        // 折扣券：折扣必须在 (0, 10) 区间（如 8.5 表示 8.5 折），无消费门槛
        const rate = parseFloat(p.discount_rate || '0');
        if (!(rate > 0 && rate < 10)) continue; // 折扣配置无效 → 份额归兜底
      }
      eligiblePrizes.push(p);
    }

    // 兜底奖本身也受每日配额限制（每日安慰奖数量可控）
    if (fallbackPrize && (await isQuotaExhausted(fallbackPrize.id, fallbackPrize.daily_quota))) {
      fallbackPrize = null;
    }

    if (eligiblePrizes.length === 0 && !fallbackPrize) {
      throw new BadRequestException('该商家当前没有可抽取的奖品');
    }

    // 6. 固定概率轮盘（CSPRNG）— 用户权重放大全品类中奖率，分享加成仅额外作用于霸王餐，
    //    放大部分均从兜底区扣减；并发扣减失败时，该奖品移出轮盘（份额归兜底），重新摇奖
    const remaining = [...eligiblePrizes];
    let selectedPrize: Prize | null = null;
    while (remaining.length > 0) {
      const picked = this.calculateWeightedLottery(remaining, shareBoost, userWeight);
      if (!picked) break; // 摇中兜底区间
      const newStock = await this.atomicDecrementStock(picked.id);
      if (newStock >= 0) {
        picked.stock = newStock;
        selectedPrize = picked;
        break; // 扣减成功
      }
      // 并发下库存被抢光 → 移出轮盘（份额归兜底），重摇
      remaining.splice(remaining.findIndex(p => p.id === picked.id), 1);
    }

    // 7. 兜底区间命中：发放兜底奖（永远有货，不扣库存）；未配置兜底奖则"再接再厉"
    let isWinner = false;
    let resultPrize: Prize | null = null;
    if (selectedPrize) {
      isWinner = true;
      resultPrize = selectedPrize;
    } else if (fallbackPrize) {
      isWinner = true;
      resultPrize = fallbackPrize;
    }

    // 8. 中奖模式逻辑
    let redemptionCode = '';
    let refundAmount = 0;
    let refundStatus = '';
    let discountCapped = false;
    if (isWinner && resultPrize) {
      const prize = resultPrize;
      if (prize.prize_type === 'coupon') {
        // 折扣券：返还金额 = 订单金额 × (10 - 折扣) / 10，受【单笔最高优惠金额】封顶
        // 先付后返模式：中奖即核销(redeemed)，返还金额随后原路返回；订单退款则权益作废(voided)
        const rate = parseFloat(prize.discount_rate || '0');
        const cap = parseFloat(prize.discount_cap || '0');
        const raw = Math.round((orderTotal * (10 - rate) / 10) * 100) / 100;
        discountCapped = cap > 0 && raw > cap;
        refundAmount = discountCapped ? cap : raw;
        refundStatus = 'redeemed'; // 中奖即核销（返还）
      } else if (prize.prize_type === 'product') {
        redemptionCode = `PRD-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
        refundStatus = 'pending';
      } else if (prize.prize_type === 'free_meal') {
        // 霸王餐：本单免单，中奖即核销(redeemed)，订单金额全额返还原账户；退款则权益作废
        refundAmount = orderTotal;
        refundStatus = 'redeemed'; // 中奖即核销（全额返还）
        redemptionCode = `BWC-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
      }
    }

    // 10. 记录抽奖结果（折扣券/霸王餐统一命名为「X元消费券/免单券」，X = 本单抵扣金额）
    const displayPrizeName = resultPrize
      ? resultPrize.prize_type === 'coupon'
        ? `${refundAmount}元消费券`
        : resultPrize.prize_type === 'free_meal'
          ? '霸王餐免单券'
          : resultPrize.name
      : null;
    const recordData: Record<string, any> = {
      order_id: orderId,
      user_id: userId,
      is_winner: isWinner,
      prize_name: displayPrizeName,
      prize_id: resultPrize?.id || null,
      redemption_code: redemptionCode,
      refund_amount: refundAmount,
      refund_status: refundStatus,
      redeemed_at: refundStatus === 'redeemed' ? new Date().toISOString() : null,
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
      prize_id: resultPrize?.id,
      prize_name: resultPrize?.name,
      is_winner: isWinner,
      ip_address: ipAddress,
      user_agent: userAgent,
      detail: {
        order_total: parseFloat(orderData.price || '0') * (orderData.quantity || 1),
        prize_type: resultPrize?.prize_type,
        redemption_code: redemptionCode || undefined,
        refund_amount: refundAmount || undefined,
      },
    });

    return {
      is_winner: isWinner,
      prize: resultPrize,
      record: {
        ...(record as LotteryRecord),
        // 折扣券附加信息：供中奖页面展示返还金额与封顶提示
        discount_capped: discountCapped,
        discount_rate: resultPrize?.prize_type === 'coupon' ? parseFloat(resultPrize.discount_rate || '0') : undefined,
        discount_cap: resultPrize?.prize_type === 'coupon' ? parseFloat(resultPrize.discount_cap || '0') : undefined,
        order_total: orderTotal,
      },
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

    // 检查兑奖有效期（优先奖品单品有效期，其次全局设置）
    const prizeValidity = await this.getPrizeValidityHours(recordData.prize_id);
    const expiryHours = prizeValidity ?? await this.getRedemptionExpiryHours();
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

    // 补充奖品商品信息（含单品有效期）
    let productName = '';
    let productValue: number | null = null;
    let prizeValidity: number | null = null;
    const r = record as any;
    if (r.prize_name) {
      const { data: prize } = await this.client
        .from('prizes')
        .select('product_name, product_value, validity_hours')
        .eq('name', r.prize_name)
        .maybeSingle();
      if (prize) {
        productName = (prize as any).product_name || '';
        productValue = (prize as any).product_value ?? null;
        const vh = (prize as any).validity_hours;
        prizeValidity = typeof vh === 'number' && vh > 0 ? vh : null;
      }
    }

    const expiryHours = prizeValidity ?? await this.getRedemptionExpiryHours();
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
      expired: this.isRedemptionExpired(r.created_at, expiryHours),
      redemption_expiry_hours: expiryHours,
    };
  }

  /** 检查核销是否已过期（优先使用奖品单品有效期） */
  private isRedemptionExpired(createdAt: string, expiryHoursOverride?: number | null): boolean {
    const expiryHours = expiryHoursOverride ?? (this.settingsCache as any)?.redemption_expiry_hours ?? 72;
    const created = new Date(createdAt).getTime();
    const expiresAt = created + expiryHours * 3600 * 1000;
    return Date.now() > expiresAt;
  }

  /** 通过 prize_id 获取奖品单品有效期（小时），未设置返回 null */
  private async getPrizeValidityHours(prizeId?: string | null): Promise<number | null> {
    if (!prizeId) return null;
    const { data } = await this.client
      .from('prizes')
      .select('validity_hours')
      .eq('id', prizeId)
      .maybeSingle();
    const hours = (data as any)?.validity_hours;
    return typeof hours === 'number' && hours > 0 ? hours : null;
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
      .select('id, redemption_code, prize_name, prize_id, is_winner, refund_status, created_at')
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

    const prizeValidity = await this.getPrizeValidityHours(r.prize_id);
    const expiryHours = prizeValidity ?? await this.getRedemptionExpiryHours();
    const createdAt = new Date(r.created_at).getTime();
    const expiresAt = new Date(createdAt + expiryHours * 3600 * 1000);

    return {
      qrcode: qrcodeUrl,
      redemption_code: r.redemption_code,
      prize_name: r.prize_name || '',
      expired: this.isRedemptionExpired(r.created_at, expiryHours),
      redemption_expiry_hours: expiryHours,
      expiry_date: expiresAt.toISOString(),
      expiry_hours: expiryHours,
      created_at: r.created_at,
    };
  }

  // ========== 查询接口 ==========

  async getRecordByOrderId(orderId: string): Promise<any | null> {
    const { data, error } = await this.client
      .from('lottery_records')
      .select('*')
      .eq('order_id', orderId)
      .maybeSingle();
    if (error) throw new Error(`查询抽奖记录失败: ${error.message}`);
    if (!data) return null;
    // 复用 getRecordById 的联表补充（prize_type / 有效期 / 过期状态等）
    return this.getRecordById((data as any).id);
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

    // 联表补充奖品详情（含单品有效期）
    let prizeValidity: number | null = null;
    if (record.prize_id) {
      const { data: prize } = await this.client
        .from('prizes')
        .select('prize_type, product_name, product_value, coupon_amount, coupon_min_spend, discount_rate, discount_cap, validity_hours')
        .eq('id', record.prize_id)
        .maybeSingle();
      if (prize) {
        record.prize_type = (prize as any).prize_type;
        record.product_name = (prize as any).product_name;
        record.product_value = (prize as any).product_value;
        record.coupon_amount = (prize as any).coupon_amount;
        record.coupon_min_spend = (prize as any).coupon_min_spend;
        record.discount_rate = parseFloat((prize as any).discount_rate || '0');
        record.discount_cap = parseFloat((prize as any).discount_cap || '0');
        // 折扣券：重算是否触发封顶（理论优惠 > 实际返还）
        if ((prize as any).prize_type === 'coupon') {
          const { data: order } = await this.client
            .from('orders')
            .select('price, quantity')
            .eq('id', record.order_id)
            .maybeSingle();
          if (order) {
            const orderTotal = parseFloat((order as any).price || '0') * ((order as any).quantity || 1);
            const raw = Math.round((orderTotal * (10 - record.discount_rate) / 10) * 100) / 100;
            record.order_total = orderTotal;
            record.discount_capped = record.discount_cap > 0 && raw > parseFloat(record.refund_amount || '0');
          }
        }
        const vh = (prize as any).validity_hours;
        prizeValidity = typeof vh === 'number' && vh > 0 ? vh : null;
      }
    }

    // 补充过期信息（优先奖品单品有效期）
    if (record.redemption_code) {
      const expiryHours = prizeValidity ?? await this.getRedemptionExpiryHours();
      record.expired = this.isRedemptionExpired(record.created_at, expiryHours);
      record.redemption_expiry_hours = expiryHours;
      // 计算过期时间
      const createdAt = new Date(record.created_at).getTime();
      const expiresAt = new Date(createdAt + expiryHours * 3600 * 1000);
      record.expiry_date = expiresAt.toISOString();
      record.expiry_hours = expiryHours;
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

    // 联表补充奖品详情（类型、优惠券金额、商品信息、单品有效期等）
    const prizeIds = [...new Set(records.map(r => r.prize_id).filter(Boolean))];
    const prizeMap = new Map<string, any>();
    if (prizeIds.length > 0) {
      const { data: prizes } = await this.client
        .from('prizes')
        .select('id, name, prize_type, coupon_amount, coupon_min_spend, discount_rate, discount_cap, product_name, product_value, image_url, validity_hours')
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
        .select('id, name, prize_type, coupon_amount, coupon_min_spend, discount_rate, discount_cap, product_name, product_value, image_url, validity_hours')
        .in('name', unmatchedNames);
      (namePrizes || []).forEach((p: any) => prizeNameMap.set(p.name, p));
    }

    const globalExpiryHours = await this.getRedemptionExpiryHours();

    return records.map(r => {
      const prize = (r.prize_id ? prizeMap.get(r.prize_id) : null) || (r.prize_name ? prizeNameMap.get(r.prize_name) : null);
      const result: any = {
        ...r,
        prize_type: prize?.prize_type || '',
        coupon_amount: prize?.coupon_amount ?? null,
        coupon_condition: prize?.coupon_min_spend ?? null,
        discount_rate: parseFloat(prize?.discount_rate || '0'),
        discount_cap: parseFloat(prize?.discount_cap || '0'),
        product_name: prize?.product_name || '',
        product_value: prize?.product_value ?? null,
        prize_image: prize?.image_url || '',
      };
      // 补充过期信息（优先奖品单品有效期）
      if (r.redemption_code) {
        const prizeVh = prize?.validity_hours;
        const expiryHours = (typeof prizeVh === 'number' && prizeVh > 0 ? prizeVh : null) ?? globalExpiryHours;
        const createdAt = new Date(r.created_at).getTime();
        const expiresAt = new Date(createdAt + expiryHours * 3600 * 1000);
        result.expired = Date.now() > expiresAt.getTime();
        result.expiry_date = expiresAt.toISOString();
        result.expiry_hours = expiryHours;
      }
      return result;
    });
  }

  /** 获取门店全部抽奖记录（商家看自己门店，管理员看全平台） */
  async getMerchantLotteryRecords(userId: string): Promise<any[]> {
    // 确认用户身份
    const { data: user } = await this.client
      .from('users')
      .select('role, merchant_id')
      .eq('user_id', userId)
      .single();
    if (!user || (user.role !== 'merchant' && user.role !== 'admin')) {
      throw new Error('无权限查看门店抽奖记录');
    }

    // 商家用户：先拿到本门店订单 id 集合，用于过滤抽奖记录
    let merchantOrderIds: Set<string> | null = null;
    if (user.role === 'merchant' && user.merchant_id) {
      const { data: packages } = await this.client
        .from('packages')
        .select('id')
        .eq('merchant_id', user.merchant_id);
      const packageIds = (packages || []).map((p: any) => p.id);
      merchantOrderIds = new Set<string>();
      if (packageIds.length > 0) {
        const { data: orders } = await this.client
          .from('orders')
          .select('id')
          .in('package_id', packageIds);
        (orders || []).forEach((o: any) => merchantOrderIds!.add(o.id));
      }
    }

    // 查询抽奖记录（联查奖品类型与单品有效期），限制返回条数防止数据过大
    const { data: rows, error } = await this.client
      .from('lottery_records')
      .select('*, prizes(prize_type, validity_hours)')
      .order('created_at', { ascending: false })
      .limit(300);
    if (error) throw new Error(`查询门店抽奖记录失败: ${error.message}`);

    let records = (rows as any[]) || [];
    if (merchantOrderIds) {
      records = records.filter(r => r.order_id && merchantOrderIds.has(r.order_id));
    }
    if (records.length === 0) return [];

    // 补充中奖用户信息（昵称、手机号）
    const recordUserIds = [...new Set(records.map(r => r.user_id).filter(Boolean))];
    const userMap = new Map<string, any>();
    if (recordUserIds.length > 0) {
      const { data: users } = await this.client
        .from('users')
        .select('user_id, nick_name, phone')
        .in('user_id', recordUserIds);
      (users || []).forEach((u: any) => userMap.set(u.user_id, u));
    }

    const globalExpiryHours = await this.getRedemptionExpiryHours();

    return records.map(r => {
      const prizeInfo = Array.isArray(r.prizes) ? r.prizes[0] : r.prizes;
      const prizeType = prizeInfo?.prize_type;
      const prizeVh = prizeInfo?.validity_hours;
      const expiryHours = (typeof prizeVh === 'number' && prizeVh > 0 ? prizeVh : null) ?? globalExpiryHours;
      const u = userMap.get(r.user_id);
      const result: any = {
        ...r,
        prizes: undefined,
        prize_type: prizeType || '',
        user_nick_name: u?.nick_name || '',
        user_phone: u?.phone || '',
      };
      if (r.redemption_code) {
        const createdAt = new Date(r.created_at).getTime();
        const expiresAt = new Date(createdAt + expiryHours * 3600 * 1000);
        result.expired = Date.now() > expiresAt.getTime();
        result.expiry_date = expiresAt.toISOString();
        result.expiry_hours = expiryHours;
      }
      return result;
    });
  }

  /** 获取往期中奖名单（中奖记录 + 用户昵称，按时间倒序，最多50条） */
  async getWinners(): Promise<Array<{
    id: string;
    prize_name: string;
    user_id: string;
    nick_name: string;
    avatar_url: string | null;
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
      .select('user_id, nick_name, avatar_url')
      .in('user_id', userIds);
    const userMap = new Map<string, { nick_name: string; avatar_url: string | null }>();
    (users || []).forEach((u: any) => userMap.set(u.user_id, {
      nick_name: u.nick_name || u.user_id,
      avatar_url: u.avatar_url || null,
    }));

    return list.map(r => ({
      id: r.id,
      prize_name: r.prize_name || '未领取',
      user_id: r.user_id,
      nick_name: userMap.get(r.user_id)?.nick_name || r.user_id,
      avatar_url: userMap.get(r.user_id)?.avatar_url || null,
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
