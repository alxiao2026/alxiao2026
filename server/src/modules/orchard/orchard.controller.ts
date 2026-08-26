import { Controller, Get, Post, Put, Body, Query, HttpCode, BadRequestException, ForbiddenException, Res, StreamableFile } from '@nestjs/common';
import { OrchardService } from './orchard.service';
import { getSupabaseClient } from '@/storage/database/supabase-client';

/** 超管权限校验（设置后台接口专用） */
async function assertAdmin(adminUserId: string) {
  if (!adminUserId) throw new BadRequestException('缺少管理员身份');
  const { data } = await getSupabaseClient()
    .from('users')
    .select('role')
    .eq('user_id', adminUserId)
    .maybeSingle();
  if (!data || String((data as any)?.role || '').toLowerCase() !== 'admin') {
    throw new ForbiddenException('仅平台管理员可执行此操作');
  }
}

function requireUser(userId?: string): string {
  if (!userId) throw new BadRequestException('缺少 user_id');
  return userId;
}

@Controller('orchard')
export class OrchardController {
  constructor(private readonly orchardService: OrchardService) {}

  /** 用户完整档案（果树+任务+积分+头像昵称），首屏渲染用 */
  @Get('profile')
  async getProfile(@Query('user_id') userId: string) {
    const data = await this.orchardService.getProfile(requireUser(userId));
    return { code: 200, msg: 'success', data };
  }

  /**
   * 树图代理：走 API 域名输出图片二进制，避免小程序端直连 TOS 域名被白名单拦截
   * GET /api/orchard/tree-image?stage=0..5
   */
  @Get('tree-image')
  async getTreeImage(@Query('stage') stage: string, @Res({ passthrough: true }) res: any): Promise<StreamableFile> {
    const buf = await this.orchardService.getTreeImage(Number(stage));
    res.set?.('Content-Type', 'image/jpeg');
    res.set?.('Cache-Control', 'public, max-age=86400');
    return new StreamableFile(buf);
  }

  /** 果树信息 */
  @Get('tree')
  async getTree(@Query('user_id') userId: string) {
    const data = await this.orchardService.getTreeInfo(requireUser(userId));
    return { code: 200, msg: 'success', data };
  }

  /** 每日签到浇水 */
  @Post('water/daily')
  @HttpCode(200)
  async dailyWater(@Body() body: { user_id?: string }) {
    const r = await this.orchardService.dailyWater(requireUser(body?.user_id));
    return { code: 200, msg: r.message, data: r.data ?? null, biz_code: r.code };
  }

  /** 三餐领水滴 */
  @Post('water/meal')
  @HttpCode(200)
  async claimMeal(@Body() body: { user_id?: string; slot?: 'morning' | 'noon' | 'evening' }) {
    if (!body?.slot) throw new BadRequestException('缺少 slot');
    const r = await this.orchardService.claimMeal(requireUser(body?.user_id), body.slot);
    return { code: 200, msg: r.message, data: r.data ?? null, biz_code: r.code };
  }

  /** 三餐状态 */
  @Get('meals')
  async getMeals(@Query('user_id') userId: string) {
    const data = await this.orchardService.getMealsStatus(requireUser(userId));
    return { code: 200, msg: 'success', data };
  }

  /** 浇水日历 */
  @Get('calendar')
  async getCalendar(@Query('user_id') userId: string, @Query('year') year: string, @Query('month') month: string) {
    const y = Number(year) || new Date().getFullYear();
    const m = Number(month) || new Date().getMonth() + 1;
    const data = await this.orchardService.getCalendar(requireUser(userId), y, m);
    return { code: 200, msg: 'success', data };
  }

  /** 补浇水（补浇卡/积分） */
  @Post('rewater')
  @HttpCode(200)
  async rewater(@Body() body: { user_id?: string; date?: string; method?: 'auto' | 'card' | 'points' }) {
    if (!body?.date) throw new BadRequestException('缺少 date');
    const r = await this.orchardService.rewater(requireUser(body?.user_id), body.date, body.method || 'auto');
    return { code: 200, msg: r.message, data: (r as { data?: unknown }).data ?? null, biz_code: r.code };
  }

  /** 完成任务（当前仅 group_buy；分享/邀请由好友助力结算） */
  /** 任务列表（日常 + 成长） */
  @Get('tasks')
  async getTasks(@Query('user_id') userId?: string) {
    if (!userId) throw new BadRequestException('缺少 user_id');
    const data = await this.orchardService.getTasks(userId);
    return { code: 200, msg: 'success', data };
  }

  @Post('tasks/complete')
  @HttpCode(200)
  async completeTask(@Body() body: { user_id?: string; task_id?: string }) {
    if (!body?.task_id) throw new BadRequestException('缺少 task_id');
    const r = await this.orchardService.completeTask(requireUser(body?.user_id), body.task_id);
    return { code: 200, msg: r.message, data: (r as { data?: unknown }).data ?? null, biz_code: r.code };
  }

  /** 绑定手机号（用 getPhoneNumber 的 phone_code 换手机号并完成 bind_phone 任务） */
  @Post('tasks/bind-phone')
  @HttpCode(200)
  async bindPhone(@Body() body: { user_id?: string; phone_code?: string }) {
    if (!body?.phone_code) throw new BadRequestException('缺少 phone_code');
    const r = await this.orchardService.bindPhoneWithCode(requireUser(body?.user_id), body.phone_code);
    return { code: 200, msg: r.message, data: (r as { data?: unknown }).data ?? null, biz_code: r.code };
  }

  /** 成长任务（一次性：bind_phone / add_wecom） */
  @Post('tasks/growth/complete')
  @HttpCode(200)
  async completeGrowthTask(@Body() body: { user_id?: string; task_id?: 'bind_phone' | 'add_wecom' }) {
    if (!body?.task_id) throw new BadRequestException('缺少 task_id');
    const r = await this.orchardService.completeGrowthTask(requireUser(body?.user_id), body.task_id);
    return { code: 200, msg: r.message, data: r.data ?? null, biz_code: r.code };
  }

  /** 分享信息（shareId + 昵称 + 今日已被助力次数） */
  @Get('share/info')
  async getShareInfo(@Query('user_id') userId: string) {
    const data = await this.orchardService.getShareInfo(requireUser(userId));
    return { code: 200, msg: 'success', data };
  }

  /** 好友提交助力（好友身份为当前登录用户） */
  @Post('help')
  @HttpCode(200)
  async submitHelp(@Body() body: { share_user_id?: string; helper_user_id?: string; helper_name?: string }) {
    const r = await this.orchardService.submitHelp(
      body?.share_user_id || '',
      requireUser(body?.helper_user_id),
      body?.helper_name,
    );
    return { code: 200, msg: r.message, data: r.data ?? null, biz_code: r.code };
  }

  /** 结算好友助力奖励（分享者进入果园时调用） */
  @Post('help/settle')
  @HttpCode(200)
  async settleHelps(@Body() body: { user_id?: string }) {
    const r = await this.orchardService.settleHelps(requireUser(body?.user_id));
    return { code: 200, msg: r.message, data: r.data };
  }

  /** 积分兑换水滴（积分与膨胀团 users.points 打通） */
  @Post('points/exchange')
  @HttpCode(200)
  async exchangePoints(@Body() body: { user_id?: string; points?: number }) {
    const r = await this.orchardService.exchangePoints(requireUser(body?.user_id), Number(body?.points));
    return { code: 200, msg: r.message, data: r.data ?? null, biz_code: r.code };
  }

  /** 水滴流水 */
  @Get('records')
  async getRecords(@Query('user_id') userId: string) {
    const data = await this.orchardService.getRecords(requireUser(userId));
    return { code: 200, msg: 'success', data };
  }

  /** 收获成熟果树（入库，可兑券） */
  @Post('harvest')
  @HttpCode(200)
  async harvest(@Body() body: { user_id?: string }) {
    const r = await this.orchardService.harvest(requireUser(body?.user_id));
    return { code: 200, msg: r.message, data: r.data ?? null, biz_code: r.code };
  }

  /** 成熟可兑换券档位定义 */
  @Get('coupons/defs')
  async getCouponDefs() {
    const cfg = await this.orchardService.getConfig();
    return { code: 200, msg: 'success', data: this.orchardService.buildCouponDefs(cfg) };
  }

  /** 用果树库存兑换优惠券 */
  @Post('coupons/claim')
  @HttpCode(200)
  async claimCoupon(@Body() body: { user_id?: string; def_id?: string }) {
    if (!body?.def_id) throw new BadRequestException('缺少 def_id');
    const r = await this.orchardService.claimCoupon(requireUser(body?.user_id), body.def_id);
    return { code: 200, msg: r.message, data: r.data ?? null, biz_code: r.code };
  }

  /** 我的券列表 */
  @Get('coupons/mine')
  async listCoupons(@Query('user_id') userId: string, @Query('status') status?: string) {
    const data = await this.orchardService.listCoupons(requireUser(userId), status);
    return { code: 200, msg: 'success', data };
  }

  /** 下单可用券（按订单原始金额过滤门槛） */
  @Get('coupons/available')
  async availableCoupons(@Query('user_id') userId: string, @Query('amount') amount: string) {
    const data = await this.orchardService.availableCoupons(requireUser(userId), Number(amount) || 0);
    return { code: 200, msg: 'success', data };
  }

  /* ---------------- 设置后台（仅平台管理员） ---------------- */

  /** 获取运营配置 */
  @Get('admin/config')
  async getAdminConfig(@Query('admin_user_id') adminUserId: string) {
    await assertAdmin(adminUserId || '');
    const data = await this.orchardService.getConfig();
    return { code: 200, msg: 'success', data };
  }

  /** 更新运营配置 */
  @Put('admin/config')
  @HttpCode(200)
  async updateAdminConfig(@Body() body: { admin_user_id?: string } & Record<string, unknown>) {
    await assertAdmin(body?.admin_user_id || '');
    const { admin_user_id: _omit, ...patch } = body || {};
    const data = await this.orchardService.updateConfig(patch);
    return { code: 200, msg: '配置已保存', data };
  }

  /** 恢复默认配置 */
  @Post('admin/config/reset')
  @HttpCode(200)
  async resetAdminConfig(@Body() body: { admin_user_id?: string }) {
    await assertAdmin(body?.admin_user_id || '');
    const data = await this.orchardService.resetConfig();
    return { code: 200, msg: '已恢复默认配置', data };
  }
}
