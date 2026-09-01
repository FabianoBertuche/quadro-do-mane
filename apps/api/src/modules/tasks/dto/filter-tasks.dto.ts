import { IsOptional, IsString, IsUUID, IsBooleanString, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class FilterTasksDto {
  @ApiPropertyOptional() @IsUUID() @IsOptional() projectId?: string;
  @ApiPropertyOptional() @IsUUID() @IsOptional() statusId?: string;
  @ApiPropertyOptional() @IsUUID() @IsOptional() assigneeTenantUserId?: string;
  @ApiPropertyOptional() @IsUUID() @IsOptional() priorityId?: string;
  @ApiPropertyOptional() @IsUUID() @IsOptional() teamId?: string;
  @ApiPropertyOptional() @IsUUID() @IsOptional() tagId?: string;
  @ApiPropertyOptional() @IsBooleanString() @IsOptional() overdue?: string;
  @ApiPropertyOptional() @IsBooleanString() @IsOptional() completed?: string;
  @ApiPropertyOptional() @IsBooleanString() @IsOptional() myTasks?: string;
  @ApiPropertyOptional() @IsBooleanString() @IsOptional() blocked?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() search?: string;
  @ApiPropertyOptional() @IsDateString() @IsOptional() startDateFrom?: string;
  @ApiPropertyOptional() @IsDateString() @IsOptional() startDateTo?: string;
  @ApiPropertyOptional() @IsDateString() @IsOptional() dueDateFrom?: string;
  @ApiPropertyOptional() @IsDateString() @IsOptional() dueDateTo?: string;
}
