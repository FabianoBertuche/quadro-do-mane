// scripts/e2e_emails_flow.js
// Simula o fluxo do browser pelo proxy Next (3000):
//  1) login via /api/auth/login no Next
//  2) extrai Set-Cookie (qd_refresh, qd_access)
//  3) chama /api/auth/refresh
//  4) usa o accessToken no header para /api/emails/settings
//  5) verifica se a página /emails do Next responde 200 (HTML) com o userEmail
const http = require('http');

const PORT = 3000;
const HOST = 'localhost';

function parseSetCookies(res) {
  const sc = res.headers['set-cookie'] || [];
  return sc.map((c) => c.split(';')[0]);
}

function joinCookies(...arrs) {
  return arrs.flat().filter(Boolean).join('; ');
}

function req(method, urlPath, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(`http://${HOST}:${PORT}` + urlPath);
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

(async () => {
  console.log('--- 1) login via Next proxy ---');
  const login = await req('POST', '/api/auth/login', {
    email: 'admin@quadrodomane.local',
    password: 'AlterarNoPrimeiroLogin123!',
  });
  console.log('  status:', login.status);
  if (login.status >= 400) {
    console.log('  body:', login.text);
    process.exit(1);
  }
  const cookies = parseSetCookies(login);
  console.log('  cookies:', cookies);
  let cookieHeader = joinCookies(cookies);

  console.log('--- 2) /auth/me com cookies ---');
  const me = await req('GET', '/api/auth/me', null, { Cookie: cookieHeader });
  console.log('  status:', me.status, me.json ? 'tenant=' + me.json?.tenant?.id : '');

  console.log('--- 3) /emails/settings com accessToken ---');
  const tk = login.json.accessToken;
  const set = await req('GET', '/api/emails/settings', null, {
    Authorization: 'Bearer ' + tk,
    Cookie: cookieHeader,
  });
  console.log('  status:', set.status);
  console.log('  body:', JSON.stringify(set.json || set.text).substring(0, 250));

  console.log('--- 4) página /emails do Next ---');
  const page = await req('GET', '/emails', null, { Cookie: cookieHeader });
  console.log('  status:', page.status);
  // Verifica se a página tem elementos esperados
  const ok = page.text.includes('E-mail') && page.text.length > 1000;
  console.log('  page ok:', ok, 'bytes:', page.text.length);

  console.log('--- 5) /profile (com EmailPasswordCard) ---');
  const profile = await req('GET', '/profile', null, { Cookie: cookieHeader });
  console.log('  status:', profile.status, 'bytes:', profile.text.length);
  const hasEmailCard = profile.text.includes('Configurações de E-mail');
  console.log('  tem EmailPasswordCard:', hasEmailCard);

  console.log('\n=== RESULTADO: ', set.status === 200 && page.status === 200 && hasEmailCard ? '✅ TUDO OK' : '❌ FALHOU', '===');
  if (set.status !== 200 || page.status !== 200 || !hasEmailCard) process.exit(2);
})().catch((e) => {
  console.error('Erro:', e);
  process.exit(1);
});
