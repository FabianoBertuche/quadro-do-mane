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
      metadata: { actorTenantUserId: input.actorTenantUserId, ...this.redact(input.metadata) },
    });
  }

  private redact(value: Record<string, unknown> = {}, depth = 0): Record<string, unknown> {
    if (depth > 4) return { value: '[REDACTED]' };
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => {
      if (/prompt|content|token|secret|authorization|password|error|payload/i.test(key)) return [key, '[REDACTED]'];
      if (entry && typeof entry === 'object' && !Array.isArray(entry)) return [key, this.redact(entry as Record<string, unknown>, depth + 1)];
      if (typeof entry === 'string' && /bearer\s+|sk-[a-z0-9_-]+|api[-_ ]?key/i.test(entry)) return [key, '[REDACTED]'];
      return [key, entry];
    }));
  }
}
