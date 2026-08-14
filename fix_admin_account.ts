import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const email = 'admin@montemoria.com.br';
  const password = 'AlterarNoPrimeiroLogin123!';
  const hashed = await bcrypt.hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      name: 'Administrador',
      passwordHash: hashed,
      isActive: true,
    },
    create: {
      name: 'Administrador',
      email,
      passwordHash: hashed,
      isActive: true,
    },
  });

  const tenant = await prisma.tenant.findFirst();
  if (!tenant) throw new Error('Nenhum tenant encontrado');

  const tenantUser = await prisma.tenantUser.upsert({
    where: { tenantId_userId: { tenantId: tenant.id, userId: user.id } },
    update: { roleId: 'admin', isActive: true, status: 'ACTIVE' },
    create: {
      tenantId: tenant.id,
      userId: user.id,
      roleId: 'admin',
      jobTitle: 'Administrador do Sistema',
      department: 'TI',
      isActive: true,
      status: 'ACTIVE',
    },
  });

  console.log('Usuário admin corrigido:', { email, roleId: tenantUser.roleId });
}

main().finally(() => prisma.$disconnect());
