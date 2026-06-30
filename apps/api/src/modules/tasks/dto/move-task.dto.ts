import { IsNotEmpty, IsInt, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class MoveTaskDto {
  @ApiProperty() @IsUUID() @IsNotEmpty() statusId: string;
  @ApiProperty() @IsInt() kanbanPosition: number;
}
