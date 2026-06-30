// Reativa o Fabiano (ou qualquer TenantUser) para ACTIVE.
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  const targets = process.argv.slice(2);
  if (targets.length === 0) {
    console.error('uso: node scripts/reactivate_user.js <email> [<email>...]');
    process.exit(1);
  }
  for (const email of targets) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      console.error(`user nao encontrado: ${email}`);
      continue;
    }
    const result = await prisma.tenantUser.updateMany({
      where: { userId: user.id },
      data: {
        isActive: true,
        status: 'ACTIVE',
        disabledAt: null,
        disabledReason: null,
      },
    });
    console.log(`reativado ${email}: ${result.count} vinculo(s) atualizados`);
  }
})()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());