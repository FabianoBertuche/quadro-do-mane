import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { TenantContextService } from '../tenant/tenant-context.service';
import { isTenantScoped } from './tenant-scoped.models';

/**
 * PrismaService estendido com:
 * 1. Cliente Prisma base (this)
 * 2. `$extends` que injeta `where.tenantId` automaticamente em queries para
 *    models tenant-scoped, lendo o tenantId do TenantContextService.
 *
 * Após onModuleInit, `this.extended` contém a versão estendida que aplica
 * isolamento de tenant automaticamente. Injete nos services via `prisma.extended`
 * OU exponha o cliente estendido como principal (renomeando).
 *
 * Para simplicidade: esta classe mantém a API do PrismaClient via herança,
 * e o cliente estendido é exposto em `this.extended`. Services existentes que
 * injetam `PrismaService` continuam funcionando, mas para obter o isolamento
 * automático devem usar `prisma.extended`.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  // Cliente com extension aplicada — use este nos services para isolamento automático.
  public extended!: PrismaClient;

  constructor(private readonly tenantContext: TenantContextService) {
    super();
  }

  async onModuleInit() {
    await this.$connect();

    const tenantContext = this.tenantContext;
    const tenantScoped = isTenantScoped;

    // Cast necessário: o tipo de retorno do $extends perde $on/$use do PrismaClient,
    // mas isso é esperado (esses métodos legados são substituídos por events).
    const extended = this.$extends({
      name: 'TenantIsolation',
      query: {
        $allModels: {
          async $allOperations({ model, operation, args, query }: any) {
            const tenantId = tenantContext.getTenantId();

            if (!tenantId || !model || !tenantScoped(model)) {
              return query(args);
            }

            const operationsWithWhere = new Set([
              'findUnique',
              'findUniqueOrThrow',
              'findFirst',
              'findFirstOrThrow',
              'findMany',
              'count',
              'aggregate',
              'groupBy',
              'update',
              'updateMany',
              'delete',
              'deleteMany',
            ]);

            const operationsWithDataWhere = new Set(['create', 'createMany', 'upsert']);

            if (operationsWithWhere.has(operation)) {
              const a: any = args ?? {};
              const existingWhere = a.where ?? {};
              a.where = { ...existingWhere, tenantId };
              return query(a);
            }

            if (operationsWithDataWhere.has(operation)) {
              const a: any = args ?? {};
              const data = a.data;
              if (data) {
                if (Array.isArray(data)) {
                  a.data = data.map((d: any) => ({ ...d, tenantId }));
                } else {
                  a.data = { ...data, tenantId };
                }
              }
              return query(a);
            }

            return query(args);
          },
        },
      },
    });

    this.extended = extended as unknown as PrismaClient;
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
