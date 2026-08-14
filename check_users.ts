import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkUsers() {
  try {
    const users = await prisma.user.findMany({ take: 5 });
    console.log('Total usuários encontrados:', users.length);
    users.forEach(u => console.log(`Email: ${u.email}, Nome: ${u.name}`));
  } catch (error) {
    console.error('Erro:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUsers();
