import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ContactsService } from './contacts.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { TenantContextGuard } from '../../common/guards/tenant-context.guard';

@ApiTags('Contacts')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), TenantContextGuard, PermissionGuard)
@Controller('contacts')
export class ContactsController {
  constructor(private contactsService: ContactsService) {}

  @Get()
  @RequirePermissions('contacts.view')
  findAll(@CurrentUser('tenantId') tenantId: string, @Query('search') search?: string) {
    return this.contactsService.findAll(tenantId, search);
  }

  @Get(':id')
  @RequirePermissions('contacts.view')
  findOne(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.contactsService.findOne(tenantId, id);
  }

  @Post()
  @RequirePermissions('contacts.create')
  create(@CurrentUser('tenantId') tenantId: string, @Body() dto: CreateContactDto) {
    return this.contactsService.create(tenantId, dto);
  }

  @Patch(':id')
  @RequirePermissions('contacts.edit')
  update(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string, @Body() dto: UpdateContactDto) {
    return this.contactsService.update(tenantId, id, dto);
  }

  @Delete(':id')
  @RequirePermissions('contacts.delete')
  remove(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.contactsService.remove(tenantId, id);
  }
}
