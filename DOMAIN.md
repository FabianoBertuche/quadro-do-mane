# DOMAIN.md

@goal
Definir o domínio de negócio do sistema "Quadro do Mané" de forma clara, consistente e orientada à implementação.

@context
O Quadro do Mané é um sistema SaaS de gestão de tarefas, equipes e projetos, inspirado em Asana, ClickUp e Monday.

O sistema deve permitir:
- múltiplas empresas usando a mesma plataforma
- controle de acesso por empresa
- gestão de projetos e tarefas
- colaboração em equipe
- calendário corporativo
- agenda telefônica
- dashboards e indicadores
- futura expansão para automações, billing e app mobile

@principles
- o domínio deve ser multi-tenant desde a origem
- o domínio deve ser simples de entender e forte o suficiente para escalar
- o domínio deve evitar duplicação de entidades
- o domínio deve refletir a realidade do negócio, não apenas a implementação técnica
- toda entidade operacional deve respeitar isolamento por tenant

---

# Visão Geral do Domínio

O sistema é dividido em 3 grandes camadas conceituais:

1. Plataforma
2. Organização
3. Operação

## 1. Plataforma
Camada global do sistema.

Responsável por:
- usuários globais
- autenticação
- planos
- assinaturas
- sessões
- infraestrutura de acesso

## 2. Organização
Camada da empresa/tenant.

Responsável por:
- tenant
- vínculo do usuário com a empresa
- papéis
- permissões
- equipes
- configurações internas

## 3. Operação
Camada do trabalho cotidiano.

Responsável por:
- projetos
- tarefas
- comentários
- anexos
- calendário
- contatos
- notificações
- relatórios
- automações

---

# Entidades Centrais do Domínio

## Tenant
Representa uma empresa, organização ou unidade de negócio cliente do sistema.

Exemplos:
- Monte Moria Holding
- Empresa XPTO
- Quadro do Mané Demo

Responsabilidades:
- isolar os dados
- definir contexto organizacional
- vincular usuários, equipes, projetos, tarefas e configurações

Regras:
- toda operação de negócio ocorre dentro de um tenant
- o tenant define o contexto ativo da sessão
- o usuário pode pertencer a mais de um tenant

---

## User
Representa uma pessoa autenticável na plataforma.

Exemplos:
- administrador
- gestor
- colaborador
- consultor externo

Responsabilidades:
- autenticar
- acessar tenants permitidos
- executar ações conforme permissões

Regras:
- o usuário é global à plataforma
- o acesso operacional depende do vínculo com um tenant
- email deve ser único na plataforma

Observação:
User não é a mesma coisa que colaborador de um tenant.  
O vínculo operacional real acontece em TenantUser.

---

## TenantUser
Representa o vínculo entre um User e um Tenant.

É uma das entidades mais importantes do sistema.

Responsabilidades:
- dizer em qual empresa o usuário atua
- definir seu papel naquela empresa
- guardar cargo, departamento e status no tenant
- servir como referência operacional em tarefas, comentários, eventos etc.

Exemplos:
- João é User global
- João como membro da empresa A = TenantUser
- João como membro da empresa B = outro TenantUser

Regras:
- um User pode ter vários TenantUsers
- um TenantUser pertence a um único Tenant
- praticamente toda ação operacional deve referenciar TenantUser, não apenas User

---

## Role
Representa um papel de acesso dentro de um tenant.

Exemplos:
- admin
- gestor
- colaborador
- convidado
- financeiro
- RH

Responsabilidades:
- agrupar permissões
- simplificar controle de acesso

Regras:
- pode ser global do sistema ou customizada por tenant
- é atribuída ao TenantUser
- não substitui checagens de escopo de dados

---

## Permission
Representa uma capacidade granular de ação.

Exemplos:
- projects.view
- tasks.create
- tasks.move
- teams.manage_members
- reports.export

Responsabilidades:
- permitir autorização fina por módulo e ação

Regras:
- permissões são avaliadas no backend
- frontend pode esconder ações, mas a decisão real é do backend
- role é conjunto de permissions

---

## Team
Representa um agrupamento organizacional de pessoas dentro de um tenant.

Exemplos:
- Comercial
- Operações
- Engenharia
- Administrativo

Responsabilidades:
- organizar pessoas
- servir de base para distribuição de trabalho
- facilitar filtros e visualizações

Regras:
- uma equipe pertence a um tenant
- uma equipe pode possuir gerente
- uma equipe pode participar de projetos
- uma equipe pode ser associada a tarefas

---

## Project
Representa uma iniciativa de trabalho com objetivo, prazo e entregas.

Exemplos:
- Implantação do sistema
- Rebranding da empresa
- Controle de manutenção industrial
- Lançamento do app mobile

Responsabilidades:
- agrupar tarefas relacionadas
- organizar responsáveis, prazo e progresso
- permitir diferentes visualizações do trabalho

Regras:
- um projeto pertence a um tenant
- um projeto pode ter equipe associada
- um projeto pode ter membros específicos
- um projeto contém tarefas
- um projeto pode ter views salvas
- um projeto pode ser arquivado

---

## ProjectView
Representa uma visualização salva de um projeto.

Tipos:
- list
- kanban
- calendar
- timeline
- dashboard

Responsabilidades:
- permitir que usuários organizem a visão do projeto
- salvar filtros e configurações da interface

Regras:
- uma view pertence a um projeto e a um tenant
- o tipo da view altera apenas a visualização, não a estrutura do projeto

---

## Task
Representa uma unidade de trabalho executável.

Exemplos:
- Configurar banco PostgreSQL
- Aprovar orçamento
- Ligar para fornecedor
- Revisar contrato
- Publicar release

Responsabilidades:
- organizar o trabalho real
- registrar responsável, prazo, prioridade e status
- permitir colaboração, checklist, comentários e anexos

Regras:
- uma tarefa pertence a um projeto
- uma tarefa pertence a um tenant
- uma tarefa pode ter subtarefas
- uma tarefa pode ter um ou vários responsáveis
- uma tarefa possui status
- uma tarefa possui prioridade
- uma tarefa pode estar bloqueada
- uma tarefa pode ser arquivada

Observação:
Task é a entidade operacional mais importante do sistema.

---

## TaskStatus
Representa um estado possível de uma tarefa no fluxo de trabalho.

Exemplos:
- backlog
- a_fazer
- em_execucao
- revisao
- concluido

Responsabilidades:
- estruturar o fluxo de trabalho
- suportar kanban e filtros

Regras:
- status pode ser customizado por tenant
- status define ordem visual no quadro
- status não é hardcoded no frontend

---

## TaskPriority
Representa a criticidade da tarefa.

Exemplos:
- baixa
- normal
- alta
- urgente

Responsabilidades:
- ajudar na triagem e priorização
- alimentar dashboards e filtros

Regras:
- prioridade pode ser customizada por tenant
- não deve ser inferida apenas por prazo

---

## TaskChecklist
Representa uma lista interna de passos de uma tarefa.

Exemplos:
- validar dados
- revisar documento
- enviar anexo
- confirmar execução

Responsabilidades:
- detalhar a execução da tarefa
- melhorar acompanhamento granular

Regras:
- uma tarefa pode ter várias checklists
- uma checklist possui itens ordenáveis

---

## TaskChecklistItem
Representa um item individual de checklist.

Responsabilidades:
- registrar pequenas ações executáveis
- permitir marcação de concluído

Regras:
- pode registrar quem concluiu
- pode registrar data de conclusão
- pertence a uma checklist

---

## TaskComment
Representa uma interação textual em torno da tarefa.

Responsabilidades:
- comunicação contextual
- histórico da discussão
- alinhamento entre membros

Regras:
- comentário pertence a uma tarefa
- comentário pertence a um tenant
- comentário é criado por um TenantUser
- pode ser editado/removido conforme política

---

## Attachment
Representa um arquivo ligado a uma tarefa ou projeto.

Exemplos:
- imagem
- PDF
- planilha
- documento técnico

Responsabilidades:
- anexar artefatos relevantes ao trabalho

Regras:
- pertence a um tenant
- pode estar ligado a task ou project
- armazenamento físico deve ocorrer em object storage
- banco guarda apenas metadados

---

## Tag
Representada por TaskTag no modelo.

Responsabilidades:
- categorizar tarefas
- facilitar busca e filtros
- melhorar leitura visual

Exemplos:
- urgente
- financeiro
- cliente
- aprovação
- infraestrutura

Regras:
- pertence ao tenant
- pode ser associada a múltiplas tarefas

---

## Event
Representa um evento de calendário corporativo.

Exemplos:
- reunião
- prazo
- lembrete
- evento interno
- entrega importante

Responsabilidades:
- organizar agenda da equipe
- conectar calendário com projetos e tarefas

Regras:
- pertence a um tenant
- pode ter participantes
- pode estar ligado a projeto ou tarefa
- pode ser all-day ou com hora definida

---

## EventAttendee
Representa a participação de um TenantUser em um Event.

Responsabilidades:
- controlar presença e resposta
- organizar agenda coletiva

Regras:
- pertence ao tenant
- liga evento e participante
- pode registrar status de resposta

---

## Contact
Representa um contato corporativo da agenda telefônica.

Exemplos:
- fornecedor
- cliente
- colaborador interno
- parceiro
- suporte técnico

Responsabilidades:
- facilitar acesso rápido a contatos úteis
- centralizar dados telefônicos e de email

Regras:
- pertence a um tenant
- não é o mesmo que usuário da plataforma
- pode existir sem login no sistema

---

## Notification
Representa um aviso do sistema para um usuário em um tenant.

Exemplos:
- nova tarefa atribuída
- comentário recebido
- prazo próximo
- tarefa atrasada
- menção

Responsabilidades:
- manter usuário informado
- apoiar fluxo operacional

Regras:
- pertence ao tenant
- pertence a um TenantUser
- pode ser marcada como lida
- pode conter payload estrutural para navegação

---

## ActivityLog
Representa histórico operacional do sistema.

Exemplos:
- tarefa criada
- tarefa movida
- projeto arquivado
- membro adicionado

Responsabilidades:
- rastrear acontecimentos do negócio
- alimentar histórico recente e auditoria leve

Regras:
- pertence ao tenant
- pode registrar autor
- registra entidade afetada, ação e mudanças

---

## AuditLog
Representa log de segurança e auditoria formal.

Exemplos:
- login
- alteração de papel
- tentativa negada
- mudança crítica
- revogação de sessão

Responsabilidades:
- rastrear eventos críticos de segurança
- apoiar compliance e investigação

Regras:
- pertence ao tenant quando aplicável
- pode referenciar User global
- deve ser mais conservador e confiável do que ActivityLog

---

## Plan
Representa um plano comercial do SaaS.

Exemplos:
- Trial
- Starter
- Pro
- Enterprise

Responsabilidades:
- definir limites comerciais
- sustentar cobrança futura

Regras:
- é entidade global da plataforma
- um tenant pode ter assinatura ligada a um plan

---

## Subscription
Representa a assinatura de um tenant em um plano.

Responsabilidades:
- controlar situação contratual
- determinar limites de uso

Regras:
- pertence a um tenant
- referencia um plan
- pode estar ativa, em trial, vencida ou cancelada

---

## UsageCounter
Representa consumo de recursos do tenant.

Exemplos:
- número de usuários
- número de projetos
- número de tarefas
- armazenamento usado

Responsabilidades:
- apoiar billing
- validar limites
- alimentar painéis administrativos

Regras:
- pertence ao tenant
- mede métricas por período ou estado acumulado

---

## Automation
Representa uma automação configurável do sistema.

Exemplos:
- quando tarefa atrasar → notificar gestor
- quando tarefa concluir → mover status do projeto
- quando prazo estiver próximo → avisar equipe

Responsabilidades:
- reduzir trabalho manual
- acelerar fluxos recorrentes

Regras:
- pertence ao tenant
- deve ser configurável
- usa gatilhos, condições e ações

---

## CustomField
Representa um campo personalizado criado por tenant.

Exemplos:
- centro de custo
- código interno
- cliente relacionado
- criticidade técnica

Responsabilidades:
- adaptar o sistema a necessidades específicas sem alterar schema central toda hora

Regras:
- pertence a um tenant
- é vinculado a uma entidade-alvo
- define tipo e configuração

---

## CustomFieldValue
Representa o valor preenchido para um campo customizado.

Responsabilidades:
- armazenar dados extras das entidades
- manter flexibilidade do domínio

Regras:
- pertence a um tenant
- referencia um custom field
- aponta para uma entidade específica

---

# Relações de Domínio

## Relações fundamentais

User
↕
TenantUser
↕
Tenant

Tenant
↕
Team

Tenant
↕
Project
↕
Task

Task
↕
TaskComment
TaskChecklist
Attachment
Tag

Tenant
↕
Event
↕
EventAttendee

Tenant
↕
Contact

Tenant
↕
Notification

Tenant
↕
ActivityLog
AuditLog

Tenant
↕
Subscription
↕
Plan

---

# Regras de Negócio Fundamentais

## Regra 1 — isolamento por tenant
Nenhuma entidade operacional pode ser lida ou alterada fora do tenant ativo.

## Regra 2 — User não opera sozinho
A operação real sempre considera TenantUser.

## Regra 3 — permissão não substitui escopo
Ter permissão para ver tarefas não significa ver todas as tarefas do tenant.
Ainda é necessário validar escopo:
- membro do projeto
- equipe relacionada
- tarefa atribuída
- política do papel

## Regra 4 — projeto organiza, tarefa executa
Project organiza o trabalho.  
Task representa o trabalho concreto.

## Regra 5 — comentário, checklist e anexo vivem em torno da tarefa
Essas entidades não existem soltas no sistema.

## Regra 6 — calendário complementa o trabalho
Event não substitui Task.  
Event organiza compromissos, reuniões e marcos temporais.

## Regra 7 — contato não é usuário
Contact é agenda corporativa.  
User é conta autenticável.

## Regra 8 — logs têm papéis diferentes
ActivityLog = histórico operacional  
AuditLog = segurança e auditoria

## Regra 9 — customização por tenant
Status, prioridades, roles customizadas e campos customizados devem respeitar o tenant.

## Regra 10 — soft delete sempre que possível
Entidades críticas devem preferir arquivamento ou marcação lógica a exclusão física.

---

# Fluxos Principais do Domínio

## Fluxo 1 — entrada do usuário
1. User autentica
2. seleciona Tenant
3. sistema carrega TenantUser
4. sistema resolve Role e Permissions
5. usuário entra na operação do tenant

---

## Fluxo 2 — criação de projeto
1. TenantUser autorizado cria Project
2. associa equipe e membros
3. define datas, prioridade e visualizações
4. projeto passa a receber tasks

---

## Fluxo 3 — execução de tarefa
1. tarefa é criada dentro de um projeto
2. recebe status e prioridade
3. recebe responsável
4. pode receber comentários, checklist e anexos
5. pode ser movida no kanban
6. pode ser concluída ou arquivada

---

## Fluxo 4 — colaboração
1. membros comentam na tarefa
2. atualizam status
3. marcam checklist
4. recebem notificações
5. atividade fica registrada em logs

---

## Fluxo 5 — acompanhamento gerencial
1. gestor acessa dashboard
2. sistema consolida tasks, projects, workload, atrasos e produtividade
3. gestor toma ação operacional

---

## Fluxo 6 — agenda corporativa
1. TenantUser cria evento
2. adiciona participantes
3. vincula opcionalmente a task ou project
4. participantes acompanham pelo calendário

---

## Fluxo 7 — expansão SaaS
1. tenant contrata plano
2. subscription controla estado comercial
3. usage counters monitoram consumo
4. automations e custom fields permitem maturidade maior do produto

---

# Módulos Funcionais do Sistema

## Módulo Auth
Responsável por:
- login
- refresh
- logout
- seleção de tenant
- contexto de sessão

Entidades centrais:
- User
- TenantUser
- Session futura
- AuditLog

---

## Módulo Access Control
Responsável por:
- roles
- permissions
- guards
- escopo de acesso

Entidades centrais:
- Role
- Permission
- TenantUser

---

## Módulo Teams
Responsável por:
- equipes
- membros
- liderança

Entidades centrais:
- Team
- TeamMember
- TenantUser

---

## Módulo Projects
Responsável por:
- projetos
- membros do projeto
- views

Entidades centrais:
- Project
- ProjectMember
- ProjectView

---

## Módulo Tasks
Responsável por:
- tarefas
- subtarefas
- status
- prioridade
- responsáveis
- tags
- checklist
- comentários
- anexos

Entidades centrais:
- Task
- TaskStatus
- TaskPriority
- TaskAssignee
- TaskTag
- TaskChecklist
- TaskChecklistItem
- TaskComment
- Attachment

---

## Módulo Calendar
Responsável por:
- agenda
- eventos
- participação

Entidades centrais:
- Event
- EventAttendee

---

## Módulo Contacts
Responsável por:
- agenda telefônica corporativa

Entidade central:
- Contact

---

## Módulo Notifications
Responsável por:
- avisos ao usuário
- leitura e navegação contextual

Entidade central:
- Notification

---

## Módulo Analytics
Responsável por:
- indicadores
- produtividade
- carga de trabalho
- progresso

Entidades-base:
- Project
- Task
- TenantUser
- ActivityLog

Observação:
Analytics pode nascer como consultas e services, sem exigir tabela própria no início.

---

## Módulo Billing
Responsável por:
- plano
- assinatura
- consumo

Entidades centrais:
- Plan
- Subscription
- UsageCounter

---

## Módulo Automation
Responsável por:
- gatilhos
- condições
- ações

Entidade central:
- Automation

---

## Módulo Audit
Responsável por:
- rastreabilidade
- segurança
- eventos críticos

Entidades centrais:
- AuditLog
- ActivityLog

---

# Linguagem Ubíqua do Domínio

Para manter consistência no código e documentação, usar estes termos:

- Tenant = empresa/organização
- User = usuário global da plataforma
- TenantUser = vínculo do usuário com a empresa
- Role = papel de acesso
- Permission = permissão granular
- Team = equipe
- Project = projeto
- Task = tarefa
- Subtask = subtarefa
- TaskStatus = status da tarefa
- TaskPriority = prioridade da tarefa
- Checklist = checklist da tarefa
- Comment = comentário da tarefa
- Attachment = anexo
- Event = evento de calendário
- Contact = contato da agenda
- Notification = notificação
- ActivityLog = histórico operacional
- AuditLog = log de segurança/auditoria
- Plan = plano comercial
- Subscription = assinatura
- UsageCounter = medidor de consumo
- Automation = automação
- CustomField = campo customizado

Evitar sinônimos soltos no código como:
- company, org, workspace, boardCompany, memberAccount, collaboratorProfile

Escolher um termo e manter coerência.  
A bagunça semântica é o cupim silencioso de sistemas grandes.

---

# Decisões de Domínio Importantes

## Decisão 1
O sistema é multi-tenant com banco compartilhado e isolamento por tenant_id.

## Decisão 2
O vínculo operacional é TenantUser, não User puro.

## Decisão 3
Task pertence a Project na versão atual.
Não haverá tarefa totalmente solta no domínio inicial.

## Decisão 4
Status e prioridade são configuráveis por tenant.

## Decisão 5
Calendário e contatos são módulos de apoio operacional, não o núcleo primário do produto.

## Decisão 6
Permissões são granulares, mas ainda precisam respeitar escopo de dados.

## Decisão 7
O domínio já nasce preparado para billing, automations e custom fields, mesmo que parte disso entre depois.

---

# Limites do Domínio Inicial

Fora do escopo da primeira versão:
- chat interno completo em tempo real
- wiki/documentação interna estilo Notion
- CRM completo
- controle financeiro detalhado
- workflow BPM avançado
- engine de automação visual complexa
- marketplace de integrações
- SLA enterprise multi-região

Essas áreas podem vir depois, mas não devem contaminar o núcleo inicial.

---

# Resultado esperado da implementação

Ao implementar este domínio corretamente, o sistema deve permitir:

- autenticação multi-tenant
- separação segura entre empresas
- gestão de equipes
- gestão de projetos
- gestão visual de tarefas com kanban
- colaboração por comentários e checklists
- agenda telefônica
- calendário corporativo
- dashboard gerencial
- expansão futura para SaaS comercial completo

---

@task
Usar este arquivo como fonte conceitual principal para alinhar entidades, nomes e relações no backend, frontend e banco de dados.

@task
Garantir que nomes de models, DTOs, endpoints e componentes reflitam a linguagem ubíqua definida aqui.

@task
Evitar criação de entidades redundantes fora deste domínio sem revisão arquitetural.

@task
Validar que DATABASE.md, API.md, AUTH.md e PERMISSIONS.md permaneçam coerentes com este domínio.