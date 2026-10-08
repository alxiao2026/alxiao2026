import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import {
  TeamLotteryService,
  UpdateTeamLotteryConfigDto,
  CreateGroupDto,
  JoinGroupDto,
  DrawPrizeDto,
} from './team-lottery.service';

@Controller('team-lottery')
export class TeamLotteryController {
  constructor(private readonly teamLotteryService: TeamLotteryService) {}

  /** 管理端：获取商家组队抽奖配置 */
  @Get('config/:merchantId')
  @HttpCode(HttpStatus.OK)
  async getConfig(@Param('merchantId') merchantId: string) {
    const data = await this.teamLotteryService.getConfig(Number(merchantId));
    return { code: 200, msg: 'success', data };
  }

  /** 管理端：更新商家组队抽奖配置 */
  @Put('config/:merchantId')
  @HttpCode(HttpStatus.OK)
  async updateConfig(
    @Param('merchantId') merchantId: string,
    @Body() dto: UpdateTeamLotteryConfigDto,
  ) {
    const data = await this.teamLotteryService.updateConfig(Number(merchantId), dto);
    return { code: 200, msg: 'success', data };
  }

  /** 管理端：获取商家可选奖品列表 */
  @Get('prizes/:merchantId')
  @HttpCode(HttpStatus.OK)
  async getPrizes(@Param('merchantId') merchantId: string) {
    const data = await this.teamLotteryService.getPrizes(Number(merchantId));
    return { code: 200, msg: 'success', data };
  }

  /** C端：查询商家组队抽奖状态 */
  @Get('merchants/:merchantId/status')
  @HttpCode(HttpStatus.OK)
  async getMerchantStatus(@Param('merchantId') merchantId: string) {
    const data = await this.teamLotteryService.getMerchantStatus(Number(merchantId));
    return { code: 200, msg: 'success', data };
  }

  /** C端：创建队伍 */
  @Post('groups')
  @HttpCode(HttpStatus.OK)
  async createGroup(@Body() dto: CreateGroupDto) {
    if (!dto.merchant_id || !dto.package_id || !dto.order_id || !dto.user_id) {
      throw new BadRequestException('缺少必要参数');
    }
    const data = await this.teamLotteryService.createGroup(dto);
    return { code: 200, msg: 'success', data };
  }

  /** C端：获取用户在某商家的可开团订单 */
  @Get('orders/:userId/:merchantId')
  @HttpCode(HttpStatus.OK)
  async getUserOrders(
    @Param('userId') userId: string,
    @Param('merchantId') merchantId: string,
  ) {
    const data = await this.teamLotteryService.getUserOrders(userId, Number(merchantId));
    return { code: 200, msg: 'success', data };
  }

  /** C端：获取队伍详情 */
  @Get('groups/:id')
  @HttpCode(HttpStatus.OK)
  async getGroupDetail(
    @Param('id') id: string,
    @Query('user_id') userId?: string,
  ) {
    const data = await this.teamLotteryService.getGroupDetail(id, userId);
    return { code: 200, msg: 'success', data };
  }

  /** C端：通过邀请码查询队伍 */
  @Get('groups/by-code/:code')
  @HttpCode(HttpStatus.OK)
  async getGroupByInviteCode(
    @Param('code') code: string,
    @Query('user_id') userId?: string,
  ) {
    const data = await this.teamLotteryService.getGroupByInviteCode(code, userId);
    return { code: 200, msg: 'success', data };
  }

  /** C端：加入队伍（支持 groupId 或 invite_code） */
  @Post('groups/:id/join')
  @HttpCode(HttpStatus.OK)
  async joinGroup(@Param('id') id: string, @Body() dto: JoinGroupDto) {
    if (!dto.user_id) throw new BadRequestException('缺少 user_id');
    const data = await this.teamLotteryService.joinGroup(id, dto);
    return { code: 200, msg: 'success', data };
  }

  /** C端：队员抽奖 */
  @Post('groups/:id/draw')
  @HttpCode(HttpStatus.OK)
  async drawPrize(@Param('id') id: string, @Body() dto: DrawPrizeDto) {
    if (!dto.user_id) throw new BadRequestException('缺少 user_id');
    const data = await this.teamLotteryService.drawPrize(id, dto);
    return { code: 200, msg: 'success', data };
  }

  /** C端：查询我的队伍 */
  @Get('my-groups/:userId')
  @HttpCode(HttpStatus.OK)
  async listMyGroups(@Param('userId') userId: string) {
    const data = await this.teamLotteryService.listMyGroups(userId);
    return { code: 200, msg: 'success', data };
  }

  /** 定时任务/手动触发：解散过期队伍 */
  @Post('jobs/expire')
  @HttpCode(HttpStatus.OK)
  async expireGroups() {
    const data = await this.teamLotteryService.expireGroups();
    return { code: 200, msg: 'success', data };
  }
}
