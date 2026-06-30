import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

@Injectable()
export class ProjectsService {
  constructor(private prisma: PrismaService) { }

  /**
   * Lista os projetos visíveis ao usuário no tenant atual.
   * Admin e gestor enxergam TODOS os projetos do tenant (visão operacional).
   * Colaborador e convidado enxergam apenas projetos onde têm vínculo direto:
   * owner, membro de equipe, membro do projeto ou tarefa atribuída.
   */
  async findAll(tenantId: string, actorTenantUserId?: string, actorRoleName?: string | null) {
    const isBroadViewer = actorRoleName === 'admin' || actorRoleName === 'gestor';

    return this.prisma.project.findMany({
      where: {
        tenantId,
        archivedAt: null,
        ...(isBroadViewer || !actorTenantUserId
          ? {}
          : {
              OR: [
                { ownerTenantUserId: actorTenantUserId },
                { team: { members: { some: { tenantUserId: actorTenantUserId } } } },
                { members: { some: { tenantUserId: actorTenantUserId } } },
                { tasks: { some: { assigneeTenantUserId: actorTenantUserId, archivedAt: null } } },
              ],
            }),
      },
      include: {
        owner: { include: { user: { select: { name: true, avatarUrl: true } } } },
        team: { select: { id: true, name: true, color: true } },
        _count: { select: { tasks: true, members: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const project = await this.prisma.project.findFirst({
      where: { id, tenantId },
      include: {
        owner: { include: { user: { select: { name: true, email: true, avatarUrl: true } } } },
        team: true,
        members: { include: { tenantUser: { include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } } } } },
        views: true,
        _count: { select: { tasks: true } },
      },
    });
    if (!project) throw new NotFoundException('Projeto não encontrado');
    return project;
  }

  async create(tenantId: string, dto: CreateProjectDto) {
    const { startDate, dueDate, ...rest } = dto;
    return this.prisma.project.create({
      data: {
        tenantId,
        ...rest,
        ...(startDate && { startDate: new Date(startDate) }),
        ...(dueDate && { dueDate: new Date(dueDate) }),
      } as any,
    });
  }

  async update(tenantId: string, id: string, dto: UpdateProjectDto) {
    await this.findOne(tenantId, id);
    const { startDate, dueDate, ...rest } = dto;
    return this.prisma.project.update({
      where: { id },
      data: {
        ...rest,
        ...(startDate !== undefined && { startDate: new Date(startDate) }),
        ...(dueDate !== undefined && { dueDate: new Date(dueDate) }),
      } as any,
    });
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    return this.prisma.project.update({
      where: { id },
      data: { archivedAt: new Date() },
    });
  }

  async addMember(tenantId: string, projectId: string, tenantUserId: string, roleInProject?: string) {
    return this.prisma.projectMember.create({
      data: { tenantId, projectId, tenantUserId, roleInProject },
    });
  }

  async removeMember(tenantId: string, projectId: string, tenantUserId: string) {
    const member = await this.prisma.projectMember.findFirst({
      where: { projectId, tenantUserId, tenantId },
    });
    if (!member) throw new NotFoundException('Membro não encontrado');
    return this.prisma.projectMember.delete({ where: { id: member.id } });
  }
}
