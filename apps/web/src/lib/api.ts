import axios from 'axios';
import { useAuthStore } from './auth';

/**
 * API_URL — usa caminho RELATIVO para que a chamada passe pelo catch-all
 * Next.js em /pages/api/[...path].ts. Isso é essencial porque:
 *  1. O proxy repassa Set-Cookie do backend (3001) para o browser (3000).
 *  2. Cookies HttpOnly funcionam same-origin sem SameSite=None.
 *  3. CORS não precisa de credentials cross-origin.
 *
 * Quando `NEXT_PUBLIC_API_URL` aponta para absoluta (ex.: em produção
 * com api.app.com), as chamadas vão direto para o backend — o navegador
 * envia o cookie HttpOnly automaticamente quando `withCredentials: true`
 * e CORS está configurado no backend.
 */
const RAW_API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

function normalizeBaseURL(raw: string): string {
  // Se for caminho relativo ou absoluto, axios aceita. Mas para que
  // o `withCredentials` funcione cross-origin em produção, precisamos
  // de uma URL absoluta. Em dev, mantemos "/api" para cair no proxy.
  if (raw.startsWith('/')) return raw;
  return raw.replace(/\/+$/, '');
}

export const API_URL = normalizeBaseURL(RAW_API_URL);

export const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

/**
 * Request interceptor:
 * - Em DEV: cookies HttpOnly cross-port (3000 ↔ 3001) podem ser
 *   descartados por alguns browsers em cenários específicos. Lê o
 *   accessToken do Zustand (sessionStorage) e envia via header
 *   Authorization como fallback.
 * - Em produção (same-origin ou CORS credentials): o cookie HttpOnly
 *   já é enviado automaticamente; o header Authorization só é setado
 *   se Zustand tiver token (fallback).
 */
api.interceptors.request.use((config) => {
  const state = useAuthStore.getState();
  if (state.accessToken) {
    config.headers = config.headers ?? {};
    (config.headers as any).Authorization = `Bearer ${state.accessToken}`;
  }
  return config;
});

/**
 * Refresh transparente:
 * - Em PROD (cookie HttpOnly): o backend lê `qd_refresh` do cookie,
 *   emite novo par e devolve via Set-Cookie. A resposta também traz
 *   os tokens no body (devido ao applyAuthCookies não-removedor).
 * - Em DEV: usamos o refreshToken do Zustand como fallback.
 *
 * Importante: após cada refresh bem-sucedido, persistimos TANTO o novo
 * accessToken QUANTO o novo refreshToken no Zustand. O backend rotaciona
 * o refresh a cada uso, então o token antigo será revogado — guardar o
 * novo é obrigatório para o próximo refresh funcionar.
 */
let refreshPromise: Promise<{ accessToken: string; refreshToken?: string } | null> | null = null;

async function refreshSession(): Promise<{ accessToken: string; refreshToken?: string } | null> {
  if (refreshPromise) return refreshPromise;
  const state = useAuthStore.getState();
  refreshPromise = (async () => {
    try {
      const payload = state.refreshToken ? { refreshToken: state.refreshToken } : {};
      const res = await axios.post(
        `${API_URL}/auth/refresh`,
        payload,
        {
          withCredentials: true,
          headers: { 'Content-Type': 'application/json' },
        },
      );
      const data = res.data || {};
      if (data.accessToken) {
        // Persiste AMBOS os tokens rotacionados. Se o backend não
        // devolver refreshToken (cookie-only em prod), mantemos o
        // atual no Zustand.
        useAuthStore.getState().setSession({
          accessToken: data.accessToken,
          refreshToken: data.refreshToken ?? state.refreshToken ?? null,
        });
        return {
          accessToken: data.accessToken,
          refreshToken: data.refreshToken ?? state.refreshToken ?? undefined,
        };
      }
      return null;
    } catch {
      return null;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const isAuthEndpoint =
      original?.url?.includes('/auth/login') ||
      original?.url?.includes('/auth/refresh') ||
      original?.url?.includes('/auth/select-tenant');
    const isUnauthorized = error.response?.status === 401;

    if (isUnauthorized && !original?._retry && !isAuthEndpoint) {
      original._retry = true;
      try {
        const refreshed = await refreshSession();
        if (refreshed?.accessToken) {
          original.headers = original.headers ?? {};
          (original.headers as any).Authorization = `Bearer ${refreshed.accessToken}`;
          return api(original);
        }
      } catch {
        // fall through
      }
      useAuthStore.getState().clearSession();
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  },
);
