import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, name: true, email: true, isActive: true,
      createdAt: true, lastLoginAt: true,
      tenantUsers: {
        select: {
          id: true, roleId: true, isActive: true, status: true,
          mustChangePassword: true, tenant: { select: { name: true, slug: true } },
        },
      },
    },
  });
  for (const u of users) {
    console.log({
      id: u.id,
      email: u.email,
      isActive: u.isActive,
      createdAt: u.createdAt,
      lastLoginAt: u.lastLoginAt,
      links: u.tenantUsers,
    });
  }
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });