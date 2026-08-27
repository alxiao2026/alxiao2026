import { Injectable, BadRequestException } from '@nestjs/common';
import { S3Storage } from 'coze-coding-dev-sdk';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { UserService } from '../user/user.service';

/* ========================================================================
 * 果园打卡模块 · 业务核心
 * 水滴(g)：做任务获得，立即浇灌到果树并累计成长值
 * 果树：种子 → 幼苗(100) → 小树(300) → 开花(600) → 结果(1000) → 成熟(1500)
 * 成熟后收获入库（availableTrees+1），用果树库存兑换优惠券
 * 积分与膨胀团小程序打通：直接读写 users.points
 * 优惠券与下单链路打通：锁券/核销由 payment 模块驱动
 * ===================================================================== */

export interface CouponTier {
  threshold: number;
  amount: number;
  treeCost: number;
}

export interface OrchardAppConfig {
  dailyWater: number;
  mealWater: number;
  makeupCostPoints: number;
  cycleMakeupUseLimit: number;
  pointsExchangeRate: number;
  pointsExchangeMin: number;
  treeFullGrowth: number;
  taskGroupBuyReward: number;
  taskGroupBuyLimit: number;
  taskShareReward: number;
  taskShareLimit: number;
  taskInviteLimit: number;
  growthBindPhonePoints: number;
  growthAddWecomPoints: number;
  wecomQrCode: string;
  couponTiers: CouponTier[];
  /** 各阶段树形象的 TOS key（索引 0-5：种子/发芽/小树/开花/结果/成熟） */
  treeStageImages?: string[];
}

export const DEFAULT_ORCHARD_CONFIG: OrchardAppConfig = {
  dailyWater: 20,
  mealWater: 10,
  makeupCostPoints: 50,
  cycleMakeupUseLimit: 5,
  pointsExchangeRate: 1,
  pointsExchangeMin: 10,
  treeFullGrowth: 1500,
  taskGroupBuyReward: 30,
  taskGroupBuyLimit: 3,
  taskShareReward: 10,
  taskShareLimit: 1,
  taskInviteLimit: 1,
  growthBindPhonePoints: 50,
  growthAddWecomPoints: 30,
  wecomQrCode: '',
  couponTiers: [
    { threshold: 50, amount: 10, treeCost: 1 },
    { threshold: 100, amount: 25, treeCost: 2 },
    { threshold: 200, amount: 60, treeCost: 3 },
  ],
  treeStageImages: [
    'generate_image_66396d7b-efcc-4ddc-8557-783332a9f00c_e26ceeea.jpeg',
    'generate_image_e7287146-6e7a-46e8-8471-f72cbe987573_15789c6c.jpeg',
    'generate_image_528f248a-0425-432c-9912-a0f07770b0c0_2fed6046.jpeg',
    'generate_image_f332d39f-e983-47f1-8b87-cfe893d85212_0b914cb7.jpeg',
    'generate_image_e6969784-4b50-42cd-9710-36c62acdcebe_feb46c55.jpeg',
    'generate_image_75a33de8-64ab-450b-a524-0b7dfc8bc33b_a1ed14d4.jpeg',
  ],
};

/** 果树阶段（阈值按成熟总值比例换算：0/100/300/600/1000/1500） */
const STAGE_DEFS = [
  { index: 0, name: '种子', emoji: '🌰', ratio: 0 },
  { index: 1, name: '幼苗', emoji: '🌱', ratio: 100 / 1500 },
  { index: 2, name: '小树', emoji: '🪴', ratio: 300 / 1500 },
  { index: 3, name: '开花', emoji: '🌸', ratio: 600 / 1500 },
  { index: 4, name: '结果', emoji: '🍊', ratio: 1000 / 1500 },
  { index: 5, name: '成熟', emoji: '🌟', ratio: 1 },
];

export const MEAL_SLOTS = [
  { key: 'morning', label: '早餐水滴', emoji: '🌅', startHour: 7, endHour: 9, reward: 10 },
  { key: 'noon', label: '午餐水滴', emoji: '🍱', startHour: 12, endHour: 14, reward: 10 },
  { key: 'evening', label: '晚餐水滴', emoji: '🌙', startHour: 19, endHour: 21, reward: 10 },
] as const;

export type MealKey = (typeof MEAL_SLOTS)[number]['key'];

/** 日常任务定义 */
const DAILY_TASK_DEFS = [
  { id: 'group_buy', title: '购买团购 1 单', desc: '每单 +%Rg，每日最多 %L 单', dailyLimit: 3 },
  { id: 'share_friend', title: '分享给一位好友', desc: '好友点开分享卡片进入助力页才算成功', dailyLimit: 1 },
  { id: 'invite_friend', title: '邀请 1 位好友助力', desc: '好友助力得补浇卡，不限量；使用时每个种树周期有限额', dailyLimit: 1 },
] as const;

/** 成长任务定义（一次性） */
const GROWTH_TASK_DEFS = [
  { id: 'bind_phone', title: '绑定手机号', desc: '方便接收优惠券到账通知' },
  { id: 'add_wecom', title: '添加企微客服', desc: '一对一专属客服服务' },
] as const;

const COUPON_TIER_DESC = [
  '1 棵果树即可兑换，全场通用',
  '需要 2 棵果树一起兑换，加购神器',
  '需要 3 棵果树一起兑换，超值大额券',
];

/** 中国时区日期工具（服务端统一按 UTC+8 结算） */
function cstNow(): Date {
  return new Date(Date.now() + 8 * 3600 * 1000);
}
export function todayStr(): string {
  const d = cstNow();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}
function cstHour(): number {
  return cstNow().getUTCHours();
}
function diffDays(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}
function genCouponCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return `ORCH-${s}`;
}
function num(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/** 果园券视图（金额单位：元） */
export interface OrchardCoupon {
  code: string;
  defId: string;
  type: string;
  title: string;
  threshold: number;
  amount: number;
  status: 'unused' | 'locked' | 'used' | 'expired';
  claimedAt: number;
  usedAt?: number;
  expireAt: number;
  fromTree: number;
  verifyOrderId?: string;
}

export interface OrchardRow {
  user_id: string;
  growth: number;
  stage: number;
  harvested: number;
  available_trees: number;
  planted_at: string | null;
  cycle_makeup_used: number;
  tree_history: any[];
  watered_dates: string[];
  current_streak: number;
  max_streak: number;
  last_water_date: string | null;
  makeup_cards: number;
  tasks_state: Record<string, { progress: number; done: boolean; completedAt?: number }>;
  task_date: string | null;
  meals_claimed: Record<string, boolean>;
  meals_date: string | null;
}

@Injectable()
export class OrchardService {
  private storage: S3Storage;
  private treeImageUrlCache = new Map<string, { url: string; expireAt: number }>();
  private treeImageBufCache = new Map<string, { buf: Buffer; ts: number }>();

  constructor(private readonly userService: UserService) {
    this.storage = new S3Storage({
      endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
      accessKey: '',
      secretKey: '',
      bucketName: process.env.COZE_BUCKET_NAME,
      region: 'cn-beijing',
    });
  }

  /** 果树阶段图：TOS key → 签名 URL（带缓存，7 天过期前 1 小时刷新） */
  private async treeImageUrls(keys: string[] | undefined): Promise<string[]> {
    if (!keys || keys.length === 0) return [];
    const now = Date.now();
    const urls: string[] = [];
    for (const key of keys) {
      const cached = this.treeImageUrlCache.get(key);
      if (cached && cached.expireAt > now + 3600_000) {
        urls.push(cached.url);
        continue;
      }
      try {
        const url = await this.storage.generatePresignedUrl({
          key,
          expireTime: 7 * 24 * 3600,
        });
        this.treeImageUrlCache.set(key, { url, expireAt: now + 7 * 24 * 3600_000 });
        urls.push(url);
      } catch {
        urls.push(key);
      }
    }
    return urls;
  }

  /**
   * 读取指定阶段的树图二进制（供图片代理接口使用，绕过小程序图片域名白名单限制）
   * @param stage 阶段序号 0-5，越界时回落到 0
   */
  async getTreeImage(stage: number): Promise<Buffer> {
    const idx = Number.isFinite(stage) ? Math.min(Math.max(Math.floor(stage), 0), 5) : 0;
    const cfg = await this.getConfig();
    const keys = (cfg as any).treeStageImages as string[] | undefined;
    const key = keys?.[idx];
    if (!key) throw new BadRequestException('树图资源未配置');

    const cached = this.treeImageBufCache.get(key);
    if (cached && Date.now() - cached.ts < 10 * 60_000) return cached.buf;

    const buf = await this.storage.readFile({ fileKey: key });
    this.treeImageBufCache.set(key, { buf, ts: Date.now() });
    return buf;
  }

  /**
   * 树图 base64 data URL：微信小程序 <Image> 走 downloadFile 域名白名单（与 request 白名单分开配置），
   * 真机可能因未配置 downloadFile 合法域名而加载失败；返回 data URL 后前端通过 Network.request 获取，
   * 完全复用 request 域名白名单，绕过图片域名限制
   */
  async getTreeImageDataUrl(stage: number): Promise<{ url: string }> {
    const buf = await this.getTreeImage(stage);
    return { url: `data:image/jpeg;base64,${buf.toString('base64')}` };
  }

  private client() {
    return getSupabaseClient();
  }

  /**
   * 绑定手机号（成长任务 bind_phone）：
   * 用小程序 getPhoneNumber 的 phone_code 换取真实手机号，写入 users.phone，
   * 写入成功后完成 bind_phone 成长任务并发放积分奖励。
   */
  async bindPhoneWithCode(userId: string, phoneCode: string) {
    if (!phoneCode) throw new BadRequestException('缺少 phone_code');
    // 已绑定过：直接尝试完成任务（幂等）
    const phone = await this.userService.getPhoneNumberByCode(phoneCode);
    if (!phone) {
      return { code: 40010, message: '手机号获取失败，请重试' };
    }
    await this.client().from('users').update({ phone }).eq('user_id', userId);
    const r = await this.completeGrowthTask(userId, 'bind_phone');
    return { ...r, data: { ...(r.data || {}), phone } };
  }

  /* ============================ 配置 ============================ */

  async getConfig(): Promise<OrchardAppConfig> {
    const { data } = await this.client()
      .from('orchard_config')
      .select('config')
      .eq('id', 1)
      .maybeSingle();
    const raw = (data?.config || {}) as Partial<OrchardAppConfig>;
    return {
      ...DEFAULT_ORCHARD_CONFIG,
      ...raw,
      couponTiers:
        Array.isArray(raw.couponTiers) && raw.couponTiers.length > 0
          ? raw.couponTiers
          : DEFAULT_ORCHARD_CONFIG.couponTiers,
    };
  }

  async updateConfig(patch: Partial<OrchardAppConfig>): Promise<OrchardAppConfig> {
    const cur = await this.getConfig();
    const next: OrchardAppConfig = {
      dailyWater: num(patch.dailyWater, cur.dailyWater),
      mealWater: num(patch.mealWater, cur.mealWater),
      makeupCostPoints: num(patch.makeupCostPoints, cur.makeupCostPoints),
      cycleMakeupUseLimit: Math.max(1, num(patch.cycleMakeupUseLimit, cur.cycleMakeupUseLimit)),
      pointsExchangeRate: Math.max(1, num(patch.pointsExchangeRate, cur.pointsExchangeRate)),
      pointsExchangeMin: Math.max(1, num(patch.pointsExchangeMin, cur.pointsExchangeMin)),
      treeFullGrowth: Math.max(100, num(patch.treeFullGrowth, cur.treeFullGrowth)),
      taskGroupBuyReward: num(patch.taskGroupBuyReward, cur.taskGroupBuyReward),
      taskGroupBuyLimit: Math.max(1, num(patch.taskGroupBuyLimit, cur.taskGroupBuyLimit)),
      taskShareReward: num(patch.taskShareReward, cur.taskShareReward),
      taskShareLimit: Math.max(1, num(patch.taskShareLimit, cur.taskShareLimit)),
      taskInviteLimit: Math.max(1, num(patch.taskInviteLimit, cur.taskInviteLimit)),
      growthBindPhonePoints: num(patch.growthBindPhonePoints, cur.growthBindPhonePoints),
      growthAddWecomPoints: num(patch.growthAddWecomPoints, cur.growthAddWecomPoints),
      wecomQrCode: typeof patch.wecomQrCode === 'string' ? patch.wecomQrCode : cur.wecomQrCode,
      couponTiers:
        Array.isArray(patch.couponTiers) && patch.couponTiers.length > 0
          ? patch.couponTiers.map((t, i) => ({
              threshold: num(t?.threshold, cur.couponTiers[i]?.threshold ?? 0),
              amount: Math.max(1, num(t?.amount, cur.couponTiers[i]?.amount ?? 1)),
              treeCost: Math.min(9, Math.max(1, num(t?.treeCost, cur.couponTiers[i]?.treeCost ?? 1))),
            }))
          : cur.couponTiers,
    };
    const { error } = await this.client()
      .from('orchard_config')
      .upsert({ id: 1, config: next, updated_at: new Date().toISOString() });
    if (error) throw new Error(`保存果园配置失败: ${error.message}`);
    return next;
  }

  async resetConfig(): Promise<OrchardAppConfig> {
    const { error } = await this.client()
      .from('orchard_config')
      .upsert({ id: 1, config: DEFAULT_ORCHARD_CONFIG, updated_at: new Date().toISOString() });
    if (error) throw new Error(`重置果园配置失败: ${error.message}`);
    return DEFAULT_ORCHARD_CONFIG;
  }

  /* ============================ 用户状态 ============================ */

  private async getOrCreateRow(userId: string): Promise<OrchardRow> {
    const { data } = await this.client()
      .from('orchard_users')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (data) return data as OrchardRow;
    const today = todayStr();
    const fresh = {
      user_id: userId,
      task_date: today,
      meals_date: today,
      planted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const { data: created, error } = await this.client()
      .from('orchard_users')
      .insert(fresh)
      .select()
      .single();
    if (error) throw new Error(`初始化果园数据失败: ${error.message}`);
    return created as OrchardRow;
  }

  private async saveRow(row: OrchardRow): Promise<void> {
    const { error } = await this.client()
      .from('orchard_users')
      .update({
        growth: row.growth,
        stage: row.stage,
        harvested: row.harvested,
        available_trees: row.available_trees,
        planted_at: row.planted_at,
        cycle_makeup_used: row.cycle_makeup_used,
        tree_history: row.tree_history,
        watered_dates: row.watered_dates,
        current_streak: row.current_streak,
        max_streak: row.max_streak,
        last_water_date: row.last_water_date,
        makeup_cards: row.makeup_cards,
        tasks_state: row.tasks_state,
        task_date: row.task_date,
        meals_claimed: row.meals_claimed,
        meals_date: row.meals_date,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', row.user_id);
    if (error) throw new Error(`保存果园数据失败: ${error.message}`);
  }

  /** 跨天重置：任务进度与三餐状态按日期归零（成长任务保留完成态） */
  private resetDailyIfNeeded(row: OrchardRow): OrchardRow {
    const today = todayStr();
    if (row.task_date !== today) {
      const nextTasks: OrchardRow['tasks_state'] = {};
      // 成长任务为一次性：跨天保留完成状态
      GROWTH_TASK_DEFS.forEach((g) => {
        const old = row.tasks_state?.[g.id];
        if (old) nextTasks[g.id] = old;
      });
      row.tasks_state = nextTasks;
      row.task_date = today;
    }
    if (row.meals_date !== today) {
      row.meals_claimed = {};
      row.meals_date = today;
    }
    return row;
  }

  /** 积分读写：与膨胀团 users.points 打通 */
  private async getPoints(userId: string): Promise<number> {
    const { data } = await this.client()
      .from('users')
      .select('points')
      .eq('user_id', userId)
      .maybeSingle();
    return Number(data?.points || 0);
  }

  private async setPoints(userId: string, points: number): Promise<number> {
    const next = Math.max(0, Math.floor(points));
    const { error } = await this.client()
      .from('users')
      .update({ points: next, updated_at: new Date().toISOString() })
      .eq('user_id', userId);
    if (error) throw new Error(`更新积分失败: ${error.message}`);
    return next;
  }

  private async appendRecord(userId: string, amount: number, reason: string, remark: string) {
    await this.client().from('orchard_records').insert({ user_id: userId, amount, reason, remark });
  }

  /** 浇水核心：累计成长值并推进阶段（返回是否新成熟） */
  private waterTree(row: OrchardRow, grams: number, fullGrowth: number) {
    row.growth = Math.min(fullGrowth, row.growth + grams);
    const stage = this.stageByGrowth(row.growth, fullGrowth);
    const becameMature = row.stage < 5 && stage.index === 5;
    row.stage = stage.index;
    return { becameMature };
  }

  private stageThresholds(fullGrowth: number): number[] {
    return STAGE_DEFS.map((s) => Math.round(s.ratio * fullGrowth));
  }

  private stageByGrowth(growth: number, fullGrowth: number) {
    const thresholds = this.stageThresholds(fullGrowth);
    let stage = STAGE_DEFS[0];
    for (let i = 0; i < STAGE_DEFS.length; i++) {
      if (growth >= thresholds[i]) stage = STAGE_DEFS[i];
    }
    return { ...stage, threshold: thresholds[stage.index] };
  }

  private nextStage(growth: number, fullGrowth: number) {
    const thresholds = this.stageThresholds(fullGrowth);
    for (let i = 0; i < STAGE_DEFS.length; i++) {
      if (thresholds[i] > growth) return { ...STAGE_DEFS[i], threshold: thresholds[i] };
    }
    return null;
  }

  /** 任务视图：进度与配置数值合成（配置改动即时生效） */
  private buildTasksView(row: OrchardRow, cfg: OrchardAppConfig) {
    const st = row.tasks_state || {};
    const daily = DAILY_TASK_DEFS.map((def) => {
      const reward =
        def.id === 'group_buy'
          ? cfg.taskGroupBuyReward
          : def.id === 'share_friend'
            ? cfg.taskShareReward
            : 0;
      const dailyLimit =
        def.id === 'group_buy'
          ? Math.max(1, cfg.taskGroupBuyLimit)
          : def.id === 'share_friend'
            ? Math.max(1, cfg.taskShareLimit)
            : Math.max(1, cfg.taskInviteLimit);
      const s = st[def.id] || { progress: 0, done: false };
      return {
        id: def.id,
        title: def.title,
        desc: def.desc.replace('%R', String(reward)).replace('%L', String(dailyLimit)),
        reward,
        dailyLimit,
        progress: s.progress || 0,
        done: (s.progress || 0) >= dailyLimit,
        completedAt: s.completedAt,
      };
    });
    const growth = GROWTH_TASK_DEFS.map((def) => {
      const reward =
        def.id === 'bind_phone' ? cfg.growthBindPhonePoints : cfg.growthAddWecomPoints;
      const s = st[def.id] || { progress: 0, done: false };
      return {
        id: def.id,
        title: def.title,
        desc: def.desc,
        reward,
        dailyLimit: 1,
        progress: s.done ? 1 : 0,
        done: !!s.done,
        completedAt: s.completedAt,
      };
    });
    return { daily, growth };
  }

  /* ============================ 查询接口 ============================ */

  /** 用户完整档案（首屏渲染）：果树 + 任务 + 积分 + 头像昵称 */
  async getProfile(userId: string) {
    const cfg = await this.getConfig();
    let row = this.resetDailyIfNeeded(await this.getOrCreateRow(userId));
    await this.saveRow(row);
    const [points, userInfo] = await Promise.all([
      this.getPoints(userId),
      this.client()
        .from('users')
        .select('nick_name, avatar_url, phone, role')
        .eq('user_id', userId)
        .maybeSingle()
        .then((r) => r.data),
    ]);
    const tasks = this.buildTasksView(row, cfg);
    const full = cfg.treeFullGrowth;
    const liveStage = this.stageByGrowth(row.growth, full);
    const next = this.nextStage(row.growth, full);
    const treeImages = await this.treeImageUrls(cfg.treeStageImages);
    const thresholds = STAGE_DEFS.map((d) => Math.round(d.ratio * full));
    return {
      userId,
      nickname: userInfo?.nick_name || '果园小农夫',
      avatarUrl: userInfo?.avatar_url || '',
      hasPhone: !!userInfo?.phone,
      isAdmin: userInfo?.role === 'admin',
      points,
      makeupCards: row.makeup_cards,
      wateredDates: row.watered_dates || [],
      lastWaterDate: row.last_water_date,
      currentStreak: row.current_streak,
      maxStreak: row.max_streak,
      tree: {
        growth: row.growth,
        stage: liveStage.index,
        stageName: liveStage.name,
        stageImage: treeImages[liveStage.index] || '',
        stageImages: treeImages,
        stageThresholds: thresholds,
        nextStageGrowth: next?.threshold ?? null,
        nextStageName: next?.name ?? null,
        harvested: row.harvested,
        availableTrees: row.available_trees,
        plantedAt: row.planted_at ? new Date(row.planted_at).getTime() : Date.now(),
        cycleMakeupUsed: row.cycle_makeup_used,
        history: row.tree_history || [],
      },
      mealsClaimed: {
        morning: !!row.meals_claimed?.morning,
        noon: !!row.meals_claimed?.noon,
        evening: !!row.meals_claimed?.evening,
      },
      meals: {
        date: todayStr(),
        currentSlot:
          MEAL_SLOTS.find((s) => cstHour() >= s.startHour && cstHour() < s.endHour)?.key ?? null,
        claimed: {
          morning: !!row.meals_claimed?.morning,
          noon: !!row.meals_claimed?.noon,
          evening: !!row.meals_claimed?.evening,
        },
        slots: MEAL_SLOTS.map((s) => ({
          key: s.key,
          label: s.label,
          range: `${s.startHour}:00-${s.endHour}:00`,
          emoji: s.emoji,
          water: cfg.mealWater,
        })),
      },
      tasks,
      config: cfg,
      fullGrowth: full,
    };
  }

  /** 果树信息 */
  async getTreeInfo(userId: string) {
    const cfg = await this.getConfig();
    const row = this.resetDailyIfNeeded(await this.getOrCreateRow(userId));
    const full = cfg.treeFullGrowth;
    const stage = this.stageByGrowth(row.growth, full);
    const next = this.nextStage(row.growth, full);
    return {
      growth: row.growth,
      stage: stage.index,
      stageName: stage.name,
      stageEmoji: stage.emoji,
      harvested: row.harvested,
      availableTrees: row.available_trees,
      treeIndex: row.harvested + 1,
      toNextStage: next ? next.threshold - row.growth : 0,
      isMature: row.growth >= full,
    };
  }

  /** 每日签到浇水 */
  async dailyWater(userId: string) {
    const cfg = await this.getConfig();
    const row = this.resetDailyIfNeeded(await this.getOrCreateRow(userId));
    const today = todayStr();
    const dates = row.watered_dates || [];
    if (dates.includes(today)) {
      return { code: 40901, message: '今天已经浇过水啦～' };
    }
    row.watered_dates = [...dates, today].sort();

    let newStreak = 1;
    if (row.last_water_date) {
      const gap = diffDays(row.last_water_date, today);
      if (gap === 1) newStreak = (row.current_streak || 0) + 1;
      else if (gap === 0) newStreak = row.current_streak || 1;
      else newStreak = 1;
    }
    row.current_streak = newStreak;
    row.max_streak = Math.max(row.max_streak || 0, newStreak);
    row.last_water_date = today;

    const gained = cfg.dailyWater;
    const full = cfg.treeFullGrowth;
    const r = this.waterTree(row, gained, full);
    await this.appendRecord(userId, gained, 'daily_checkin', `每日签到浇水 +${gained}g`);
    await this.saveRow(row);
    return { code: 0, message: '浇水成功', data: this.waterResult(row, gained, 'daily_checkin', full, r.becameMature) };
  }

  private waterResult(row: OrchardRow, gained: number, reason: string, full: number, becameMature: boolean) {
    const stage = this.stageByGrowth(row.growth, full);
    const next = this.nextStage(row.growth, full);
    return {
      gained,
      reason,
      growth: row.growth,
      newStreak: row.current_streak,
      stage: stage.index,
      stageName: stage.name,
      stageEmoji: stage.emoji,
      becameMature,
      toNextStage: next ? next.threshold - row.growth : 0,
    };
  }

  /** 三餐时段领取水滴 */
  async claimMeal(userId: string, slot: MealKey) {
    const slotConf = MEAL_SLOTS.find((s) => s.key === slot);
    if (!slotConf) return { code: 40001, message: '时段不存在' };
    const h = cstHour();
    if (h < slotConf.startHour || h >= slotConf.endHour) {
      return {
        code: 40301,
        message: `还没到「${slotConf.label}」时段哦（${slotConf.startHour}:00-${slotConf.endHour}:00）`,
      };
    }
    const cfg = await this.getConfig();
    const row = this.resetDailyIfNeeded(await this.getOrCreateRow(userId));
    if (row.meals_claimed?.[slot]) {
      return { code: 40902, message: '本时段水滴已经领过啦' };
    }
    row.meals_claimed = { ...(row.meals_claimed || {}), [slot]: true };
    const gained = cfg.mealWater;
    const full = cfg.treeFullGrowth;
    const r = this.waterTree(row, gained, full);
    await this.appendRecord(userId, gained, `meal_${slot}`, `${slotConf.label} +${gained}g`);
    await this.saveRow(row);
    return { code: 0, message: `${slotConf.label}领取成功`, data: this.waterResult(row, gained, `meal_${slot}`, full, r.becameMature) };
  }

  /** 三餐状态 */
  async getMealsStatus(userId: string) {
    const row = this.resetDailyIfNeeded(await this.getOrCreateRow(userId));
    const h = cstHour();
    const current = MEAL_SLOTS.find((s) => h >= s.startHour && h < s.endHour)?.key || null;
    return {
      current,
      claimed: {
        morning: !!row.meals_claimed?.morning,
        noon: !!row.meals_claimed?.noon,
        evening: !!row.meals_claimed?.evening,
      },
      slots: MEAL_SLOTS,
    };
  }

  /** 浇水日历 */
  async getCalendar(userId: string, year: number, month: number) {
    const row = await this.getOrCreateRow(userId);
    const dates = row.watered_dates || [];
    const today = todayStr();
    // 构建月历矩阵（周日起）
    const first = new Date(Date.UTC(year, month - 1, 1));
    const startWeekday = first.getUTCDay();
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const cells: (({ date: string; watered: boolean; isToday: boolean; isFuture: boolean; missed: boolean }) | null)[][] = [];
    let week: any[] = new Array(startWeekday).fill(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const date = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const watered = dates.includes(date);
      const isToday = date === today;
      const isFuture = date > today;
      week.push({ date, watered, isToday, isFuture, missed: !isToday && !isFuture && !watered });
      if (week.length === 7) {
        cells.push(week);
        week = [];
      }
    }
    if (week.length > 0) {
      while (week.length < 7) week.push(null);
      cells.push(week);
    }
    return { year, month, cells };
  }

  /** 补浇水：method=card 消耗补浇卡，method=points 扣积分（auto 优先用卡） */
  async rewater(userId: string, date: string, method: 'auto' | 'card' | 'points' = 'auto') {
    const cfg = await this.getConfig();
    const row = await this.getOrCreateRow(userId);
    const dates = row.watered_dates || [];
    if (dates.includes(date)) return { code: 40903, message: '该日期已经浇过水啦' };
    if (diffDays(date, todayStr()) <= 0) return { code: 40002, message: '只能补浇过去的日期' };

    let usedCard = false;
    let costPoints = 0;
    const useLimit = cfg.cycleMakeupUseLimit;
    const pointsCost = cfg.makeupCostPoints;
    const preferCard = method !== 'points';
    if (preferCard && (row.makeup_cards || 0) > 0) {
      if ((row.cycle_makeup_used || 0) >= useLimit) {
        if (method === 'card') {
          return { code: 40311, message: `本种树周期补浇卡已用满 ${useLimit} 张，可改用 ${pointsCost} 积分补浇` };
        }
      } else {
        row.makeup_cards -= 1;
        row.cycle_makeup_used = (row.cycle_makeup_used || 0) + 1;
        usedCard = true;
      }
    }
    if (!usedCard) {
      if (method === 'card') return { code: 40203, message: '补浇卡不足，去任务页邀请好友获取' };
      const points = await this.getPoints(userId);
      if (points < pointsCost) return { code: 40201, message: `积分不足，补浇需要 ${pointsCost} 积分` };
      await this.setPoints(userId, points - pointsCost);
      costPoints = pointsCost;
      await this.appendRecord(userId, 0, 'admin_grant', `补浇水扣除 ${pointsCost} 积分`);
    }

    row.watered_dates = [...dates, date].sort();
    if (row.last_water_date && diffDays(date, row.last_water_date) === -1) {
      row.current_streak = (row.current_streak || 0) + 1;
      row.max_streak = Math.max(row.max_streak || 0, row.current_streak);
    } else if (!row.last_water_date) {
      row.current_streak = 1;
      row.max_streak = Math.max(row.max_streak || 0, 1);
      row.last_water_date = date;
    }
    await this.saveRow(row);
    return {
      code: 0,
      message: usedCard ? '已使用补浇卡补浇成功' : `已消耗 ${costPoints} 积分补浇成功`,
      data: { date, usedCard, costPoints, growth: row.growth, streak: row.current_streak },
    };
  }

  /* ============================ 任务 ============================ */

  /** 手动完成任务（当前仅 group_buy 支持主动完成；分享/邀请须好友助力后结算） */
  async completeTask(userId: string, taskId: string) {
    if (taskId === 'share_friend' || taskId === 'invite_friend') {
      return { code: 40313, message: '好友点开你的分享卡片助力后，奖励才会到账哦' };
    }
    if (taskId !== 'group_buy') return { code: 40401, message: '任务不存在' };
    return this.grantGroupBuy(userId);
  }

  /** 任务列表（日常任务 + 成长任务，含今日进度与奖励配置） */
  async getTasks(userId: string) {
    const cfg = await this.getConfig();
    const row = this.resetDailyIfNeeded(await this.getOrCreateRow(userId));
    const tasks = this.buildTasksView(row, cfg);
    const u = await this.client()
      .from('users')
      .select('phone')
      .eq('user_id', userId)
      .maybeSingle()
      .then((r) => r.data);
    return {
      tasks,
      dailyTasks: tasks.daily,
      growthTasks: tasks.growth,
      makeupCards: row.makeup_cards,
      cycleMakeupUsed: row.cycle_makeup_used,
      cycleMakeupUseLimit: cfg.cycleMakeupUseLimit,
      shareId: userId,
      hasPhone: !!u?.phone,
    };
  }

  /**
   * 团购任务奖励（购买团购 1 单）：手动点击或支付成功回调驱动，幂等按日限次
   */
  async grantGroupBuy(userId: string) {
    const cfg = await this.getConfig();
    const row = this.resetDailyIfNeeded(await this.getOrCreateRow(userId));
    const limit = Math.max(1, cfg.taskGroupBuyLimit);
    const s = row.tasks_state?.group_buy || { progress: 0, done: false };
    if ((s.progress || 0) >= limit) {
      return {
        code: 0,
        message: '今日已达上限',
        data: { taskId: 'group_buy', gained: 0, progress: s.progress, dailyLimit: limit, alreadyDone: true, growth: row.growth, becameMature: false },
      };
    }
    const gained = cfg.taskGroupBuyReward;
    s.progress = (s.progress || 0) + 1;
    s.done = s.progress >= limit;
    s.completedAt = Date.now();
    row.tasks_state = { ...(row.tasks_state || {}), group_buy: s };
    const full = cfg.treeFullGrowth;
    const r = this.waterTree(row, gained, full);
    await this.appendRecord(userId, gained, 'group_buy', `购买团购 1 单 +${gained}g`);
    await this.saveRow(row);
    return {
      code: 0,
      message: '任务完成',
      data: { taskId: 'group_buy', gained, progress: s.progress, dailyLimit: limit, alreadyDone: false, growth: row.growth, becameMature: r.becameMature },
    };
  }

  /** 成长任务（一次性）：绑定手机号 / 添加企微客服 */
  async completeGrowthTask(userId: string, taskId: 'bind_phone' | 'add_wecom') {
    if (!['bind_phone', 'add_wecom'].includes(taskId)) return { code: 40401, message: '任务不存在' };
    // 绑定手机号：服务端校验 users.phone 真实存在（登录时已获取的手机号直接复用）
    if (taskId === 'bind_phone') {
      const { data: u } = await this.client()
        .from('users')
        .select('phone')
        .eq('user_id', userId)
        .maybeSingle();
      if (!u?.phone) {
        return { code: 40321, message: '请先授权获取手机号' };
      }
    }
    const cfg = await this.getConfig();
    const row = this.resetDailyIfNeeded(await this.getOrCreateRow(userId));
    const s = row.tasks_state?.[taskId] || { progress: 0, done: false };
    if (s.done) return { code: 40902, message: '该任务已完成过，奖励只能领一次哦' };
    const reward = taskId === 'bind_phone' ? cfg.growthBindPhonePoints : cfg.growthAddWecomPoints;
    row.tasks_state = { ...(row.tasks_state || {}), [taskId]: { progress: 1, done: true, completedAt: Date.now() } };
    const points = await this.getPoints(userId);
    const nextPoints = await this.setPoints(userId, points + reward);
    const title = GROWTH_TASK_DEFS.find((t) => t.id === taskId)?.title || taskId;
    await this.appendRecord(userId, 0, 'admin_grant', `${title}（+${reward}积分）`);
    await this.saveRow(row);
    return { code: 0, message: '任务完成', data: { points: nextPoints, reward } };
  }

  /* ============================ 分享助力 ============================ */

  /** 分享信息：shareId 即 user_id（真实微信身份），前端拼小程序分享卡片路径 */
  async getShareInfo(userId: string) {
    const { data: u } = await this.client()
      .from('users')
      .select('nick_name')
      .eq('user_id', userId)
      .maybeSingle();
    const today = todayStr();
    const { data: helps } = await this.client()
      .from('orchard_helps')
      .select('id')
      .eq('share_user_id', userId)
      .eq('date', today);
    return { shareId: userId, nickname: u?.nick_name || '果园小农夫', helpedToday: (helps || []).length };
  }

  /** 好友提交助力（同一好友每天对同一人限 1 次；禁止自助力） */
  async submitHelp(shareUserId: string, helperUserId: string, helperName?: string) {
    if (!shareUserId || !helperUserId) return { code: 40001, message: '助力参数无效' };
    if (shareUserId === helperUserId) return { code: 40314, message: '不能给自己助力哦，快分享给好友吧' };
    // 被助力人必须是真实用户
    const { data: target } = await this.client()
      .from('users')
      .select('user_id, nick_name')
      .eq('user_id', shareUserId)
      .maybeSingle();
    if (!target) return { code: 40404, message: '助力对象不存在' };
    const today = todayStr();
    const { data: dup } = await this.client()
      .from('orchard_helps')
      .select('id')
      .eq('share_user_id', shareUserId)
      .eq('helper_user_id', helperUserId)
      .eq('date', today)
      .maybeSingle();
    if (dup) return { code: 40910, message: '今天已经帮 TA 助力过啦，明天再来～' };
    const { error } = await this.client().from('orchard_helps').insert({
      share_user_id: shareUserId,
      helper_user_id: helperUserId,
      helper_name: helperName || null,
      date: today,
      claimed: false,
    });
    if (error) throw new Error(`助力失败: ${error.message}`);
    return { code: 0, message: '助力成功', data: { date: today, ownerName: target.nick_name || '好友' } };
  }

  /**
   * 结算好友助力奖励（分享者进入果园时调用）：
   * share_friend：+taskShareReward g 水滴（每日限 taskShareLimit 次）
   * invite_friend：补浇卡 +1（每日限 taskInviteLimit 次）
   */
  async settleHelps(userId: string) {
    const cfg = await this.getConfig();
    const row = this.resetDailyIfNeeded(await this.getOrCreateRow(userId));
    const { data: pending } = await this.client()
      .from('orchard_helps')
      .select('*')
      .eq('share_user_id', userId)
      .eq('claimed', false)
      .order('created_at', { ascending: true })
      .limit(50);
    if (!pending || pending.length === 0) {
      return { code: 0, message: 'ok', data: { settled: 0, droplets: 0, cards: 0, becameMature: false } };
    }
    let droplets = 0;
    let cards = 0;
    let becameMature = false;
    const full = cfg.treeFullGrowth;
    const tasksState = { ...(row.tasks_state || {}) };
    const shareTask = tasksState.share_friend || { progress: 0, done: false };
    const inviteTask = tasksState.invite_friend || { progress: 0, done: false };
    const shareLimit = Math.max(1, cfg.taskShareLimit);
    const inviteLimit = Math.max(1, cfg.taskInviteLimit);

    for (const h of pending) {
      if ((shareTask.progress || 0) < shareLimit) {
        shareTask.progress = (shareTask.progress || 0) + 1;
        shareTask.done = shareTask.progress >= shareLimit;
        shareTask.completedAt = Date.now();
        const g = cfg.taskShareReward;
        const r = this.waterTree(row, g, full);
        becameMature = becameMature || r.becameMature;
        droplets += g;
        await this.appendRecord(userId, g, 'share_friend', `好友助力成功 +${g}g`);
      }
      if ((inviteTask.progress || 0) < inviteLimit) {
        inviteTask.progress = (inviteTask.progress || 0) + 1;
        inviteTask.done = inviteTask.progress >= inviteLimit;
        inviteTask.completedAt = Date.now();
        row.makeup_cards = (row.makeup_cards || 0) + 1;
        cards += 1;
        await this.appendRecord(userId, 0, 'invite_friend', '好友助力成功，获得补浇卡 ×1');
      }
      await this.client().from('orchard_helps').update({ claimed: true }).eq('id', h.id);
    }
    tasksState.share_friend = shareTask;
    tasksState.invite_friend = inviteTask;
    row.tasks_state = tasksState;
    await this.saveRow(row);
    return { code: 0, message: 'ok', data: { settled: pending.length, droplets, cards, becameMature } };
  }

  /* ============================ 积分兑换水滴（积分打通） ============================ */

  async exchangePoints(userId: string, points: number) {
    const cfg = await this.getConfig();
    const min = cfg.pointsExchangeMin;
    const rate = cfg.pointsExchangeRate;
    if (!Number.isFinite(points) || points < min) {
      return { code: 40003, message: `至少兑换 ${min} 积分` };
    }
    const balance = await this.getPoints(userId);
    if (balance < points) return { code: 40202, message: '积分余额不足' };
    const row = await this.getOrCreateRow(userId);
    const left = await this.setPoints(userId, balance - points);
    const droplets = Math.floor(points * rate);
    const full = cfg.treeFullGrowth;
    this.waterTree(row, droplets, full);
    await this.appendRecord(userId, droplets, 'points_exchange', `积分兑换水滴 ${points}积分 → ${droplets}g`);
    await this.saveRow(row);
    return {
      code: 0,
      message: '兑换成功',
      data: { exchangedPoints: points, gainedDroplets: droplets, growth: row.growth, pointsLeft: left },
    };
  }

  /** 水滴流水（最近 100 条） */
  async getRecords(userId: string) {
    const { data } = await this.client()
      .from('orchard_records')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100);
    return (data || []).map((r: any) => ({
      id: r.id,
      createdAt: new Date(r.created_at).getTime(),
      amount: r.amount,
      reason: r.reason,
      remark: r.remark,
    }));
  }

  /* ============================ 收获与优惠券（优惠券打通） ============================ */

  /** 成熟后可兑换的券档位定义 */
  buildCouponDefs(cfg: OrchardAppConfig) {
    return cfg.couponTiers.map((t, i) => ({
      id: `r_cash_${t.amount}`,
      type: 'amount' as const,
      title: `满 ${t.threshold} 减 ${t.amount} 元券`,
      threshold: t.threshold,
      amount: t.amount,
      treeCost: Math.min(3, Math.max(1, t.treeCost)),
      desc: COUPON_TIER_DESC[i] ?? `${t.treeCost} 棵果树一起兑换`,
    }));
  }

  /** 收获成熟果树：入库 availableTrees+1，树重置开始下一棵 */
  async harvest(userId: string) {
    const cfg = await this.getConfig();
    const row = await this.getOrCreateRow(userId);
    const full = cfg.treeFullGrowth;
    if (row.growth < full) return { code: 40302, message: '果树还未成熟，继续浇水吧' };
    const now = new Date().toISOString();
    row.harvested = (row.harvested || 0) + 1;
    row.available_trees = (row.available_trees || 0) + 1;
    const history = Array.isArray(row.tree_history) ? row.tree_history : [];
    row.tree_history = [
      ...history,
      {
        treeIndex: row.harvested,
        plantedAt: row.planted_at ? new Date(row.planted_at).getTime() : Date.now(),
        harvestedAt: Date.now(),
      },
    ].slice(-30);
    row.growth = 0;
    row.stage = 0;
    row.planted_at = now;
    row.cycle_makeup_used = 0;
    await this.saveRow(row);
    return { code: 0, message: '收获成功', data: { treeIndex: row.harvested, availableTrees: row.available_trees } };
  }

  /** 用果树库存兑换优惠券（每棵树只能兑换一次，兑换后库存扣减） */
  async claimCoupon(userId: string, defId: string) {
    const cfg = await this.getConfig();
    const def = this.buildCouponDefs(cfg).find((c) => c.id === defId);
    if (!def) return { code: 40402, message: '优惠券不存在' };
    const row = await this.getOrCreateRow(userId);
    if ((row.available_trees || 0) < def.treeCost) {
      return { code: 40303, message: `果树库存不足：该券需要 ${def.treeCost} 棵果树一起兑换` };
    }
    row.available_trees -= def.treeCost;
    const expireAt = new Date(Date.now() + 30 * 86400000).toISOString();
    const coupon = {
      code: genCouponCode(),
      user_id: userId,
      def_id: def.id,
      type: 'amount',
      title: def.title,
      threshold: def.threshold,
      amount: def.amount,
      status: 'unused',
      expire_at: expireAt,
      from_tree: row.harvested,
    };
    const { data: created, error } = await this.client()
      .from('orchard_coupons')
      .insert(coupon)
      .select()
      .single();
    if (error) throw new Error(`兑换优惠券失败: ${error.message}`);
    await this.saveRow(row);
    return { code: 0, message: '兑换成功', data: this.couponView(created) };
  }

  /** 支付链路可用的券视图类型（门槛/金额单位：元） */
  private couponView(c: any) {
    return {
      code: c.code,
      defId: c.def_id,
      type: c.type,
      title: c.title,
      threshold: Number(c.threshold),
      amount: Number(c.amount),
      status: c.status,
      claimedAt: c.claimed_at ? new Date(c.claimed_at).getTime() : Date.now(),
      usedAt: c.used_at ? new Date(c.used_at).getTime() : undefined,
      expireAt: c.expire_at ? new Date(c.expire_at).getTime() : 0,
      fromTree: c.from_tree,
      verifyOrderId: c.verify_order_id || undefined,
    };
  }

  /** 我的券列表（自动标记过期） */
  async listCoupons(userId: string, status?: string) {
    const { data } = await this.client()
      .from('orchard_coupons')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100);
    const now = new Date().toISOString();
    const list = (data || []) as any[];
    // 懒过期：unused 且过期的自动标记
    const toExpire = list.filter((c) => c.status === 'unused' && c.expire_at && c.expire_at < now);
    for (const c of toExpire) {
      await this.client().from('orchard_coupons').update({ status: 'expired' }).eq('id', c.id);
      c.status = 'expired';
    }
    const views = list.map((c) => this.couponView(c));
    return status && status !== 'all' ? views.filter((c) => c.status === status) : views;
  }

  /** 下单可用券：unused 未过期且门槛 <= 订单原始金额（元） */
  async availableCoupons(userId: string, orderAmount: number) {
    const list = await this.listCoupons(userId, 'unused');
    return list
      .filter((c) => c.threshold <= orderAmount)
      .sort((a, b) => b.amount - a.amount);
  }

  /**
   * 支付预下单锁券：校验归属/状态/门槛，锁定到订单（status=locked）
   * 返回券信息；失败返回 null（由调用方决定报错策略）
   */
  async lockCouponForOrder(code: string, userId: string, orderId: string, orderAmount: number) {
    const { data: c } = await this.client()
      .from('orchard_coupons')
      .select('*')
      .eq('code', code)
      .maybeSingle();
    if (!c) return { ok: false as const, message: '果园券不存在' };
    if (c.user_id !== userId) return { ok: false as const, message: '无权使用该券' };
    if (c.status === 'locked' && c.verify_order_id === orderId) {
      // 幂等：本订单重复预下单，直接复用
      return { ok: true as const, coupon: c };
    }
    if (c.status !== 'unused') return { ok: false as const, message: '该券已被使用或锁定' };
    if (c.expire_at && c.expire_at < new Date().toISOString()) {
      await this.client().from('orchard_coupons').update({ status: 'expired' }).eq('id', c.id);
      return { ok: false as const, message: '该券已过期' };
    }
    if (Number(c.threshold) > orderAmount) {
      return { ok: false as const, message: `该券满 ${Number(c.threshold)} 元可用` };
    }
    const { error } = await this.client()
      .from('orchard_coupons')
      .update({ status: 'locked', verify_order_id: orderId })
      .eq('id', c.id)
      .eq('status', 'unused');
    if (error) return { ok: false as const, message: '券锁定失败，请重试' };
    return { ok: true as const, coupon: { ...c, status: 'locked', verify_order_id: orderId } };
  }

  /** 解锁券（订单关闭/换券时）：locked → unused */
  async unlockCoupon(code: string) {
    await this.client()
      .from('orchard_coupons')
      .update({ status: 'unused', verify_order_id: null })
      .eq('code', code)
      .eq('status', 'locked');
  }

  /** 按订单解锁其锁定的果园券（订单超时关闭时调用） */
  async unlockCouponsByOrder(orderId: string) {
    await this.client()
      .from('orchard_coupons')
      .update({ status: 'unused', verify_order_id: null })
      .eq('verify_order_id', orderId)
      .eq('status', 'locked');
  }

  /** 支付成功核销：locked → used */
  async redeemCoupon(code: string, orderId: string) {
    const now = new Date().toISOString();
    await this.client()
      .from('orchard_coupons')
      .update({ status: 'used', used_at: now, verify_order_id: orderId })
      .eq('code', code)
      .eq('status', 'locked');
  }

  /** 预下单前置校验（不锁券）：校验券归属/状态/门槛，失败抛 BadRequestException */
  async getCouponForPrepay(code: string, userId: string, orderAmount: number): Promise<OrchardCoupon> {
    const { data: c } = await this.client()
      .from('orchard_coupons')
      .select('*')
      .eq('code', code)
      .maybeSingle();
    if (!c) throw new BadRequestException('果园券不存在');
    if (c.user_id !== userId) throw new BadRequestException('无权使用该果园券');
    if (c.status === 'locked' && c.verify_order_id) {
      // 幂等：本订单重复预下单可复用
      return this.couponView(c) as OrchardCoupon;
    }
    if (c.status !== 'unused') throw new BadRequestException('该果园券已被使用');
    if (c.expire_at && c.expire_at < new Date().toISOString()) {
      await this.client().from('orchard_coupons').update({ status: 'expired' }).eq('id', c.id);
      throw new BadRequestException('该果园券已过期');
    }
    if (Number(c.threshold) > orderAmount) {
      throw new BadRequestException(`该券满 ${Number(c.threshold)} 元可用，当前订单未达门槛`);
    }
    return this.couponView(c) as OrchardCoupon;
  }

  /**
   * 预下单锁券同步：先解锁本订单此前锁定的其他券，再锁定当前选中的券。
   * 幂等：重复预下单同一券不会重复锁定。
   */
  async syncCouponLock(code: string | null, orderId: string, userId: string) {
    // 解锁本订单占用但已非当前选中的券
    await this.client()
      .from('orchard_coupons')
      .update({ status: 'unused', verify_order_id: null })
      .eq('verify_order_id', orderId)
      .eq('status', 'locked')
      .neq('code', code || '');
    if (!code) return;
    // 锁定当前选中券（校验 + 锁定，幂等）
    const { data: c } = await this.client()
      .from('orchard_coupons')
      .select('*')
      .eq('code', code)
      .maybeSingle();
    if (!c || c.user_id !== userId) return;
    if (c.status === 'locked' && c.verify_order_id === orderId) return; // 已锁定到本单
    if (c.status !== 'unused') return;
    await this.client()
      .from('orchard_coupons')
      .update({ status: 'locked', verify_order_id: orderId })
      .eq('id', c.id)
      .eq('status', 'unused');
  }

  /** 订单支付成功钩子：自动累计「购买团购」任务（每单 +Ng 水滴，达上限返回 done） */
  async onOrderPaid(userId: string) {
    const r = await this.grantGroupBuy(userId);
    return r;
  }
}
