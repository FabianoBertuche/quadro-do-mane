import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export enum TenantUserStatusEnum {
  ACTIVE = 'ACTIVE',
  INVITED = 'INVITED',
  SUSPENDED = 'SUSPENDED',
}

export class SetStatusDto {
  @IsEnum(TenantUserStatusEnum)
  status!: TenantUserStatusEnum;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}