export type TaskFilterInput = URLSearchParams | Record<string, unknown>;

/**
 * Monta a query de `/tasks` preservando os filtros já escolhidos e anexando a
 * categoria de status. Sem categoria, a chave é removida em vez de ir vazia:
 * o drill-down do dashboard manda `statusCategory` e o cliente não pode
 * descartá-la no caminho.
 */
export function withStatusCategory(params: TaskFilterInput, category?: string | null): URLSearchParams {
  const search = params instanceof URLSearchParams
    ? new URLSearchParams(params)
    : new URLSearchParams(
        Object.entries(params)
          .filter(([, value]) => value !== null && value !== undefined)
          .map(([key, value]) => [key, String(value)]),
      );

  const trimmed = category?.trim();
  if (trimmed) search.set('statusCategory', trimmed);
  else search.delete('statusCategory');

  return search;
}