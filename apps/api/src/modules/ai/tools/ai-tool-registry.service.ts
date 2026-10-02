import { Injectable, Optional } from '@nestjs/common';
import { AiPermissionService } from '../ai-permission.service';
import { AiTool } from './ai-tool.port';

@Injectable()
export class AiToolRegistryService {
  private readonly tools: Map<string, AiTool>;

  constructor(
    tools: AiTool[] = [],
    @Optional() private readonly permissions?: AiPermissionService,
  ) {
    this.tools = new Map(tools.map((tool) => [tool.name, tool]));
  }

  list(): AiTool[] {
    return [...this.tools.values()];
  }

  get(name: string): AiTool | undefined {
    return this.tools.get(name);
  }

  /** Tools que o ator pode executar; base do que é enviado ao modelo. */
  async listVisible(input: { tenantId: string; tenantUserId: string }): Promise<AiTool[]> {
    const all = this.list();
    if (!this.permissions) return all;

    const allowed: AiTool[] = [];
    for (const tool of all) {
      if (!tool.permission || await this.permissions.can(input, tool.permission)) allowed.push(tool);
    }
    return allowed;
  }
}
