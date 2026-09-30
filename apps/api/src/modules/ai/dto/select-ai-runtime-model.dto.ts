import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** Seleção global de modelo: apenas o `slug` do catálogo, nada mais. */
export class SelectAiRuntimeModelDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  slug!: string;
}