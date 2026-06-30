import { useAuthStore } from './auth';

/**
 * Check if the current user has a specific permission.
 * Used for frontend conditional rendering — backend is the final authority.
 */
export function can(permission: string): boolean {
  const permissions = useAuthStore.getState().permissions;
  return permissions.includes(permission);
}

/**
 * Check if the current user has any of the given permissions.
 */
export function canAny(...perms: string[]): boolean {
  const permissions = useAuthStore.getState().permissions;
  return perms.some((p) => permissions.includes(p));
}

/**
 * React hook version for use in components.
 */
export function usePermission(permission: string): boolean {
  const permissions = useAuthStore((state) => state.permissions);
  return permissions.includes(permission);
}
