// Verifica estado atual do usuario e tenta login.
const http = require('http');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function req(method, path, { token, body } = {}) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (data) headers['Content-Length'] = Buffer.byteLength(data);
    const r = http.request(
      { hostname: 'localhost', port: 3001, path: `/api${path}`, method, headers },
      (res) => {
        let chunks = '';
        res.on('data', (d) => (chunks += d));
        res.on('end', () => {
          let parsed = chunks;
          try { parsed = JSON.parse(chunks); } catch (_) {}
          resolve({ status: res.statusCode, body: parsed });
        });
      },
    );
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

(async () => {
  const email = 'fabiano.bertuche@montemoria.com.br';
  console.log('== ESTADO NO BANCO ==');
  const u = await prisma.user.findUnique({
    where: { email },
    include: { tenantUsers: true },
  });
  console.log({
    name: u.name,
    email: u.email,
    isActive: u.isActive,
    tenantUsers: u.tenantUsers.map(tu => ({
      tenantId: tu.tenantId,
      isActive: tu.isActive,
      status: tu.status,
      roleId: tu.roleId,
    })),
  });

  console.log('\n== TENTATIVA DE LOGIN ==');
  const login = await req('POST', '/auth/login', { body: { email, password: 'AlterarNoPrimeiroLogin123!' } });
  console.log('status:', login.status);
  if (login.body.tenants) {
    console.log('tenants:', login.body.tenants);
  } else {
    console.log('body:', login.body);
  }
})()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());