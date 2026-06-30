// e2e_fab_profile.js — valida que o /profile do Next tem o card
// de Configurações de E-mail no bundle JS.
const http = require('http');

function req(method, urlPath, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL('http://localhost:3000' + urlPath);
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
  const lg = await req('POST', '/api/auth/login', {
    email: 'admin@quadrodomane.local',
    password: 'AlterarNoPrimeiroLogin123!',
  });
  const setCookie = (lg.headers['set-cookie'] || []).map((c) => c.split(';')[0]).join('; ');
  const tk = lg.json.accessToken;
  // 1) HTML server-side
  const page = await req('GET', '/profile', null, {
    Cookie: setCookie,
    Authorization: 'Bearer ' + tk,
  });
  console.log('HTML status:', page.status, 'len:', page.text.length);
  const checks = ['Configurações de E-mail', 'EmailPasswordCard', 'Meu Perfil', 'Segurança', 'salvar senha', 'Salvar Senha', 'Configurações de E-mail', 'Sua conta IMAP'];
  for (const c of checks) console.log('  tem "' + c + '":', page.text.toLowerCase().includes(c.toLowerCase()));

  // 2) Se o HTML não tiver, vamos buscar no bundle JS
  const m = page.text.match(/src="(\/_next\/static\/chunks\/[^"]*profile[^"]*\.js)"/) || page.text.match(/src="(\/_next\/static\/chunks\/app\/_app[^"]*\.js)"/);
  if (m) {
    console.log('Bundle referenciado:', m[1]);
  } else {
    // pega todos os .js referenciados
    const links = [...page.text.matchAll(/src="(\/_next\/static\/chunks\/[^"]+\.js)"/g)].map((x) => x[1]);
    console.log('Bundles:', links.slice(0, 10));
    let hasIt = false;
    for (const link of links) {
      const r = await req('GET', link, null, { Cookie: setCookie });
      if (r.text.toLowerCase().includes('configurações de e-mail')) {
        hasIt = true;
        console.log('  ✅ texto encontrado em', link);
        break;
      }
    }
    if (!hasIt) console.log('  ❌ texto NÃO encontrado em nenhum bundle');
  }
})();
