import { plainToInstance, Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsHexadecimal,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

/**
 * Schema de validação das variáveis de ambiente.
 * Falha rápido no boot se alguma variável obrigatória estiver ausente ou inválida.
 *
 * Use: ConfigModule.forRoot({ validate: validateEnv }) em main.ts
 */
export class EnvSchema {
  // ─── Database ───────────────────────────────────────────────────────────
  @IsString()
  @IsNotEmpty()
  DATABASE_URL!: string;

  // ─── JWT ────────────────────────────────────────────────────────────────
  @IsString()
  @IsHexadecimal()
  @IsNotEmpty()
  JWT_SECRET!: string;

  @IsString()
  @IsOptional()
  JWT_EXPIRES_IN?: string = '15m';

  @IsString()
  @IsHexadecimal()
  @IsNotEmpty()
  JWT_REFRESH_SECRET!: string;

  @IsString()
  @IsOptional()
  JWT_REFRESH_EXPIRES_IN?: string = '7d';

  // ─── Encryption (AES-256-GCM, 32 bytes = 64 hex chars) ─────────────────
  @IsString()
  @IsHexadecimal()
  @IsNotEmpty()
  ENCRYPTION_KEY!: string;

  // ─── API ────────────────────────────────────────────────────────────────
  @Transform(({ value }) => (value === undefined ? 3001 : Number(value)))
  @IsInt()
  @Min(1)
  API_PORT!: number;

  @IsString()
  @IsOptional()
  API_PREFIX?: string = '/api';

  @IsString()
  @IsUrl({ require_tld: false })
  @IsNotEmpty()
  NEXT_PUBLIC_API_URL!: string;

  // ─── Redis removido ────────────────────────────────────────────────────
  // A denylist de tokens JWT passou a usar a tabela `token_denylist`
  // no PostgreSQL. Não há mais dependência de Redis no projeto.

  // ─── S3 / Object Storage ───────────────────────────────────────────────
  @IsString()
  @IsUrl({ require_tld: false })
  @IsOptional()
  S3_ENDPOINT?: string;

  @IsString()
  @IsOptional()
  S3_ACCESS_KEY?: string;

  @IsString()
  @IsOptional()
  S3_SECRET_KEY?: string;

  @IsString()
  @IsOptional()
  S3_BUCKET?: string;

  // ─── Cookie / CORS ──────────────────────────────────────────────────────
  @IsString()
  @IsNotEmpty()
  COOKIE_DOMAIN!: string;

  @Transform(({ value }) => {
    if (typeof value === 'boolean') return value;
    if (value === undefined) return false;
    return ['1', 'true', 'yes'].includes(String(value).toLowerCase());
  })
  @IsBoolean()
  COOKIE_SECURE!: boolean;

  @IsString()
  @IsNotEmpty()
  CORS_ORIGINS!: string;

  // ─── Security ───────────────────────────────────────────────────────────
  @Transform(({ value }) => (value === undefined ? 12 : Number(value)))
  @IsInt()
  @Min(8)
  @IsOptional()
  BCRYPT_ROUNDS?: number = 12;

  // ─── Seed ───────────────────────────────────────────────────────────────
  @IsEmail()
  @IsNotEmpty()
  SEED_ADMIN_EMAIL!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  SEED_ADMIN_PASSWORD!: string;
}

/**
 * Função de validação usada pelo @nestjs/config.
 * Lança erro descritivo listando TODAS as variáveis inválidas antes do app subir.
 */
export function validateEnv(config: Record<string, unknown>): EnvSchema {
  const validated = plainToInstance(EnvSchema, config, {
    enableImplicitConversion: false,
  });

  const errors = validateSync(validated, {
    skipMissingProperties: false,
    forbidUnknownValues: false,
  });

  if (errors.length > 0) {
    const messages = errors
      .map((err) => {
        const constraints = Object.values(err.constraints ?? {}).join(', ');
        return `  • ${err.property}: ${constraints}`;
      })
      .join('\n');

    throw new Error(
      `\n❌ Invalid environment configuration:\n${messages}\n\n` +
        `Fix the variables in your .env file and restart the API.\n`,
    );
  }

  return validated;
}