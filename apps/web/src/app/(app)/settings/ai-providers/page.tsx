'use client';

import { AiProviderSettings } from '@/components/settings/AiProviderSettings';
import { useAuthStore } from '@/lib/auth';

export default function AiProvidersSettingsPage() {
  const role = useAuthStore((state) => state.role);
  if (role !== 'admin') {
    return <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">Esta área está disponível apenas para administradores.</div>;
  }
  return <AiProviderSettings />;
}
