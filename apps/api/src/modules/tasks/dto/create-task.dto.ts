import { IsNotEmpty, IsOptional, IsString, IsUUID, IsInt, IsBoolean, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTaskDto {
  @ApiProperty() @IsUUID() @IsNotEmpty() projectId: string;
  @ApiProperty() @IsString() @IsNotEmpty() title: string;
  @ApiPropertyOptional() @IsString() @IsOptional() description?: string;
  @ApiPropertyOptional() @IsUUID() @IsOptional() statusId?: string;
  @ApiPropertyOptional() @IsUUID() @IsOptional() priorityId?: string;
  @ApiPropertyOptional() @IsUUID() @IsOptional() assigneeTenantUserId?: string;
  @ApiPropertyOptional() @IsUUID() @IsOptional() reporterTenantUserId?: string;
  @ApiPropertyOptional() @IsUUID() @IsOptional() parentTaskId?: string;
  @ApiPropertyOptional() @IsUUID() @IsOptional() teamId?: string;
  @ApiPropertyOptional() @IsDateString() @IsOptional() startDate?: string;
  @ApiPropertyOptional() @IsDateString() @IsOptional() dueDate?: string;
  @ApiPropertyOptional() @IsInt() @IsOptional() estimatedMinutes?: number;
  @ApiPropertyOptional() @IsInt() @IsOptional() storyPoints?: number;
}
