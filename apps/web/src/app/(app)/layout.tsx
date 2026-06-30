'use client';

import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { useSession } from '@/lib/use-session';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '';
  const { hydrated } = useSession();

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
