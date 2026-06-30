# PERMISSIONS.md

@goal
Definir a matriz de permissões do sistema Quadro do Mané.

@context
O sistema usa três camadas de controle:
1. tenant
2. role
3. permission

Toda autorização deve considerar:
- tenant atual
- vínculo do usuário com o tenant
- papel do usuário no tenant
- permissões atribuídas ao papel

---

# Conceitos

## tenant
Empresa/organização dona dos dados.

## role
Papel do usuário dentro do tenant.

## permission
Ação granular permitida em um módulo.

---

# Regras gerais

- Nenhum usuário pode acessar recursos de outro tenant
- O backend deve validar tenant_id em toda query
- O frontend pode ocultar ações sem permissão, mas a decisão real é do backend
- Roles podem ser globais do sistema ou customizadas por tenant
- O super admin da plataforma não deve ser confundido com admin do tenant

---

# Papéis padrão

## admin
Controle total do tenant.

## gestor
Gerencia projetos, equipes e visão operacional.

## colaborador
Executa e atualiza tarefas nas áreas permitidas.

## convidado
Acesso limitado, majoritariamente leitura.

---

# Matriz de permissões

## auth
- auth.login
- auth.logout
- auth.refresh

Todos os usuários autenticáveis podem executar.

---

## dashboard
- dashboard.view

admin: sim
gestor: sim
colaborador: sim
convidado: sim

---

## users
- users.view
- users.create
- users.edit
- users.disable

admin:
- view: sim
- create: sim
- edit: sim
- disable: sim

gestor:
- view: sim
- create: não
- edit: não
- disable: não

colaborador:
- view: não
- create: não
- edit: não
- disable: não

convidado:
- todos: não

---

## roles
- roles.view
- roles.create
- roles.edit
- roles.assign

admin:
- todos: sim

gestor:
- view: não
- create: não
- edit: não
- assign: não

colaborador:
- todos: não

convidado:
- todos: não

---

## teams
- teams.view
- teams.create
- teams.edit
- teams.delete
- teams.manage_members

admin:
- todos: sim

gestor:
- view: sim
- create: sim
- edit: sim
- delete: não
- manage_members: sim

colaborador:
- view: sim
- create: não
- edit: não
- delete: não
- manage_members: não

convidado:
- view: opcional
- demais: não

---

## projects
- projects.view
- projects.create
- projects.edit
- projects.archive
- projects.delete
- projects.manage_members
- projects.manage_views

admin:
- todos: sim

gestor:
- view: sim
- create: sim
- edit: sim
- archive: sim
- delete: não
- manage_members: sim
- manage_views: sim

colaborador:
- view: sim
- create: opcional
- edit: limitado ao permitido
- archive: não
- delete: não
- manage_members: não
- manage_views: opcional

convidado:
- view: sim
- demais: não

---

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

admin:
- todos: sim

gestor:
- todos exceto delete irrestrito: sim

colaborador:
- view: sim
- create: sim
- edit: sim com regras
- delete: não
- move: sim
- assign: opcional
- comment: sim
- checklist_manage: sim
- attachments_manage: sim
- change_status: sim
- change_priority: opcional

convidado:
- view: sim
- comment: opcional
- demais: não

---

## calendar
- calendar.view
- calendar.create
- calendar.edit
- calendar.delete

admin:
- todos: sim

gestor:
- view: sim
- create: sim
- edit: sim
- delete: sim

colaborador:
- view: sim
- create: opcional
- edit: opcional
- delete: não

convidado:
- view: sim
- demais: não

---

## contacts
- contacts.view
- contacts.create
- contacts.edit
- contacts.delete

admin:
- todos: sim

gestor:
- view: sim
- create: sim
- edit: sim
- delete: não

colaborador:
- view: sim
- create: não
- edit: não
- delete: não

convidado:
- view: opcional
- demais: não

---

## reports
- reports.view
- reports.export

admin:
- ambos: sim

gestor:
- ambos: sim

colaborador:
- view: opcional
- export: não

convidado:
- ambos: não

---

## notifications
- notifications.view
- notifications.manage

admin:
- ambos: sim

gestor:
- view: sim
- manage: opcional

colaborador:
- view: sim
- manage: limitado ao próprio usuário

convidado:
- view: sim
- manage: não

---

## automations
- automations.view
- automations.create
- automations.edit
- automations.delete

admin:
- todos: sim

gestor:
- todos exceto delete avançado: opcional

colaborador:
- todos: não

convidado:
- todos: não

---

## billing
- billing.view
- billing.manage

admin:
- ambos: sim

gestor:
- ambos: não

colaborador:
- ambos: não

convidado:
- ambos: não

---

## settings
- settings.view
- settings.edit

admin:
- ambos: sim

gestor:
- view: opcional
- edit: não

colaborador:
- ambos: não

convidado:
- ambos: não

---

## audit
- audit.view

admin: sim
gestor: não
colaborador: não
convidado: não

---

# Regras especiais por contexto

## Projetos
Mesmo tendo projects.view, o usuário só deve ver projetos:
- do próprio tenant
- em que tenha acesso por papel
- ou em que seja membro
- ou em que a equipe dele esteja vinculada

## Tarefas
Mesmo tendo tasks.view, o usuário só deve ver tarefas:
- do próprio tenant
- do projeto permitido
- atribuídas a ele
- ou visíveis à equipe dele

## Edição
Ter tasks.edit não significa editar tudo.
Aplicar regras adicionais:
- colaborador edita apenas tarefas visíveis
- em alguns tenants, só edita tarefas atribuídas a ele
- admin e gestor podem ter escopo ampliado

---

# Estratégia backend

Toda requisição autenticada deve carregar:
- userId
- tenantId atual
- tenantUserId
- role
- permissions[]

Middleware recomendado:
1. autenticar token
2. validar tenant atual
3. carregar vínculo tenant_users
4. carregar permissões da role
5. executar guard de permissão
6. aplicar filtro de escopo de dados

---

# Estratégia frontend

- esconder botões sem permissão
- esconder menus sem permissão
- desabilitar ações restritas
- sempre confiar no backend como fonte final

---

@task
Criar guard PermissionGuard no backend.

@task
Criar decorator @RequirePermissions() para rotas.

@task
Criar helper can() no frontend.

@task
Criar cache leve de permissões por usuário e tenant.