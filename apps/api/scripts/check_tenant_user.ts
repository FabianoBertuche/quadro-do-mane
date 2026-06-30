import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2];
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error('Usuário não encontrado.');
    process.exit(2);
  }
  const links = await prisma.tenantUser.findMany({
    where: { userId: user.id },
    include: { tenant: true, role: true },
  });
  console.log('TenantUsers:');
  for (const tu of links) {
    console.log({
      tenantUserId: tu.id,
      tenantId: tu.tenantId,
      tenantName: tu.tenant.name,
      roleId: tu.roleId,
      roleName: tu.role?.name,
      isActive: tu.isActive,
      status: tu.status,
      mustChangePassword: tu.mustChangePassword,
      disabledAt: tu.disabledAt,
    });
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});