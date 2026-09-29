import { HttpException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { AiActor, AiSecurityLimits } from './ai.service';

export interface AiRateLimiter {
  consume(actor: AiActor, costUnits: number): Promise<void>;
}

@Injectable()
export class AiRateLimitService implements AiRateLimiter {
  constructor(
    private readonly prisma: PrismaService,
    private readonly limits: Pick<AiSecurityLimits, 'userRequestsPerMinute' | 'tenantRequestsPerMinute' | 'costUnitsPerMinute'>,
  ) {}

  async consume(actor: AiActor, costUnits: number): Promise<void> {
    const windowStart = new Date(Math.floor(Date.now() / 60_000) * 60_000);
    try {
      await this.prisma.$transaction(async (transaction) => {
        const claimed = await transaction.$queryRaw<{ scope_key: string }[]>(Prisma.sql`
          INSERT INTO "ai_rate_limit_buckets"
            ("id", "tenant_id", "tenant_user_id", "scope_key", "window_start", "request_count", "cost_units", "request_limit", "cost_limit", "created_at", "updated_at")
          VALUES
            (gen_random_uuid(), ${actor.tenantId}, ${actor.tenantUserId}, ${`user:${actor.tenantUserId}`}, ${windowStart}, 1, ${costUnits}, ${this.limits.userRequestsPerMinute}, ${this.limits.costUnitsPerMinute}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
            (gen_random_uuid(), ${actor.tenantId}, NULL, ${`tenant:${actor.tenantId}`}, ${windowStart}, 1, ${costUnits}, ${this.limits.tenantRequestsPerMinute}, ${this.limits.costUnitsPerMinute}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          ON CONFLICT ("tenant_id", "scope_key", "window_start")
          DO UPDATE SET
            "request_count" = "ai_rate_limit_buckets"."request_count" + 1,
            "cost_units" = "ai_rate_limit_buckets"."cost_units" + EXCLUDED."cost_units",
            "request_limit" = EXCLUDED."request_limit",
            "cost_limit" = EXCLUDED."cost_limit",
            "updated_at" = CURRENT_TIMESTAMP
          WHERE "ai_rate_limit_buckets"."request_count" + 1 <= EXCLUDED."request_limit"
            AND "ai_rate_limit_buckets"."cost_units" + EXCLUDED."cost_units" <= EXCLUDED."cost_limit"
          RETURNING "scope_key"
        `);
        if (claimed.length !== 2) throw new HttpException('Limite de uso da IA excedido', 429);
      });
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new ServiceUnavailableException('Limite de uso da IA indisponível');
    }
  }
}
