# Constituição Monte Moria

## Princípios fundamentais

### I. Paridade entre clientes é vinculante

Web, Android e iOS são clientes de primeira classe. Toda capacidade orientada
ao usuário deve ter comportamento, regras de acesso, estados de carregamento,
erro e vazio equivalentes nas três plataformas, salvo limitação explicitamente
documentada na especificação aprovada. Uma entrega não é considerada pronta se
ampliar ou reduzir arbitrariamente a capacidade de apenas um cliente.

### II. O backend é a autoridade de tenant, permissões e escopo

O backend NestJS é a fonte de verdade para identidade, isolamento por tenant,
associação a equipes, papéis, permissões e escopo dos dados. Clientes podem
ocultar controles para melhorar a experiência, mas nunca podem conceder acesso,
inferir autorização definitiva ou contornar validações do servidor. Toda API
que lê ou altera dados deve aplicar esse escopo no servidor.

### III. Testes unitários e TDD são obrigatórios

Mudanças de comportamento devem começar por um teste unitário que falhe pelo
motivo esperado, seguido da implementação mínima e da execução verde. Regras
de domínio, mapeamentos de contrato, políticas de permissão, estados offline e
adaptações de cliente exigem cobertura unitária. Uma exceção só é válida para
artefatos sem comportamento executável e deve ser registrada na especificação.

### IV. Cache é somente leitura e mutações são bloqueadas offline

Dados em cache podem servir exclusivamente para consulta quando não houver
conectividade. A interface deve avisar de forma inequívoca que os dados podem
estar desatualizados e identificar o modo offline. Criar, editar, excluir,
enviar arquivos, alterar configurações ou qualquer outra mutação deve ficar
bloqueada enquanto offline; não há fila implícita de escrita nem confirmação
local de alteração não aceita pelo servidor.

### V. Contratos e documentação são revisados por especificação

Toda alteração de endpoint, esquema, regra de autorização, capacidade de
cliente ou requisito de compatibilidade deve ser descrita e revisada na spec
correspondente antes da implementação. Contratos compartilhados são
versionados de forma compatível ou incluem plano explícito de migração. A
documentação do produto e das APIs deve refletir o comportamento entregue.

## Requisitos de compatibilidade

- Clientes suportados: Web em navegadores modernos, Android e iOS nas versões
  mínimas definidas e publicadas pela equipe de plataforma.
- O mesmo contrato de API deve produzir resultados semanticamente equivalentes
  nos três clientes; diferenças nativas de navegação, permissão do sistema e
  apresentação devem ser documentadas e testadas.
- Novos recursos exigem critérios de aceite para API, Web, Android, iOS e
  testes antes de iniciarem desenvolvimento.
- Recursos indisponíveis em qualquer plataforma só podem ser liberados com
  exclusão explícita, justificativa, alternativa de uso e prazo de revisão na
  spec aprovada.

## Fluxo de entrega e gates de qualidade

1. Registrar o requisito na spec do programa de paridade e atualizar a matriz
   de funcionalidades afetada.
2. Revisar contratos, autorização de tenant/permissões/escopo e compatibilidade
   dos três clientes antes de codificar.
3. Criar e executar testes unitários em ciclo red-green-refactor para o
   comportamento novo ou alterado.
4. Validar online e offline: em offline, leituras de cache exibem aviso e todas
   as mutações permanecem indisponíveis.
5. Revisar a implementação contra a matriz de paridade, a spec e os contratos
   publicados antes da liberação.

## Governança

Esta constituição prevalece sobre práticas locais, convenções de módulo e
preferências de implementação. Toda revisão deve verificar aderência aos cinco
princípios, aos requisitos de compatibilidade e aos gates de qualidade.
Emendas exigem uma proposta escrita, aprovação dos responsáveis por produto,
backend e clientes, atualização das specs afetadas e, quando aplicável, plano
de migração. A versão segue versionamento semântico: princípios removidos ou
incompatíveis elevam MAJOR; novos princípios ou requisitos elevam MINOR;
esclarecimentos sem alteração normativa elevam PATCH.

**Versão**: 1.0.0 | **Ratificada**: 2026-09-09 | **Última alteração**: 2026-09-09
