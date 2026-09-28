import { IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/** Alteração do próprio usuário. O lock é da empresa e nunca chega por aqui. */
export class UpdateNotificationPreferenceDto {
  @ApiProperty({ description: 'Receber push nesta categoria' })
  @IsBoolean()
  pushEnabled: boolean;
}
