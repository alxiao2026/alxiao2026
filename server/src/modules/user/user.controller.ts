import { Controller, Get, Post, Put, Param, Body, HttpCode, Query } from '@nestjs/common';
import { UserService, UpdateUserBody } from './user.service';

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
}
