// Diagnostico: lista TODOS os usuarios e seus tenant_users para entender
// por que o colaborador "sumiu" da listagem.
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  console.log('== TODOS OS USERS ==');
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      isActive: true,
      createdAt: true,
      passwordHash: true,
    },
    orderBy: { createdAt: 'asc' },
  });
  for (const u of users) {
    console.log({
      id: u.id,
      name: u.name,
      email: u.email,
      isActive: u.isActive,
      createdAt: u.createdAt,
      hasPassword: !!u.passwordHash,
    });
  }

  console.log('\n== TODOS OS TENANT_USERS ==');
  const tenantUsers = await prisma.tenantUser.findMany({
    include: { user: { select: { email: true, name: true } } },
    orderBy: { createdAt: 'asc' },
  });
  for (const tu of tenantUsers) {
    console.log({
      id: tu.id,
      userId: tu.userId,
      email: tu.user?.email,
      name: tu.user?.name,
      tenantId: tu.tenantId,
      isActive: tu.isActive,
      status: tu.status,
      mustChangePassword: tu.mustChangePassword,
      createdAt: tu.createdAt,
      roleId: tu.roleId,
    });
  }

  console.log('\n== TENANTS ==');
  const tenants = await prisma.tenant.findMany({
    select: { id: true, name: true, slug: true },
  });
  console.log(tenants);
})()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());