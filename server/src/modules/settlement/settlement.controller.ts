import { Controller, Get, Post, Put, Delete, Body, Param, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { SettlementService } from './settlement.service';

@Controller('settlement')
export class SettlementController {
  constructor(private readonly settlementService: SettlementService) {}

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
  async markWithdrawalPaid(@Param('id') id: string) {
    const data = await this.settlementService.markWithdrawalPaid(id);
    return { code: 200, msg: '已确认打款', data };
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
    @Query('merchant_id') merchantId: string,
    @Query('status') status?: string,
  ) {
    const data = await this.settlementService.getWithdrawals({ merchantId, status });
    return { code: 200, msg: 'success', data };
  }

  // ==================== 平台佣金 ====================

  /** 获取平台佣金明细列表 */
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
