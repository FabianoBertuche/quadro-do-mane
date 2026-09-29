export interface AiToolInput {
  tenantId: string;
  actorTenantUserId: string;
  args: unknown;
}

export interface AiTool {
  name: string;
  description?: string;
  parameters: Record<string, unknown>;
  validate?(args: unknown): unknown;
  execute(input: AiToolInput): Promise<unknown>;
}
