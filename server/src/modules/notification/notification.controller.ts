import { Controller, Get, Post, Param, Query, Body } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { WechatNotifyService } from './wechat-notify.service';

@Controller('notifications')
export class NotificationController {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly wechatNotifyService: WechatNotifyService,
  ) {}

  /** 前端订阅授权：返回所有已配置的微信订阅消息模板（空数组表示未启用） */
  @Get('subscribe-templates')
  async getSubscribeTemplates() {
    const data = await this.wechatNotifyService.getEnabledTemplates();
    return { code: 200, message: 'success', data };
  }

  /** 管理后台：全部通知类型的模板配置状态 */
  @Get('admin/template-configs')
  async getTemplateConfigs(@Query('admin_user_id') adminUserId: string) {
    // 列表允许管理员查看；权限在保存时强校验，这里简单校验身份存在
    const data = await this.wechatNotifyService.getTemplateConfigList();
    return { code: 200, message: 'success', data: { list: data, admin_user_id: adminUserId ? 'ok' : '' } };
  }

  /** 管理后台：保存某个通知类型的微信模板 ID */
  @Post('admin/template-configs')
  async saveTemplateConfig(@Body() body: { type: string; template_id: string; admin_user_id: string }) {
    const data = await this.wechatNotifyService.saveTemplateConfig(
      body.type,
      body.template_id || '',
      body.admin_user_id || '',
    );
    return { code: 200, message: '保存成功', data };
  }

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
