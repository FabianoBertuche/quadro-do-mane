import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesService } from './roles.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { TenantContextGuard } from '../../common/guards/tenant-context.guard';
import { CreateRoleDto } from './dto/create-role.dto';

@UseGuards(AuthGuard('jwt'), TenantContextGuard, PermissionGuard)
@Controller('roles')
export class RolesController {
    constructor(private rolesService: RolesService) { }

    @Get()
    @RequirePermissions('settings.view')
    findAll(@CurrentUser('tenantId') tenantId: string) {
        return this.rolesService.findAll(tenantId);
    }

    @Post()
    @RequirePermissions('settings.manage')
    create(@CurrentUser('tenantId') tenantId: string, @Body() dto: CreateRoleDto) {
        return this.rolesService.create(tenantId, dto);
    }

    @Patch(':id')
    @RequirePermissions('settings.manage')
    update(
        @CurrentUser('tenantId') tenantId: string,
        @Param('id') id: string,
        @Body('name') name: string,
    ) {
        return this.rolesService.update(tenantId, id, name);
    }

    @Delete(':id')
    @RequirePermissions('settings.manage')
    remove(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
        return this.rolesService.remove(tenantId, id);
    }
}
