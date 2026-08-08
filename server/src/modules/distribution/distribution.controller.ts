import { Controller, Get, Post, Put, Body, Param, Query, HttpCode, BadRequestException } from '@nestjs/common';
import { DistributionService } from './distribution.service';

@Controller('distribution')
export class DistributionController {
  constructor(private readonly distributionService: DistributionService) {}

  /** 分销配置（公开读：前端展示佣金比例） */
  @Get('config')
  async getConfig() {
    const data = await this.distributionService.getConfig();
    return { code: 200, msg: 'success', data };
  }

  /** 管理员：修改分销配置 */
  @Put('config')
  async updateConfig(@Body() body: any) {
    const data = await this.distributionService.updateConfig(body || {});
    return { code: 200, msg: 'success', data };
  }

  /** 绑定邀请人 */
  @Post('bind')
  @HttpCode(200)
  async bind(@Body() body: { user_id?: string; inviter_id?: string }) {
    if (!body?.user_id || !body?.inviter_id) throw new BadRequestException('user_id 与 inviter_id 均不能为空');
    const data = await this.distributionService.bindInviter(body.user_id, body.inviter_id);
    return { code: 200, msg: 'success', data };
  }

  /** 订单分佣（内部钩子：支付成功/核销后调用） */
  @Post('settle')
  @HttpCode(200)
  async settle(@Body() body: { order_no?: string }) {
    if (!body?.order_no) throw new BadRequestException('order_no 不能为空');
    const data = await this.distributionService.settleOrder(body.order_no);
    return { code: 200, msg: 'success', data };
  }

  /** 我的分销概览 */
  @Get('my/:userId/overview')
  async overview(@Param('userId') userId: string) {
    const data = await this.distributionService.getOverview(userId);
    return { code: 200, msg: 'success', data };
  }

  /** 我的团队（level=1/2/3） */
  @Get('my/:userId/team')
  async team(@Param('userId') userId: string, @Query('level') level?: string) {
    const lv = Math.min(3, Math.max(1, parseInt(level || '1', 10) || 1));
    const data = await this.distributionService.getTeam(userId, lv);
    return { code: 200, msg: 'success', data };
  }

  /** 佣金明细 */
  @Get('my/:userId/commissions')
  async commissions(@Param('userId') userId: string, @Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    const data = await this.distributionService.getCommissions(
      userId,
      parseInt(page || '1', 10) || 1,
      Math.min(50, parseInt(pageSize || '20', 10) || 20),
    );
    return { code: 200, msg: 'success', data };
  }

  /** 申请提现 */
  @Post('withdraw')
  @HttpCode(200)
  async withdraw(@Body() body: { user_id?: string; amount?: number }) {
    if (!body?.user_id) throw new BadRequestException('user_id 不能为空');
    const data = await this.distributionService.applyWithdraw(body.user_id, Number(body.amount));
    return { code: 200, msg: 'success', data };
  }

  /** 我的提现记录 */
  @Get('my/:userId/withdraws')
  async withdraws(@Param('userId') userId: string) {
    const data = await this.distributionService.getWithdraws(userId);
    return { code: 200, msg: 'success', data };
  }

  /** 管理员：提现审核列表 */
  @Get('admin/withdraws')
  async adminWithdraws(@Query('status') status?: string) {
    const data = await this.distributionService.adminWithdraws(status);
    return { code: 200, msg: 'success', data };
  }

  /** 管理员：审核提现 */
  @Post('admin/withdraws/:id/audit')
  @HttpCode(200)
  async auditWithdraw(@Param('id') id: string, @Body() body: { action?: string; reject_reason?: string }) {
    if (!['approve', 'reject'].includes(body?.action || '')) {
      throw new BadRequestException('action 仅支持 approve / reject');
    }
    const data = await this.distributionService.auditWithdraw(id, body.action as 'approve' | 'reject', body.reject_reason);
    return { code: 200, msg: 'success', data };
  }
}
