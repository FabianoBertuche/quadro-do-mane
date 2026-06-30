# DATABASE.md

@goal
Definir uma arquitetura de banco de dados SaaS multi-tenant para o sistema "Quadro do Mané".

@context
O sistema deve suportar múltiplas empresas (tenants) em uma única base PostgreSQL, com isolamento de dados por tenant_id.

@stack
PostgreSQL
Prisma ORM

@principles
- Toda entidade de negócio deve ser associada a um tenant_id quando aplicável
- Toda consulta do backend deve filtrar por tenant_id
- O sistema deve suportar múltiplos usuários por empresa
- Um usuário pode participar de múltiplas empresas
- O modelo deve ser escalável para evoluir de sistema interno para SaaS comercial

---

# Estratégia Multi-Tenant

Modelo adotado:
Single database + shared schema + tenant_id

Vantagens:
- menor custo inicial
- manutenção simples
- migrações centralizadas
- relatórios globais mais fáceis
- boa escalabilidade para fase inicial e intermediária

Regra crítica:
Toda query deve respeitar:

WHERE tenant_id = :tenantId

---

# Entidades Principais

## tenants
Representa uma empresa cliente do sistema.

Campos:
- id
- name
- slug
- legal_name
- document_number
- email
- phone
- status
- created_at
- updated_at

---

## plans
Planos comerciais do SaaS.

Campos:
- id
- name
- description
- max_users
- max_projects
- max_storage_mb
- monthly_price
- annual_price
- created_at
- updated_at

---

## subscriptions
Assinatura ativa da empresa.

Campos:
- id
- tenant_id
- plan_id
- status
- started_at
- expires_at
- trial_ends_at
- cancelled_at
- created_at
- updated_at

---

## users
Usuários globais da plataforma.

Campos:
- id
- name
- email
- password_hash
- avatar_url
- phone
- is_active
- last_login_at
- created_at
- updated_at

Regra:
- email único globalmente

---

## tenant_users
Relaciona usuário com empresa.

Campos:
- id
- tenant_id
- user_id
- role_id
- job_title
- department
- is_active
- created_at
- updated_at

Função:
- usuário participar de várias empresas
- cargo por empresa
- ativação/desativação por empresa
- papel por empresa

---

## roles
Perfis de acesso.

Campos:
- id
- tenant_id (nullable para papéis globais)
- name
- description
- is_system_role
- created_at
- updated_at

Exemplos:
- admin
- gestor
- colaborador
- convidado

---

## permissions
Permissões granulares.

Campos:
- id
- code
- name
- description
- module

Exemplos:
- projects.view
- projects.create
- projects.edit
- tasks.move
- tasks.delete
- users.manage
- reports.view

---

## role_permissions
Relaciona perfil com permissões.

Campos:
- id
- role_id
- permission_id

---

## teams
Equipes internas da empresa.

Campos:
- id
- tenant_id
- name
- description
- manager_tenant_user_id
- color
- created_at
- updated_at

---

## team_members
Membros da equipe.

Campos:
- id
- tenant_id
- team_id
- tenant_user_id
- created_at

---

## projects
Projetos da empresa.

Campos:
- id
- tenant_id
- name
- code
- description
- status
- priority
- owner_tenant_user_id
- team_id
- start_date
- due_date
- completed_at
- progress_percent
- color
- created_at
- updated_at
- archived_at

Status sugeridos:
- draft
- active
- on_hold
- completed
- cancelled
- archived

---

## project_members
Participantes do projeto.

Campos:
- id
- tenant_id
- project_id
- tenant_user_id
- role_in_project
- created_at

---

## project_views
Views salvas do projeto.

Campos:
- id
- tenant_id
- project_id
- name
- type
- config_json
- created_by
- created_at
- updated_at

Tipos:
- list
- kanban
- calendar
- timeline
- dashboard

---

## task_statuses
Status configuráveis por tenant.

Campos:
- id
- tenant_id
- name
- slug
- color
- position
- category
- is_default
- created_at

Exemplos:
- backlog
- a_fazer
- em_execucao
- revisao
- concluido

---

## task_priorities
Prioridades configuráveis por tenant.

Campos:
- id
- tenant_id
- name
- level
- color
- created_at

Exemplos:
- baixa
- normal
- alta
- urgente

---

## tasks
Tarefas e subtarefas.

Campos:
- id
- tenant_id
- project_id
- parent_task_id
- title
- description
- status_id
- priority_id
- assignee_tenant_user_id
- reporter_tenant_user_id
- team_id
- start_date
- due_date
- completed_at
- estimated_minutes
- spent_minutes
- story_points
- kanban_position
- sort_order
- is_blocked
- blocked_reason
- created_at
- updated_at
- archived_at

Observações:
- parent_task_id permite subtarefas
- sort_order e kanban_position permitem drag and drop ordenado

---

## task_assignees
Permite múltiplos responsáveis por tarefa.

Campos:
- id
- tenant_id
- task_id
- tenant_user_id
- assigned_at

---

## task_tags
Tags de tarefas.

Campos:
- id
- tenant_id
- name
- color
- created_at

---

## task_tag_links
Relaciona tags e tarefas.

Campos:
- id
- tenant_id
- task_id
- tag_id

---

## task_checklists
Checklist da tarefa.

Campos:
- id
- tenant_id
- task_id
- title
- position
- created_at

---

## task_checklist_items
Itens da checklist.

Campos:
- id
- tenant_id
- checklist_id
- content
- is_done
- done_by_tenant_user_id
- done_at
- position
- created_at

---

## task_comments
Comentários de tarefas.

Campos:
- id
- tenant_id
- task_id
- author_tenant_user_id
- content
- created_at
- updated_at
- deleted_at

---

## attachments
Arquivos anexados.

Campos:
- id
- tenant_id
- task_id
- project_id
- uploaded_by_tenant_user_id
- file_name
- file_path
- mime_type
- file_size
- created_at

Observação:
Arquivos devem ser armazenados em object storage, não no banco.

---

## contacts
Agenda telefônica corporativa.

Campos:
- id
- tenant_id
- name
- company
- department
- role
- email
- phone
- mobile
- extension
- notes
- created_at
- updated_at

---

## events
Eventos de calendário.

Campos:
- id
- tenant_id
- title
- description
- type
- start_at
- end_at
- all_day
- created_by_tenant_user_id
- related_project_id
- related_task_id
- created_at
- updated_at

---

## event_attendees
Participantes do evento.

Campos:
- id
- tenant_id
- event_id
- tenant_user_id
- response_status

---

## notifications
Notificações do sistema.

Campos:
- id
- tenant_id
- tenant_user_id
- type
- title
- message
- payload_json
- is_read
- read_at
- created_at

---

## activity_logs
Histórico operacional.

Campos:
- id
- tenant_id
- actor_tenant_user_id
- entity_type
- entity_id
- action
- old_values_json
- new_values_json
- created_at

Exemplos:
- tarefa criada
- tarefa movida
- projeto arquivado

---

## audit_logs
Histórico de auditoria e segurança.

Campos:
- id
- tenant_id
- actor_user_id
- action
- target_type
- target_id
- ip_address
- user_agent
- metadata_json
- created_at

---

## usage_counters
Controle de limites do plano.

Campos:
- id
- tenant_id
- metric_code
- current_value
- period_start
- period_end
- updated_at

Exemplos de metric_code:
- users_count
- projects_count
- tasks_count
- storage_mb

---

## automations
Automações futuras.

Campos:
- id
- tenant_id
- name
- description
- trigger_type
- conditions_json
- actions_json
- is_active
- created_by_tenant_user_id
- created_at
- updated_at

---

## custom_fields
Campos customizados por entidade.

Campos:
- id
- tenant_id
- entity_type
- name
- field_type
- config_json
- is_required
- created_at

Entidades:
- task
- project
- contact

---

## custom_field_values
Valores dos campos customizados.

Campos:
- id
- tenant_id
- custom_field_id
- entity_id
- value_text
- value_number
- value_date
- value_boolean
- value_json
- created_at
- updated_at

---

# Estratégia de Permissões

Camadas:
1. Tenant
2. Role
3. Permission

Recomendação:
- verificar tenant no login
- carregar papel do tenant_users
- aplicar permissões finas por módulo

---

# Soft Delete e Arquivamento

Usar sempre que possível:
- archived_at
- deleted_at

Evitar remoções físicas em entidades críticas.

---

# Índices Recomendados

## tasks
- (tenant_id, project_id)
- (tenant_id, assignee_tenant_user_id)
- (tenant_id, status_id)
- (tenant_id, due_date)
- (tenant_id, archived_at)

## projects
- (tenant_id, status)
- (tenant_id, owner_tenant_user_id)

## tenant_users
- unique (tenant_id, user_id)

## notifications
- (tenant_id, tenant_user_id, is_read)

---

# Fases de Implementação

## Fase 1
- tenants
- users
- tenant_users
- roles
- permissions
- role_permissions
- teams
- team_members
- projects
- project_members
- task_statuses
- task_priorities
- tasks
- task_comments
- notifications
- activity_logs

## Fase 2
- task_tags
- task_tag_links
- task_checklists
- task_checklist_items
- contacts
- events
- event_attendees
- attachments

## Fase 3
- plans
- subscriptions
- usage_counters
- automations
- custom_fields
- custom_field_values
- audit_logs

---

@task
Gerar migration inicial Prisma baseada neste documento.

@task
Implementar isolamento por tenant_id em todas as queries do backend.

@task
Criar seed inicial com:
- 1 tenant padrão
- roles padrão
- permissões padrão
- status padrão de tarefa
- prioridades padrão