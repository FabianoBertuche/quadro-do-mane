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
      return [key, this.redactValue(entry, depth + 1)];
    }));
  }

  private redactValue(value: unknown, depth: number): unknown {
    if (depth > 4) return '[REDACTED]';
    if (typeof value === 'string' && /bearer\s+|sk-[a-z0-9_-]+|api[-_ ]?key/i.test(value)) return '[REDACTED]';
    if (Array.isArray(value)) return value.map((entry) => this.redactValue(entry, depth + 1));
    if (value && typeof value === 'object') return this.redact(value as Record<string, unknown>, depth + 1);
    return value;
  }
}
