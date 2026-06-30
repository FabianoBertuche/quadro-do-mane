import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';

@Injectable()
export class TeamsService {
  constructor(private prisma: PrismaService) {}

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

  async update(tenantId: string, id: string, dto: UpdateTeamDto) {
    await this.findOne(tenantId, id);
    return this.prisma.team.update({
      where: { id },
      data: dto,
    });
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    return this.prisma.team.delete({ where: { id } });
  }

  async addMember(tenantId: string, teamId: string, tenantUserId: string) {
    return this.prisma.teamMember.create({
      data: { tenantId, teamId, tenantUserId },
    });
  }

  async removeMember(tenantId: string, teamId: string, tenantUserId: string) {
    const member = await this.prisma.teamMember.findFirst({
      where: { teamId, tenantUserId, tenantId },
    });
    if (!member) throw new NotFoundException('Membro não encontrado');
    return this.prisma.teamMember.delete({ where: { id: member.id } });
  }
}
