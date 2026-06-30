// Reseta a senha de um usuario e limpa mustChangePassword em TODOS os vinculos.
// Uso: node scripts/reset_password.js <email> <nova_senha>
const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const ROUNDS = Number(process.env.BCRYPT_ROUNDS) || 12;

(async () => {
  const [email, newPassword] = process.argv.slice(2);
  if (!email || !newPassword) {
    console.error('uso: node scripts/reset_password.js <email> <nova_senha>');
    process.exit(1);
  }
  if (newPassword.length < 6) {
    console.error('senha precisa ter pelo menos 6 caracteres');
    process.exit(1);
  }
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`user nao encontrado: ${email}`);
    process.exit(1);
  }
  const hash = await bcrypt.hash(newPassword, ROUNDS);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: hash },
  });
  const tu = await prisma.tenantUser.updateMany({
    where: { userId: user.id },
    data: {
      mustChangePassword: false,
      isActive: true,
      status: 'ACTIVE',
      disabledAt: null,
      disabledReason: null,
    },
  });
  console.log(`OK: senha resetada para ${email}; ${tu.count} vinculo(s) atualizados para ACTIVE.`);
})()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());