import Taro from '@tarojs/taro';

/**
 * 结算明细导出共享模块
 * 商家端（结算明细页）与平台端（平台佣金明细页）共用同一套表头与数据行结构，
 * 保证两端导出的表格数据维度完全一致；撤销核销以独立冲销行（负数）呈现，对账有据可循。
 */

/** 撤销流水（明细页红字行与导出冲销行） */
export interface SettlementRevocation {
  order_id: string;
  revoke_count: number;
  rollback_amount: number;
  rollback_commission: number;
  operator_name?: string;
  created_at: string;
}

/** 导出用结算记录（双端统一维度） */
export interface SettlementExportRecord {
  order_id: string;
  order_amount: number;
  /** 中奖返现（已从商家应得中扣除） */
  rebate_amount?: number;
  commission_rate?: number | null;
  commission_amount: number;
  settlement_amount: number;
  settlement_date?: string;
  status: string;
  settled_at?: string | null;
  verified_qty?: number;
  revocations?: SettlementRevocation[];
  orders?: {
    order_no?: string | null;
    created_at?: string | null;
    paid_at?: string | null;
    verified_at?: string | null;
    verification_code?: string | null;
  } | null;
  merchants?: { name?: string } | null;
  packages?: { name?: string } | null;
}

/** 双端统一导出表头（共 18 列，顺序固定） */
export const SETTLEMENT_EXPORT_HEADERS = [
  '记录类型', '订单号', '商家', '套餐', '核销份数', '订单金额', '中奖返现', '佣金率(%)',
  '平台佣金', '商家应得', '核销码', '状态', '下单时间', '支付时间', '核销时间',
  '结算日期', '撤销时间', '操作人',
];

const STATUS_TEXT: Record<string, string> = {
  settled: '已结算',
  pending: '待结算',
  withdrawn: '已提现',
  revoked: '撤销核销',
};

const formatTime = (v?: string | null) => {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** 将结算记录展开为导出数据行：每条结算记录一行「结算入账」，每条撤销流水一行「撤销核销」红字冲销（份数/金额为负） */
export function buildSettlementExportRows(records: SettlementExportRecord[]): (string | number)[][] {
  const rows: (string | number)[][] = [];
  (records || []).forEach((r) => {
    const orderNo = r.orders?.order_no || r.order_id;
    const merchantName = r.merchants?.name || '';
    const packageName = r.packages?.name || '';
    const verificationCode = r.orders?.verification_code || '';

    // 结算入账行（中奖返现已从商家应得中扣除，单独成列便于对账）
    rows.push([
      '结算入账',
      orderNo,
      merchantName,
      packageName,
      r.verified_qty ?? 0,
      Number(r.order_amount || 0).toFixed(2),
      Number(r.rebate_amount || 0).toFixed(2),
      r.commission_rate ?? 0,
      Number(r.commission_amount || 0).toFixed(2),
      Number(r.settlement_amount || 0).toFixed(2),
      verificationCode,
      STATUS_TEXT[r.status] || r.status || '',
      formatTime(r.orders?.created_at),
      formatTime(r.orders?.paid_at),
      formatTime(r.orders?.verified_at || r.settled_at),
      r.settlement_date || '',
      '',
      '',
    ]);

    // 撤销核销冲销行（红字记录：份数与金额取负，撤销时间与操作人独立成列；回冲金额为已扣返现后的净值，返现列留空）
    (r.revocations || []).forEach((rv) => {
      rows.push([
        '撤销核销',
        orderNo,
        merchantName,
        packageName,
        -Math.abs(Number(rv.revoke_count) || 0),
        '',
        '',
        '',
        (-Math.abs(Number(rv.rollback_commission) || 0)).toFixed(2),
        (-Math.abs(Number(rv.rollback_amount) || 0)).toFixed(2),
        verificationCode,
        '已撤销',
        '',
        '',
        '',
        r.settlement_date || '',
        formatTime(rv.created_at),
        rv.operator_name || '',
      ]);
    });
  });
  return rows;
}

/** 生成带 BOM 的 CSV 文本（Excel 打开中文不乱码） */
export function buildSettlementCsv(records: SettlementExportRecord[]): string {
  const escapeCell = (cell: unknown) => `"${String(cell ?? '').replace(/"/g, '""')}"`;
  const rows = buildSettlementExportRows(records);
  return '﻿' + [SETTLEMENT_EXPORT_HEADERS, ...rows].map((row) => row.map(escapeCell).join(',')).join('\n');
}

/** 跨端下载 CSV：H5 走 Blob 下载；小程序写本地文件后打开预览（可转发分享），失败降级复制剪贴板 */
export function downloadCsvFile(fileName: string, csvContent: string): void {
  if (Taro.getEnv() === Taro.ENV_TYPE.WEB) {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    link.click();
    Taro.showToast({ title: '导出成功', icon: 'success' });
    return;
  }
  const fs = Taro.getFileSystemManager();
  const userDataPath = (Taro as any).env?.USER_DATA_PATH || 'wxfile://tmp';
  const filePath = `${userDataPath}/${fileName}`;
  fs.writeFile({
    filePath,
    data: csvContent,
    encoding: 'utf8',
    success: () => {
      Taro.openDocument({
        filePath,
        showMenu: true,
        fail: () => {
          Taro.setClipboardData({ data: csvContent });
          Taro.showToast({ title: '已复制到剪贴板', icon: 'none' });
        },
      });
    },
    fail: (err) => {
      console.error('写入导出文件失败:', err);
      Taro.setClipboardData({ data: csvContent });
      Taro.showToast({ title: '已复制到剪贴板', icon: 'none' });
    },
  });
}
