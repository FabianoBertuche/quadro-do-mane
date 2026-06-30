import { Controller, Headers, HttpCode, Post, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';
import { PrismaService } from '@/common/prisma/prisma.service';

/**
 * Limpeza manual da denylist de tokens JWT.
 *
 * Por que existe: o Render Postgres NÃO tem `pg_cron` nativo. Esta rota
 * é chamada 1x/dia por um **Cron Job** externo (Render Cron Job,
 * GitHub Actions schedule, EasyCron, etc.).
 *
 * Segurança: protege com um token estático via header `X-Cleanup-Token`
 * comparado em constant-time com `CLEANUP_TOKEN` no `.env`.
 * Em produção use um valor gerado com `openssl rand -hex 32`.
 *
 * Endpoint: `POST /admin/cleanup-denylist`
 * Header:   `X-Cleanup-Token: <seu-token>`
 *
 * Se `CLEANUP_TOKEN` não estiver configurado, a rota responde
 * `{ disabled: true }` em vez de executar — fail-safe.
 */
@Controller('admin/cleanup-denylist')
export class CleanupController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  @Post()
  @HttpCode(200)
  async run(@Headers('x-cleanup-token') token?: string) {
    const expected = this.config.get<string>('CLEANUP_TOKEN') || '';

    if (!expected) {
      return { disabled: true, reason: 'CLEANUP_TOKEN not configured' };
    }

    if (!token || !this.safeEqual(token, expected)) {
      throw new UnauthorizedException('Invalid cleanup token');
    }

    const result = await this.prisma.tokenDenylist.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });

    return {
      ok: true,
      removed: result.count,
      ranAt: new Date().toISOString(),
    };
  }

  private safeEqual(a: string, b: string): boolean {
    const ab = Buffer.from(a);
    const bb = Buffer.from(b);
    if (ab.length !== bb.length) return false;
    return timingSafeEqual(ab, bb);
  }
}
