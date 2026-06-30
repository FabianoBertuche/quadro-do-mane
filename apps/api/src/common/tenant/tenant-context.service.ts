import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Contexto de tenant por request usando AsyncLocalStorage (Node.js nativo).
 *
 * Vantagens:
 * - Sem precisar passar tenantId por parâmetro em cada chamada de service
 * - Funciona bem com NestJS (request-scoped) e qualquer profundidade de chamadas
 * - Compatível com Prisma Client Extension
 *
 * O TenantMiddleware popula este contexto extraindo tenantId do req.user.
 */

interface TenantContextValue {
  tenantId: string;
  userId: string;
  tenantUserId: string;
}

@Injectable()
export class TenantContextService {
  private readonly storage = new AsyncLocalStorage<TenantContextValue>();

  /**
   * Executa o callback dentro de um contexto de tenant.
   * Use no TenantMiddleware.
   */
  run<T>(ctx: TenantContextValue, callback: () => T): T {
    return this.storage.run(ctx, callback);
  }

  /**
   * Retorna o contexto atual ou null se fora de um request autenticado.
   */
  get(): TenantContextValue | null {
    return this.storage.getStore() ?? null;
  }

  /**
   * Retorna o tenantId atual ou null. Helper comum nos services.
   */
  getTenantId(): string | null {
    return this.get()?.tenantId ?? null;
  }

  /**
   * Retorna o userId atual ou null.
   */
  getUserId(): string | null {
    return this.get()?.userId ?? null;
  }

  /**
   * Retorna o tenantUserId atual ou null.
   */
  getTenantUserId(): string | null {
    return this.get()?.tenantUserId ?? null;
  }
}