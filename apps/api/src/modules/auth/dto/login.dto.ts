import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'admin@quadrodomane.local' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'AlterarNoPrimeiroLogin123!' })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;
}
