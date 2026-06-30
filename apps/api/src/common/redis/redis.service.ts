import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Denylist de access tokens JWT.
 *
 * Substitui o RedisService original — antes armazenava `denylist:<hash>`
 * com TTL no Redis. Agora usa a tabela `token_denylist` (PostgreSQL).
 *
 * Cleanup periódico é feito pelo pg_cron:
 *   DELETE FROM token_denylist WHERE expires_at < NOW();
 * (configurado fora desta aplicação, no Supabase).
 */
@Injectable()
export class RedisService {
  private readonly logger = new Logger(RedisService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Mantido por compatibilidade — algumas estratégias legadas podem chamar
   * `raw()` em código antigo. Em Postgres-only, não há mais cliente cru;
   * lançar para deixar claro que o caller precisa migrar.
   */
  raw(): never {
    throw new Error(
      'RedisService.raw() não é mais suportado. Migre para o PrismaService.',
    );
  }

  /**
   * Adiciona um identificador (ex.: hash de token) à denylist com TTL.
   * O `key` é gravado como está; o `RedisService` antigo prefixava com
   * `denylist:` internamente — aqui ficamos com o valor literal para
   * casar com a coluna única.
   */
  async denylist(key: string, ttlSeconds: number, opts: { userId?: string; reason?: string } = {}): Promise<void> {
    if (ttlSeconds <= 0) return;
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    try {
      await this.prisma.tokenDenylist.upsert({
        where: { tokenHash: key },
        update: { expiresAt },
        create: {
          tokenHash: key,
          userId: opts.userId,
          reason: opts.reason,
          expiresAt,
        },
      });
    } catch (err) {
      this.logger.error(
        `Falha ao inserir na denylist (hash=${key.substring(0, 12)}...): ${(err as Error).message}`,
      );
      // Não lançamos — denylist é "best-effort": se cair, o token expira sozinho.
    }
  }

  async isDenylisted(key: string): Promise<boolean> {
    const row = await this.prisma.tokenDenylist.findUnique({
      where: { tokenHash: key },
      select: { expiresAt: true },
    });
    if (!row) return false;
    if (row.expiresAt < new Date()) {
      // Expirado — limpa em background (o pg_cron também cuida).
      this.prisma.tokenDenylist
        .delete({ where: { tokenHash: key } })
        .catch(() => undefined);
      return false;
    }
    return true;
  }

  async revokeDenylist(key: string): Promise<void> {
    try {
      await this.prisma.tokenDenylist.delete({ where: { tokenHash: key } });
    } catch {
      // Ignora se não existe
    }
  }
}
