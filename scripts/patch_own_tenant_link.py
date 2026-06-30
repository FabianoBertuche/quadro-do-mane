import sys

path = 'apps/api/src/modules/users/users.service.ts'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

if 'updateOwnTenantLink' in content:
    print('ALREADY_PATCHED')
    sys.exit(0)

old = """    return {
      ok: true,
      message:
        'Senha alterada com sucesso. Você precisará fazer login novamente em outros dispositivos.',
    };
  }
}"""

new = """    return {
      ok: true,
      message:
        'Senha alterada com sucesso. Você precisará fazer login novamente em outros dispositivos.',
    };
  }

  /**
   * Atualiza os dados do próprio vínculo do usuário com o tenant atual.
   * Não exige users.edit — qualquer usuário pode manter o próprio perfil.
   * Não permite alterar roleId/status/isActive (auto-promoção proibida).
   */
  async updateOwnTenantLink(
    userId: string,
    tenantId: string,
    data: {
      name?: string;
      phone?: string | null;
      avatarUrl?: string | null;
      jobTitle?: string | null;
      department?: string | null;
    },
  ) {
    const tenantUser = await this.prisma.tenantUser.findFirst({
      where: { userId, tenantId },
    });
    if (!tenantUser) {
      throw new NotFoundException(
        'Seu vínculo com este workspace não foi encontrado',
      );
    }

    const userUpdate: Record<string, any> = {};
    if (data.name !== undefined) userUpdate.name = data.name;
    if (data.phone !== undefined) userUpdate.phone = data.phone;
    if (data.avatarUrl !== undefined) userUpdate.avatarUrl = data.avatarUrl;
    if (Object.keys(userUpdate).length > 0) {
      await this.prisma.user.update({
        where: { id: userId },
        data: userUpdate,
      });
    }

    const tenantUserUpdate: Record<string, any> = {};
    if (data.jobTitle !== undefined) tenantUserUpdate.jobTitle = data.jobTitle;
    if (data.department !== undefined) tenantUserUpdate.department = data.department;
    if (Object.keys(tenantUserUpdate).length > 0) {
      await this.prisma.tenantUser.update({
        where: { id: tenantUser.id },
        data: tenantUserUpdate,
      });
    }

    return this.findOwnTenantLink(userId, tenantId);
  }
}"""

if old not in content:
    print('OLD_NOT_FOUND')
    sys.exit(1)

content = content.replace(old, new)
with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print('PATCHED')