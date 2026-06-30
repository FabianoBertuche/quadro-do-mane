'use client';

import { useAuthStore } from '@/lib/auth';
import { Shield, Building2, User, Bell, Briefcase, Plus, Edit2, Trash2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { TenantEmailAdminCard } from '@/components/emails/TenantEmailAdminCard';

export default function SettingsPage() {
  const user = useAuthStore((s) => s.user);
  const tenant = useAuthStore((s) => s.tenant);
  const role = useAuthStore((s) => s.role);
  const queryClient = useQueryClient();

  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [roleForm, setRoleForm] = useState({ id: '', name: '' });

  const { data: roles } = useQuery({
    queryKey: ['roles'],
    queryFn: () => api.get('/roles').then(r => r.data),
  });

  const saveRoleMutation = useMutation({
    mutationFn: (data: typeof roleForm) => {
      if (data.id) return api.patch(`/roles/${data.id}`, { name: data.name });
      return api.post('/roles', { name: data.name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      setIsRoleModalOpen(false);
      setRoleForm({ id: '', name: '' });
    }
  });

  const deleteRoleMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/roles/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['roles'] }),
  });

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Configurações</h1>
        <p className="text-muted-foreground mt-1">Gerencie sua conta e preferências</p>
      </div>

      {/* Profile Section */}
      <div className="p-6 rounded-2xl bg-card border border-border shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <User className="w-5 h-5 text-primary" />
          <h2 className="font-semibold">Perfil</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-muted-foreground">Nome</label>
            <input type="text" value={user?.name || ''} readOnly className="mt-1 w-full px-4 py-2.5 rounded-xl bg-muted border-0 text-sm" />
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Email</label>
            <input type="email" value={user?.email || ''} readOnly className="mt-1 w-full px-4 py-2.5 rounded-xl bg-muted border-0 text-sm" />
          </div>
        </div>
      </div>

      {/* Tenant Section */}
      <div className="p-6 rounded-2xl bg-card border border-border shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Building2 className="w-5 h-5 text-primary" />
          <h2 className="font-semibold">Empresa</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-muted-foreground">Nome da Empresa</label>
            <input type="text" value={tenant?.name || ''} readOnly className="mt-1 w-full px-4 py-2.5 rounded-xl bg-muted border-0 text-sm" />
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Slug</label>
            <input type="text" value={tenant?.slug || ''} readOnly className="mt-1 w-full px-4 py-2.5 rounded-xl bg-muted border-0 text-sm" />
          </div>
        </div>
      </div>

      {/* Role & Permissions */}
      <div className="p-6 rounded-2xl bg-card border border-border shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-5 h-5 text-primary" />
          <h2 className="font-semibold">Papel e Permissões</h2>
        </div>
        <div className="mb-4">
          <label className="text-sm text-muted-foreground">Papel Atual</label>
          <div className="mt-1 px-4 py-2.5 rounded-xl bg-muted text-sm capitalize">{role || 'admin'}</div>
        </div>
        <p className="text-xs text-muted-foreground">As permissões são gerenciadas pelo administrador da empresa.</p>
      </div>

      {/* Tenant email server (admin only) */}
      {role === "admin" && (
        <TenantEmailAdminCard />
      )}

      {/* Notifications preferences */}
      <div className="p-6 rounded-2xl bg-card border border-border shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Bell className="w-5 h-5 text-primary" />
          <h2 className="font-semibold">Notificações</h2>
        </div>
        <div className="space-y-3">
          {['Novas tarefas atribuídas', 'Comentários em tarefas', 'Prazos próximos', 'Menções'].map((label) => (
            <label key={label} className="flex items-center justify-between p-3 rounded-xl hover:bg-muted/50 transition-colors cursor-pointer">
              <span className="text-sm">{label}</span>
              <input type="checkbox" defaultChecked className="w-4 h-4 text-primary rounded border-border focus:ring-primary" />
            </label>
          ))}
        </div>
      </div>

      {/* Roles / Job Titles Management */}
      <div className="p-6 rounded-2xl bg-card border border-border shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-primary" />
            <h2 className="font-semibold">Funções e Cargos (Relatórios)</h2>
          </div>
          {role === 'admin' && (
            <button
              onClick={() => { setRoleForm({ id: '', name: '' }); setIsRoleModalOpen(true); }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors text-sm font-medium"
            >
              <Plus className="w-4 h-4" /> Nova Função
            </button>
          )}
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Cadastre as funções da sua empresa (ex: Projetista, Pedreiro) para classificar seus colaboradores e agrupar relatórios de performance.
        </p>
        <div className="space-y-2">
          {(roles || []).map((r: any) => (
            <div key={r.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/50 group">
              <div>
                <span className="text-sm font-medium">{r.name}</span>
                {r._count && <span className="ml-2 text-xs text-muted-foreground">({r._count.tenantUsers} colaboradores)</span>}
              </div>
              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                <button
                  onClick={() => { setRoleForm({ id: r.id, name: r.name }); setIsRoleModalOpen(true); }}
                  className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => { if (confirm('Tem certeza?')) deleteRoleMutation.mutate(r.id); }}
                  className="p-1.5 rounded-md hover:bg-red-50 text-muted-foreground hover:text-red-500 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
          {roles?.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma função cadastrada.</p>}
        </div>
      </div>

      <Modal isOpen={isRoleModalOpen} onClose={() => setIsRoleModalOpen(false)} title={roleForm.id ? "Editar Função" : "Nova Função"}>
        <form onSubmit={(e) => { e.preventDefault(); saveRoleMutation.mutate(roleForm); }} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Nome da Função</label>
            <input
              required
              type="text"
              value={roleForm.name}
              onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl bg-muted border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Ex: Engenheiro, Programador"
            />
          </div>
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saveRoleMutation.isPending}
              className="px-6 py-2.5 rounded-xl bg-primary text-white font-medium hover:bg-primary-600 disabled:opacity-50 transition-colors shadow-md shadow-primary/30"
            >
              {saveRoleMutation.isPending ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </Modal>

    </div>
  );
}
