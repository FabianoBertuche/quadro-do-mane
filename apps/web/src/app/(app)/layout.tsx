'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { useSession, useBackgroundRefresh } from '@/lib/use-session';
import { useAuthStore } from '@/lib/auth';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '';
  const router = useRouter();
  const { hydrated } = useSession();
  const user = useAuthStore((s) => s.user);
  const [mobileOpen, setMobileOpen] = useState(false);
  useBackgroundRefresh();

  useEffect(() => {
    if (hydrated && !user) {
      router.replace('/login');
    }
  }, [hydrated, user, router]);

  // Close mobile sidebar on navigation
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const toggleMobile = useCallback(() => setMobileOpen((v) => !v), []);

  if (hydrated && !user) {
    return (
      <div className="flex items-center justify-center h-screen text-muted-foreground text-sm">
        Redirecionando para login...
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar currentPath={pathname} mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header onMenuToggle={toggleMobile} mobileOpen={mobileOpen} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
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
