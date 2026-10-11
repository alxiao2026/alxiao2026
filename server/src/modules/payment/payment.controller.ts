import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  HttpCode,
  BadRequestException,
  Req,
} from '@nestjs/common';
import { PaymentService } from './payment.service';

@Controller('payment')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  /** 发起支付预下单：后端金额引擎计算实付，前端只展示；支持果园满减券叠加抵扣 */
  @Post('prepay')
  @HttpCode(200)
  async prepay(@Body() body: { order_id?: string; user_id?: string; orchard_coupon_code?: string; discount_coupon_code?: string }) {
    if (!body.order_id || !body.user_id) {
      throw new BadRequestException('缺少 order_id 或 user_id');
    }
    return this.paymentService.prepay({
      order_id: body.order_id,
      user_id: body.user_id,
      orchard_coupon_code: body.orchard_coupon_code,
      discount_coupon_code: body.discount_coupon_code,
    });
  }

  /** Mock 支付回调（模拟微信异步通知；真实回调接入 /payment/notify） */
  @Post('mock-notify')
  @HttpCode(200)
  async mockNotify(@Body() body: { prepay_id?: string; result?: 'success' | 'fail' }) {
    if (!body.prepay_id) {
      throw new BadRequestException('缺少 prepay_id');
    }
    return this.paymentService.mockNotify({
      prepay_id: body.prepay_id,
      result: body.result,
    });
  }

  /**
   * 微信支付结果回调（V3）
   * 成功响应须为微信约定格式 { code: 'SUCCESS' }；处理失败抛异常（HTTP 4xx/5xx），微信会自动重试（幂等已保证）
   */
  @Post('wechat-notify')
  @HttpCode(200)
  async wechatNotify(@Req() req: any, @Body() body: any) {
    const rawBody =
      req.rawBody?.toString?.() || (body ? JSON.stringify(body) : '');
    await this.paymentService.handleWechatNotify(req.headers, rawBody);
    return { code: 'SUCCESS', message: '成功' };
  }

  /** 用户主动退款（未核销团购券，支持按份部分退款） */
  @Post('refund')
  @HttpCode(200)
  async refund(
    @Body()
    body: {
      order_id?: string;
      user_id?: string;
      reason?: string;
      note?: string;
      refund_quantity?: number;
    },
  ) {
    if (!body.order_id || !body.user_id) {
      throw new BadRequestException('缺少 order_id 或 user_id');
    }
    return this.paymentService.refund({
      order_id: body.order_id,
      user_id: body.user_id,
      reason: body.reason,
      note: body.note,
      refund_quantity: body.refund_quantity,
    });
  }

  /** 查询订单可退款信息（退款申请页金额预览） */
  @Get('refundable/:orderId')
  async getRefundable(@Param('orderId') orderId: string) {
    return this.paymentService.getRefundable(orderId);
  }

  /** 查询订单支付信息 */
  @Get('order/:orderId')
  async getByOrder(@Param('orderId') orderId: string) {
    return this.paymentService.getByOrder(orderId);
  }
}
