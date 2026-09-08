# Monte Moria

@context
Sistema corporativo de gestão de tarefas e projetos inspirado em Asana, ClickUp e Monday.

Objetivo:
Organizar tarefas, projetos e equipes com visualizações modernas (kanban, timeline, dashboard).

Deve permitir monitoramento de produtividade e desempenho de colaboradores.

---

@stack

Frontend
React
NextJS
Tailwind
TypeScript

Backend
NodeJS
NestJS

Database
PostgreSQL

Infra
Docker
Nginx
PostgreSQL

---

@architecture

monorepo

/apps
  web
  api

/packages
  ui
  database
  utils

---

@collaboration

Para tarefas de implementação, usar múltiplos agentes sempre que houver duas ou mais subtarefas independentes que possam ser executadas em paralelo.

Dividir o trabalho por módulos ou conjuntos de arquivos sem sobreposição, atribuir uma responsabilidade concreta a cada agente e consolidar as alterações antes da verificação final.

Não paralelizar mudanças concorrentes no mesmo arquivo, nem criar agentes para tarefas curtas, sequenciais ou que dependam de uma decisão ainda não tomada.

---

@skill
using-superpowers
brainstorming
writing-plans
test-driven-development
systematic-debugging
verification-before-completion
