import { IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

/** Alteração do próprio usuário. O lock é da empresa e nunca chega por aqui. */
export class UpdateNotificationPreferenceDto {
  @ApiProperty({ description: 'Receber push nesta categoria' })
  @Transform(({ obj }) => {
    const v = obj.pushEnabled;
    if (v === true || v === 'true') return true;
    if (v === false || v === 'false') return false;
    return v;
  })
  @IsBoolean()
  pushEnabled: boolean;
}
