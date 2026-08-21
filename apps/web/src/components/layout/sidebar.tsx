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
  ListChecks,
  ClipboardCheck,
  Activity,
  X,
} from 'lucide-react';
import { useState, useEffect, Fragment } from 'react';

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

const monitorRoutineNav = {
  name: 'Monitorar Rotina',
  href: '/daily-routine/admin',
  icon: ClipboardCheck,
};

const manageRoutineNav = {
  name: 'Gerenciar Rotinas',
  href: '/daily-routine/manage',
  icon: Settings,
};

const operationalNav = {
  name: 'Atividades',
  href: '/operational',
  icon: Activity,
  requires: 'audit.view' as const,
};

interface SidebarProps {
  currentPath: string;
  mobileOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ currentPath, mobileOpen, onClose }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const tenant = useAuthStore((s) => s.tenant);
  const user = useAuthStore((s) => s.user);
  const role = useAuthStore((s) => s.role);
  const hydrated = useAuthStore((s) => s.hydrated);
  const showAudit = hydrated && can(auditNav.requires);
  const showMonitorRoutine = hydrated && role === 'admin';
  const showManageRoutine = hydrated && role === 'admin';
  const showOperational = hydrated && can(operationalNav.requires);

  const handleLinkClick = () => {
    onClose();
  };

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileOpen, onClose]);

  const navLinkClass = (isActive: boolean) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group ${
      isActive
        ? 'bg-primary text-white shadow-lg shadow-primary/30'
        : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-white'
    }`;

  const navIconClass = (isActive: boolean) =>
    `w-5 h-5 flex-shrink-0 ${isActive ? '' : 'group-hover:scale-110 transition-transform'}`;

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/50 lg:hidden transition-opacity duration-300 ${
          mobileOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sidebar */}
      <aside
        className={`
          flex flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-all duration-300
          fixed inset-y-0 left-0 z-50 lg:relative
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          ${collapsed && !mobileOpen ? 'w-[72px]' : 'w-[260px] max-w-[85vw]'}
        `}
      >
        {/* Logo / Profile */}
        <Link href="/profile" onClick={handleLinkClick} className="flex items-center gap-3 px-4 h-16 border-b border-sidebar-border hover:bg-sidebar-accent transition-colors group relative cursor-pointer">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary flex-shrink-0 overflow-hidden">
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <span className="text-white font-bold">{user?.name?.charAt(0) || 'U'}</span>
            )}
          </div>
          {(!collapsed || mobileOpen) && (
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm text-white truncate group-hover:text-primary-400 transition-colors">{user?.name || 'Usuário'}</div>
              <div className="text-xs text-sidebar-foreground/60 truncate">{tenant?.name}</div>
            </div>
          )}
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setCollapsed(!collapsed); }}
            className="absolute -right-3 top-5 p-1 rounded-full bg-sidebar-border text-sidebar-foreground hover:text-white hover:bg-sidebar-accent transition-colors shadow-sm hidden lg:block"
            aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
          >
            <ChevronLeft className={`w-4 h-4 transition-transform ${collapsed ? 'rotate-180' : ''}`} />
          </button>
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClose(); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full text-sidebar-foreground/70 hover:text-white hover:bg-sidebar-accent transition-colors lg:hidden"
            aria-label="Fechar menu"
          >
            <X className="w-4 h-4" />
          </button>
        </Link>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navigation.map((item) => {
            const isActive = currentPath.startsWith(item.href);
            return (
              <Fragment key={item.name}>
                <Link
                  href={item.href}
                  onClick={handleLinkClick}
                  className={navLinkClass(isActive)}
                >
                  <item.icon className={navIconClass(isActive)} />
                  {(!collapsed || mobileOpen) && <span className="truncate">{item.name}</span>}
                </Link>
                {item.href === '/calendar' && (
                  <div className="mt-2">
                    {(!collapsed || mobileOpen) && (
                      <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
                        Rotina Diária
                      </div>
                    )}
                    <div className="space-y-0.5">
                      <Link
                        href="/daily-routine"
                        onClick={handleLinkClick}
                        className={navLinkClass(currentPath.startsWith('/daily-routine') && !currentPath.includes('admin') && !currentPath.includes('manage'))}
                      >
                        <ListChecks className={navIconClass(false)} />
                        {(!collapsed || mobileOpen) && <span className="truncate">Rotina Diária</span>}
                      </Link>
                      {showMonitorRoutine && (
                        <Link
                          href={monitorRoutineNav.href}
                          onClick={handleLinkClick}
                          className={navLinkClass(currentPath.startsWith(monitorRoutineNav.href))}
                        >
                          <monitorRoutineNav.icon className={navIconClass(false)} />
                          {(!collapsed || mobileOpen) && <span className="truncate">{monitorRoutineNav.name}</span>}
                        </Link>
                      )}
                      {showManageRoutine && (
                        <Link
                          href={manageRoutineNav.href}
                          onClick={handleLinkClick}
                          className={navLinkClass(currentPath.startsWith(manageRoutineNav.href))}
                        >
                          <manageRoutineNav.icon className={navIconClass(false)} />
                          {(!collapsed || mobileOpen) && <span className="truncate">{manageRoutineNav.name}</span>}
                        </Link>
                      )}
                    </div>
                  </div>
                )}
              </Fragment>
            );
          })}
          {showAudit && (
            <Link
              href={auditNav.href}
              onClick={handleLinkClick}
              className={navLinkClass(currentPath.startsWith(auditNav.href))}
            >
              <auditNav.icon className={navIconClass(false)} />
              {(!collapsed || mobileOpen) && <span className="truncate">{auditNav.name}</span>}
            </Link>
          )}
          {showOperational && (
            <Link
              href={operationalNav.href}
              onClick={handleLinkClick}
              className={navLinkClass(currentPath.startsWith(operationalNav.href))}
            >
              <operationalNav.icon className={navIconClass(false)} />
              {(!collapsed || mobileOpen) && <span className="truncate">{operationalNav.name}</span>}
            </Link>
          )}
        </nav>

        {/* User / Logout */}
        <div className="px-3 pb-4">
          <button
            onClick={async () => {
              handleLinkClick();
              try {
                const { api } = await import('@/lib/api');
                await api.post('/auth/logout');
              } catch {
                // noop
              }
              useAuthStore.getState().logout();
              window.location.href = '/login';
            }}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-sidebar-foreground/70 hover:bg-red-500/20 hover:text-red-400 transition-all w-full"
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            {(!collapsed || mobileOpen) && <span>Sair</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
