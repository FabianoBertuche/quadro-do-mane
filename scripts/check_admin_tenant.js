// Verifica se o admin@quadrodomane.local possui TenantUser ativo e quantos tenants
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const u = await prisma.user.findUnique({ where: { email: 'admin@quadrodomane.local' } });
  console.log('user:', u && { id: u.id, isActive: u.isActive, mustChangePassword: u.mustChangePassword });
  const links = await prisma.tenantUser.findMany({
    where: { userId: u?.id },
    include: { tenant: true },
  });
  console.log('tenantUsers:', links.map((l) => ({
    tenantUserId: l.id,
    tenantId: l.tenantId,
    tenantSlug: l.tenant?.slug,
    roleId: l.roleId,
    isActive: l.isActive,
    status: l.status,
  })));
  await prisma.$disconnect();
})();
