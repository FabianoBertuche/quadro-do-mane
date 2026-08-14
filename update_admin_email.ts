import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function updateAdmin() {
  try {
    const updated = await prisma.user.updateMany({
      where: { email: 'admin@quadrodomane.local' },
      data: { email: 'admin@montemoria.local' },
    });
    console.log('Usuários atualizados:', updated.count);
    
    // Verificar
    const user = await prisma.user.findUnique({
      where: { email: 'admin@montemoria.local' },
    });
    console.log('Novo email do admin:', user?.email);
  } catch (error) {
    console.error('Erro:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateAdmin();
