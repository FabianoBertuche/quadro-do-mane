import { IsString, IsInt, IsBoolean, IsOptional, IsEnum } from 'class-validator';

export class UpdateEmailSettingsDto {
    @IsEnum(['imap', 'smtp'])
    protocol: string;

    @IsString()
    host: string;

    @IsInt()
    port: number;

    @IsString()
    user: string;

    @IsString()
    password: string;

    @IsBoolean()
    @IsOptional()
    secure?: boolean;
}

export class SendEmailDto {
    @IsString()
    to: string;

    @IsString()
    subject: string;

    @IsString()
    content: string;
}
