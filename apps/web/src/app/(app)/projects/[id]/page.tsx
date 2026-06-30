'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Users, Calendar, Kanban, Plus, X, Edit2 } from 'lucide-react';
import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';

export default function ProjectDetailPage() {
  const params = useParams();
  const id = params?.id as string | undefined;
  const queryClient = useQueryClient();

  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const { data: project, isLoading } = useQuery({
    queryKey: ['project', id],
    queryFn: () => api.get(`/projects/${id}`).then((r) => {
      setSelectedTeamId(r.data.teamId || '');
      return r.data;
    }),
    enabled: !!id,
  });

  const { data: teams } = useQuery({
    queryKey: ['teams'],
    queryFn: () => api.get('/teams').then((r) => r.data),
  });

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then((r) => r.data),
  });

  const updateTeamMutation = useMutation({
    mutationFn: (teamId: string) => api.patch(`/projects/${id}`, { teamId: teamId || null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', id] });
      setIsTeamModalOpen(false);
    },
  });

  const addMemberMutation = useMutation({
    mutationFn: (tenantUserId: string) => api.post(`/projects/${id}/members`, { tenantUserId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', id] });
      setIsMemberModalOpen(false);
      setSelectedUserId('');
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: (tenantUserId: string) => api.delete(`/projects/${id}/members/${tenantUserId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['project', id] }),
  });

  if (isLoading) return <div className="animate-pulse h-96 rounded-2xl bg-muted" />;
  if (!project) return <div className="text-center py-20 text-muted-foreground">Projeto não encontrado</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/projects" className="p-2 rounded-xl hover:bg-muted transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">{project.name}</h1>
          <p className="text-muted-foreground text-sm">{project.code} • {project.status}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {project.description && (
            <div className="p-5 rounded-2xl bg-card border border-border">
              <h3 className="font-semibold mb-2">Descrição</h3>
              <p className="text-sm text-muted-foreground">{project.description}</p>
            </div>
          )}
          <div className="flex gap-3">
            <Link href={`/tasks?projectId=${project.id}`} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary-600 transition-colors">
              Ver Tarefas
            </Link>
            <Link href={`/tasks/kanban?projectId=${project.id}`} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-muted text-sm font-medium hover:bg-muted/80 transition-colors">
              <Kanban className="w-4 h-4" /> Kanban
            </Link>
          </div>
        </div>
        <div className="space-y-4">
          <div className="p-5 rounded-2xl bg-card border border-border">
            <h3 className="font-semibold mb-3">Detalhes</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-muted-foreground">Tarefas</dt><dd className="font-medium">{project._count?.tasks || 0}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Progresso</dt><dd className="font-medium">{project.progressPercent}%</dd></div>
              <div className="flex justify-between items-center">
                <dt className="text-muted-foreground flex items-center gap-2">
                  Equipe
                  <button onClick={() => setIsTeamModalOpen(true)} className="p-1 hover:bg-muted rounded text-primary transition-colors">
                    <Edit2 className="w-3 h-3" />
                  </button>
                </dt>
                <dd className="font-medium">{project.team?.name || 'Nenhuma'}</dd>
              </div>
            </dl>
          </div>
          <div className="p-5 rounded-2xl bg-card border border-border">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Colaboradores (Individuais)</h3>
              <button
                onClick={() => setIsMemberModalOpen(true)}
                className="p-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              {(project.members || []).map((m: any) => (
                <div key={m.id} className="flex items-center justify-between group">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center">
                      <span className="text-xs font-semibold text-primary">{m.tenantUser?.user?.name?.charAt(0)}</span>
                    </div>
                    <span className="text-sm">{m.tenantUser?.user?.name}</span>
                  </div>
                  <button
                    onClick={() => removeMemberMutation.mutate(m.tenantUser.id)}
                    className="p-1.5 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-red-500 hover:bg-red-50 rounded-md transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {project.members?.length === 0 && (
                <p className="text-xs text-muted-foreground mt-2">Nenhum colaborador individual.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <Modal isOpen={isTeamModalOpen} onClose={() => setIsTeamModalOpen(false)} title="Alterar Equipe do Projeto">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Selecione uma Equipe</label>
            <select
              value={selectedTeamId}
              onChange={(e) => setSelectedTeamId(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-muted border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Nenhuma Equipe</option>
              {(teams || []).map((t: any) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end pt-2">
            <button
              onClick={() => updateTeamMutation.mutate(selectedTeamId)}
              disabled={updateTeamMutation.isPending}
              className="px-6 py-2.5 rounded-xl bg-primary text-white font-medium hover:bg-primary-600 disabled:opacity-50 transition-colors shadow-md shadow-primary/30"
            >
              {updateTeamMutation.isPending ? 'Salvando...' : 'Salvar Equipe'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={isMemberModalOpen} onClose={() => setIsMemberModalOpen(false)} title="Adicionar Colaborador">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Selecione um Usuário</label>
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-muted border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Selecione...</option>
              {(users || []).filter((u: any) => !(project.members || []).some((m: any) => m.tenantUser.id === u.id)).map((u: any) => (
                <option key={u.id} value={u.id}>{u.user?.name} {u.role ? `(${u.role.name})` : ''}</option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground mt-2">
              Estes membros terão acesso ao projeto mesmo que não façam parte da Equipe Principal.
            </p>
          </div>
          <div className="flex justify-end pt-2">
            <button
              onClick={() => {
                if (selectedUserId) addMemberMutation.mutate(selectedUserId);
              }}
              disabled={addMemberMutation.isPending || !selectedUserId}
              className="px-6 py-2.5 rounded-xl bg-primary text-white font-medium hover:bg-primary-600 disabled:opacity-50 transition-colors shadow-md shadow-primary/30"
            >
              {addMemberMutation.isPending ? 'Adicionando...' : 'Adicionar ao Projeto'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
