# Quickstart: Fundação segura e paritária dos clientes

## Prerequisites

- Node.js e dependências do monorepo instaladas com `npm install` na raiz.
- PostgreSQL acessível para os testes de integração manual da API, com variáveis do ambiente configuradas conforme o repositório.
- Dois tenants de teste, cada um com ao menos um usuário ativo; no Tenant A, inclua um membro de projeto, participante de evento, pessoa com rotina e destinatário de notificação.
- Um usuário sem a permissão de alteração necessária e um usuário autorizado no Tenant A. Mantenha dados equivalentes no Tenant B para provar isolamento.

## Start services

```bash
npm run dev:api
npm run dev:web
npm run start --workspace=@quadro/mobile
```

Configure o Expo com `EXPO_PUBLIC_API_URL` apontando à API em execução. Para o Web, use o proxy local padrão `/api` ou uma `NEXT_PUBLIC_API_URL` autorizada.

## Security smoke test

1. Entre como usuário autorizado do Tenant A no Web e no Expo; confirme que tarefas, projetos, eventos, rotina e notificações trazem apenas registros do Tenant A.
2. Usando um ID do Tenant B, tente abrir e alterar um registro de cada recurso pela interface e pela API autenticada. Confirme que nenhum dado do Tenant B é mostrado ou modificado.
3. Entre como usuário do Tenant A sem a permissão necessária. Tente criar/editar um recurso; confirme erro de acesso proibido, sessão preservada e ausência de repetição da ação.
4. Tente marcar como lida uma notificação destinada a outro `TenantUser` no mesmo Tenant A; confirme que o estado da notificação não muda.

## Session and error smoke test

1. Expire o access token mantendo refresh válido e execute uma leitura `GET`: confirme uma renovação de sessão e uma repetição bem-sucedida da leitura no Web e Expo.
2. Expire o access token mantendo refresh válido e execute criação, edição, exclusão, conclusão, marcação de leitura ou upload: confirme uma renovação no máximo uma vez, nenhuma repetição automática da mutação e solicitação de nova intenção explícita.
3. Expire access e refresh e execute uma leitura: confirme que não há loop de renovação e que ambos exigem nova autenticação.
4. Induza um 403: confirme que ambos mostram erro de permissão, mantêm a sessão e não disparam refresh/retry.
5. Interrompa temporariamente uma leitura: confirme que o usuário pode acionar retry explícito e que nenhuma mutação é repetida automaticamente.

## Attachment upload smoke test

1. Como usuário autorizado do Tenant A, envie um arquivo permitido para uma tarefa do Tenant A e confirme que o `Attachment` referencia a mesma tarefa, tenant e pessoa enviadora.
2. Como usuário do Tenant A, use o ID de tarefa do Tenant B ou sem permissão `tasks.edit`; confirme que não há arquivo no diretório de uploads e nenhum `Attachment` criado.
3. Fique offline e tente anexar arquivo no Web e Expo; confirme bloqueio antes da transferência e nenhuma ação pendente.

## Offline smoke test

1. Com conexão, abra uma lista elegível e um detalhe de cada recurso; anote a última atualização exibida em `America/Sao_Paulo`.
2. Desative rede no navegador/dispositivo e reabra os mesmos dados. Confirme indicador offline/desatualizado e a hora registrada.
3. Tente criar, editar, mover, concluir, excluir ou marcar notificação como lida. Confirme bloqueio antes do envio, sem mudança visual otimista e sem ação pendente.
4. Abra uma consulta que não foi carregada anteriormente. Confirme a mensagem de indisponibilidade offline, e não uma lista vazia tratada como sucesso.

## Automated verification target

After implementation, run the repository commands added by the tasks:

```bash
npm run test --workspace=apps/api
npm run test --workspace=apps/web
npm run test --workspace=@quadro/mobile
npm run build --workspace=apps/api
npm run build --workspace=apps/web
```

The final implementation must also run the focused unit suites for tenant authorization, client response policy, and offline mutation blocking described in `tasks.md`.
