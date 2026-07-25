import { Controller, Get, Post, Put, Param, Body, HttpCode, Query } from '@nestjs/common';
import { UserService, UpdateUserBody, roleToCode } from './user.service';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  /** 获取或创建用户（登录时用） */
  @Post('login')
  @HttpCode(200)
  async login(@Body() body: { user_id: string; nick_name?: string; avatar_url?: string }) {
    console.log('[UserController] login:', body.user_id);
    const user = await this.userService.getOrCreate(body.user_id, body.nick_name, body.avatar_url);
    return { code: 200, msg: 'success', data: user };
  }

  /** 手机号+密码登录 */
  @Post('login/password')
  @HttpCode(200)
  async loginByPassword(@Body() body: { phone: string; password: string; nick_name?: string }) {
    console.log('[UserController] loginByPassword:', body.phone);
    const user = await this.userService.loginByPassword(body.phone, body.password, body.nick_name);
    return { code: 200, msg: 'success', data: { ...user, role_code: roleToCode(user.role) } };
  }

  /** 手机验证码登录 */
  @Post('login/sms')
  @HttpCode(200)
  async loginBySms(@Body() body: { phone: string; code: string; nick_name?: string }) {
    console.log('[UserController] loginBySms:', body.phone);
    const user = await this.userService.loginBySms(body.phone, body.code, body.nick_name);
    return { code: 200, msg: 'success', data: { ...user, role_code: roleToCode(user.role) } };
  }

  /** 微信授权登录 */
  @Post('login/wechat')
  @HttpCode(200)
  async loginByWechat(@Body() body: { open_id: string; nick_name?: string; avatar_url?: string }) {
    console.log('[UserController] loginByWechat:', body.open_id);
    const user = await this.userService.loginByWechat(body.open_id, body.nick_name, body.avatar_url);
    return { code: 200, msg: 'success', data: user };
  }

  /** 获取用户信息 */
  @Get(':userId')
  async getProfile(@Param('userId') userId: string) {
    console.log('[UserController] getProfile:', userId);
    const user = await this.userService.findByUserId(userId);
    return { code: 200, msg: 'success', data: user };
  }

  /** 获取用户统计 */
  @Get(':userId/stats')
  async getStats(@Param('userId') userId: string) {
    console.log('[UserController] getStats:', userId);
    const stats = await this.userService.getStats(userId);
    return { code: 200, msg: 'success', data: stats };
  }

  /** 更新用户资料 */
  @Put(':userId')
  @HttpCode(200)
  async updateProfile(@Param('userId') userId: string, @Body() body: UpdateUserBody) {
    console.log('[UserController] updateProfile:', userId, body);
    const user = await this.userService.update(userId, body);
    return { code: 200, msg: 'success', data: user };
  }

  /** 绑定门店（商家用户） */
  @Post(':userId/bind-merchant')
  @HttpCode(200)
  async bindMerchant(@Param('userId') userId: string, @Body() body: { merchant_id: number }) {
    console.log('[UserController] bindMerchant:', userId, body.merchant_id);
    const user = await this.userService.bindMerchant(userId, body.merchant_id);
    return { code: 200, msg: 'success', data: user };
  }

  /** 解绑门店（变回消费者） */
  @Post(':userId/unbind-merchant')
  @HttpCode(200)
  async unbindMerchant(@Param('userId') userId: string) {
    console.log('[UserController] unbindMerchant:', userId);
    const user = await this.userService.unbindMerchant(userId);
    return { code: 200, msg: 'success', data: user };
  }

  /** 获取用户关联的门店信息 */
  @Get(':userId/merchant')
  async getMerchantInfo(@Param('userId') userId: string) {
    console.log('[UserController] getMerchantInfo:', userId);
    const merchant = await this.userService.getMerchantInfo(userId);
    return { code: 200, msg: 'success', data: merchant };
  }

  /** 获取所有门店列表 */
  @Get('merchants/list')
  async getMerchantList() {
    console.log('[UserController] getMerchantList');
    const merchants = await this.userService.getMerchantList();
    return { code: 200, msg: 'success', data: merchants };
  }

  /** 获取用户权限信息（前端仅做显示/隐藏控制，不做权限判断） */
  @Get(':userId/permissions')
  async getUserPermissions(@Param('userId') userId: string) {
    console.log('[UserController] getUserPermissions:', userId);
    const permissions = await this.userService.getUserPermissions(userId);
    return { code: 200, msg: 'success', data: permissions };
  }

  /** 获取商家统计数据 */
  @Get(':userId/merchant-stats')
  async getMerchantStats(@Param('userId') userId: string) {
    console.log('[UserController] getMerchantStats:', userId);
    const stats = await this.userService.getMerchantStats(userId);
    return { code: 200, msg: 'success', data: stats };
  }

  /** 获取综合统计数据（支持时间筛选，仅系统管理员可见） */
  @Get('stats/overview')
  async getOverviewStats(@Query() query: { start_date?: string; end_date?: string; user_id?: string }) {
    const data = await this.userService.getOverviewStats(query);
    return { code: 200, msg: 'success', data };
  }
}
