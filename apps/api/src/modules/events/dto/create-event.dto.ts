import { IsNotEmpty, IsOptional, IsString, IsUUID, IsBoolean, IsDateString, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateEventDto {
  @ApiProperty() @IsString() @IsNotEmpty() title: string;
  @ApiPropertyOptional() @IsString() @IsOptional() description?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() type?: string;
  @ApiProperty() @IsDateString() startAt: string;
  @ApiProperty() @IsDateString() endAt: string;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() allDay?: boolean;
  @ApiPropertyOptional() @IsUUID() @IsOptional() relatedProjectId?: string;
  @ApiPropertyOptional() @IsUUID() @IsOptional() relatedTaskId?: string;
  @ApiPropertyOptional() @IsArray() @IsUUID('4', { each: true }) @IsOptional() attendeeIds?: string[];
}
