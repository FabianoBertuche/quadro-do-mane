# Arquitetura

@goal
Sistema escalável com arquitetura API-first.

---

Frontend

NextJS
React
Tailwind
Shadcn UI

Responsabilidades

interface
kanban drag and drop
visualizações
dashboard

---

Backend

NestJS

Responsabilidades

API REST
autenticação
controle de permissões
processamento de dados

---

Database

PostgreSQL

Entidades

users
projects
tasks
teams
comments
attachments
contacts
events

---

Denylist JWT

PostgreSQL — tabela `token_denylist` ([`apps/api/prisma/migrations/20260630150000_token_denylist`](apps/api/prisma/migrations/20260630150000_token_denylist/migration.sql))
Cleanup via pg_cron ([`apps/api/prisma/sql/pg_cron_token_denylist.sql`](apps/api/prisma/sql/pg_cron_token_denylist.sql))

Uso

revogação de access tokens em logout
proteção contra reuso de token revogado
