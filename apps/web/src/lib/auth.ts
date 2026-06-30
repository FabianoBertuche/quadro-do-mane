import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface AuthUser {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  phone?: string;
}

interface AuthTenant {
  id: string;
  name: string;
  slug: string;
}

interface SessionPayload {
  accessToken?: string | null;
  refreshToken?: string | null;
  user?: AuthUser | null;
  tenant?: AuthTenant | null;
  permissions?: string[];
  role?: string | null;
  hydrated?: boolean;
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  tenant: AuthTenant | null;
  permissions: string[];
  role: string | null;
  hydrated: boolean;

  setSession: (data: SessionPayload) => void;
  clearSession: () => void;
  isAuthenticated: () => boolean;
}

/**
 * Store de auth que prioriza cookies HttpOnly mas mantém fallback em
 * sessionStorage para DEV (onde cookies cross-port são bloqueados pelo Chrome).
 *
 * Em produção (HTTPS + mesmo domínio), os cookies HttpOnly funcionam e o frontend
 * lê via /auth/me. Em DEV, o frontend usa tokens do body via Zustand.
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      tenant: null,
      permissions: [],
      role: null,
      hydrated: false,

      setSession: (data) =>
        set((state) => ({
          ...state,
          ...data,
          hydrated: data.hydrated ?? true,
        })),

      clearSession: () =>
        set({
          accessToken: null,
          refreshToken: null,
          user: null,
          tenant: null,
          permissions: [],
          role: null,
          hydrated: true,
        }),

      isAuthenticated: () => !!get().user,
    }),
    {
      name: 'quadro-auth-dev',
      storage: createJSONStorage(() =>
        typeof window === 'undefined'
          ? ({ getItem: () => null, setItem: () => {}, removeItem: () => {} } as any)
          : window.sessionStorage,
      ),
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
        tenant: state.tenant,
        permissions: state.permissions,
        role: state.role,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.hydrated = true;
        }
      },
    },
  ),
);
