import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { TenantContextService } from './tenant-context.service';

/**
 * Middleware que extrai tenantId do req.user (populado pelo JwtAuthGuard
 * via Passport) e injeta no TenantContextService via AsyncLocalStorage.
 *
 * Sem tenantId no req.user → callback segue sem contexto. Services que
 * tentarem acessar TenantContextService.getTenantId() retornarão null.
 *
 * ATENÇÃO: este middleware roda ANTES dos guards de controller, mas o
 * req.user só está disponível DEPOIS do JwtAuthGuard (que é executado como
 * guard, ou seja, depois do middleware).
 *
 * Solução: este middleware deve rodar como guard global OU ser integrado
 * ao JwtStrategy.validate() para registrar o contexto imediatamente após
 * decodificar o token.
 *
 * Implementação atual: o JwtStrategy também popula o contexto via
 * TenantContextService.run() — este middleware existe como fallback para
 * casos onde o req.user já esteja disponível (ex: edge cases).
 */
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private readonly tenantContext: TenantContextService) {}

  use(req: Request, _res: Response, next: NextFunction) {
    const user = (req as any).user;
    if (user?.tenantId && user?.userId && user?.tenantUserId) {
      // Garante contexto para casos em que JwtStrategy ainda não populou
      this.tenantContext.run(
        {
          tenantId: user.tenantId,
          userId: user.userId,
          tenantUserId: user.tenantUserId,
        },
        () => next(),
      );
      return;
    }
    next();
  }
}
