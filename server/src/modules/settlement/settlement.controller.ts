import { Controller, Get, Post, Put, Delete, Body, Param, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { SettlementService } from './settlement.service';

@Controller('settlement')
export class SettlementController {
  constructor(private readonly settlementService: SettlementService) {}

  /**
   * 历史补账：为已核销但缺少结算记录的订单补建结算（仅超级管理员）
   * POST /api/settlement/backfill
   */
  @Post('backfill')
  @HttpCode(200)
  async backfill(@Body() body: { admin_user_id?: string }) {
    const result = await this.settlementService.backfillSettlements(body.admin_user_id || '');
    return {
      code: 200,
      data: result,
      msg: `补账完成：共 ${result.total} 笔已核销订单，新增 ${result.created} 条结算记录，跳过 ${result.skipped} 条`,
    };
  }

  // ==================== 套餐结算配置 ====================

  /** 获取套餐结算配置 */
  @Get('config/:packageId')
  async getConfig(@Param('packageId') packageId: string) {
    const data = await this.settlementService.getConfig(packageId);
    return { code: 200, msg: 'success', data };
  }

  /** 保存套餐结算配置 */
  @Post('config')
  @HttpCode(HttpStatus.OK)
  async saveConfig(@Body() body: {
    package_id: string;
    settlement_type: number;
    commission_rate?: number;
    settlement_price?: number;
  }) {
    const data = await this.settlementService.saveConfig(body);
    return { code: 200, msg: 'success', data };
  }

  /** 获取商家的套餐结算配置列表 */
  @Get('config/merchant/:merchantId')
  async getConfigsByMerchant(@Param('merchantId') merchantId: string) {
    const data = await this.settlementService.getConfigsByMerchant(merchantId);
    return { code: 200, msg: 'success', data };
  }

  /** 清除商家名下所有套餐的套餐级结算配置（佣金百分比模式统一全店生效） */
  @Delete('config/merchant/:merchantId')
  @HttpCode(HttpStatus.OK)
  async clearConfigsByMerchant(@Param('merchantId') merchantId: string) {
    const data = await this.settlementService.clearConfigsByMerchant(merchantId);
    return { code: 200, msg: 'success', data };
  }

  // ==================== 商家余额 ====================

  /** 获取商家余额 */
  @Get('balance/:merchantId')
  async getBalance(@Param('merchantId') merchantId: string) {
    const data = await this.settlementService.getBalance(merchantId);
    return { code: 200, msg: 'success', data };
  }

  // ==================== 结算记录 ====================

  /** 获取商家结算记录列表 */
  @Get('records')
  async getRecords(
    @Query('merchant_id') merchantId: string,
    @Query('status') status?: string,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
    @Query('page') page?: string,
    @Query('page_size') pageSize?: string,
  ) {
    const data = await this.settlementService.getRecords({
      merchantId,
      status,
      startDate,
      endDate,
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 20,
    });
    return { code: 200, msg: 'success', data };
  }

  /** 获取结算记录详情 */
  @Get('records/:id')
  async getRecordById(@Param('id') id: string) {
    const data = await this.settlementService.getRecordById(id);
    return { code: 200, msg: 'success', data };
  }

  /** 导出商家结算记录 */
  @Get('records/export')
  async exportRecords(
    @Query('merchant_id') merchantId: string,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
  ) {
    const data = await this.settlementService.exportRecords({ merchantId, startDate, endDate });
    return { code: 200, msg: 'success', data };
  }

  // ==================== 提现 ====================

  /** 管理员确认打款（提现已到账） */
  @Post('withdrawals/:id/mark-paid')
  @HttpCode(200)
  async markWithdrawalPaid(
    @Param('id') id: string,
    @Body() body: {
      admin_user_id?: string;
      payment_proof_image?: string;
      payment_transaction_no?: string;
      payment_proof_note?: string;
    },
  ) {
    const data = await this.settlementService.markWithdrawalPaid(id, body?.admin_user_id || '', {
      payment_proof_image: body?.payment_proof_image,
      payment_transaction_no: body?.payment_transaction_no,
      payment_proof_note: body?.payment_proof_note,
    });
    return { code: 200, msg: '已确认打款', data };
  }

  /** 管理员拒绝提现（金额退回商家余额） */
  @Post('withdrawals/:id/reject')
  @HttpCode(200)
  async rejectWithdrawal(@Param('id') id: string, @Body() body: { admin_user_id?: string; reason?: string }) {
    const data = await this.settlementService.rejectWithdrawal(id, body?.admin_user_id || '', body?.reason);
    return { code: 200, msg: '已拒绝，金额已退回商家余额', data };
  }

  /** 申请提现 */
  @Post('withdraw')
  @HttpCode(HttpStatus.OK)
  async withdraw(@Body() body: { merchant_id: string; amount: number }) {
    const data = await this.settlementService.withdraw(body);
    return { code: 200, msg: 'success', data };
  }

  /** 获取提现记录列表 */
  @Get('withdrawals')
  async getWithdrawals(
    @Query('merchant_id') merchantId?: string,
    @Query('status') status?: string,
    @Query('admin_user_id') adminUserId?: string,
  ) {
    const data = await this.settlementService.getWithdrawals({ merchantId, status, adminUserId });
    return { code: 200, msg: 'success', data };
  }

  // ==================== 平台佣金 ====================

  /** 获取平台佣金明细列表 */
  @Get('commission/summary')
  async getCommissionSummary() {
    const data = await this.settlementService.getCommissionSummary();
    return { code: 200, msg: 'success', data };
  }

  @Get('commission')
  async getCommissionRecords(
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
    @Query('page') page?: string,
    @Query('page_size') pageSize?: string,
  ) {
    const data = await this.settlementService.getCommissionRecords({
      startDate,
      endDate,
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 20,
    });
    return { code: 200, msg: 'success', data };
  }

  /** 导出平台佣金明细 */
  @Get('commission/export')
  async exportCommissionRecords(
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
  ) {
    const data = await this.settlementService.exportCommissionRecords({ startDate, endDate });
    return { code: 200, msg: 'success', data };
  }

  /** 获取平台佣金统计 */
  @Get('commission/stats')
  async getCommissionStats(
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
  ) {
    const data = await this.settlementService.getCommissionStats({ startDate, endDate });
    return { code: 200, msg: 'success', data };
  }
}
