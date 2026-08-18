import { IsString, IsOptional, IsDateString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateRoutineDto {
  @ApiProperty({ example: 'Morning Stretch', description: 'Title of the routine item' })
  @IsString()
  title: string;

  @ApiProperty({ example: '10 minutes of light stretching', description: 'Description of the routine item', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: '08:00', description: 'Scheduled time in HH:mm format' })
  @IsString()
  scheduledTime: string;

  @ApiProperty({ example: 'user-uuid', description: 'ID of the assigned tenant user. If omitted, assigns to the current user.', required: false })
  @IsUUID()
  @IsOptional()
  assignedTenantUserId?: string;
}

export class CompleteRoutineDto {
  @ApiProperty({ example: 'Completed successfully', description: 'Optional notes about the completion', required: false })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class AdminFilterDto {
  @ApiProperty({ example: 'user-uuid', description: 'Filter by user ID', required: false })
  @IsUUID()
  @IsOptional()
  userId?: string;

  @ApiProperty({ example: '2026-01-01', description: 'Start date filter', required: false })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiProperty({ example: '2026-01-31', description: 'End date filter', required: false })
  @IsDateString()
  @IsOptional()
  endDate?: string;

  @ApiProperty({ example: 'routine-item-uuid', description: 'Filter by routine item ID', required: false })
  @IsUUID()
  @IsOptional()
  routineItemId?: string;
}

export class UpdateRoutineDto {
  @ApiProperty({ example: 'Updated Title', description: 'Title of the routine item', required: false })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiProperty({ example: 'Updated description', description: 'Description of the routine item', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: '09:00', description: 'Scheduled time in HH:mm format', required: false })
  @IsString()
  @IsOptional()
  scheduledTime?: string;

  @ApiProperty({ example: 'user-uuid', description: 'ID of the assigned tenant user', required: false })
  @IsUUID()
  @IsOptional()
  assignedTenantUserId?: string;
}
