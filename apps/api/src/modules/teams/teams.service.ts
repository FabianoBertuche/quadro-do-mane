import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationDispatcherService } from '../notifications/notification-dispatcher.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';

@Injectable()
export class TeamsService {
  constructor(
    private prisma: PrismaService,
    private dispatcher: NotificationDispatcherService,
  ) {}

  async findAll(tenantId: string) {
    return this.prisma.team.findMany({
      where: { tenantId },
      include: {
        manager: { include: { user: { select: { name: true, email: true, avatarUrl: true } } } },
        members: { include: { tenantUser: { include: { user: { select: { name: true, avatarUrl: true } } } } } },
        _count: { select: { members: true, projects: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const team = await this.prisma.team.findFirst({
      where: { id, tenantId },
      include: {
        manager: { include: { user: { select: { name: true, email: true, avatarUrl: true } } } },
        members: { include: { tenantUser: { include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } } } } },
      },
    });
    if (!team) throw new NotFoundException('Equipe não encontrada');
    return team;
  }

  async create(tenantId: string, dto: CreateTeamDto) {
    return this.prisma.team.create({
      data: { tenantId, ...dto },
    });
  }

  async update(tenantId: string, id: string, dto: UpdateTeamDto, actorTenantUserId?: string) {
    const previous = await this.findOne(tenantId, id);
    const updated = await this.prisma.team.update({
      where: { id },
      data: dto,
    });
    if (dto.managerTenantUserId !== undefined && dto.managerTenantUserId !== previous.managerTenantUserId) {
      const recipients = new Set<string>([
        updated.managerTenantUserId,
        ...(previous.members ?? []).map((member: { tenantUserId: string }) => member.tenantUserId),
      ].filter((value): value is string => Boolean(value)));
      if (actorTenantUserId) recipients.delete(actorTenantUserId);
      await Promise.all([...recipients].map((tenantUserId) => this.dispatcher.dispatch({
        tenantId,
        tenantUserId,
        category: 'PROJECTS_TEAMS' as any,
        type: 'team_manager_changed',
        title: 'Gestor da equipe alterado',
        message: updated.name,
        payload: { teamId: id, route: `/team/${id}` },
        entityType: 'team',
        entityId: id,
        occurrenceKey: `update:${updated.updatedAt.toISOString()}`,
      })));
    }
    return updated;
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    return this.prisma.team.delete({ where: { id } });
  }

  async addMember(tenantId: string, teamId: string, tenantUserId: string, actorTenantUserId?: string) {
    const membership = await this.prisma.teamMember.create({
      data: { tenantId, teamId, tenantUserId },
    });
    if (tenantUserId !== actorTenantUserId) {
      await this.dispatcher.dispatch({
        tenantId,
        tenantUserId,
        category: 'PROJECTS_TEAMS' as any,
        type: 'team_member_added',
        title: 'Você foi adicionado a uma equipe',
        message: 'Você agora participa desta equipe',
        payload: { teamId, route: `/team/${teamId}` },
        entityType: 'team',
        entityId: teamId,
        occurrenceKey: `membership:${membership.createdAt.toISOString()}`,
      });
    }
    return membership;
  }

  async removeMember(tenantId: string, teamId: string, tenantUserId: string) {
    const member = await this.prisma.teamMember.findFirst({
      where: { teamId, tenantUserId, tenantId },
    });
    if (!member) throw new NotFoundException('Membro não encontrado');
    return this.prisma.teamMember.delete({ where: { id: member.id } });
  }
}
