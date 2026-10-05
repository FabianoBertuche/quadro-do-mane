import { IsNotEmpty, IsInt, IsUUID, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class MoveTaskDto {
  @ApiProperty() @IsUUID() @IsNotEmpty() statusId: string;
  @ApiProperty() @IsInt() @Min(0) kanbanPosition: number;
}
