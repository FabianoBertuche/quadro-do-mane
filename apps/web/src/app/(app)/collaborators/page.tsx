'use client';

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Edit2,
  ShieldCheck,
  PowerOff,
  Power,
  Search,
  Filter,
  UserCircle,
  Briefcase,
  Info,
} from 'lucide-react';
import { api } from '@/lib/api';
import { usePermission } from '@/lib/permissions';
import { useAuthStore } from '@/lib/auth';
import { Modal } from '@/components/ui/Modal';
import {
  AssignRolePayload,
  CreateUserPayload,
  EffectivePermissions,
  RoleLite,
  SetStatusPayload,
  TenantUserCard,
  TenantUserStatus,
  UpdateUserPayload,
} from '@/types/user';

// ────────────────────────────────────────────────────────────────────────
// Helpers visuais
// ────────────────────────────────────────────────────────────────────────

const STATUS_META: Record<TenantUserStatus, { label: string; classes: string }> = {
  ACTIVE: {
    label: 'Ativo',
    classes: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  },
  INVITED: {
    label: 'Convidado',
    classes: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  },
  SUSPENDED: {
    label: 'Suspenso',
    classes: 'bg-rose-500/10 text-rose-600 border-rose-500/20',
  },
};

function StatusBadge({ status }: { status: TenantUserStatus }) {
  const meta = STATUS_META[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] font-medium ${meta.classes}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {meta.label}
    </span>
  );
}

function RolePill({ role }: { role: RoleLite | null }) {
  if (!role) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-500/10 text-slate-600 text-[11px] font-medium">
        <UserCircle className="w-3 h-3" /> Sem função
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/10 text-amber-600 text-[11px] font-medium">
      <ShieldCheck className="w-3 h-3" /> {role.name}
    </span>
  );
}

function UserAvatar({ name, url }: { name: string; url?: string | null }) {
  if (url) {
    return (
      <img
        src={url}
        alt={name}
        className="w-12 h-12 rounded-full object-cover flex-shrink-0"
      />
    );
  }
  const initial = (name || '?').trim().charAt(0).toUpperCase();
  // cor determinística baseada em hash do nome
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  const hue = hash % 360;
  return (
    <div
      className="w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0"
      style={{ backgroundColor: `hsl(${hue} 65% 55%)` }}
    >
      {initial}
    </div>
  );
}

function extractErrorMessage(err: any, fallback: string): string {
  const data = err?.response?.data;
  if (Array.isArray(data?.message)) return data.message.join(', ');
  if (typeof data?.message === 'string') return data.message;
  return fallback;
}

// ────────────────────────────────────────────────────────────────────────
// Página principal
// ────────────────────────────────────────────────────────────────────────

type DialogMode =
  | { type: 'none' }
  | { type: 'create' }
  | { type: 'edit'; tenantUser: TenantUserCard }
  | { type: 'role'; tenantUser: TenantUserCard }
  | { type: 'status'; tenantUser: TenantUserCard };

export default function CollaboratorsPage() {
  const qc = useQueryClient();
  const currentUserId = useAuthStore((s) => s.user?.id);

  const canCreate = usePermission('users.create');
  const canEdit = usePermission('users.edit');
  const canDisable = usePermission('users.disable');
  const canView = usePermission('users.view');

  const [dialog, setDialog] = useState<DialogMode>({ type: 'none' });
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [toast, setToast] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  // ── Queries ─────────────────────────────────────────────────────────
  // Lista completa: exige users.view. Não retentamos em 401/403 — se o
  // usuário não tiver essa permissão, vamos usar o fallback selfQuery.
  const usersQuery = useQuery<TenantUserCard[]>({
    queryKey: ['users'],
    queryFn: async () => (await api.get('/users')).data,
    retry: (failureCount, error: any) => {
      const status = error?.response?.status;
      if (status === 401 || status === 403) return false;
      return failureCount < 2;
    },
  });

  // Fallback: vínculo do próprio usuário (sempre permitido).
  // Quando o usuário não tem users.view (403 em /users), exibimos
  // apenas o card dele para permitir a autoedição do próprio perfil.
  const selfQuery = useQuery<TenantUserCard>({
    queryKey: ['users', 'me', 'tenant-link'],
    queryFn: async () => (await api.get('/users/me/tenant-link')).data,
    enabled: !canView,
  });

  const rolesQuery = useQuery<RoleLite[]>({
    queryKey: ['roles'],
    queryFn: async () => (await api.get('/roles')).data,
    retry: (failureCount, error: any) => {
      const status = error?.response?.status;
      if (status === 401 || status === 403) return false;
      return failureCount < 2;
    },
  });

  // Lista exibida: completa se tiver users.view, senão só o próprio card.
  const users: TenantUserCard[] = useMemo(() => {
    if (canView) return usersQuery.data ?? [];
    return selfQuery.data ? [selfQuery.data] : [];
  }, [canView, usersQuery.data, selfQuery.data]);

  const isLoading = canView ? usersQuery.isLoading : selfQuery.isLoading;

  const filtered = useMemo(() => {
    return users.filter((u) => {
      if (!showInactive && u.status === 'SUSPENDED') return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        u.user?.name?.toLowerCase().includes(q) ||
        u.user?.email?.toLowerCase().includes(q) ||
        u.jobTitle?.toLowerCase().includes(q)
      );
    });
  }, [users, search, showInactive]);

  // ── Mutations ──────────────────────────────────────────────────────
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['users'] });
    qc.invalidateQueries({ queryKey: ['users', 'me', 'tenant-link'] });
    qc.invalidateQueries({ queryKey: ['audit-log'] });
  };

  const createMutation = useMutation({
    mutationFn: async (data: CreateUserPayload) =>
      (await api.post('/users', data)).data,
    onSuccess: () => {
      invalidate();
      setToast({ kind: 'success', text: 'Colaborador criado com sucesso' });
      setDialog({ type: 'none' });
    },
    onError: (e) =>
      setToast({ kind: 'error', text: extractErrorMessage(e, 'Erro ao criar colaborador') }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data, isSelf }: { id: string; data: UpdateUserPayload; isSelf?: boolean }) => {
      // Quando o usuário está editando o próprio card em modo fallback
      // (sem users.edit), usa o endpoint dedicado /users/me/tenant-link
      // que aceita apenas campos seguros (sem role/status/email).
      if (isSelf && !canEdit) {
        const safe: any = {};
        if (data.name !== undefined) safe.name = data.name;
        if (data.phone !== undefined) safe.phone = data.phone;
        if (data.jobTitle !== undefined) safe.jobTitle = data.jobTitle;
        if (data.department !== undefined) safe.department = data.department;
        return (await api.patch('/users/me/tenant-link', safe)).data;
      }
      return (await api.patch(`/users/${id}`, data)).data;
    },
    onSuccess: () => {
      invalidate();
      setToast({ kind: 'success', text: 'Colaborador atualizado' });
      setDialog({ type: 'none' });
    },
    onError: (e) =>
      setToast({ kind: 'error', text: extractErrorMessage(e, 'Erro ao atualizar') }),
  });

  const roleMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: AssignRolePayload }) =>
      (await api.patch(`/users/${id}/role`, data)).data,
    onSuccess: () => {
      invalidate();
      setToast({ kind: 'success', text: 'Função atualizada' });
      setDialog({ type: 'none' });
    },
    onError: (e) =>
      setToast({ kind: 'error', text: extractErrorMessage(e, 'Erro ao trocar função') }),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: SetStatusPayload }) =>
      (await api.patch(`/users/${id}/status`, data)).data,
    onSuccess: (_res, vars) => {
      invalidate();
      const label = vars.data.status === 'ACTIVE' ? 'reativado' : vars.data.status === 'SUSPENDED' ? 'suspenso' : 'redefinido como convidado';
      setToast({ kind: 'success', text: `Colaborador ${label}` });
      setDialog({ type: 'none' });
    },
    onError: (e) =>
      setToast({ kind: 'error', text: extractErrorMessage(e, 'Erro ao alterar status') }),
  });

  // ── Render ──────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium border ${
            toast.kind === 'success'
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-rose-50 text-rose-700 border-rose-200'
          }`}
          onAnimationEnd={() => setToast(null)}
          role="status"
        >
          {toast.text}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Colaboradores</h1>
          <p className="text-muted-foreground mt-1">
            {canView
              ? 'Gerencie quem participa desta empresa, suas funções e status de acesso.'
              : 'Veja e edite o seu próprio perfil de colaborador nesta empresa.'}
          </p>
        </div>
        {canCreate && (
          <button
            onClick={() => setDialog({ type: 'create' })}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white font-medium hover:bg-primary-600 transition-colors shadow-lg shadow-primary/30"
          >
            <Plus className="w-4 h-4" /> Novo colaborador
          </button>
        )}
      </div>

      {/* Aviso informativo quando o usuário não tem users.view */}
      {!canView && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-500/5 border border-blue-500/20 text-sm text-blue-700 dark:text-blue-300">
          <Info className="w-5 h-5 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium">Acesso somente ao seu próprio perfil</p>
            <p className="text-blue-700/80 dark:text-blue-300/80 mt-0.5">
              Você não possui permissão para visualizar a lista completa de
              colaboradores deste workspace. Apenas o seu card é exibido para
              que você possa manter seus dados atualizados. Caso precise de
              acesso completo, solicite ao responsável da empresa.
            </p>
          </div>
        </div>
      )}

      {/* Filtros — só para quem tem a lista completa */}
      {canView && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome, e-mail ou cargo..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
            />
            <Filter className="w-4 h-4" />
            Mostrar suspensos/convidados
          </label>
        </div>
      )}

      {/* Grid de cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-2">
        {isLoading ? (
          [1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-32 rounded-2xl bg-muted animate-pulse" />
          ))
        ) : filtered.length === 0 ? (
          <div className="col-span-full text-center py-16 text-muted-foreground border border-dashed border-border rounded-2xl">
            {canView
              ? 'Nenhum colaborador encontrado com os filtros atuais.'
              : 'Não foi possível carregar o seu perfil de colaborador.'}
          </div>
        ) : (
          filtered.map((tu) => {
            const isSelf = tu.user?.id === currentUserId;
            // Permissões efetivas do card:
            //  - Em modo "lista completa", segue canEdit/canDisable do usuário logado.
            //  - Em modo "somente o próprio", o usuário pode SEMPRE editar a si mesmo.
            const mayEdit = canView ? canEdit : isSelf;
            const mayChangeRole = canView ? canEdit : false;
            const mayChangeStatus = canView ? canDisable : false;
            return (
              <div
                key={tu.id}
                className="p-5 rounded-2xl bg-card border border-border shadow-sm hover:shadow-md transition-shadow flex flex-col gap-3"
              >
                <div className="flex items-center gap-4">
                  <UserAvatar name={tu.user?.name ?? '?'} url={tu.user?.avatarUrl} />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-base truncate flex items-center gap-2">
                      {tu.user?.name}
                      {isSelf && (
                        <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                          você
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-muted-foreground truncate">
                      {tu.user?.email}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 items-center">
                  <StatusBadge status={tu.status} />
                  <RolePill role={tu.role} />
                  {tu.jobTitle && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-500/10 text-blue-600 text-[11px] font-medium">
                      <Briefcase className="w-3 h-3" />
                      {tu.jobTitle}
                    </span>
                  )}
                </div>

                {tu.teamMemberships?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {tu.teamMemberships.map((m) => (
                      <span
                        key={m.team.id}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] border border-border bg-muted/50"
                      >
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: m.team.color ?? '#888' }}
                        />
                        {m.team.name}
                      </span>
                    ))}
                  </div>
                )}

                {/* Ações */}
                <div className="mt-auto pt-2 flex items-center justify-end gap-1">
                  {mayEdit && (
                    <button
                      onClick={() => setDialog({ type: 'edit', tenantUser: tu })}
                      className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                      title="Editar dados"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  )}
                  {mayChangeRole && (
                    <button
                      onClick={() => setDialog({ type: 'role', tenantUser: tu })}
                      className="p-2 rounded-lg text-muted-foreground hover:text-amber-600 hover:bg-amber-500/10 transition-colors"
                      title="Trocar função"
                    >
                      <ShieldCheck className="w-4 h-4" />
                    </button>
                  )}
                  {mayChangeStatus && !isSelf && (
                    <button
                      onClick={() => setDialog({ type: 'status', tenantUser: tu })}
                      className={`p-2 rounded-lg transition-colors ${
                        tu.status === 'SUSPENDED'
                          ? 'text-emerald-600 hover:bg-emerald-500/10'
                          : 'text-rose-500 hover:bg-rose-500/10'
                      }`}
                      title={tu.status === 'SUSPENDED' ? 'Reativar' : 'Suspender'}
                    >
                      {tu.status === 'SUSPENDED' ? (
                        <Power className="w-4 h-4" />
                      ) : (
                        <PowerOff className="w-4 h-4" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modais */}
      {dialog.type === 'create' && (
        <UserFormModal
          mode="create"
          roles={rolesQuery.data ?? []}
          submitting={createMutation.isPending}
          onCancel={() => setDialog({ type: 'none' })}
          onSubmit={(payload) => createMutation.mutate(payload as CreateUserPayload)}
        />
      )}

      {dialog.type === 'edit' && (
        <UserFormModal
          mode="edit"
          tenantUser={dialog.tenantUser}
          roles={rolesQuery.data ?? []}
          submitting={updateMutation.isPending}
          onCancel={() => setDialog({ type: 'none' })}
          onSubmit={(payload) =>
            updateMutation.mutate({
              id: dialog.tenantUser.id,
              data: payload,
              isSelf: dialog.tenantUser.user?.id === currentUserId,
            })
          }
        />
      )}

      {dialog.type === 'role' && (
        <RoleChangeModal
          tenantUser={dialog.tenantUser}
          roles={rolesQuery.data ?? []}
          submitting={roleMutation.isPending}
          onCancel={() => setDialog({ type: 'none' })}
          onSubmit={(roleId) =>
            roleMutation.mutate({ id: dialog.tenantUser.id, data: { roleId } })
          }
        />
      )}

      {dialog.type === 'status' && (
        <StatusChangeModal
          tenantUser={dialog.tenantUser}
          submitting={statusMutation.isPending}
          onCancel={() => setDialog({ type: 'none' })}
          onSubmit={(payload) =>
            statusMutation.mutate({ id: dialog.tenantUser.id, data: payload })
          }
        />
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Modal: criar / editar usuário
// ────────────────────────────────────────────────────────────────────────

interface UserFormModalProps {
  mode: 'create' | 'edit';
  tenantUser?: TenantUserCard;
  roles: RoleLite[];
  submitting: boolean;
  onCancel: () => void;
  onSubmit: (payload: CreateUserPayload | UpdateUserPayload) => void;
}

function UserFormModal({
  mode,
  tenantUser,
  roles,
  submitting,
  onCancel,
  onSubmit,
}: UserFormModalProps) {
  const [name, setName] = useState(tenantUser?.user?.name ?? '');
  const [email, setEmail] = useState(tenantUser?.user?.email ?? '');
  const [phone, setPhone] = useState(tenantUser?.user?.phone ?? '');
  const [password, setPassword] = useState('');
  const [roleId, setRoleId] = useState<string>(tenantUser?.roleId ?? '');
  const [jobTitle, setJobTitle] = useState(tenantUser?.jobTitle ?? '');
  const [department, setDepartment] = useState(tenantUser?.department ?? '');
  const [sendInvite, setSendInvite] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'create') {
      const payload: CreateUserPayload = {
        name,
        email,
        phone: phone || undefined,
        password: sendInvite ? undefined : password || undefined,
        roleId: roleId || undefined,
        jobTitle: jobTitle || undefined,
        department: department || undefined,
        sendInvite,
      };
      onSubmit(payload);
    } else {
      const payload: UpdateUserPayload = {
        name,
        email,
        phone: phone || undefined,
        password: password || undefined,
        roleId: roleId || null,
        jobTitle: jobTitle || undefined,
        department: department || undefined,
      };
      onSubmit(payload);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onCancel}
      title={mode === 'create' ? 'Novo colaborador' : 'Editar colaborador'}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1.5">Nome completo</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            minLength={2}
            className="w-full px-4 py-2.5 rounded-xl bg-muted border border-border focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">E-mail (login)</label>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-muted border border-border focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Telefone</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-muted border border-border focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Cargo</label>
            <input
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-muted border border-border focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Departamento</label>
            <input
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-muted border border-border focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">
              Função no sistema
            </label>
            <select
              value={roleId}
              onChange={(e) => setRoleId(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-muted border border-border focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Sem função</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">
              {mode === 'edit' ? 'Nova senha (opcional)' : 'Senha provisória'}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required={mode === 'create' && !sendInvite}
              placeholder={mode === 'edit' ? 'Deixe em branco para manter' : ''}
              className="w-full px-4 py-2.5 rounded-xl bg-muted border border-border focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground"
            />
          </div>
        </div>

        {mode === 'create' && (
          <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={sendInvite}
              onChange={(e) => setSendInvite(e.target.checked)}
              className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
            />
            Enviar como convite (sem senha imediata, status = convidado)
          </label>
        )}

        <div className="pt-2 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2.5 rounded-xl border border-border text-foreground hover:bg-muted transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2.5 rounded-xl bg-primary text-white font-medium hover:bg-primary-600 disabled:opacity-50 transition-colors shadow-lg shadow-primary/30"
          >
            {submitting ? 'Salvando...' : mode === 'create' ? 'Criar colaborador' : 'Salvar alterações'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Modal: trocar role
// ────────────────────────────────────────────────────────────────────────

interface RoleChangeModalProps {
  tenantUser: TenantUserCard;
  roles: RoleLite[];
  submitting: boolean;
  onCancel: () => void;
  onSubmit: (roleId: string | null) => void;
}

function RoleChangeModal({
  tenantUser,
  roles,
  submitting,
  onCancel,
  onSubmit,
}: RoleChangeModalProps) {
  const [roleId, setRoleId] = useState<string>(tenantUser.roleId ?? '');
  return (
    <Modal isOpen onClose={onCancel} title="Trocar função">
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
          <UserAvatar name={tenantUser.user?.name ?? '?'} url={tenantUser.user?.avatarUrl} />
          <div>
            <p className="font-semibold">{tenantUser.user?.name}</p>
            <p className="text-xs text-muted-foreground">{tenantUser.user?.email}</p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">
            Função atual:{' '}
            <span className="font-normal text-muted-foreground">
              {tenantUser.role?.name ?? 'Sem função'}
            </span>
          </label>
          <select
            value={roleId}
            onChange={(e) => setRoleId(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl bg-muted border border-border focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Sem função</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>

        <div className="pt-2 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2.5 rounded-xl border border-border hover:bg-muted transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => onSubmit(roleId || null)}
            className="px-6 py-2.5 rounded-xl bg-amber-500 text-white font-medium hover:bg-amber-600 disabled:opacity-50 transition-colors shadow-lg shadow-amber-500/30"
          >
            {submitting ? 'Salvando...' : 'Confirmar troca'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Modal: suspender / reativar / convidado
// ────────────────────────────────────────────────────────────────────────

interface StatusChangeModalProps {
  tenantUser: TenantUserCard;
  submitting: boolean;
  onCancel: () => void;
  onSubmit: (payload: SetStatusPayload) => void;
}

function StatusChangeModal({
  tenantUser,
  submitting,
  onCancel,
  onSubmit,
}: StatusChangeModalProps) {
  const [status, setStatus] = useState<TenantUserStatus>(
    tenantUser.status === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED'
  );
  const [reason, setReason] = useState('');

  return (
    <Modal isOpen onClose={onCancel} title="Alterar status de acesso">
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
          <UserAvatar name={tenantUser.user?.name ?? '?'} url={tenantUser.user?.avatarUrl} />
          <div>
            <p className="font-semibold">{tenantUser.user?.name}</p>
            <p className="text-xs text-muted-foreground">
              Status atual: <StatusBadge status={tenantUser.status} />
            </p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">Novo status</label>
          <div className="grid grid-cols-3 gap-2">
            {(['ACTIVE', 'INVITED', 'SUSPENDED'] as TenantUserStatus[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                className={`px-3 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                  status === s
                    ? 'bg-primary text-white border-primary'
                    : 'border-border text-foreground hover:bg-muted'
                }`}
              >
                {STATUS_META[s].label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">
            Motivo (opcional, fica no log)
          </label>
          <textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ex: licença médica, férias, desvio de conduta..."
            className="w-full px-4 py-2.5 rounded-xl bg-muted border border-border focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground"
          />
        </div>

        <div className="pt-2 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2.5 rounded-xl border border-border hover:bg-muted transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => onSubmit({ status, reason: reason || undefined })}
            className={`px-6 py-2.5 rounded-xl text-white font-medium disabled:opacity-50 transition-colors shadow-lg ${
              status === 'ACTIVE'
                ? 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/30'
                : status === 'SUSPENDED'
                ? 'bg-rose-500 hover:bg-rose-600 shadow-rose-500/30'
                : 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/30'
            }`}
          >
            {submitting ? 'Salvando...' : 'Confirmar'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
