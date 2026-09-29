import { IsBoolean, IsOptional } from 'class-validator';

export class ConfirmAiActionDto {
  @IsOptional()
  @IsBoolean()
  confirmed?: boolean;
}
