import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AiService } from './ai.service';
import { AiAudioService } from './ai-audio.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { TenantContextGuard } from '../../common/guards/tenant-context.guard';
import { AiResponseMode, SendAiMessageDto } from './dto/send-ai-message.dto';
import { ConfirmAiActionDto } from './dto/confirm-ai-action.dto';
import { ListAiConversationsDto } from './dto/list-ai-conversations.dto';

@UseGuards(AuthGuard('jwt'), TenantContextGuard, PermissionGuard)
@RequirePermissions('ai.use')
@Controller('ai')
export class AiController {
  constructor(private readonly ai: AiService, private readonly audio: AiAudioService) {}

  @Post('conversations')
  createConversation(@CurrentUser() user: any, @Body() dto: { contextProjectId?: string }) { return this.ai.createConversation(user, dto); }

  @Get('conversations')
  listConversations(@CurrentUser() user: any, @Query() dto: ListAiConversationsDto) { return this.ai.listConversations(user, dto.page, dto.take); }

  @Get('conversations/:id/messages')
  getMessages(@CurrentUser() user: any, @Param('id') id: string, @Query() dto: ListAiConversationsDto) { return this.ai.getMessages(user, id, dto.page, dto.take); }

  @Post('conversations/:id/messages')
  async sendMessage(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: SendAiMessageDto) {
    const response = await this.ai.sendMessage({ ...user, conversationId: id }, dto);
    return dto.responseMode === 'AUDIO' ? this.audio.attachResponseAudio(user, response) : response;
  }

  @Post('action-proposals/:id/confirm')
  confirm(@CurrentUser() user: any, @Param('id') id: string, @Body() _dto: ConfirmAiActionDto) { return this.ai.confirmProposal(user, id); }

  @Post('action-proposals/:id/cancel')
  cancel(@CurrentUser() user: any, @Param('id') id: string) { return this.ai.cancelProposal(user, id); }
}
