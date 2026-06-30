import { IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RefreshTokenDto {
  @ApiProperty({ required: false, description: 'Refresh token (alternativa ao cookie HttpOnly)' })
  @IsOptional()
  @IsString()
  refreshToken?: string;
}
