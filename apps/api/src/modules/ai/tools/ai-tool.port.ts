import { PermissionCode } from './permission-codes';

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

export type AiToolResult = AiToolClarification | Record<string, unknown> | unknown[] | null | undefined | void;

export interface AiTool {
  name: string;
  readOnly?: boolean;
  description?: string;
  /** Permissão exigida do ator; ausente mantém a tool visível. */
  permission?: PermissionCode;
  parameters: Record<string, unknown>;
  validate?(args: unknown): unknown;
  authorize(input: AiToolInput): Promise<void | AiToolResult>;
  execute(input: AiToolInput): Promise<AiToolResult>;
}
