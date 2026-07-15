import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { getSupabaseClient } from '@/storage/database/supabase-client';

@Injectable()
export class PackageAutoRenewService {
  private readonly logger = new Logger(PackageAutoRenewService.name);
  private client = getSupabaseClient();

  // 每天凌晨 2 点执行
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async handleAutoRenew() {
    this.logger.log('开始检查套餐自动延期...');

    const today = new Date().toISOString().split('T')[0];

    // 查找已过期的套餐
    const { data: expiredPackages, error } = await this.client
      .from('packages')
      .select('*')
      .lt('sale_end_date', today)
      .eq('is_active', true);

    if (error) {
      this.logger.error(`查询过期套餐失败：${error.message}`);
      return;
    }

    if (!expiredPackages || expiredPackages.length === 0) {
      this.logger.log('没有过期套餐');
      return;
    }

    this.logger.log(`找到 ${expiredPackages.length} 个过期套餐`);

    for (const pkg of expiredPackages) {
      if (pkg.auto_renew) {
        // 自动延期半年
        const endDate = new Date(pkg.sale_end_date);
        endDate.setMonth(endDate.getMonth() + 6);
        const newEndDate = endDate.toISOString().split('T')[0];

        const { error: updateError } = await this.client
          .from('packages')
          .update({
            sale_end_date: newEndDate,
            updated_at: new Date().toISOString(),
          })
          .eq('id', pkg.id);

        if (updateError) {
          this.logger.error(`套餐 ${pkg.id} 自动延期失败：${updateError.message}`);
        } else {
          this.logger.log(`套餐 ${pkg.id} 已自动延期至 ${newEndDate}`);
        }
      } else {
        // 未启用自动延期，下架
        const { error: updateError } = await this.client
          .from('packages')
          .update({
            is_active: false,
            updated_at: new Date().toISOString(),
          })
          .eq('id', pkg.id);

        if (updateError) {
          this.logger.error(`套餐 ${pkg.id} 下架失败：${updateError.message}`);
        } else {
          this.logger.log(`套餐 ${pkg.id} 已下架`);
        }
      }
    }

    this.logger.log('套餐自动延期检查完成');
  }
}
