import { BadRequestException, Body, Controller, Get, HttpException, Param, Post, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
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

export const AI_AUDIO_UPLOAD_OPTIONS = {
  fieldName: 'audio',
  limits: { fileSize: MAX_AI_AUDIO_BYTES },
  fileFilter: (_request: unknown, file: { mimetype: string }, callback: (error: Error | null, acceptFile: boolean) => void) => {
    if (!AI_AUDIO_MIME_TYPES.includes(file.mimetype as any)) return callback(new BadRequestException('Tipo de áudio não permitido'), false);
    callback(null, true);
  },
};

@UseGuards(AuthGuard('jwt'), TenantContextGuard, PermissionGuard)
@RequirePermissions('ai.use')
@Controller('ai')
export class AiAudioController {
  constructor(private readonly audio: AiAudioService) {}

  @Post('conversations/:id/audio')
  @UseInterceptors(FileInterceptor(AI_AUDIO_UPLOAD_OPTIONS.fieldName, AI_AUDIO_UPLOAD_OPTIONS))
  async handleMessage(@CurrentUser() user: RequestUser, @Param('id') conversationId: string, @Body() dto: SendAiAudioDto, @UploadedFile() file?: UploadedAudio) {
    if (!file) throw new BadRequestException('Nenhum áudio enviado');
    try {
      return await this.audio.handleMessage({ conversationId, actor: user, buffer: file.buffer, mimeType: file.mimetype, durationSeconds: dto.durationSeconds, responseMode: dto.responseMode });
    } catch (error) {
      throw this.safeError(error, 'Não foi possível processar o áudio');
    }
  }

  @Get('audio/:id')
  async download(@CurrentUser() user: RequestUser, @Param('id') id: string, @Res() response: Response) {
    let audio;
    try {
      audio = await this.audio.getAudio(user, id);
    } catch (error) {
      throw this.safeError(error, 'Não foi possível obter o áudio');
    }
    response.type(audio.mimeType).send(audio.audio);
  }

  private safeError(error: unknown, fallback: string): Error {
    return error instanceof HttpException ? error : new BadRequestException(fallback);
  }
}
