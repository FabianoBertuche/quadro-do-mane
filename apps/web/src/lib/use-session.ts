'use client';

import { useEffect } from 'react';
import { useAuthStore } from './auth';
import { api } from './api';

/**
 * Hook de hidratação da sessão: garante que o Zustand tenha um accessToken
 * válido e chama /auth/me para preencher user/tenant/permissions.
 *
 * Fluxo de boot (DEV cross-port 3000↔3001, onde cookies HttpOnly são
 * instáveis no Chrome):
 *  1. Se Zustand já tem accessToken, prossegue direto para /auth/me.
 *  2. Se não tem accessToken mas tem refreshToken, chama /auth/refresh
 *     (rotaciona tokens) e depois /auth/me.
 *  3. Se não tem nenhum, tenta /auth/refresh com payload vazio (vai usar
 *     o cookie HttpOnly) — se sucesso, /auth/me. Se 401, clearSession().
 *
 * Isso evita a corrida em que um useQuery (ex.: /emails) sai sem
 * Authorization na primeira requisição e dispara o banner de erro.
 */
export function useSession() {
  const setSession = useAuthStore((s) => s.setSession);
  const clearSession = useAuthStore((s) => s.clearSession);
  const hydrated = useAuthStore((s) => s.hydrated);

  useEffect(() => {
    let cancelled = false;

    async function refreshIfNeeded(): Promise<string | null> {
      const state = useAuthStore.getState();
      if (state.accessToken) return state.accessToken;
      if (state.refreshToken) {
        try {
          const res = await api.post('/auth/refresh', { refreshToken: state.refreshToken });
          if (cancelled) return null;
          if (res.data?.accessToken) {
            useAuthStore.getState().setSession({
              accessToken: res.data.accessToken,
              refreshToken: res.data.refreshToken ?? state.refreshToken,
            });
            return res.data.accessToken as string;
          }
        } catch {
          // tenta o caminho do cookie abaixo
        }
      }
      // Tenta refresh via cookie (payload vazio)
      try {
        const res = await api.post('/auth/refresh', {});
        if (cancelled) return null;
        if (res.data?.accessToken) {
          const cur = useAuthStore.getState();
          useAuthStore.getState().setSession({
            accessToken: res.data.accessToken,
            refreshToken: res.data.refreshToken ?? cur.refreshToken,
          });
          return res.data.accessToken as string;
        }
      } catch {
        return null;
      }
      return null;
    }

    async function hydrate() {
      // 1) garante que temos um accessToken
      const accessToken = await refreshIfNeeded();
      if (cancelled) return;
      if (!accessToken) {
        clearSession();
        return;
      }

      // 2) busca metadata do usuário
      try {
        const { data } = await api.get('/auth/me');
        if (cancelled) return;
        const current = useAuthStore.getState();
        setSession({
          accessToken: current.accessToken ?? null,
          refreshToken: current.refreshToken ?? null,
          user: data.user,
          tenant: data.tenant,
          permissions: data.permissions,
          role: data.role,
          hydrated: true,
        });
      } catch {
        if (cancelled) return;
        clearSession();
      }
    }

    hydrate();

    return () => {
      cancelled = true;
    };
  }, [setSession, clearSession]);

  return { hydrated };
}
