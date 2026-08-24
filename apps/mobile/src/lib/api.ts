import axios from 'axios';
import { useAuthStore } from './auth';

/**
 * Cliente da API para o mobile.
 *
 * Sem cookies: o access token vai no header Authorization (Bearer) e o
 * refresh é enviado no body do /auth/refresh. O backend rotaciona o par
 * a cada uso — persistimos sempre o novo refreshToken.
 */
export const API_URL = (
  process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001/api'
).replace(/\/+$/, '');

export const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15_000,
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers = config.headers ?? {};
    (config.headers as any).Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshPromise: Promise<string | null> | null = null;

async function refreshSession(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const refreshToken = useAuthStore.getState().refreshToken;
      if (!refreshToken) return null;
      const res = await axios.post(
        `${API_URL}/auth/refresh`,
        { refreshToken },
        { timeout: 15_000, headers: { 'Content-Type': 'application/json' } },
      );
      const accessToken = res.data?.accessToken;
      if (accessToken) {
        useAuthStore.getState().setSession({
          accessToken,
          refreshToken: res.data?.refreshToken ?? refreshToken,
        });
        return accessToken as string;
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

const AUTH_BYPASS_REFRESH = ['/auth/login', '/auth/refresh', '/auth/select-tenant'];

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const isAuthEndpoint = AUTH_BYPASS_REFRESH.some((u) =>
      original?.url?.includes(u),
    );
    const isUnauthorized = error.response?.status === 401;

    // Refresh transparente em 401 — nunca força logout em runtime.
    if (isUnauthorized && original && !original._retry && !isAuthEndpoint) {
      original._retry = true;
      const accessToken = await refreshSession();
      if (accessToken) {
        original.headers = { ...original.headers, Authorization: `Bearer ${accessToken}` };
        return api(original);
      }
    }

    return Promise.reject(error);
  },
);

/** Extrai mensagem legível de erro da API Nest (string ou array de validação). */
export function apiErrorMessage(error: unknown, fallback = 'Erro inesperado'): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data;
    const msg = data?.message;
    if (Array.isArray(msg)) return msg.join(', ');
    if (typeof msg === 'string') return msg;
    if (error.code === 'ECONNABORTED') return 'Tempo de conexão esgotado';
    if (!error.response) return 'Sem conexão com o servidor';
  }
  return fallback;
}
