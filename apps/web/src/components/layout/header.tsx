'use client';

import { useAuthStore } from '@/lib/auth';
import { Bell, Search, Menu, X } from 'lucide-react';

interface HeaderProps {
  onMenuToggle: () => void;
  mobileOpen?: boolean;
}

export function Header({ onMenuToggle, mobileOpen }: HeaderProps) {
  const user = useAuthStore((s) => s.user);

  return (
    <header className="h-16 border-b border-border bg-background/80 backdrop-blur-md flex items-center justify-between px-4 md:px-6">
      {/* Left: hamburger (mobile) + search */}
      <div className="flex items-center gap-3 flex-1 max-w-md">
        <button
          onClick={onMenuToggle}
          className="p-2 rounded-xl hover:bg-muted transition-colors lg:hidden"
          aria-label={mobileOpen ? 'Fechar menu' : 'Abrir menu'}
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <X className="w-5 h-5 text-muted-foreground" /> : <Menu className="w-5 h-5 text-muted-foreground" />}
        </button>
        <div className="relative w-full hidden sm:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar tarefas, projetos..."
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-muted border-0 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-4">
        <button className="relative p-2 rounded-xl hover:bg-muted transition-colors">
          <Bell className="w-5 h-5 text-muted-foreground" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-error rounded-full" />
        </button>

        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center">
            <span className="text-sm font-semibold text-primary">
              {user?.name?.charAt(0)?.toUpperCase() || 'U'}
            </span>
          </div>
          <div className="hidden lg:block">
            <div className="text-sm font-medium">{user?.name}</div>
            <div className="text-xs text-muted-foreground">{user?.email}</div>
          </div>
        </div>
      </div>
    </header>
  );
}
