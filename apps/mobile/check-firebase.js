const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'google-services.json');
if (!fs.existsSync(file)) {
  console.error('❌ google-services.json NÃO existe ainda.');
  console.log('   Coloque o arquivo em: apps/mobile/google-services.json');
  console.log('   (Baixe do Firebase Console → app Android com package com.quadrodomane.app)');
  process.exit(1);
}

try {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const client = data.client && data.client[0];
  const pkg = data.project_info;
  const androidClient = data.client && data.client.find(c => c.client_info && c.client_info.android_client_info);
  const androidPkg = androidClient && androidClient.client_info.android_client_info.package_name;

  console.log('✅ google-services.json encontrado');
  console.log(`   project_id: ${pkg && pkg.project_id}`);
  console.log(`   android package: ${androidPkg}`);

  if (androidPkg !== 'com.quadrodomane.app') {
    console.error(`❌ Pacote incorreto: esperado 'com.quadrodomane.app', encontrado '${androidPkg}'`);
    console.log('   Recrie o app Android no Firebase com o package correto.');
    process.exit(1);
  }
  console.log('✅ Package Android confere com o app.config.js.');
  console.log('   Push notifications FCM prontas para build!');
} catch (e) {
  console.error('❌ Arquivo é um JSON inválido:', e.message);
  process.exit(1);
}
