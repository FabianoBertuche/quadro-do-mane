import { Controller, Get, Param, Post, Res, UploadedFile, UseGuards, UseInterceptors, BadRequestException, Body } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { TenantContextGuard } from '../../common/guards/tenant-context.guard';
import { RequestUser } from '../../common/interfaces/request-context.interface';
import { AiAudioService, AI_AUDIO_MIME_TYPES, MAX_AI_AUDIO_BYTES } from './ai-audio.service';
import { SendAiAudioDto } from './dto/send-ai-audio.dto';

interface UploadedAudio {
  buffer: Buffer;
  mimetype: string;
}

@UseGuards(AuthGuard('jwt'), TenantContextGuard, PermissionGuard)
@RequirePermissions('ai.use')
@Controller('ai')
export class AiAudioController {
  constructor(private readonly audio: AiAudioService) {}

  @Post('conversations/:id/audio')
  @UseInterceptors(FileInterceptor('audio', {
    limits: { fileSize: MAX_AI_AUDIO_BYTES },
    fileFilter: (_request, file, callback) => {
      if (!AI_AUDIO_MIME_TYPES.includes(file.mimetype as any)) return callback(new BadRequestException('Tipo de áudio não permitido'), false);
      callback(null, true);
    },
  }))
  handleMessage(@CurrentUser() user: RequestUser, @Param('id') conversationId: string, @Body() dto: SendAiAudioDto, @UploadedFile() file?: UploadedAudio) {
    if (!file) throw new BadRequestException('Nenhum áudio enviado');
    return this.audio.handleMessage({ conversationId, actor: user, buffer: file.buffer, mimeType: file.mimetype, responseMode: dto.responseMode });
  }

  @Get('audio/:id')
  async download(@CurrentUser() user: RequestUser, @Param('id') id: string, @Res() response: Response) {
    const audio = await this.audio.getAudio(user, id);
    response.type(audio.mimeType).send(audio.audio);
  }
}
