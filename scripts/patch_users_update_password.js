// scripts/patch_users_update_password.js
// Corrige users.service.ts: mustChangePassword vive em TenantUser, não em User.
// Quando admin troca a senha via PATCH /users/:id, precisamos setar
// mustChangePassword=false em TenantUser (não em User), evitando
// PrismaClientValidationError em prisma.user.update.
//
// Estratégia: o arquivo alvo tem CRLF (Windows). Vamos normalizar tudo para LF
// antes de comparar/substituir, e gravar de volta com CRLF para preservar o
// estilo do projeto.
const fs = require('fs');
const path = require('path');

const target = path.join(__dirname, '..', 'apps', 'api', 'src', 'modules', 'users', 'users.service.ts');
const raw = fs.readFileSync(target, 'utf8');
const isCrlf = raw.includes('\r\n');
const nl = isCrlf ? '\r\n' : '\n';
const original = raw.replace(/\r\n/g, '\n');

// 1ª etapa: substituir o bloco de userPatch (remover mustChangePassword e
// guardar flag passwordChanged para usar em tenantPatch).
const searchBlock = `    if (typeof dto.password === 'string' && dto.password.length >= 6) {
      userPatch.passwordHash = await bcrypt.hash(dto.password, this.bcryptRounds);
      userPatch.mustChangePassword = false;
    }

    if (Object.keys(userPatch).length > 0) {
      await this.prisma.user.update({
        where: { id: tenantUser.userId },
        data: userPatch,
      });
    }

    const tenantPatch: Record<string, any> = {};
    if (dto.jobTitle !== undefined) tenantPatch.jobTitle = dto.jobTitle;
    if (dto.department !== undefined) tenantPatch.department = dto.department;
    if (dto.roleId !== undefined) {`;

const replaceBlock = `    let passwordChanged = false;
    if (typeof dto.password === 'string' && dto.password.length >= 6) {
      userPatch.passwordHash = await bcrypt.hash(dto.password, this.bcryptRounds);
      // mustChangePassword vive em TenantUser, não em User. Marcamos para
      // setar abaixo em tenantPatch. Isso evita PrismaClientValidationError
      // ao chamar prisma.user.update.
      passwordChanged = true;
    }

    if (Object.keys(userPatch).length > 0) {
      await this.prisma.user.update({
        where: { id: tenantUser.userId },
        data: userPatch,
      });
    }

    const tenantPatch: Record<string, any> = {};
    if (dto.jobTitle !== undefined) tenantPatch.jobTitle = dto.jobTitle;
    if (dto.department !== undefined) tenantPatch.department = dto.department;
    if (dto.roleId !== undefined) {`;

if (!original.includes(searchBlock)) {
  console.error('[patch_users_update_password] bloco principal não encontrado. Nada alterado.');
  process.exit(1);
}

let updated = original.replace(searchBlock, replaceBlock);

// 2ª etapa: adicionar passwordChanged -> tenantPatch.mustChangePassword = false
const tenantAnchor = `    if (dto.jobTitle !== undefined) tenantPatch.jobTitle = dto.jobTitle;
    if (dto.department !== undefined) tenantPatch.department = dto.department;`;
const tenantReplace = `    if (dto.jobTitle !== undefined) tenantPatch.jobTitle = dto.jobTitle;
    if (dto.department !== undefined) tenantPatch.department = dto.department;
    if (passwordChanged) tenantPatch.mustChangePassword = false;`;

if (!updated.includes(tenantAnchor)) {
  console.error('[patch_users_update_password] âncora de tenantPatch não encontrada.');
  process.exit(1);
}
updated = updated.replace(tenantAnchor, tenantReplace);

// 3ª etapa: propagar passwordChanged no audit metadata
const auditAnchor = `        userFields: Object.keys(userPatch),
        tenantFields: Object.keys(tenantPatch),`;
const auditReplace = `        userFields: Object.keys(userPatch),
        tenantFields: Object.keys(tenantPatch),
        passwordChanged,`;

if (!updated.includes(auditAnchor)) {
  console.error('[patch_users_update_password] âncora de audit não encontrada.');
  process.exit(1);
}
updated = updated.replace(auditAnchor, auditReplace);

fs.writeFileSync(target, isCrlf ? updated.replace(/\n/g, '\r\n') : updated, 'utf8');
console.log('[patch_users_update_password] patch aplicado em', target);
console.log('  isCrlf original:', isCrlf);
