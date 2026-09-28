import { IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/** Alteração administrativa: o estado e o lock são decididos juntos pela empresa. */
export class UpdateAdminNotificationPreferenceDto {
  @ApiProperty({ description: 'Push da categoria para este usuário' })
  @IsBoolean()
  pushEnabled: boolean;

  @ApiProperty({ description: 'true trava a categoria contra o usuário; false devolve o controle' })
  @IsBoolean()
  lockedByAdmin: boolean;
}
