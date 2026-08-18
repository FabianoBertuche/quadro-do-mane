'use client';

import { useEffect } from 'react';
import axios from 'axios';
import { useAuthStore } from './auth';
import { api, API_URL } from './api';

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
 *     o cookie HttpOnly) — se sucesso, /auth/me. Se falhar, marca
 *     hydrated=true de qualquer forma para o app renderizar.
 *
 * NUCLEAR MODE: nunca limpa sessão nem redireciona. O app sempre renderiza.
 */
export function useSession() {
  const setSession = useAuthStore((s) => s.setSession);
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
      // Tenta refresh via cookie (payload vazio) — usa axios direto para evitar interceptor
      try {
        const res = await axios.post(
          `${API_URL}/auth/refresh`,
          {},
          { withCredentials: true, headers: { 'Content-Type': 'application/json' } },
        );
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

      // 2) busca metadata do usuário (com 1 retry para tolerância a glitches)
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const { data } = await api.get('/auth/me');
          if (cancelled) return;
          const current = useAuthStore.getState();
          setSession({
            accessToken: current.accessToken ?? null,
            refreshToken: current.refreshToken ?? null,
            user: { ...data.user, tenantUserId: data.tenantUserId },
            tenant: data.tenant,
            permissions: data.permissions,
            role: data.role,
            hydrated: true,
          });
          return;
        } catch (err: any) {
          if (cancelled) return;
          if (err?.response?.status === 401) break;
          if (attempt === 0) {
            await new Promise((r) => setTimeout(r, 1000));
          }
        }
      }
      // Even if /auth/me fails, mark as hydrated so the app renders.
      // The user can still navigate and the background refresh will try to recover.
      setSession({ hydrated: true });
    }

    hydrate();

    return () => {
      cancelled = true;
    };
  }, [setSession]);

  return { hydrated };
}

// Background refresh: tenta renovar sessão periodicamente para evitar logout
// silencioso por inatividade. Intervalo padrão 12 horas.
let isRefreshing = false;

export function useBackgroundRefresh(intervalMs = 1000 * 60 * 60 * 12) {
  const hydrated = useAuthStore((s) => s.hydrated);
  const setSession = useAuthStore((s) => s.setSession);

  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    let timer: any = null;

    async function doRefresh() {
      if (isRefreshing) return;
      isRefreshing = true;
      try {
        const refreshToken = useAuthStore.getState().refreshToken;
        if (!refreshToken) return;
        const res = await axios.post(
          `${API_URL}/auth/refresh`,
          { refreshToken },
          { withCredentials: true, headers: { 'Content-Type': 'application/json' } },
        );
        if (cancelled) return;
        if (res.data?.accessToken) {
          setSession({
            accessToken: res.data.accessToken,
            refreshToken: res.data.refreshToken ?? refreshToken,
          });
        }
      } catch {
        // Refresh failed — just log it, NEVER clear session
        console.warn('[background-refresh] Token refresh failed, will retry in next interval');
      } finally {
        isRefreshing = false;
      }
    }

    // Delay first refresh by 5s to avoid racing with useSession.hydrate()
    const initialTimeout = setTimeout(() => {
      if (!cancelled) doRefresh();
    }, 5000);
    timer = setInterval(doRefresh, intervalMs);

    return () => {
      cancelled = true;
      clearTimeout(initialTimeout);
      if (timer) clearInterval(timer);
    };
  }, [hydrated, intervalMs, setSession]);
}
