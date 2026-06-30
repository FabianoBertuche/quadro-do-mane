import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateRoleDto } from './dto/create-role.dto';

@Injectable()
export class RolesService {
    constructor(private prisma: PrismaService) { }

    async findAll(tenantId: string) {
      return this.prisma.role.findMany({
        where: {
          OR: [{ tenantId }, { tenantId: null }],
        },
        include: {
          _count: { select: { tenantUsers: true } },
        },
        orderBy: { name: 'asc' },
      });
    }

    async create(tenantId: string, dto: CreateRoleDto) {
        const role = await this.prisma.role.create({
            data: {
                tenantId,
                name: dto.name,
            },
        });

        // Basic permissions for new roles: viewing tasks, projects, contacts and using calendar
        const basicPermissionCodes = [
            'tasks.view', 'tasks.create', 'tasks.edit',
            'projects.view',
            'calendar.view', 'calendar.create', 'calendar.edit',
            'contacts.view',
            'email.view'
        ];

        const permissions = await this.prisma.permission.findMany({
            where: { code: { in: basicPermissionCodes } }
        });

        if (permissions.length > 0) {
            await this.prisma.rolePermission.createMany({
                data: permissions.map(p => ({
                    roleId: role.id,
                    permissionId: p.id
                }))
            });
        }

        return role;
    }

    async update(tenantId: string, id: string, name: string) {
        const role = await this.prisma.role.findFirst({ where: { id, tenantId } });
        if (!role) throw new NotFoundException('Função não encontrada');

        return this.prisma.role.update({
            where: { id },
            data: { name },
        });
    }

    async remove(tenantId: string, id: string) {
        const role = await this.prisma.role.findFirst({ where: { id, tenantId } });
        if (!role) throw new NotFoundException('Função não encontrada');

        return this.prisma.role.delete({
            where: { id },
        });
    }
}
