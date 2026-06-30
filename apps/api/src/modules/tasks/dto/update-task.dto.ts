import { PartialType } from '@nestjs/swagger';
import { CreateTaskDto } from './create-task.dto';
import { IsBoolean, IsInt, IsOptional, IsString } from 'class-validator';

export class UpdateTaskDto extends PartialType(CreateTaskDto) {
  @IsInt() @IsOptional() spentMinutes?: number;
  @IsInt() @IsOptional() kanbanPosition?: number;
  @IsInt() @IsOptional() sortOrder?: number;
  @IsBoolean() @IsOptional() isBlocked?: boolean;
  @IsString() @IsOptional() blockedReason?: string;
}
