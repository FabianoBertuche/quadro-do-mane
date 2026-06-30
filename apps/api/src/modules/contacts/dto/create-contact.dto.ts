import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsEmail,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateContactDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((o) => o.email !== '' && o.email != null)
  @IsEmail({}, { message: 'email deve ser um endereço válido' })
  @Transform(({ value }) => (typeof value === 'string' && value.trim() === '' ? undefined : value))
  email?: string;

  @ApiPropertyOptional() @IsString() @IsOptional() company?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() department?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() role?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() phone?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() mobile?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() extension?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() notes?: string;
}
