// Patch simples: insere permissoes email.view e email.admin no seed
const fs = require('fs');
const path = 'apps/api/prisma/seed.ts';
let content = fs.readFileSync(path, 'utf8');
const needle = "    { code: 'audit.view', name: 'Ver Auditoria', module: 'audit' },\n  ];";
const replacement =
  "    { code: 'audit.view', name: 'Ver Auditoria', module: 'audit' },\n" +
  "    { code: 'email.view', name: 'Usar E-mail', module: 'email' },\n" +
  "    { code: 'email.admin', name: 'Configurar Servidor de E-mail', module: 'email' },\n" +
  '  ];';
if (!content.includes(needle)) {
  console.error('PATTERN_NOT_FOUND');
  process.exit(1);
}
if (content.includes("code: 'email.view'")) {
  console.log('ALREADY_PATCHED');
  process.exit(0);
}
content = content.replace(needle, replacement);
fs.writeFileSync(path, content, 'utf8');
console.log('OK');