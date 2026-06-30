import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2] || 'fabiano.bertuche@montemoria.com.br';
  const password = process.argv[3] || 'Fabiano2025!';
  console.log('inputs:', { email, password, len: password.length });
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) { console.error('user not found'); process.exit(1); }
  console.log('user found:', user.id, user.isActive);
  console.log('hashPrefix:', user.passwordHash.slice(0, 7), 'hashLen:', user.passwordHash.length);
  console.log('hash check (bcrypt.compare):', await bcrypt.compare(password, user.passwordHash));

  // simula exatamente o que o AuthService.login faz após o hash check
  const tenantUsers = await prisma.tenantUser.findMany({
    where: { userId: user.id, isActive: true, status: { in: ['ACTIVE'] } },
    include: { tenant: true },
  });
  console.log('tenantUsers visíveis para login:', tenantUsers.length);
  for (const tu of tenantUsers) {
    console.log({ tenantId: tu.tenantId, tenantName: tu.tenant.name, isActive: tu.isActive, status: tu.status });
  }
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });