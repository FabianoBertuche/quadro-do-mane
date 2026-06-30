'use client';

import Link from 'next/link';
import { useAuthStore } from '@/lib/auth';
import { can } from '@/lib/permissions';
import {
  LayoutDashboard,
  FolderKanban,
  CheckSquare,
  Users,
  Calendar,
  Phone,
  Settings,
  LogOut,
  ChevronLeft,
  UserCircle,
  Mail,
  ScrollText,
} from 'lucide-react';
import { useState } from 'react';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Projetos', href: '/projects', icon: FolderKanban },
  { name: 'Tarefas', href: '/tasks', icon: CheckSquare },
  { name: 'Equipes', href: '/teams', icon: Users },
  { name: 'Colaboradores', href: '/collaborators', icon: UserCircle },
  { name: 'Calendário', href: '/calendar', icon: Calendar },
  { name: 'E-mail', href: '/emails', icon: Mail },
  { name: 'Contatos', href: '/contacts', icon: Phone },
  { name: 'Configurações', href: '/settings', icon: Settings },
];

const auditNav = {
  name: 'Auditoria',
  href: '/audit',
  icon: ScrollText,
  requires: 'audit.view' as const,
};

interface SidebarProps {
  currentPath: string;
}

export function Sidebar({ currentPath }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const tenant = useAuthStore((s) => s.tenant);
  const user = useAuthStore((s) => s.user);
  const clearSession = useAuthStore((s) => s.clearSession);
  // Só renderizamos itens condicionais (ex: Auditoria) depois que o Zustand
  // terminar de hidratar. Antes da hidratação o servidor não conhece as
  // permissions, então renderizar o item geraria mismatch no SSR.
  const hydrated = useAuthStore((s) => s.hydrated);
  const showAudit = hydrated && can(auditNav.requires);

  return (
    <aside
      className={`flex flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-all duration-300 ${collapsed ? 'w-[72px]' : 'w-[260px]'
        }`}
    >
      {/* Logo / Profile */}
      <Link href="/profile" className="flex items-center gap-3 px-4 h-16 border-b border-sidebar-border hover:bg-sidebar-accent transition-colors group relative cursor-pointer">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary flex-shrink-0 overflow-hidden">
          {user?.avatarUrl ? (
            <img src={user.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
          ) : (
            <span className="text-white font-bold">{user?.name?.charAt(0) || 'U'}</span>
          )}
        </div>
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <div className="font-bold text-sm text-white truncate group-hover:text-primary-400 transition-colors">{user?.name || 'Usuário'}</div>
            <div className="text-xs text-sidebar-foreground/60 truncate">{tenant?.name}</div>
          </div>
        )}
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setCollapsed(!collapsed); }}
          className="absolute -right-3 top-5 p-1 rounded-full bg-sidebar-border text-sidebar-foreground hover:text-white hover:bg-sidebar-accent transition-colors shadow-sm"
        >
          <ChevronLeft className={`w-4 h-4 transition-transform ${collapsed ? 'rotate-180' : ''}`} />
        </button>
      </Link>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navigation.map((item) => {
          const isActive = currentPath.startsWith(item.href);
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group ${isActive
                ? 'bg-primary text-white shadow-lg shadow-primary/30'
                : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-white'
                }`}
            >
              <item.icon className={`w-5 h-5 flex-shrink-0 ${isActive ? '' : 'group-hover:scale-110 transition-transform'}`} />
              {!collapsed && <span className="truncate">{item.name}</span>}
            </Link>
          );
        })}
        {showAudit && (
          <Link
            href={auditNav.href}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group ${
              currentPath.startsWith(auditNav.href)
                ? 'bg-primary text-white shadow-lg shadow-primary/30'
                : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-white'
            }`}
          >
            <auditNav.icon className="w-5 h-5 flex-shrink-0 group-hover:scale-110 transition-transform" />
            {!collapsed && <span className="truncate">{auditNav.name}</span>}
          </Link>
        )}
      </nav>

      {/* User / Logout */}
      <div className="px-3 pb-4">
        <button
          onClick={async () => {
            try {
              // chama via import dinâmico para evitar ciclo
              const { api } = await import('@/lib/api');
              await api.post('/auth/logout');
            } catch {
              // ignora — o cookie já pode estar expirado
            }
            clearSession();
            window.location.href = '/login';
          }}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-sidebar-foreground/70 hover:bg-red-500/20 hover:text-red-400 transition-all w-full"
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          {!collapsed && <span>Sair</span>}
        </button>
      </div>
    </aside>
  );
}
