# API.md

@goal
Definir a API REST multi-tenant do sistema Quadro do Mané.

@context
A API deve seguir arquitetura API-first para suportar:
- frontend web
- futuro app Android
- futuro app iOS
- integrações externas

@stack
NestJS
PostgreSQL
Prisma
JWT

@principles
- versionamento por /api/v1
- autenticação via bearer token
- isolamento obrigatório por tenant
- respostas consistentes
- paginação padrão
- filtros previsíveis
- erro padronizado

---

# Convenções gerais

Base URL:
`/api/v1`

Headers obrigatórios:
- Authorization: Bearer <token>

Header opcional quando aplicável:
- X-Tenant-Slug: <tenant-slug>

Observação:
O tenant ativo também pode ser derivado do token, do subdomínio ou de rota contextual. Definir uma única estratégia principal e manter consistência.

---

# Resposta padrão de sucesso

```json
{
  "success": true,
  "data": {},
  "meta": {}
}