import { Inject, Injectable, BadRequestException, ForbiddenException, GoneException, Logger, NotFoundException, Optional } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AiCompletionInput, AiProvider, AiProviderError } from './ports/ai-provider.port';
import { AiContextService } from './ai-context.service';
import { AiIdentityContextService } from './ai-identity.service';
import { AiAuditService } from './ai-audit.service';
import { AiToolRegistryService } from './tools/ai-tool-registry.service';
import { AiTool } from './tools/ai-tool.port';
import { AiResponseMode, SendAiMessageDto } from './dto/send-ai-message.dto';
import type { AiRateLimiter } from './ai-rate-limit.service';
import type { AiOAuthService } from './ai-oauth.service';
import type { AiServerRuntimeService } from './ai-server-runtime.service';

export const AI_PROVIDER = 'AI_PROVIDER';
export const AI_RATE_LIMITER = 'AI_RATE_LIMITER';
export const AI_OAUTH_SERVICE = 'AI_OAUTH_SERVICE';
export const AI_SERVER_RUNTIME = 'AI_SERVER_RUNTIME';
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

const safeError = (err: unknown) => (err instanceof Error ? err.name : 'erro desconhecido');

export const DEFAULT_AI_SECURITY_LIMITS: AiSecurityLimits = {
  maxMessageLength: positiveInt('AI_MESSAGE_MAX_LENGTH', 4000),
  maxHistoryMessages: positiveInt('AI_HISTORY_MAX_MESSAGES', 20),
  userRequestsPerMinute: positiveInt('AI_USER_REQUESTS_PER_MINUTE', 60),
  tenantRequestsPerMinute: positiveInt('AI_TENANT_REQUESTS_PER_MINUTE', 300),
  costUnitsPerMinute: positiveInt('AI_COST_UNITS_PER_MINUTE', 120),
};

@Injectable()
export class AiService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(AI_PROVIDER) private readonly provider: AiProvider,
    private readonly context: AiContextService,
    public registry: AiToolRegistryService,
    private readonly audit: AiAuditService,
    @Optional() limits: Partial<AiSecurityLimits> = {},
    @Optional() @Inject(AI_RATE_LIMITER) private readonly rateLimiter?: AiRateLimiter,
    @Optional() @Inject(AI_OAUTH_SERVICE) private readonly oauth?: AiOAuthService,
    @Optional() @Inject(AI_SERVER_RUNTIME) private readonly runtime?: AiServerRuntimeService,
    @Optional() private readonly identity?: AiIdentityContextService,
  ) {
    this.limits = { ...DEFAULT_AI_SECURITY_LIMITS, ...limits };
  }

  private readonly limits: AiSecurityLimits;
  private readonly logger = new Logger(AiService.name);

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

  async sendMessage(actor: AiActor & { conversationId: string; rateLimitReserved?: boolean }, dto: SendAiMessageDto, inputFormat: AiResponseMode = AiResponseMode.TEXT) {
    const conversation = await this.requireConversation(actor, actor.conversationId);
    const text = dto.text?.trim();
    if (!text) throw new BadRequestException('A mensagem de texto é obrigatória');
    if (text.length > this.limits.maxMessageLength) throw new BadRequestException('A mensagem excede o limite permitido');
    if (!actor.rateLimitReserved) await this.reserveRateLimit(actor, Math.max(1, Math.ceil(text.length / 1000)));
    const context = await this.context.buildContext({ tenantId: actor.tenantId, actorTenantUserId: actor.tenantUserId, projectId: dto.contextProjectId ?? conversation.contextProjectId ?? undefined, query: text });
    const identity = this.identity
      ? await this.identity.resolve({ tenantId: actor.tenantId, tenantUserId: actor.tenantUserId })
      : null;
    const history = await this.prisma.aiMessage.findMany({ where: { tenantId: actor.tenantId, conversationId: conversation.id, conversation: { ownerTenantUserId: actor.tenantUserId } }, orderBy: { createdAt: 'desc' }, take: Math.max(this.limits.maxHistoryMessages - 1, 0) });
    const model = await this.selectedModel();
    const completionInput: AiCompletionInput = {
      messages: [
        { role: 'system', content: `${identity ? `Usuário autenticado: ${identity.name}. Tratamento: ${identity.address}. Use este tratamento apenas para se dirigir ao usuário atual.\n` : ''}Use somente este contexto acessível: ${context.summary}` },
        ...history.reverse().map((message: any) => ({ role: message.role, content: message.content ?? '' })),
        { role: 'user', content: text },
      ],
      tools: this.registry.list().map((tool) => ({ name: tool.name, description: tool.description, parameters: tool.parameters })),
      ...(model ? { model } : {}),
    };
    let completion: Awaited<ReturnType<AiProvider['complete']>>;
    try {
      completion = await this.provider.complete(completionInput, this.oauth ? await this.oauth.resolveProviderAuth() : undefined);
    } catch (error) {
      const metadata = error instanceof AiProviderError ? {
        providerStatus: error.metadata.status,
        providerCode: error.metadata.code,
        providerRequestId: error.metadata.requestId,
      } : {};
      await this.audit.record({ tenantId: actor.tenantId, actorTenantUserId: actor.tenantUserId, actorUserId: actor.userId, action: 'provider.failed', targetId: conversation.id, metadata: { provider: 'AI_PROVIDER', status: 'failed', ...metadata } });
      throw error;
    }
    const tools = completion.toolCalls.map((toolCall) => {
      const tool = this.registry.get(toolCall.name);
      if (!tool) throw new BadRequestException(`Ferramenta não disponível: ${toolCall.name}`);
      this.validateToolArgs(tool, toolCall.arguments);
      return { tool, args: toolCall.arguments };
    });
    const { userMessage, assistantMessage, proposals } = await this.persistAtomically(async (tx) => {
      const createdUserMessage = await tx.aiMessage.create({ data: { tenantId: actor.tenantId, conversationId: conversation.id, role: 'user', format: inputFormat, content: text } });
      const createdAssistantMessage = await tx.aiMessage.create({ data: { tenantId: actor.tenantId, conversationId: conversation.id, role: 'assistant', format: dto.responseMode, content: completion.text, providerMetaJson: JSON.stringify({ toolCallCount: completion.toolCalls.length }) } });
      const createdProposals: any[] = [];
      for (const { tool, args } of tools) {
        createdProposals.push(await tx.aiActionProposal.create({ data: { tenantId: actor.tenantId, conversationId: conversation.id, createdByTenantUserId: actor.tenantUserId, toolName: tool.name, argumentsJson: JSON.stringify(args), status: 'PENDING', summary: `Confirmar ação: ${tool.name}`, expiresAt: new Date(Date.now() + 5 * 60_000) } }));
      }
      return { userMessage: createdUserMessage, assistantMessage: createdAssistantMessage, proposals: createdProposals };
    });
    await this.audit.record({ tenantId: actor.tenantId, actorTenantUserId: actor.tenantUserId, actorUserId: actor.userId, action: 'message.completed', targetId: conversation.id, metadata: { responseMode: dto.responseMode, toolCallCount: proposals.length } });
    return { message: userMessage, assistantMessage, proposals, proposal: proposals[0] };
  }

  private async selectedModel(): Promise<string | undefined> {
    if (!this.runtime) return undefined;
    try {
      const runtime = await this.runtime.getRuntime();
      return runtime.selectedModel?.slug || undefined;
    } catch (error) {
      this.logger.error(`Falha ao ler o runtime global de IA: ${safeError(error)}`);
      throw error;
    }
  }

  private async persistAtomically<T>(work: (tx: PrismaService) => Promise<T>): Promise<T> {
    if (typeof (this.prisma as { $transaction?: unknown }).$transaction === 'function') {
      return this.prisma.$transaction((tx: PrismaService) => work(tx));
    }
    return work(this.prisma);
  }

  async confirmProposal(actor: AiActor, proposalId: string) {
    let proposal;
    try {
      proposal = await this.findPendingProposal(actor, proposalId);
    } catch (error) {
      await this.audit.record({ tenantId: actor.tenantId, actorTenantUserId: actor.tenantUserId, actorUserId: actor.userId, action: 'proposal.confirmation_denied', targetId: proposalId, metadata: { reason: 'proposal_not_found' } });
      throw error;
    }
    if (proposal.expiresAt <= new Date()) {
      await this.audit.record({ tenantId: actor.tenantId, actorTenantUserId: actor.tenantUserId, actorUserId: actor.userId, action: 'proposal.expired', targetId: proposalId, metadata: { status: 'expired' } });
      throw new GoneException('A proposta expirou');
    }
    const tool = this.registry.get(proposal.toolName);
    if (!tool) throw new NotFoundException('Ferramenta não disponível');
    const args = JSON.parse(proposal.argumentsJson);
    this.validateToolArgs(tool, args);
    try {
      await this.updateOwnedProposal(actor, proposal.id, { status: 'CONFIRMED' }, 'PENDING', true);
    } catch (error) {
      await this.audit.record({ tenantId: actor.tenantId, actorTenantUserId: actor.tenantUserId, actorUserId: actor.userId, action: 'proposal.confirmation_denied', targetId: proposalId, metadata: { reason: 'expired_or_claimed' } });
      throw error;
    }
    try {
      const current = await this.findOwnedProposal(actor, proposal.id, 'CONFIRMED');
       if (!current) throw new ForbiddenException('Proposta não está mais disponível');
       if (current.expiresAt <= new Date()) throw new GoneException('A proposta expirou');
      const currentArgs = JSON.parse(current.argumentsJson);
      this.validateToolArgs(tool, currentArgs);
      const toolInput = { tenantId: actor.tenantId, actorTenantUserId: actor.tenantUserId, args: currentArgs };
      await tool.authorize(toolInput);
      const result = await tool.execute(toolInput);
      if (this.isClarification(result)) {
        const pending = await this.updateOwnedProposal(actor, proposal.id, { status: 'PENDING', resultJson: this.safeJson(result) }, 'CONFIRMED');
        const message = await this.persistResultMessage(actor, proposal.conversationId, { status: 'needsClarification', toolName: proposal.toolName, result });
        return { ...pending, message };
      }
      const saved = await this.updateOwnedProposal(actor, proposal.id, { status: 'EXECUTED', resultJson: this.safeJson(result) }, 'CONFIRMED');
      const message = await this.persistResultMessage(actor, proposal.conversationId, { status: 'success', toolName: proposal.toolName, result });
      await this.audit.record({ tenantId: actor.tenantId, actorTenantUserId: actor.tenantUserId, actorUserId: actor.userId, action: 'proposal.executed', targetId: proposal.id, metadata: { toolName: proposal.toolName } });
      return { ...saved, message };
    } catch (error) {
      await this.updateOwnedProposal(actor, proposal.id, { status: 'FAILED' }, 'CONFIRMED');
      await this.persistResultMessage(actor, proposal.conversationId, { status: 'failure', toolName: proposal.toolName });
      const denied = error instanceof ForbiddenException;
      await this.audit.record({ tenantId: actor.tenantId, actorTenantUserId: actor.tenantUserId, actorUserId: actor.userId, action: denied ? 'proposal.confirmation_denied' : 'proposal.confirmation_failed', targetId: proposal.id, metadata: { status: denied ? 'denied' : 'failed' } });
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

  private async updateOwnedProposal(actor: AiActor, proposalId: string, data: Record<string, unknown>, expectedStatus: string, requireUnexpired = false) {
    const result = await this.prisma.aiActionProposal.updateMany({
      where: { id: proposalId, tenantId: actor.tenantId, createdByTenantUserId: actor.tenantUserId, status: expectedStatus, ...(requireUnexpired ? { expiresAt: { gt: new Date() } } : {}) },
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

  private isClarification(value: unknown): value is { needsClarification: true } {
    return !!value && typeof value === 'object' && (value as any).needsClarification === true;
  }

  private safeJson(value: unknown): string {
    const serialized = JSON.stringify(value ?? null);
    return serialized.length > 4_000 ? `${serialized.slice(0, 4_000)}...` : serialized;
  }

  private async persistResultMessage(actor: AiActor, conversationId: string, result: Record<string, unknown>) {
    return this.prisma.aiMessage.create({
      data: {
        tenantId: actor.tenantId,
        conversationId,
        role: 'assistant',
        format: 'TEXT',
        content: this.safeJson(result),
      },
    });
  }

  async reserveRateLimit(actor: AiActor, cost: number) {
    if (this.rateLimiter) await this.rateLimiter.consume(actor, cost);
  }
}
