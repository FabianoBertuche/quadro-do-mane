import { Inject, Injectable, BadRequestException, ForbiddenException, GoneException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AiCompletionInput, AiProvider } from './ports/ai-provider.port';
import { AiContextService } from './ai-context.service';
import { AiAuditService } from './ai-audit.service';
import { AiToolRegistryService } from './tools/ai-tool-registry.service';
import { AiTool } from './tools/ai-tool.port';
import { SendAiMessageDto } from './dto/send-ai-message.dto';

export const AI_PROVIDER = 'AI_PROVIDER';
export interface AiActor { tenantId: string; tenantUserId: string; userId?: string }

@Injectable()
export class AiService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(AI_PROVIDER) private readonly provider: AiProvider,
    private readonly context: AiContextService,
    public registry: AiToolRegistryService,
    private readonly audit: AiAuditService,
  ) {}

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
      this.prisma.aiMessage.findMany({ where: { tenantId: actor.tenantId, conversationId }, orderBy: { createdAt: 'asc' }, skip: (page - 1) * safeTake, take: safeTake }),
      this.prisma.aiActionProposal.findMany({ where: { tenantId: actor.tenantId, conversationId, createdByTenantUserId: actor.tenantUserId, status: 'PENDING' }, orderBy: { createdAt: 'desc' }, take: 20 }),
    ]);
    return { messages, pendingProposals: proposals };
  }

  async sendMessage(actor: AiActor & { conversationId: string }, dto: SendAiMessageDto) {
    const conversation = await this.requireConversation(actor, actor.conversationId);
    const text = dto.text?.trim();
    if (!text) throw new BadRequestException('A mensagem de texto é obrigatória');
    const userMessage = await this.prisma.aiMessage.create({ data: { tenantId: actor.tenantId, conversationId: conversation.id, role: 'user', format: dto.responseMode, content: text } });
    const context = await this.context.buildContext({ tenantId: actor.tenantId, actorTenantUserId: actor.tenantUserId, projectId: dto.contextProjectId ?? conversation.contextProjectId ?? undefined, query: text });
    const history = await this.prisma.aiMessage.findMany({ where: { tenantId: actor.tenantId, conversationId: conversation.id }, orderBy: { createdAt: 'desc' }, take: 20 });
    const completionInput: AiCompletionInput = {
      messages: [
        { role: 'system', content: `Use somente este contexto acessível: ${context.summary}` },
        ...history.reverse().map((message: any) => ({ role: message.role, content: message.content ?? '' })),
      ],
      tools: this.registry.list().map((tool) => ({ name: tool.name, description: tool.description, parameters: tool.parameters })),
    };
    const completion = await this.provider.complete(completionInput);
    const assistantMessage = await this.prisma.aiMessage.create({ data: { tenantId: actor.tenantId, conversationId: conversation.id, role: 'assistant', format: dto.responseMode, content: completion.text, providerMetaJson: JSON.stringify({ toolCallCount: completion.toolCalls.length }) } });
    let proposal: any;
    const toolCall = completion.toolCalls[0];
    if (toolCall) {
      const tool = this.registry.get(toolCall.name);
      if (tool) {
        this.validateToolArgs(tool, toolCall.arguments);
        proposal = await this.prisma.aiActionProposal.create({ data: { tenantId: actor.tenantId, conversationId: conversation.id, createdByTenantUserId: actor.tenantUserId, toolName: tool.name, argumentsJson: JSON.stringify(toolCall.arguments), status: 'PENDING', summary: `Confirmar ação: ${tool.name}`, expiresAt: new Date(Date.now() + 5 * 60_000) } });
      }
    }
    await this.audit.record({ tenantId: actor.tenantId, actorTenantUserId: actor.tenantUserId, actorUserId: actor.userId, action: 'message.completed', targetId: conversation.id, metadata: { responseMode: dto.responseMode, toolCall: Boolean(proposal) } });
    return { message: userMessage, assistantMessage, proposal };
  }

  async confirmProposal(actor: AiActor, proposalId: string) {
    const proposal = await this.findPendingProposal(actor, proposalId);
    if (proposal.expiresAt <= new Date()) throw new GoneException('A proposta expirou');
    const tool = this.registry.get(proposal.toolName);
    if (!tool) throw new NotFoundException('Ferramenta não disponível');
    const args = JSON.parse(proposal.argumentsJson);
    this.validateToolArgs(tool, args);
    await this.prisma.aiActionProposal.update({ where: { id: proposal.id }, data: { status: 'CONFIRMED' } });
    try {
      const result = await tool.execute({ tenantId: actor.tenantId, actorTenantUserId: actor.tenantUserId, args });
      const saved = await this.prisma.aiActionProposal.update({ where: { id: proposal.id }, data: { status: 'EXECUTED', resultJson: JSON.stringify(result) } });
      await this.audit.record({ tenantId: actor.tenantId, actorTenantUserId: actor.tenantUserId, actorUserId: actor.userId, action: 'proposal.executed', targetId: proposal.id, metadata: { toolName: proposal.toolName } });
      return saved;
    } catch (error) {
      await this.prisma.aiActionProposal.update({ where: { id: proposal.id }, data: { status: 'FAILED' } });
      throw error;
    }
  }

  async cancelProposal(actor: AiActor, proposalId: string) {
    const proposal = await this.findPendingProposal(actor, proposalId);
    const cancelled = await this.prisma.aiActionProposal.update({ where: { id: proposal.id }, data: { status: 'CANCELLED' } });
    await this.audit.record({ tenantId: actor.tenantId, actorTenantUserId: actor.tenantUserId, actorUserId: actor.userId, action: 'proposal.cancelled', targetId: proposal.id });
    return cancelled;
  }

  private async requireConversation(actor: AiActor, conversationId: string) {
    const conversation = await this.prisma.aiConversation.findFirst({ where: { id: conversationId, tenantId: actor.tenantId, ownerTenantUserId: actor.tenantUserId } });
    if (!conversation) throw new ForbiddenException('Conversa não encontrada');
    return conversation;
  }

  private async findPendingProposal(actor: AiActor, proposalId: string) {
    const proposal = await this.prisma.aiActionProposal.findFirst({ where: { id: proposalId, tenantId: actor.tenantId, createdByTenantUserId: actor.tenantUserId, status: 'PENDING' } });
    if (!proposal) throw new ForbiddenException('Proposta não encontrada');
    return proposal;
  }

  private validateToolArgs(tool: AiTool, args: unknown) {
    if (tool.validate) tool.validate(args);
    else if (!args || typeof args !== 'object' || Array.isArray(args)) throw new BadRequestException('Argumentos inválidos');
  }
}
