import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
}

export interface AuthTenant {
  id: string;
  name: string;
  slug: string;
}

export interface SessionPayload {
  accessToken?: string | null;
  refreshToken?: string | null;
  user?: AuthUser | null;
  tenant?: AuthTenant | null;
  permissions?: string[];
  role?: string | null;
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
  markHydrated: () => void;
  clearSession: () => void;
}

const AT_KEY = 'qd_access_token';
const RT_KEY = 'qd_refresh_token';

/**
 * Store de autenticação do mobile.
 *
 * Diferente da web (que usa cookies HttpOnly), o app guarda APENAS os tokens
 * no expo-secure-store (Keystore/Keychain). Perfil, tenant e permissões
 * ficam em memória e são recarregados via GET /auth/me no boot.
 */
export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  refreshToken: null,
  user: null,
  tenant: null,
  permissions: [],
  role: null,
  hydrated: false,

  setSession: (data) => {
    if (typeof data.accessToken === 'string') {
      void SecureStore.setItemAsync(AT_KEY, data.accessToken);
    }
    if (typeof data.refreshToken === 'string') {
      void SecureStore.setItemAsync(RT_KEY, data.refreshToken);
    }
    set((state) => ({
      ...state,
      ...(data.accessToken !== undefined ? { accessToken: data.accessToken } : {}),
      ...(data.refreshToken !== undefined ? { refreshToken: data.refreshToken } : {}),
      ...(data.user !== undefined ? { user: data.user } : {}),
      ...(data.tenant !== undefined ? { tenant: data.tenant } : {}),
      ...(data.permissions !== undefined ? { permissions: data.permissions } : {}),
      ...(data.role !== undefined ? { role: data.role } : {}),
    }));
  },

  markHydrated: () => set({ hydrated: true }),

  clearSession: () => {
    void SecureStore.deleteItemAsync(AT_KEY);
    void SecureStore.deleteItemAsync(RT_KEY);
    set({
      accessToken: null,
      refreshToken: null,
      user: null,
      tenant: null,
      permissions: [],
      role: null,
      hydrated: true,
    });
  },
}));

/** Lê os tokens persistidos no SecureStore. */
export async function loadStoredTokens(): Promise<{
  accessToken: string;
  refreshToken: string;
} | null> {
  try {
    const [accessToken, refreshToken] = await Promise.all([
      SecureStore.getItemAsync(AT_KEY),
      SecureStore.getItemAsync(RT_KEY),
    ]);
    if (!accessToken || !refreshToken) return null;
    return { accessToken, refreshToken };
  } catch {
    return null;
  }
}
