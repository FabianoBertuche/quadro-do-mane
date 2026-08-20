'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { useSession, useBackgroundRefresh } from '@/lib/use-session';
import { useAuthStore } from '@/lib/auth';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '';
  const router = useRouter();
  const { hydrated } = useSession();
  const user = useAuthStore((s) => s.user);
  // Mantém sessão ativa com refresh periódico
  useBackgroundRefresh();

  useEffect(() => {
    if (hydrated && !user) {
      router.replace('/login');
    }
  }, [hydrated, user, router]);

  if (hydrated && !user) {
    return (
      <div className="flex items-center justify-center h-screen text-muted-foreground text-sm">
        Redirecionando para login...
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar currentPath={pathname} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          {!hydrated ? (
            <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
              Carregando sessão...
            </div>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}
