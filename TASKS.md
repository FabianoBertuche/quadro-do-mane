# TASKS.md

@goal
Plano de construção do sistema Quadro do Mané utilizando vibe coding com Antigravity.

@context
O sistema deve ser construído seguindo os documentos:

AGENTS.md  
PROJECT.md  
DOMAIN.md  
ARCHITECTURE.md  
DATABASE.md  
API.md  
AUTH.md  
PERMISSIONS.md  
SEED.md  
UI.md  
DESIGN_SYSTEM.md  

---

# Estratégia de Construção

O projeto será construído em fases sequenciais:

1. Estrutura do projeto
2. Banco de dados
3. Autenticação
4. Controle de acesso
5. Núcleo operacional
6. Módulos auxiliares
7. Dashboard
8. Frontend
9. Recursos visuais
10. Logs e auditoria
11. Recursos SaaS

---

# FASE 1 — Estrutura do Projeto

@task
Criar monorepo com a estrutura:

/apps
/web
/api

/packages
/ui
/database
/utils


@task
Configurar backend usando NestJS.

Dependências principais:

- NestJS
- Prisma
- PostgreSQL
- JWT
- class-validator
- class-transformer

@task
Configurar frontend com NextJS.

Dependências principais:

- React
- TailwindCSS
- shadcn/ui
- React Query
- Zustand

@task
Criar ambiente Docker com serviços:

- api
- web
- postgres

---

# FASE 2 — Banco de Dados

@task
Criar pacote de banco:

/packages/database


@task
Criar schema Prisma:


prisma/schema.prisma


Baseado em DATABASE.md.

@task
Executar primeira migration.

@task
Criar script de seed inicial.

Baseado em SEED.md.

@task
Garantir que o seed seja idempotente.

---

# FASE 3 — Autenticação

@task
Criar módulo AuthModule.

@task
Criar endpoint:

POST /auth/login

@task
Criar endpoint:

POST /auth/select-tenant

@task
Criar endpoint:

POST /auth/refresh

@task
Criar endpoint:

POST /auth/logout

@task
Criar endpoint:

GET /auth/me

@task
Implementar autenticação JWT.

@task
Criar tabela:

auth_sessions

@task
Implementar rotação de refresh tokens.

---

# FASE 4 — Controle de Acesso

@task
Criar PermissionGuard.

@task
Criar TenantContextGuard.

@task
Criar decorator:

@RequirePermissions()

@task
Criar helper frontend:

can()

@task
Carregar permissões no login.

---

# FASE 5 — Módulo Teams

@task
Criar TeamsModule.

@task
Criar endpoints:

GET /teams  
POST /teams  
PATCH /teams/:id  
DELETE /teams/:id  

@task
Criar endpoints para membros da equipe:

POST /teams/:id/members  
DELETE /teams/:id/members/:tenantUserId  

---

# FASE 6 — Módulo Projects

@task
Criar ProjectsModule.

@task
Criar endpoints:

GET /projects  
POST /projects  
GET /projects/:id  
PATCH /projects/:id  
DELETE /projects/:id  

@task
Criar endpoints para membros do projeto.

@task
Criar endpoints para views do projeto.

---

# FASE 7 — Módulo Tasks

@task
Criar TasksModule.

@task
Criar endpoints:

GET /tasks  
POST /tasks  
GET /tasks/:id  
PATCH /tasks/:id  
DELETE /tasks/:id  

@task
Criar endpoint para mover tarefas no kanban:

PATCH /tasks/:id/move

@task
Criar endpoint de alteração de status:

PATCH /tasks/:id/status

@task
Criar endpoint de alteração de prioridade:

PATCH /tasks/:id/priority

@task
Criar endpoints para responsáveis.

@task
Criar endpoints para comentários.

@task
Criar endpoints para checklists.

@task
Criar endpoints para tags.

@task
Criar endpoints para anexos.

---

# FASE 8 — Calendário

@task
Criar EventsModule.

@task
Criar endpoints:

GET /events  
POST /events  
PATCH /events/:id  
DELETE /events/:id  

@task
Criar endpoints para participantes de eventos.

---

# FASE 9 — Agenda Telefônica

@task
Criar ContactsModule.

@task
Criar endpoints:

GET /contacts  
POST /contacts  
PATCH /contacts/:id  
DELETE /contacts/:id  

---

# FASE 10 — Notificações

@task
Criar NotificationsModule.

@task
Criar endpoints:

GET /notifications  
PATCH /notifications/:id/read  
PATCH /notifications/read-all  

---

# FASE 11 — Dashboard

@task
Criar DashboardModule.

@task
Criar endpoint:

GET /dashboard/overview

@task
Criar endpoint:

GET /dashboard/workload

@task
Criar endpoint:

GET /dashboard/productivity

@task
Criar endpoint:

GET /dashboard/project-progress

---

# FASE 12 — Frontend

@task
Criar layout principal contendo:

- Sidebar
- Header
- Área de conteúdo
- Painel contextual

@task
Criar páginas principais:

/dashboard  
/projects  
/tasks  
/teams  
/calendar  
/contacts  
/settings  

---

# FASE 13 — Kanban

@task
Implementar quadro Kanban.

Biblioteca recomendada:

dnd-kit

@task
Permitir:

- drag and drop
- reorder
- mover tarefas entre colunas

---

# FASE 14 — Dashboard Visual

@task
Implementar gráficos usando:

Recharts

@task
Criar:

- gráfico de produtividade
- gráfico de carga de trabalho
- progresso de projetos

---

# FASE 15 — Upload de Arquivos

@task
Criar serviço de upload.

@task
Armazenar arquivos em:

S3 ou storage compatível.

---

# FASE 16 — Logs e Auditoria

@task
Criar ActivityLogService.

@task
Criar AuditLogService.

@task
Registrar eventos críticos do sistema.

---

# FASE 17 — Automations (Futuro)

@task
Criar AutomationModule.

@task
Implementar estrutura:

trigger  
conditions  
actions  

---

# FASE 18 — Billing (Futuro)

@task
Criar BillingModule.

@task
Integrar planos e subscriptions.

---

# Verificações Finais

@task
Garantir isolamento de dados por tenant_id em todas as queries.

@task
Criar testes básicos.

@task
Gerar documentação OpenAPI.

@task
Preparar deploy com Docker.

@task
Criar pipeline CI/CD.

