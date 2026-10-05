# Checklist de qualidade — Calendário e lembretes

## Completude da especificação

- [x] Objetivo, dependências 001/002, escopo e exclusões definidos.
- [x] Três histórias independentes P1/P2/P3 possuem cenário Given/When/Then e teste independente.
- [x] Visões mensal, semanal, diária e lista, inclusive grande volume, foram definidas.
- [x] Detalhe, ocorrência, série, recorrência, vínculos, participantes e responsável foram delimitados.
- [x] Lembrete individual, push e deep link possuem fluxo e isolamento por destinatário.
- [x] Requisitos FR-001 a FR-020 e SC-001 a SC-008 são verificáveis.

## Segurança e consistência

- [x] Matriz de operação, permissão, visibilidade e exceção administrativa está explícita no contrato.
- [x] Administração não constitui bypass de tenant ou permissão.
- [x] Mudanças de endpoints existentes e endpoints novos estão nomeados e versionados no contrato.
- [x] Contrato declara método, request, response e erros por operação.
- [x] Datas, cursores e lembretes usam `America/Sao_Paulo`.
- [x] Cache contém versão, escopo, TTL e invalidação; offline é somente leitura.

## Preparação de entrega

- [x] Pesquisa registra alternativas e decisões.
- [x] Modelo de dados separa registros persistidos, projeções e cache local.
- [x] Quickstart inclui configuração, comandos reais propostos e cenários de validação.
- [x] Plano usa caminhos existentes/reais, runners, dependências e configurações explícitas.
- [x] Tarefas T001+ têm dependências, passos TDD e verificações concretas.
- [x] Não há termos pendentes, endpoints implícitos, lacunas de implementação ou autorização presumida.
