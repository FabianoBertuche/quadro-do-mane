export interface AiToolInput {
  tenantId: string;
  actorTenantUserId: string;
  args: unknown;
}

export interface AiToolClarification {
  needsClarification: true;
  field: string;
  matches: Array<string | { id: string; name?: string }>;
}

export type AiToolResult = unknown | AiToolClarification;

export interface AiTool {
  name: string;
  description?: string;
  parameters: Record<string, unknown>;
  validate?(args: unknown): unknown;
  authorize(input: AiToolInput): Promise<void | AiToolResult>;
  execute(input: AiToolInput): Promise<AiToolResult>;
}
