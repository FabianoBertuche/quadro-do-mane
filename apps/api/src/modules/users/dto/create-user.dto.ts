import {
  IsEmail,
  IsOptional,
  IsString,
  MinLength,
  MaxLength,
  IsBoolean,
} from 'class-validator';

export class CreateUserDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  /**
   * Senha provisória. Opcional: quando ausente, o vínculo é criado
   * com `mustChangePassword = true` para fluxos de convite posteriores.
   */
  @IsOptional()
  @IsString()
  @MinLength(6)
  @MaxLength(128)
  password?: string;

  /**
   * Aceita UUID ou `name` da role (compatibilidade com seed inicial
   * que usou `name` como id). Service resolve para o id real.
   */
  @IsOptional()
  @IsString()
  roleId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  jobTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  department?: string;

  /**
   * Quando true, cria o vínculo como `INVITED` (não exige senha imediata).
   */
  @IsOptional()
  @IsBoolean()
  sendInvite?: boolean;
}