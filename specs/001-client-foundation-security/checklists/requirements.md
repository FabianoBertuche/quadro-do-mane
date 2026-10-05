# Requirements Checklist: Fundação segura e paritária dos clientes

**Purpose**: Verificar a completude, coerência e verificabilidade dos requisitos da feature antes da implementação.  
**Created**: 2026-09-09  
**Feature**: [spec.md](../spec.md)

## Cobertura de jornadas

- [x] CHK001 Há histórias independentes e priorizadas P1, P2 e P3.
- [x] CHK002 A jornada P1 cobre isolamento de tenant, usuário, participação e permissão.
- [x] CHK003 A jornada P2 cobre paridade funcional de API, Web e mobile para loading, erro, 401, 403 e retry.
- [x] CHK004 A jornada P3 define consulta offline explícita e bloqueio de mutações.
- [x] CHK005 Cada história contém cenários de aceitação Given/When/Then testáveis de forma independente.

## Segurança e dados

- [x] CHK006 O tenant ativo é requisito explícito para todos os recursos no escopo.
- [x] CHK007 Usuário participante, permissões e participação por recurso estão diferenciados no requisito.
- [x] CHK008 A regra para vínculos de responsável, participante, membro e destinatário exige tenant e atividade válidos.
- [x] CHK009 Notificações são explicitamente limitadas ao destinatário.
- [x] CHK010 Tentativas entre tenants e alterações sem autorização têm resultado definido.

## Experiência e resiliência

- [x] CHK011 Estados de loading, 401, 403 e falha temporária têm comportamento definido nos dois clientes.
- [x] CHK012 O limite de uma renovação e uma repetição após 401 está explícito.
- [x] CHK013 O comportamento em 403 preserva sessão e evita repetição automática.
- [x] CHK014 Retry automático é limitado a leituras temporariamente indisponíveis.
- [x] CHK015 Offline permite somente leitura prévia, exibe desatualização e bloqueia todas as mutações antes do envio.
- [x] CHK016 Não há ambiguidade sobre ausência de fila, sincronização automática ou resolução de conflitos offline.

## Qualidade e mensuração

- [x] CHK017 Os requisitos funcionais são orientados ao resultado e não prescrevem mecanismo técnico.
- [x] CHK018 Os critérios de sucesso são mensuráveis, têm percentuais/limites claros e podem ser automatizados.
- [x] CHK019 A exigência de testes unitários para API, Web e mobile está explícita.
- [x] CHK020 A regra de data civil e apresentação de horário em `America/Sao_Paulo` está registrada onde relevante.
- [x] CHK021 Escopo excluído e pressupostos que afetam a implementação estão documentados.
- [x] CHK022 A regra pós-refresh diferencia explicitamente `GET`/`HEAD` de todas as mutações, inclusive upload.
- [x] CHK023 Upload/anexo tem requisito de validação antes de gravar arquivo ou registro associado.
- [x] CHK024 O contrato canônico versionado inclui método, solicitação, resposta, erros, filtros/paginação e rastreabilidade para cada operação.
- [x] CHK025 A matriz de autorização formaliza permissão, predicado de visibilidade e exceção administrativa limitada por tenant.
- [x] CHK026 A política proíbe bypass global de permissão para administradores.

## Notes

- Checklist concluído contra a especificação aprovada em 2026-09-09.
