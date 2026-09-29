import { IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

/** Alteração administrativa: o estado e o lock são decididos juntos pela empresa. */
export class UpdateAdminNotificationPreferenceDto {
  @ApiProperty({ description: 'Push da categoria para este usuário' })
  @Transform(({ obj }) => {
    const v = obj.pushEnabled;
    if (v === true || v === 'true') return true;
    if (v === false || v === 'false') return false;
    return v;
  })
  @IsBoolean()
  pushEnabled: boolean;

  @ApiProperty({ description: 'true trava a categoria contra o usuário; false devolve o controle' })
  @Transform(({ obj }) => {
    const v = obj.lockedByAdmin;
    if (v === true || v === 'true') return true;
    if (v === false || v === 'false') return false;
    return v;
  })
  @IsBoolean()
  lockedByAdmin: boolean;
}
