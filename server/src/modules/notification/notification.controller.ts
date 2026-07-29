import { Controller, Get, Post, Param, Query, Body } from '@nestjs/common';
import { NotificationService } from './notification.service';

@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  /** 我的通知列表 */
  @Get()
  async getMyNotifications(
    @Query('user_id') userId: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const data = await this.notificationService.getMyNotifications(
      userId,
      Number(page) || 1,
      Number(pageSize) || 20,
    );
    return { code: 200, message: 'success', data };
  }

  /** 未读数 */
  @Get('unread-count')
  async getUnreadCount(@Query('user_id') userId: string) {
    const count = await this.notificationService.getUnreadCount(userId);
    return { code: 200, message: 'success', data: { count } };
  }

  /** 标记单条已读 */
  @Post(':id/read')
  async markRead(@Param('id') id: string, @Body('user_id') userId: string) {
    const data = await this.notificationService.markRead(id, userId);
    return { code: 200, message: 'success', data };
  }

  /** 全部已读 */
  @Post('read-all')
  async markAllRead(@Body('user_id') userId: string) {
    const data = await this.notificationService.markAllRead(userId);
    return { code: 200, message: 'success', data };
  }

  /** 手动触发到期提醒扫描（管理员/运维） */
  @Post('admin/scan-reminders')
  async scanReminders() {
    const data = await this.notificationService.scanExpiringReminders();
    return { code: 200, message: '扫描完成', data };
  }

  /** 测试发送（开发调试用） */
  @Post('test-send')
  async testSend(@Body() body: { user_id: string; type: string; data?: Record<string, any> }) {
    const data = await this.notificationService.notify(body.user_id, body.type as any, body.data || {});
    return { code: 200, message: 'success', data };
  }
}
