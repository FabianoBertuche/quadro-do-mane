import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  IsBoolean,
  IsDateString,
  IsArray,
  IsInt,
  Min,
  IsIn,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export type RecurrenceUnit = 'day' | 'week' | 'month' | 'year';

const RECURRENCE_RULES = ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY', 'CUSTOM'] as const;
const RECURRENCE_UNITS = ['day', 'week', 'month', 'year'] as const;

export class CreateEventDto {
  @ApiProperty() @IsString() @IsNotEmpty() title: string;
  @ApiPropertyOptional() @IsString() @IsOptional() description?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() type?: string;
  @ApiProperty() @IsDateString() startAt: string;
  @ApiProperty() @IsDateString() endAt: string;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() allDay?: boolean;
  @ApiPropertyOptional() @IsUUID() @IsOptional() relatedProjectId?: string;
  @ApiPropertyOptional() @IsUUID() @IsOptional() relatedTaskId?: string;
  @ApiPropertyOptional() @IsUUID() @IsOptional() assigneeTenantUserId?: string;
  @ApiPropertyOptional() @IsArray() @IsUUID('4', { each: true }) @IsOptional() attendeeIds?: string[];

  // Recorrência
  @ApiPropertyOptional({ enum: RECURRENCE_RULES })
  @IsIn(RECURRENCE_RULES)
  @IsOptional()
  recurrenceRule?: string;

  @ApiPropertyOptional()
  @IsInt()
  @Min(1)
  @IsOptional()
  recurrenceInterval?: number;

  @ApiPropertyOptional({ enum: RECURRENCE_UNITS })
  @IsIn(RECURRENCE_UNITS)
  @IsOptional()
  recurrenceUnit?: RecurrenceUnit;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  recurrenceEndAt?: string;

  // Lembrete
  @ApiPropertyOptional({ description: 'Quantos dias antes do evento o lembrete começa a aparecer' })
  @IsInt()
  @Min(0)
  @IsOptional()
  remindDaysBefore?: number;
}