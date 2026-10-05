# Quickstart — validar Calendário e lembretes

## Pré-requisitos

- Node.js >=20 e npm >=10, conforme o `package.json` raiz.
- PostgreSQL e variáveis da API configurados pelo fluxo existente; executar `npm run db:generate` após dependências/migrações.
- Expo configurado para simulador/dispositivo e `apps/mobile/.env` com `EXPO_PUBLIC_API_URL` alcançável.
- Para push real, projeto EAS/FCM/APNs e `google-services.json` já configurados; testes unitários não chamam Expo nem provedor real.
- Um tenant com administrador, dois colaboradores ativos, um inativo e massa de eventos (incluindo série, evento de fronteira e >100 eventos).

## Instalar runners e iniciar

Os scripts abaixo são entregáveis da T001; antes dela, o repositório não possui todos os runners descritos.

```bash
cd /root/quadro-do-mane/.worktrees/client-parity-sdd
npm install
npm run db:generate
npm run dev:api
npm run dev:web
npm run dev:mobile
```

## Verificações automatizadas esperadas

```bash
npm --workspace=api run test:calendar
npm --workspace=web run test:calendar
npm --workspace=@quadro/mobile run test:calendar
npm --workspace=api run build
npm --workspace=web run build
npm --workspace=@quadro/mobile run typecheck
```

Os comandos acima são adicionados na T001. `test:calendar` do API usa `node -r ts-node/register --test`; Web usa Vitest/jsdom; Expo usa Jest/jest-expo. Não executar push real nesses testes.

## Cenário manual mínimo

1. Entre como colaborador A com `calendar.view`, crie evento único e série semanal com responsável B, participantes A/B, projeto, tarefa e lembrete de zero dias.
2. Em Web, Android e iOS, alterne mês, semana, dia e lista; verifique eventos sobrepostos e a paginação ao ultrapassar 100 itens. Horários devem coincidir em `America/Sao_Paulo`.
3. Como A, abra detalhe, altere somente uma ocorrência e confira que a irmã não mudou; em seguida altere título/participantes da série e confirme a quantidade retornada.
4. Como B, confirme que só aparecem seus eventos envolvidos. Como administrador com `calendar.view`, selecione B e confirme a mesma lista de B; retire `calendar.view` do administrador e confirme 403/ausência do seletor funcional.
5. Em A, dispense o lembrete do dia. Em B, confirme que o lembrete ainda existe. Rode o job de cron de teste com relógio fixado; cada destinatário elegível recebe no máximo um payload por ocorrência/dia.
6. Toque no push no Expo e abra `/calendar/{occurrenceId}`; abra a URL Web `/calendar/events/{occurrenceId}`. Ambos precisam passar pela sessão/tenant antes de mostrar detalhe.
7. Carregue uma página e detalhe online, desligue a rede e reabra: mostrar “Dados salvos; somente leitura” e `savedAt`; tente criar, editar, excluir e dispensar, confirmando ausência de chamada de rede/fila.

## Dados de borda

- Fixar `2026-09-09T02:59:59.999Z` e `2026-09-09T03:00:00.000Z` para a mudança de dia São Paulo.
- Evento `2026-09-08T23:30:00-03:00` a `2026-09-09T00:30:00-03:00` deve figurar nas duas datas afetadas.
- Criar 101 eventos com mesmo início e ids distintos para comprovar desempate por id e cursor.
- Criar 366 ocorrências e esperar `422 CALENDAR_SERIES_LIMIT_EXCEEDED` sem persistência parcial.
- Tentar adicionar usuário inativo e vínculo de outro tenant; esperar falha e zero alterações.
