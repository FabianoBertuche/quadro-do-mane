// Teste de conexão com Postgres do Render
const { PrismaClient } = require('@prisma/client');
(async () => {
  const p = new PrismaClient({
    datasources: {
      db: {
        url: 'postgresql://admin_kabam:Gv3i3sZOIX8gGyt5OHmP5EaIauBiM9EU@dpg-d91u3iuq1p3s73cimp70-a.ohio-postgres.render.com:5432/kambam?sslmode=require',
      },
    },
  });
  try {
    const r = await p.$queryRaw`SELECT version() as version, current_database() as db`;
    console.log('OK ->', JSON.stringify(r, null, 2));
  } catch (e) {
    console.error('ERR ->', e.message);
  } finally {
    await p.$disconnect();
  }
})();
