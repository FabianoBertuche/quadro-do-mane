const fs = require('fs');
const path = 'apps/web/src/app/(app)/settings/page.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1) Adicionar import
const importNeedle = "import { Modal } from '@/components/ui/Modal';";
const importReplacement =
  "import { Modal } from '@/components/ui/Modal';\n" +
  "import { TenantEmailAdminCard } from '@/components/emails/TenantEmailAdminCard';";
if (!content.includes(importNeedle)) {
  console.error('IMPORT_NEEDLE_NOT_FOUND');
  process.exit(1);
}
if (!content.includes('TenantEmailAdminCard')) {
  content = content.replace(importNeedle, importReplacement);
}

// 2) Inserir card antes da seção "Notifications preferences" (só para admin)
const sectionNeedle =
  '      {/* Notifications preferences */}\n' +
  '      <div className="p-6 rounded-2xl bg-card border border-border shadow-sm">\n' +
  '        <div className="flex items-center gap-2 mb-4">\n' +
  '          <Bell className="w-5 h-5 text-primary" />\n' +
  '          <h2 className="font-semibold">Notificações</h2>';
const sectionReplacement =
  '      {/* Tenant email server (admin only) */}\n' +
  '      {role === "admin" && (\n' +
  '        <TenantEmailAdminCard />\n' +
  '      )}\n\n' +
  '      {/* Notifications preferences */}\n' +
  '      <div className="p-6 rounded-2xl bg-card border border-border shadow-sm">\n' +
  '        <div className="flex items-center gap-2 mb-4">\n' +
  '          <Bell className="w-5 h-5 text-primary" />\n' +
  '          <h2 className="font-semibold">Notificações</h2>';
if (!content.includes(sectionNeedle)) {
  console.error('SECTION_NEEDLE_NOT_FOUND');
  process.exit(1);
}
if (!content.includes('Tenant email server (admin only)')) {
  content = content.replace(sectionNeedle, sectionReplacement);
}

fs.writeFileSync(path, content, 'utf8');
console.log('OK');