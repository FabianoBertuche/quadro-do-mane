import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const rows: any[] = await prisma.$queryRaw`
    SELECT
      tu.id::text         AS tenant_user_id,
      u.email,
      t.name              AS tenant,
      tu.role_id,
      tu.is_active,
      tu.status::text,
      tu.must_change_password,
      tu.disabled_at
    FROM tenant_users tu
    JOIN users u ON u.id = tu.user_id
    JOIN tenants t ON t.id = tu.tenant_id
    WHERE u.email = 'fabiano.bertuche@montemoria.com.br'
  `;
  console.log(JSON.stringify(rows, null, 2));
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});