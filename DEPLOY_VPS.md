# Deploy em VPS (Ubuntu 24.04) com Docker — passo a passo

Este documento descreve como preparar a VPS, configurar Docker, subir o stack com Traefik, Postgres, `api`, `web` e um `code-server` acessível via browser, além de como transferir os dados do banco atual para o novo Postgres em container.

Pré-requisitos:
- VPS Ubuntu 24.04 com acesso root / sudo
- DNS apontando os domínios para a VPS (ex.: `example.com`, `api.example.com`, `editor.example.com`)

1) Instalar Docker e plugin Compose

```bash
sudo apt update
sudo apt install -y docker.io docker-compose-plugin
sudo usermod -aG docker $USER
newgrp docker
docker version
docker compose version
```

2) Preparar diretório do projeto

```bash
cd /opt
git clone <SUA-REPO-URL> monte-moria
cd monte-moria
```

3) Gerar `.env` com segredos

Use o script localizado em `scripts/generate-env.js` para gerar um `.env` inicial e depois edite-o para ajustar domínios e variáveis sensíveis (ou crie um `.env.production`).

```bash
node scripts/generate-env.js
# editar .env: setar NEXT_PUBLIC_API_URL, COOKIE_DOMAIN, COOKIE_SECURE=true, trocar DATABASE_URL para apontar ao serviço postgres no compose
```

Adicione também a senha para o `code-server` no `.env`:

```env
CODE_SERVER_PASSWORD=uma-senha-forte
```

4) Ajustar `docker-compose.prod.yml`

- Substitua `example.com` e `api.example.com` e `editor.example.com` pelos seus domínios.
- No serviço `traefik`, coloque seu e-mail em `--certificatesresolvers.le.acme.email=you@example.com`.

5) Subir containers (build + detach)

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

6) Transferir dados do banco atual

Opção A — copia completa (schema + dados) — restaura exatamente o estado atual:

No servidor origem (onde está o banco atual):

```bash
# se o Postgres roda em container (ex.: quadro-postgres):
docker exec -t quadro-postgres pg_dump -U postgres -F c quadro_do_mane > /tmp/quadro.dump

# ou se for um Postgres local:
pg_dump -h localhost -p 5432 -U postgres -F c -b -v -f /tmp/quadro.dump quadro_do_mane

scp /tmp/quadro.dump user@vps:/tmp/
```

No VPS (após `docker compose up` já ter criado o container `postgres`):

```bash
# copia do arquivo para dentro do container via stdin
cat /tmp/quadro.dump | docker exec -i $(docker ps -qf "name=quadro-postgres") pg_restore -U postgres -d quadro_do_mane -v
```

Observação: este método restaura schema + dados. Se preferir aplicar o schema do código atual (migrations) e apenas importar os dados, use a Opção B.

Opção B — aplicar migrations (schema do código) e importar apenas os dados:

```bash
# 1) executar migrations
docker compose run --rm api sh -c "npm ci && npx prisma migrate deploy --schema=prisma/schema.prisma"

# 2) no host origem gerar dump somente dos dados (sem schema):
pg_dump -h origem -U postgres -a -F c -f /tmp/quadro_data.dump quadro_do_mane
scp /tmp/quadro_data.dump user@vps:/tmp/

# 3) importar apenas os dados
cat /tmp/quadro_data.dump | docker exec -i $(docker ps -qf "name=quadro-postgres") pg_restore -U postgres -d quadro_do_mane -a -v
```

7) Rodar seed (opcional)

Se quiser executar os seeds (ex.: criar usuário admin), rode:

```bash
docker compose run --rm api sh -c "npm ci && npm run seed"
```

8) Acessar `code-server` no navegador

Após o compose estar no ar e DNS apontando, abra `https://editor.seudominio.com` e entre com a senha definida em `CODE_SERVER_PASSWORD`. O diretório montado `/home/coder/project` será a raiz do repositório e você poderá editar arquivos e rodar comandos dentro do editor.

9) Manutenção e backups

- Agende dumps regulares com `pg_dump` e copie para armazenamento externo (S3 ou outro servidor).
- Considere usar `pgbackrest` ou `wal-g` para backups contínuos em produção.

10) Notas de segurança

- Proteja `code-server` por autenticação forte e considere limitar acesso por IP no firewall até confirmar tudo funcionando.
- Armazene `JWT_SECRET` e `ENCRYPTION_KEY` fora do repositório (use Docker secrets ou um vault se possível).

---

Se quiser, eu posso:
- gerar um `.env.production` pronto com placeholders para você preencher (domínio, e-mail, senha do editor);
- adicionar um serviço `migrate` no `docker-compose.prod.yml` para executar migrations automaticamente;
- configurar Docker secrets para os segredos.
