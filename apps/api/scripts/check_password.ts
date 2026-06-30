import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2];
  const password = process.argv[3];
  if (!email || !password) {
    console.error('Uso: npx ts-node scripts/check_password.ts <email> <senha>');
    process.exit(1);
  }
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error('Usuário não encontrado.');
    process.exit(2);
  }
  console.log({
    id: user.id,
    name: user.name,
    email: user.email,
    isActive: user.isActive,
    hashPrefix: user.passwordHash.slice(0, 7),
    hashLen: user.passwordHash.length,
  });
  const ok = await bcrypt.compare(password, user.passwordHash);
  console.log('bcrypt.compare =>', ok);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});