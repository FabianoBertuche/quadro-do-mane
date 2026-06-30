import { IsNotEmpty, IsString, MinLength, MaxLength, Matches, ValidateIf } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO para troca de senha do próprio usuário.
 *
 * Segurança:
 *  - Senha atual é obrigatória para confirmar identidade.
 *  - Nova senha deve ter entre 8 e 128 caracteres.
 *  - Senhas com espaço no início/fim são normalizadas antes do hash.
 *  - Validações de "nova senha ≠ atual" são feitas no service.
 */
export class ChangePasswordDto {
  @ApiProperty({ description: 'Senha atual (obrigatória para confirmar identidade)' })
  @IsString()
  @IsNotEmpty({ message: 'Senha atual é obrigatória' })
  @MinLength(1)
  @MaxLength(128)
  currentPassword!: string;

  @ApiProperty({ description: 'Nova senha (mínimo 8 caracteres)' })
  @IsString()
  @IsNotEmpty({ message: 'Nova senha é obrigatória' })
  @MinLength(8, { message: 'A nova senha deve ter pelo menos 8 caracteres' })
  @MaxLength(128, { message: 'A nova senha deve ter no máximo 128 caracteres' })
  @ValidateIf((_o, v) => typeof v === 'string')
  @Matches(/^\S(.*\S)?$|^\S+$/, {
    message: 'A nova senha não pode começar ou terminar com espaço',
  })
  newPassword!: string;
}