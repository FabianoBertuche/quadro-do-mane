import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface AiIdentityContext {
  name: string;
  address: string;
}

const normalizeName = (name: string) => name
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .replace(/\s+/g, ' ')
  .toLocaleLowerCase('pt-BR');

@Injectable()
export class AiIdentityContextService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(input: { tenantId: string; tenantUserId: string }): Promise<AiIdentityContext> {
    const tenantUser = await this.prisma.tenantUser.findFirst({
      where: { id: input.tenantUserId, tenantId: input.tenantId },
      select: { user: { select: { name: true } } },
    });
    if (!tenantUser) throw new NotFoundException('Usuário autenticado não encontrado');

    const name = tenantUser.user.name;
    const normalized = normalizeName(name);
    const address = normalized === 'emanuel barsotini'
      ? 'pai'
      : normalized === 'alexandre bergamasco'
        ? 'Coronel'
        : name;

    return { name, address };
  }
}
