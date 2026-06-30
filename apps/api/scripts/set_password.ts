import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const ROUNDS = Number(process.env.BCRYPT_ROUNDS) || 12;

async function main() {
  const email = process.argv[2];
  const newPassword = process.argv[3];
  if (!email || !newPassword) {
    console.error('Uso: npx ts-node scripts/set_password.ts <email> <nova_senha>');
    process.exit(1);
  }
  if (newPassword.length < 6) {
    console.error('Senha precisa ter no mínimo 6 caracteres.');
    process.exit(2);
  }
  const hash = await bcrypt.hash(newPassword, ROUNDS);
  const user = await prisma.user.update({
    where: { email },
    data: { passwordHash: hash } as any,
    select: { id: true, name: true, email: true, isActive: true },
  });
  console.log('OK: senha atualizada para', user.email);
  await prisma.refreshToken.updateMany({
    where: { userId: user.id, isRevoked: false },
    data: { isRevoked: true },
  });
  console.log('Refresh tokens ativos revogados. Faça login novamente.');
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('ERRO:', e);
  process.exit(1);
});