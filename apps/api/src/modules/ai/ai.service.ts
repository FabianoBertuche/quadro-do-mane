import { Inject, Injectable, BadRequestException, ForbiddenException, GoneException, NotFoundException, HttpException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AiCompletionInput, AiProvider } from './ports/ai-provider.port';
import { AiContextService } from './ai-context.service';
import { AiAuditService } from './ai-audit.service';
import { AiToolRegistryService } from './tools/ai-tool-registry.service';
import { AiTool } from './tools/ai-tool.port';
import { SendAiMessageDto } from './dto/send-ai-message.dto';

export const AI_PROVIDER = 'AI_PROVIDER';
export interface AiActor { tenantId: string; tenantUserId: string; userId?: string }

export interface AiSecurityLimits {
  maxMessageLength: number;
  maxHistoryMessages: number;
  userRequestsPerMinute: number;
  tenantRequestsPerMinute: number;
  costUnitsPerMinute: number;
}

const positiveInt = (key: string, fallback: number) => {
  const value = Number(process.env[key]);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
};

export const DEFAULT_AI_SECURITY_LIMITS: AiSecurityLimits = {
  maxMessageLength: positiveInt('AI_MESSAGE_MAX_LENGTH', 4000),
  maxHistoryMessages: positiveInt('AI_HISTORY_MAX_MESSAGES', 20),
  userRequestsPerMinute: positiveInt('AI_USER_REQUESTS_PER_MINUTE', 60),
  tenantRequestsPerMinute: positiveInt('AI_TENANT_REQUESTS_PER_MINUTE', 300),
  costUnitsPerMinute: positiveInt('AI_COST_UNITS_PER_MINUTE', 120),
};

interface RateBucket { startedAt: number; requests: number; cost: number }

@Injectable()
export class AiService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(AI_PROVIDER) private readonly provider: AiProvider,
    private readonly context: AiContextService,
    public registry: AiToolRegistryService,
    private readonly audit: AiAuditService,
    limits: Partial<AiSecurityLimits> = {},
  ) {
    this.limits = { ...DEFAULT_AI_SECURITY_LIMITS, ...limits };
  }

  private readonly limits: AiSecurityLimits;
  private readonly rateBuckets = new Map<string, RateBucket>();

  async createConversation(actor: AiActor, input: { contextProjectId?: string } = {}) {
    if (input.contextProjectId) {
      const context = await this.context.buildContext({ tenantId: actor.tenantId, actorTenantUserId: actor.tenantUserId, projectId: input.contextProjectId, query: '' });
      if (!context.project) throw new ForbiddenException('Projeto sem acesso');
    }
    const conversation = await this.prisma.aiConversation.create({
      data: { tenantId: actor.tenantId, ownerTenantUserId: actor.tenantUserId, contextProjectId: input.contextProjectId ?? null },
    });
    await this.audit.record({ tenantId: actor.tenantId, actorTenantUserId: actor.tenantUserId, actorUserId: actor.userId, action: 'conversation.created', targetId: conversation.id });
    return { id: conversation.id, contextProjectId: conversation.contextProjectId };
  }

  listConversations(actor: AiActor, page = 1, take = 20) {
    const safeTake = Math.min(Math.max(take, 1), 50);
    return this.prisma.aiConversation.findMany({
      where: { tenantId: actor.tenantId, ownerTenantUserId: actor.tenantUserId },
      orderBy: { updatedAt: 'desc' }, skip: (page - 1) * safeTake, take: safeTake,
    });
  }

  async getMessages(actor: AiActor, conversationId: string, page = 1, take = 50) {
    await this.requireConversation(actor, conversationId);
    const safeTake = Math.min(Math.max(take, 1), 50);
    const [messages, proposals] = await Promise.all([
      this.prisma.aiMessage.findMany({ where: { tenantId: actor.tenantId, conversationId, conversation: { ownerTenantUserId: actor.tenantUserId } }, orderBy: { createdAt: 'asc' }, skip: (page - 1) * safeTake, take: safeTake }),
      this.prisma.aiActionProposal.findMany({ where: { tenantId: actor.tenantId, conversationId, createdByTenantUserId: actor.tenantUserId, conversation: { ownerTenantUserId: actor.tenantUserId }, status: 'PENDING' }, orderBy: { createdAt: 'desc' }, take: 20 }),
    ]);
    return { messages, pendingProposals: proposals };
  }

  async sendMessage(actor: AiActor & { conversationId: string }, dto: SendAiMessageDto) {
    const conversation = await this.requireConversation(actor, actor.conversationId);
    const text = dto.text?.trim();
    if (!text) throw new BadRequestException('A mensagem de texto é obrigatória');
    if (text.length > this.limits.maxMessageLength) throw new BadRequestException('A mensagem excede o limite permitido');
    this.consumeRateLimit(actor, Math.max(1, Math.ceil(text.length / 1000)));
    const userMessage = await this.prisma.aiMessage.create({ data: { tenantId: actor.tenantId, conversationId: conversation.id, role: 'user', format: dto.responseMode, content: text } });
    const context = await this.context.buildContext({ tenantId: actor.tenantId, actorTenantUserId: actor.tenantUserId, projectId: dto.contextProjectId ?? conversation.contextProjectId ?? undefined, query: text });
    const history = await this.prisma.aiMessage.findMany({ where: { tenantId: actor.tenantId, conversationId: conversation.id, conversation: { ownerTenantUserId: actor.tenantUserId } }, orderBy: { createdAt: 'desc' }, take: this.limits.maxHistoryMessages });
    const completionInput: AiCompletionInput = {
      messages: [
        { role: 'system', content: `Use somente este contexto acessível: ${context.summary}` },
        ...history.reverse().map((message: any) => ({ role: message.role, content: message.content ?? '' })),
      ],
      tools: this.registry.list().map((tool) => ({ name: tool.name, description: tool.description, parameters: tool.parameters })),
    };
    const completion = await this.provider.complete(completionInput);
    const assistantMessage = await this.prisma.aiMessage.create({ data: { tenantId: actor.tenantId, conversationId: conversation.id, role: 'assistant', format: dto.responseMode, content: completion.text, providerMetaJson: JSON.stringify({ toolCallCount: completion.toolCalls.length }) } });
    const tools = completion.toolCalls.map((toolCall) => {
      const tool = this.registry.get(toolCall.name);
      if (!tool) throw new BadRequestException(`Ferramenta não disponível: ${toolCall.name}`);
      this.validateToolArgs(tool, toolCall.arguments);
      return { tool, args: toolCall.arguments };
    });
    const proposals: any[] = [];
    for (const { tool, args } of tools) {
      proposals.push(await this.prisma.aiActionProposal.create({ data: { tenantId: actor.tenantId, conversationId: conversation.id, createdByTenantUserId: actor.tenantUserId, toolName: tool.name, argumentsJson: JSON.stringify(args), status: 'PENDING', summary: `Confirmar ação: ${tool.name}`, expiresAt: new Date(Date.now() + 5 * 60_000) } }));
    }
    await this.audit.record({ tenantId: actor.tenantId, actorTenantUserId: actor.tenantUserId, actorUserId: actor.userId, action: 'message.completed', targetId: conversation.id, metadata: { responseMode: dto.responseMode, toolCallCount: proposals.length } });
    return { message: userMessage, assistantMessage, proposals, proposal: proposals[0] };
  }

  async confirmProposal(actor: AiActor, proposalId: string) {
    const proposal = await this.findPendingProposal(actor, proposalId);
    if (proposal.expiresAt <= new Date()) throw new GoneException('A proposta expirou');
    const tool = this.registry.get(proposal.toolName);
    if (!tool) throw new NotFoundException('Ferramenta não disponível');
    const args = JSON.parse(proposal.argumentsJson);
    this.validateToolArgs(tool, args);
    await this.updateOwnedProposal(actor, proposal.id, { status: 'CONFIRMED' }, 'PENDING');
    try {
      const current = await this.findOwnedProposal(actor, proposal.id, 'CONFIRMED');
      if (!current) throw new ForbiddenException('Proposta não está mais disponível');
      const currentArgs = JSON.parse(current.argumentsJson);
      this.validateToolArgs(tool, currentArgs);
      const toolInput = { tenantId: actor.tenantId, actorTenantUserId: actor.tenantUserId, args: currentArgs };
      await tool.authorize(toolInput);
      const result = await tool.execute(toolInput);
      const saved = await this.updateOwnedProposal(actor, proposal.id, { status: 'EXECUTED', resultJson: JSON.stringify(result) }, 'CONFIRMED');
      await this.audit.record({ tenantId: actor.tenantId, actorTenantUserId: actor.tenantUserId, actorUserId: actor.userId, action: 'proposal.executed', targetId: proposal.id, metadata: { toolName: proposal.toolName } });
      return saved;
    } catch (error) {
      await this.updateOwnedProposal(actor, proposal.id, { status: 'FAILED' }, 'CONFIRMED');
      throw error;
    }
  }

  async cancelProposal(actor: AiActor, proposalId: string) {
    const proposal = await this.findPendingProposal(actor, proposalId);
    const cancelled = await this.updateOwnedProposal(actor, proposal.id, { status: 'CANCELLED' }, 'PENDING');
    await this.audit.record({ tenantId: actor.tenantId, actorTenantUserId: actor.tenantUserId, actorUserId: actor.userId, action: 'proposal.cancelled', targetId: proposal.id });
    return cancelled;
  }

  private async requireConversation(actor: AiActor, conversationId: string) {
    const conversation = await this.prisma.aiConversation.findFirst({ where: { id: conversationId, tenantId: actor.tenantId, ownerTenantUserId: actor.tenantUserId } });
    if (!conversation) throw new ForbiddenException('Conversa não encontrada');
    return conversation;
  }

  private async findPendingProposal(actor: AiActor, proposalId: string) {
    const proposal = await this.findOwnedProposal(actor, proposalId, 'PENDING');
    if (!proposal) throw new ForbiddenException('Proposta não encontrada');
    return proposal;
  }

  private findOwnedProposal(actor: AiActor, proposalId: string, status?: string) {
    return this.prisma.aiActionProposal.findFirst({
      where: { id: proposalId, tenantId: actor.tenantId, createdByTenantUserId: actor.tenantUserId, ...(status ? { status } : {}) },
    });
  }

  private async updateOwnedProposal(actor: AiActor, proposalId: string, data: Record<string, unknown>, expectedStatus: string) {
    const result = await this.prisma.aiActionProposal.updateMany({
      where: { id: proposalId, tenantId: actor.tenantId, createdByTenantUserId: actor.tenantUserId, status: expectedStatus },
      data,
    });
    if (result.count !== 1) throw new ForbiddenException('Proposta não encontrada');
    const proposal = await this.findOwnedProposal(actor, proposalId);
    if (!proposal) throw new ForbiddenException('Proposta não encontrada');
    return proposal;
  }

  private validateToolArgs(tool: AiTool, args: unknown) {
    if (tool.validate) tool.validate(args);
    else if (!args || typeof args !== 'object' || Array.isArray(args)) throw new BadRequestException('Argumentos inválidos');
  }

  private consumeRateLimit(actor: AiActor, cost: number) {
    const now = Date.now();
    const keys = [
      [`user:${actor.tenantId}:${actor.tenantUserId}`, this.limits.userRequestsPerMinute],
      [`tenant:${actor.tenantId}`, this.limits.tenantRequestsPerMinute],
    ] as const;
    const buckets = keys.map(([key, requestLimit]) => {
      const current = this.rateBuckets.get(key);
      return [key, requestLimit, !current || now - current.startedAt >= 60_000
        ? { startedAt: now, requests: 0, cost: 0 }
        : current] as const;
    });
    if (buckets.some(([, requestLimit, bucket]) => bucket.requests + 1 > requestLimit || bucket.cost + cost > this.limits.costUnitsPerMinute)) {
      throw new HttpException('Limite de uso da IA excedido', 429);
    }
    for (const [key, , bucket] of buckets) {
      bucket.requests += 1;
      bucket.cost += cost;
      this.rateBuckets.set(key, bucket);
    }
  }
}
