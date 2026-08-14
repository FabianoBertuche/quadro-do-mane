Próximos passos para retomar o deploy (resumo e ações detalhadas)

Contexto curto
- As migrações foram aplicadas com sucesso usando a imagem construída (`quadro-do-mane_api:latest`).
- O step de `seed` falhou: erro `TypeError: Unknown file extension ".ts"` ao executar `ts-node prisma/seed.ts` dentro do container de produção (imagem com apenas dependências de produção).

Objetivo
- Garantir que o seed seja aplicado em produção de forma repetível e segura, e concluir o deploy (iniciar serviços e validar o site em `montemoria.com`).

Ações imediatas (para executar agora e validar)
1) Rodar o seed manualmente (via container temporário com dev deps):

```bash
# no servidor, na raiz do projeto
# usa a imagem oficial node:20-bullseye-slim montada no diretório do app
docker run --rm -v "$(pwd)/apps/api":/usr/src/app -w /usr/src/app node:20-bullseye-slim bash -lc "apt-get update && apt-get install -y libssl1.1 ca-certificates openssl && npm ci && npx prisma generate --schema=prisma/schema.prisma && npx ts-node prisma/seed.ts"
```

Observação: esse comando instala dependências de desenvolvimento temporariamente dentro do container e executa o seed. Útil para validar o seed agora sem alterar a imagem de produção.

2) Alternativa rápida (menos recomendada): instalar `ts-node`/`typescript` nas dependências de produção (ou movê-las para `dependencies`) e rebuildar a imagem. Isso faz o seed rodar com a imagem atual, mas aumenta o tamanho e superfície de ataque da imagem.

Correção recomendada (persistente)
Opção A — Compilar o seed para JS e rodar o binário (recomendado):
- Converter `prisma/seed.ts` para ser executável como JS compilado em `dist` (por exemplo, mover lógica para `src/prisma/seed.ts` e garantir que o build transpile para `dist/prisma/seed.js`).
- Alterar `package.json` para que o script `seed` invoque `node dist/prisma/seed.js`.
- Garantir que o `Dockerfile` copie `dist` e execute `npm run seed` a partir da imagem final (ou usar `migrate` service para rodar `npm run seed`).

Opção B — Incluir `ts-node` no runtime: adicionar `ts-node` e `typescript` em `dependencies` (não devDependencies) e rebuildar imagem. Menos ideal por motivos de performance/segurança.

Passos para implementar Opção A (detalhado)
1. Atualizar `prisma/seed.ts` para exportar/rodar de forma compatível com transpile (evitar code paths ESM-only), ou criar `src/prisma/seed.ts` e importar utilitários já presentes no `src`.
2. Atualizar `tsconfig.json` (se necessário) para garantir que `outDir` inclua `dist/prisma`.
3. Atualizar `package.json` scripts:
   - `build`: já presente; verificar que compila `src` para `dist` inclusive o seed.
   - `seed`: `node dist/prisma/seed.js`
4. No `Dockerfile` (builder): garantir que `npm run build` produza `dist/prisma/seed.js` e que a cópia para a imagem final inclua `dist` (já ocorre). Remover execução de `ts-node` no runtime.
5. Rebuildar imagens e executar migrate+seed:

```bash
docker compose -f docker-compose.prod.yml build --no-cache
docker compose -f docker-compose.prod.yml run --rm migrate
```

Como validar que o seed funcionou
- Verificar logs do comando `run` no terminal (procure mensagens de criação de usuário admin).
- Conectar ao banco e verificar tabela `users` ou `tenants` conforme o seed.
- Tentar autenticar no frontend com o usuário seed (senha definida em `SEED_ADMIN_PASSWORD`).

Verificações pós-deploy
- Acessar https://montemoria.com e https://api.montemoria.com (checar SSL do Traefik/Let's Encrypt)
- Revisar logs do `api` e `web` via `docker compose -f docker-compose.prod.yml logs -f api` e `... web` para erros.
- Desabilitar envio de e-mail temporariamente (se ainda ativo): confirmar variáveis relacionadas a SMTP não estão definidas ou endpoints de e-mail estão mockados.

Rollback (se necessário)
- Se o seed inserir dados indesejados, restaurar backup do Postgres (recomenda-se sempre ter backup antes de rodar seed em produção). Exemplo simplificado:

```bash
# dump atual
docker exec quadro-do-mane-postgres-1 pg_dumpall -U postgres > /tmp/db-backup.sql
# restaurar a partir de backup anterior
cat /tmp/db-backup-old.sql | docker exec -i quadro-do-mane-postgres-1 psql -U postgres
```

Notas e recomendações
- Preferir a Opção A (compilar o seed) para manter a imagem enxuta.
- Manter secrets (JWT, ENCRYPTION_KEY) fora do repositório e no arquivo `.env` gerenciado no servidor.
- Após o seed concluído, aplicar as permissões de firewall e monitoramento.

Checklist rápido para a próxima vez
- [ ] Corrigir seed (compilar para JS ou incluir ts-node em runtime)
- [ ] Rebuildar imagens
- [ ] Rodar `docker compose run --rm migrate` e confirmar seed
- [ ] Subir serviços e validar frontend/backoffice

---
Arquivo gerado automaticamente para retomar o deploy.
