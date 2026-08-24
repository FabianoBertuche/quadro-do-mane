import { useAuthStore } from './auth';

/**
 * Verificação de permissões no cliente — paridade com apps/web/src/lib/permissions.ts.
 * O backend continua sendo a autoridade final.
 */
export function can(permission: string): boolean {
  return useAuthStore.getState().permissions.includes(permission);
}

export function canAny(...perms: string[]): boolean {
  const permissions = useAuthStore.getState().permissions;
  return perms.some((p) => permissions.includes(p));
}

export function usePermission(permission: string): boolean {
  const permissions = useAuthStore((state) => state.permissions);
  return permissions.includes(permission);
}
