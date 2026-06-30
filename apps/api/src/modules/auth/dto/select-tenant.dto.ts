import { IsNotEmpty, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SelectTenantDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  tenantId: string;
}
