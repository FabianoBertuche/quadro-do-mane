import { Injectable } from '@nestjs/common';
import { AiTool } from './ai-tool.port';

@Injectable()
export class AiToolRegistryService {
  private readonly tools: Map<string, AiTool>;

  constructor(tools: AiTool[] = []) {
    this.tools = new Map(tools.map((tool) => [tool.name, tool]));
  }

  list(): AiTool[] {
    return [...this.tools.values()];
  }

  get(name: string): AiTool | undefined {
    return this.tools.get(name);
  }
}
