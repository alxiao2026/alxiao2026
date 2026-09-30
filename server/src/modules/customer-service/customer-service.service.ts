import { Injectable } from '@nestjs/common';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export interface CustomerServiceConfig {
  id: number;
  enabled: boolean;
  qrcode_url: string | null;
  title: string;
  welcome_text: string;
  service_id: string | null;
  community_enabled: boolean;
  community_title: string;
  community_subtitle: string;
  community_button_text: string;
  community_qrcode_url: string | null;
  updated_at?: string;
}

@Injectable()
export class CustomerServiceService {
  private static readonly ROW_ID = 1;

  private client() {
    return getSupabaseClient();
  }

  /** 获取客服配置（前端弹窗读取，无需登录） */
  async getConfig(): Promise<CustomerServiceConfig> {
    const { data, error } = await this.client()
      .from('customer_service_config')
      .select('id, enabled, qrcode_url, title, welcome_text, service_id, community_enabled, community_title, community_subtitle, community_button_text, community_qrcode_url, updated_at')
      .eq('id', CustomerServiceService.ROW_ID)
      .maybeSingle();
    if (error) throw new Error(`查询客服配置失败: ${error.message}`);
    if (data) return data as CustomerServiceConfig;
    // 兜底返回默认配置
    return {
      id: CustomerServiceService.ROW_ID,
      enabled: true,
      qrcode_url: null,
      title: '联系客服',
      welcome_text: '扫码添加客服企业微信，有问题随时找我们',
      service_id: null,
      community_enabled: false,
      community_title: '加店长领券享88折',
      community_subtitle: '进群抽免单，天天享9折',
      community_button_text: '长按识别二维码加店长',
      community_qrcode_url: null,
    };
  }

  /** 更新客服配置（管理员） */
  async updateConfig(patch: Partial<CustomerServiceConfig>): Promise<CustomerServiceConfig> {
    const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (patch.enabled !== undefined) payload.enabled = !!patch.enabled;
    if (patch.qrcode_url !== undefined) payload.qrcode_url = patch.qrcode_url || null;
    if (patch.title !== undefined && String(patch.title).trim()) payload.title = String(patch.title).trim();
    if (patch.welcome_text !== undefined) payload.welcome_text = String(patch.welcome_text);
    if (patch.service_id !== undefined) payload.service_id = patch.service_id || null;
    if (patch.community_enabled !== undefined) payload.community_enabled = !!patch.community_enabled;
    if (patch.community_title !== undefined) payload.community_title = String(patch.community_title).trim();
    if (patch.community_subtitle !== undefined) payload.community_subtitle = String(patch.community_subtitle).trim();
    if (patch.community_button_text !== undefined) payload.community_button_text = String(patch.community_button_text).trim();
    if (patch.community_qrcode_url !== undefined) payload.community_qrcode_url = patch.community_qrcode_url || null;

    const { error } = await this.client()
      .from('customer_service_config')
      .update(payload)
      .eq('id', CustomerServiceService.ROW_ID);
    if (error) throw new Error(`更新客服配置失败: ${error.message}`);
    return this.getConfig();
  }
}
