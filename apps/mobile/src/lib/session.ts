import { api } from './api';
import { useAuthStore, loadStoredTokens } from './auth';

/**
 * Hidrata a sessão no boot do app:
 * 1. Lê tokens do SecureStore.
 * 2. Busca o perfil atualizado via GET /auth/me
 *    (o interceptor renova o access token automaticamente se expirado).
 * 3. Sem sessão válida → marca hidratado; o guarda de rotas direciona ao login.
 */
export async function hydrateSession(): Promise<void> {
  const store = useAuthStore.getState();
  if (store.hydrated) return;

  const tokens = await loadStoredTokens();
  if (!tokens) {
    store.markHydrated();
    return;
  }

  store.setSession(tokens);

  try {
    const res = await api.get('/auth/me');
    const d = res.data ?? {};
    useAuthStore.getState().setSession({
      user: d.user ?? null,
      tenant: d.tenant ?? null,
      permissions: Array.isArray(d.permissions) ? d.permissions : [],
      role: d.role ?? null,
    });
    useAuthStore.getState().markHydrated();
  } catch {
    // Refresh falhou (interceptor já tentou) — sessão morta, limpa tokens.
    useAuthStore.getState().clearSession();
  }
}
