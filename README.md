Monte Moria

Sistema corporativo de gestão de tarefas inspirado em Asana e ClickUp.

Leia os arquivos de documentação .md para entender a arquitetura.

## PM2 Deployment

Para gerenciar o backend sem Docker, usamos PM2 para manter o processo vivo e reiniciar automaticamente em caso de crash.

### Instalação

No servidor, execute:

```bash
npm install -g pm2
npm install
```

### Comandos úteis

```bash
npm run pm2:start
npm run pm2:restart
npm run pm2:stop
npm run pm2:delete
npm run pm2:logs
```

### Startup automático

Depois que o processo estiver rodando, execute:

```bash
pm2 startup
pm2 save
```

Isso garante que o processo volte a rodar após reiniciar o servidor.