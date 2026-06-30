# SEED.md

@goal
Definir os dados iniciais obrigatórios do sistema "Quadro do Mané" para ambiente local, homologação e produção inicial.

@context
O seed deve preparar a plataforma para uso imediato com:
- 1 tenant padrão
- planos iniciais
- papéis padrão
- permissões básicas
- status padrão de tarefa
- prioridades padrão
- usuário administrador inicial

@stack
PostgreSQL
Prisma ORM

---

# Tenant padrão

Criar tenant inicial:

- name: Quadro do Mané Demo
- slug: quadro-do-mane-demo
- legal_name: Quadro do Mané Demo LTDA
- document_number: 00.000.000/0001-00
- email: admin@quadrodomane.local
- phone: +55 19 99999-9999
- status: ACTIVE

---

# Planos iniciais

Criar planos:

## Plano Trial
- name: Trial
- description: Plano de avaliação
- max_users: 10
- max_projects: 10
- max_storage_mb: 1024
- monthly_price: 0
- annual_price: 0

## Plano Starter
- name: Starter
- description: Plano inicial para pequenas equipes
- max_users: 25
- max_projects: 50
- max_storage_mb: 5120
- monthly_price: 99.90
- annual_price: 999.00

## Plano Pro
- name: Pro
- description: Plano profissional para equipes em crescimento
- max_users: 100
- max_projects: 500
- max_storage_mb: 20480
- monthly_price: 299.90
- annual_price: 2999.00

## Plano Enterprise
- name: Enterprise
- description: Plano corporativo
- max_users: null
- max_projects: null
- max_storage_mb: null
- monthly_price: 999.90
- annual_price: 9999.00

---

# Subscription inicial

Criar subscription inicial para o tenant demo:

- tenant: quadro-do-mane-demo
- plan: Trial
- status: ACTIVE
- started_at: now
- trial_ends_at: now + 30 dias

---

# Papéis padrão

Criar roles globais do sistema:

## admin
Descrição:
Controle total do tenant.

## gestor
Descrição:
Gerencia projetos, equipes e tarefas.

## colaborador
Descrição:
Executa tarefas, comenta, atualiza status e acompanha projetos permitidos.

## convidado
Descrição:
Acesso restrito de leitura em contextos autorizados.

---

# Permissões padrão

Criar permissões iniciais agrupadas por módulo.

## auth
- auth.login
- auth.logout
- auth.refresh

## dashboard
- dashboard.view

## users
- users.view
- users.create
- users.edit
- users.disable

## roles
- roles.view
- roles.create
- roles.edit
- roles.assign

## teams
- teams.view
- teams.create
- teams.edit
- teams.delete
- teams.manage_members

## projects
- projects.view
- projects.create
- projects.edit
- projects.archive
- projects.delete
- projects.manage_members
- projects.manage_views

## tasks
- tasks.view
- tasks.create
- tasks.edit
- tasks.delete
- tasks.move
- tasks.assign
- tasks.comment
- tasks.checklist_manage
- tasks.attachments_manage
- tasks.change_status
- tasks.change_priority

## calendar
- calendar.view
- calendar.create
- calendar.edit
- calendar.delete

## contacts
- contacts.view
- contacts.create
- contacts.edit
- contacts.delete

## reports
- reports.view
- reports.export

## notifications
- notifications.view
- notifications.manage

## automations
- automations.view
- automations.create
- automations.edit
- automations.delete

## billing
- billing.view
- billing.manage

## settings
- settings.view
- settings.edit

## audit
- audit.view

---

# Mapeamento inicial role -> permissions

## admin
Recebe todas as permissões.

## gestor
Recebe:
- dashboard.view
- users.view
- teams.view
- teams.create
- teams.edit
- teams.manage_members
- projects.view
- projects.create
- projects.edit
- projects.archive
- projects.manage_members
- projects.manage_views
- tasks.view
- tasks.create
- tasks.edit
- tasks.move
- tasks.assign
- tasks.comment
- tasks.checklist_manage
- tasks.attachments_manage
- tasks.change_status
- tasks.change_priority
- calendar.view
- calendar.create
- calendar.edit
- contacts.view
- contacts.create
- contacts.edit
- reports.view
- reports.export
- notifications.view

## colaborador
Recebe:
- dashboard.view
- projects.view
- tasks.view
- tasks.create
- tasks.edit
- tasks.move
- tasks.comment
- tasks.checklist_manage
- tasks.attachments_manage
- tasks.change_status
- calendar.view
- contacts.view
- notifications.view

## convidado
Recebe:
- dashboard.view
- projects.view
- tasks.view
- calendar.view
- contacts.view

---

# Status padrão de tarefa

Criar status para o tenant demo:

## backlog
- name: Backlog
- slug: backlog
- color: #64748B
- position: 1
- category: pending
- is_default: false

## a_fazer
- name: A Fazer
- slug: a_fazer
- color: #3B82F6
- position: 2
- category: pending
- is_default: true

## em_execucao
- name: Em Execução
- slug: em_execucao
- color: #F59E0B
- position: 3
- category: active
- is_default: false

## revisao
- name: Revisão
- slug: revisao
- color: #8B5CF6
- position: 4
- category: active
- is_default: false

## concluido
- name: Concluído
- slug: concluido
- color: #22C55E
- position: 5
- category: done
- is_default: false

---

# Prioridades padrão

## baixa
- name: Baixa
- level: 1
- color: #94A3B8

## normal
- name: Normal
- level: 2
- color: #3B82F6

## alta
- name: Alta
- level: 3
- color: #F59E0B

## urgente
- name: Urgente
- level: 4
- color: #EF4444

---

# Usuário administrador inicial

Criar usuário inicial:

- name: Administrador
- email: admin@quadrodomane.local
- password: AlterarNoPrimeiroLogin123!
- is_active: true

Vincular ao tenant demo com role:
- admin

---

# Dados opcionais de demonstração

Criar equipe demo:
- name: Operações
- color: #5B5FEF

Criar projeto demo:
- name: Implantação Inicial
- code: IMPL-001
- status: ACTIVE
- priority: HIGH

Criar tarefas demo:
- Configurar VPS
- Criar identidade visual
- Definir fluxo de kanban
- Homologar autenticação
- Publicar versão alfa

---

@task
Criar script Prisma seed com idempotência.

@task
Garantir que o seed possa ser executado múltiplas vezes sem duplicação.

@task
Criar hash seguro da senha inicial usando bcrypt.

@task
Permitir sobrescrever dados iniciais por variáveis de ambiente.