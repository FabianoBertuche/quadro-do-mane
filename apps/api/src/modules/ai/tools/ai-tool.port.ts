export interface AiToolInput {
  tenantId: string;
  actorTenantUserId: string;
  args: unknown;
}

export interface AiToolClarificationMatch {
  id: string;
  name: string;
}

export interface AiToolClarification {
  needsClarification: true;
  field: string;
  matches: AiToolClarificationMatch[];
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
