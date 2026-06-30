// Bateria de testes do fluxo de e-mail via API.
const http = require('http');

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

function show(label, r) {
  console.log(`\n== ${label} ==`);
  console.log('status:', r.status);
  const s = JSON.stringify(r.body, null, 2);
  console.log(s.length > 1200 ? s.slice(0, 1200) + '\n... (truncado)' : s);
}

(async () => {
  show('LOGIN', await req('POST', '/auth/login', {
    body: { email: 'admin@quadrodomane.local', password: 'AlterarNoPrimeiroLogin123!' },
  }));
  const tok = (
    await req('POST', '/auth/login', {
      body: { email: 'admin@quadrodomane.local', password: 'AlterarNoPrimeiroLogin123!' },
    })
  ).body.accessToken;

  show('GET /email/tenant-settings (vazio)', await req('GET', '/email/tenant-settings', { token: tok }));
  show('GET /email/domain-presets', await req('GET', '/email/domain-presets', { token: tok }));

  show('PATCH /email/tenant-settings (montemoria)', await req('PATCH', '/email/tenant-settings', {
    token: tok,
    body: {
      emailDomain: 'montemoria.com.br',
      detectionMode: 'PRESET',
      presetKey: 'montemoria',
      imapHost: 'mail.montemoria.com.br',
      imapPort: 993,
      imapSecure: true,
      smtpHost: 'mail.montemoria.com.br',
      smtpPort: 465,
      smtpSecure: true,
    },
  }));

  show('GET /email/tenant-settings (preenchido)', await req('GET', '/email/tenant-settings', { token: tok }));
  show('GET /emails/settings (snapshot)', await req('GET', '/emails/settings', { token: tok }));

  show('PATCH /emails/password (imap)', await req('PATCH', '/emails/password', {
    token: tok,
    body: { protocol: 'imap', password: 'fake-password-for-test' },
  }));

  show('PATCH /emails/password (smtp)', await req('PATCH', '/emails/password', {
    token: tok,
    body: { protocol: 'smtp', password: 'fake-password-for-test' },
  }));

  show('GET /emails/settings (apos pwd)', await req('GET', '/emails/settings', { token: tok }));

  console.log('\n== GET /emails/messages (espera falha IMAP) ==');
  const msgs = await req('GET', '/emails/messages', { token: tok });
  console.log('status:', msgs.status);
  console.log(JSON.stringify(msgs.body).slice(0, 600));

  console.log('\n== POST /emails/test-connection ==');
  const tc = await req('POST', '/emails/test-connection', { token: tok, body: { password: 'fake-password-for-test' } });
  console.log('status:', tc.status);
  console.log(JSON.stringify(tc.body, null, 2));
})().catch((e) => { console.error(e); process.exit(1); });