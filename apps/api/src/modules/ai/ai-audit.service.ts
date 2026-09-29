import { Injectable } from '@nestjs/common';
import { AuditLogService } from '../audit-log/audit-log.service';

@Injectable()
export class AiAuditService {
  constructor(private readonly auditLog: AuditLogService) {}

  async record(input: {
    tenantId: string;
    actorTenantUserId: string;
    actorUserId?: string;
    action: string;
    targetId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    await this.auditLog.log({
      tenantId: input.tenantId,
      actorUserId: input.actorUserId,
      action: `ai.${input.action}`,
      targetType: 'AiAssistant',
      targetId: input.targetId,
      metadata: { actorTenantUserId: input.actorTenantUserId, ...input.metadata },
    });
  }
}
