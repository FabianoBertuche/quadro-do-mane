import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    where: { email: { in: ['admin@montemoria.local', 'admin@montemoria.com.br'] } },
    include: { tenantUsers: true },
  });

  console.log(JSON.stringify(users, null, 2));
}

main().finally(() => prisma.$disconnect());
