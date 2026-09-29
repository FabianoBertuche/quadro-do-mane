export interface AiContextItem {
  id: string;
  content: string;
  source?: string;
  metadata?: Record<string, unknown>;
}

export interface AiKnowledgeSource {
  search(input: {
    tenantId: string;
    actorTenantUserId: string;
    query: string;
  }): Promise<AiContextItem[]>;
}
