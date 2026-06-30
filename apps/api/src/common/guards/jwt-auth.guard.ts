import {
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { EncryptionService } from '../crypto/encryption.service';
import { RedisService } from '../redis/redis.service';

/**
 * Guard JWT estendido que:
 * 1. delega a validação do JWT para a JwtStrategy (que aceita Authorization
 *    OU cookie `qd_access` — ver `strategies/jwt.strategy.ts`)
 * 2. checa a denylist de tokens (tabela `token_denylist` no PostgreSQL —
 *    substitui o Redis anterior). Logout explícito revoga mesmo tokens válidos.
 *
 * Use como substituto do AuthGuard('jwt') nas controllers:
 *   @UseGuards(JwtAuthGuard)
 *
 * Por compatibilidade com controllers existentes que usam AuthGuard('jwt')
 * direto, esta classe NÃO é obrigatória — a JwtStrategy já cobre os dois
 * casos. Este guard existe para adicionar a checagem da denylist.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(
    private readonly redis: RedisService,
    private readonly encryption: EncryptionService,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    // 1) valida JWT (assinatura + expiração) — extrai do header OU cookie
    const passportOk = await super.canActivate(context);
    if (!passportOk) return false;

    // 2) checa denylist — extrai o token cru do que a estratégia usou
    const token = this.extractTokenFromRequest(request);
    if (!token) {
      throw new UnauthorizedException('Token ausente');
    }

    const hash = this.encryption.hash(token);
    if (await this.redis.isDenylisted(`access:${hash}`)) {
      this.logger.warn(`Acesso negado — token na denylist (hash=${hash.substring(0, 8)}...)`);
      throw new UnauthorizedException('Token revogado');
    }

    return true;
  }

  private extractTokenFromRequest(req: Request): string | null {
    const auth = req.headers?.authorization;
    if (auth && typeof auth === 'string' && auth.startsWith('Bearer ')) {
      return auth.substring('Bearer '.length).trim();
    }

    // Fallback: cookie (mesmo extrator da JwtStrategy)
    const fromParsed = (req as any).cookies?.qd_access;
    if (typeof fromParsed === 'string' && fromParsed.length > 0) return fromParsed;

    const raw = req.headers?.cookie;
    if (raw && typeof raw === 'string') {
      const parts = raw.split(';');
      for (const part of parts) {
        const idx = part.indexOf('=');
        if (idx === -1) continue;
        const k = part.slice(0, idx).trim();
        if (k === 'qd_access') {
          const v = part.slice(idx + 1).trim();
          try {
            return decodeURIComponent(v);
          } catch {
            return v;
          }
        }
      }
    }

    return null;
  }
}