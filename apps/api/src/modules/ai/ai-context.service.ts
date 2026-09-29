import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface AiContextItem {
  id: string;
  title: string;
  projectId?: string | null;
  [key: string]: unknown;
}

export interface AiContext {
  project: Record<string, unknown> | null;
  items: AiContextItem[];
  summary: string;
}

@Injectable()
export class AiContextService {
  constructor(private readonly prisma: PrismaService) {}

  async buildContext(input: {
    tenantId: string;
    actorTenantUserId: string;
    projectId?: string;
    query: string;
  }): Promise<AiContext> {
    const visibility = {
      OR: [
        { ownerTenantUserId: input.actorTenantUserId },
        { members: { some: { tenantUserId: input.actorTenantUserId } } },
        { team: { members: { some: { tenantUserId: input.actorTenantUserId } } } },
        { tasks: { some: { assigneeTenantUserId: input.actorTenantUserId, archivedAt: null } } },
      ],
    };
    let project: Record<string, unknown> | null = null;

    if (input.projectId) {
      project = await this.prisma.project.findFirst({
        where: { id: input.projectId, tenantId: input.tenantId, archivedAt: null, ...visibility },
        select: { id: true, name: true, description: true },
      });
      if (!project) {
        return { project: null, items: [], summary: 'Nenhum resultado: projeto sem acesso ou inexistente.' };
      }
    }

    const search = input.query.trim();
    const tasks = await this.prisma.task.findMany({
      where: {
        tenantId: input.tenantId,
        archivedAt: null,
        ...(input.projectId ? { projectId: input.projectId } : {}),
        ...(search ? { OR: [{ title: { contains: search, mode: 'insensitive' } }, { description: { contains: search, mode: 'insensitive' } }] } : {}),
        project: visibility,
      },
      select: { id: true, title: true, description: true, projectId: true, statusId: true, dueDate: true },
      orderBy: { updatedAt: 'desc' },
      take: 30,
    });
    const items = tasks as AiContextItem[];
    return {
      project,
      items,
      summary: project || items.length ? `Projeto: ${project?.name ?? 'global'}; itens: ${items.length}.` : 'Nenhum resultado acessível para a consulta.',
    };
  }
}
