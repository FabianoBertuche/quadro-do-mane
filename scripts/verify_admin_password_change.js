// scripts/verify_admin_password_change.js (v4)
// Valida o fix do bug mustChangePassword no PATCH /users/:id.
// POST /auth/login devolve um único "tenant" (não array).
// GET /users devolve array com shape {id, userId, ..., user:{id,name,email,...}, role, teamMemberships}.
const http = require('http');

const API = 'http://localhost:3001/api';
const ADMIN_EMAIL = 'admin@quadrodomane.local';
const ADMIN_PASS = 'AlterarNoPrimeiroLogin123!';
const FAB_EMAIL = 'fabiano.bertuche@montemoria.com.br';
const ORIGINAL_FAB_PASS = 'AlterarNoPrimeiroLogin123!';
const TEMP_PASS = 'TempPassword-Test-9876';

function req(method, urlPath, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(API + urlPath);
    const data = body ? Buffer.from(JSON.stringify(body)) : null;
    const opts = {
      hostname: u.hostname,
      port: u.port,
      path: u.pathname + u.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
        ...(data ? { 'Content-Length': data.length } : {}),
      },
    };
    const r = http.request(opts, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let json = null;
        try { json = text ? JSON.parse(text) : null; } catch {}
        resolve({ status: res.statusCode, headers: res.headers, json, text });
      });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

function findFab(arr) {
  return arr.find((u) => {
    const email = u.email || u.user?.email;
    const name = u.name || u.user?.name;
    return /fabiano/i.test(email || '') || /fabiano/i.test(name || '');
  });
}

(async () => {
  console.log('--- 1) login admin ---');
  const login = await req('POST', '/auth/login', { email: ADMIN_EMAIL, password: ADMIN_PASS });
  console.log('  status:', login.status);
  if (login.status >= 400) {
    console.log('  body:', login.text);
    process.exit(1);
  }
  const access = login.json.accessToken;
  const tenantId = login.json.tenant?.id;
  console.log('  tenantId:', tenantId);
  const auth = { Authorization: 'Bearer ' + access, 'X-Tenant-Id': tenantId };

  console.log('--- 2) GET /users ---');
  const list = await req('GET', '/users', null, auth);
  console.log('  status:', list.status);
  const items = Array.isArray(list.json) ? list.json : (list.json?.items || []);
  console.log('  items:', items.length);
  const fab = findFab(items);
  if (!fab) {
    console.log('  Emails vistos:');
    for (const u of items) console.log('   -', u.email || u.user?.email, '/', u.name || u.user?.name);
    process.exit(1);
  }
  const fabEmail = fab.email || fab.user?.email;
  console.log('  Fabiano:', { id: fab.id, email: fabEmail, status: fab.status, mcp: fab.mustChangePassword });

  console.log('--- 3) PATCH /users/:id com nova senha ---');
  const patch = await req('PATCH', `/users/${fab.id}`, { password: TEMP_PASS }, auth);
  console.log('  status:', patch.status);
  console.log('  body:', JSON.stringify(patch.json || patch.text));
  if (patch.status >= 400) {
    console.log('  ❌ PATCH falhou. Bug ainda presente.');
    process.exit(1);
  }

  console.log('--- 4) login com NOVA senha ---');
  const okLogin = await req('POST', '/auth/login', { email: FAB_EMAIL, password: TEMP_PASS });
  console.log('  status:', okLogin.status, '(esperado <400)');

  console.log('--- 5) login com senha ANTIGA ---');
  const oldLogin = await req('POST', '/auth/login', { email: FAB_EMAIL, password: ORIGINAL_FAB_PASS });
  console.log('  status:', oldLogin.status, '(esperado >=400)');

  console.log('--- 6) reverter para senha padrão ---');
  const revert = await req('PATCH', `/users/${fab.id}`, { password: ORIGINAL_FAB_PASS }, auth);
  console.log('  status:', revert.status);

  console.log('--- 7) login com senha padrão ---');
  const finalLogin = await req('POST', '/auth/login', { email: FAB_EMAIL, password: ORIGINAL_FAB_PASS });
  console.log('  status:', finalLogin.status, '(esperado <400)');

  const allOk =
    patch.status < 400 &&
    okLogin.status < 400 &&
    oldLogin.status >= 400 &&
    revert.status < 400 &&
    finalLogin.status < 400;
  console.log('\n=== RESULTADO:', allOk ? '✅ TUDO OK' : '❌ FALHOU', '===');
  if (!allOk) process.exit(2);
})().catch((e) => {
  console.error('Erro:', e);
  process.exit(1);
});
