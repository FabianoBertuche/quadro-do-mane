'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Plus, Users as UsersIcon, Trash2, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';

export default function TeamsPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', description: '' });
  const [selectedTeam, setSelectedTeam] = useState<any>(null);
  const [newMemberId, setNewMemberId] = useState('');
  const queryClient = useQueryClient();

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then((r) => r.data),
  });

  const { data: teams, isLoading } = useQuery({
    queryKey: ['teams'],
    queryFn: () => api.get('/teams').then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) => api.post('/teams', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      setIsModalOpen(false);
      setFormData({ name: '', description: '' });
    },
  });

  const addMemberMutation = useMutation({
    mutationFn: (tenantUserId: string) => api.post(`/teams/${selectedTeam?.id}/members`, { tenantUserId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      setNewMemberId('');
      // Update selectedTeam local state if needed (or let the refetch handle it, but we need to re-open or rely on refetch)
      // Since it's passed by reference and we invalidate, the react-query will fetch, but it might not auto-update the modal.
      const updatedTeam = teams?.find((t: any) => t.id === selectedTeam?.id);
      if (updatedTeam) setSelectedTeam(updatedTeam);
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: (tenantUserId: string) => api.delete(`/teams/${selectedTeam?.id}/members/${tenantUserId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      const updatedTeam = teams?.find((t: any) => t.id === selectedTeam?.id);
      if (updatedTeam) setSelectedTeam(updatedTeam);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Equipes</h1>
          <p className="text-muted-foreground mt-1">Organize seus times e departamentos</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white font-medium hover:bg-primary-600 transition-colors shadow-lg shadow-primary/30"
        >
          <Plus className="w-4 h-4" /> Nova Equipe
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          [1, 2, 3].map((i) => <div key={i} className="h-40 rounded-2xl bg-muted animate-pulse" />)
        ) : (
          (teams || []).map((team: any) => (
            <div
              key={team.id}
              onClick={() => setSelectedTeam(team)}
              className="p-5 rounded-2xl bg-card border border-border shadow-sm hover:shadow-md transition-shadow cursor-pointer"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: (team.color || '#5B5FEF') + '20' }}>
                  <UsersIcon className="w-5 h-5" style={{ color: team.color || '#5B5FEF' }} />
                </div>
                <div>
                  <h3 className="font-semibold">{team.name}</h3>
                  {team.description && <p className="text-xs text-muted-foreground">{team.description}</p>}
                </div>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{team._count?.members || 0} membros</span>
                <span>{team._count?.projects || 0} projetos</span>
              </div>
              {team.manager && (
                <div className="mt-3 pt-3 border-t border-border flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                    <span className="text-[10px] font-semibold text-primary">{team.manager.user?.name?.charAt(0)}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">Gestor: {team.manager.user?.name}</span>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Nova Equipe">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Nome da Equipe</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Ex: Engenharia"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Descrição (opcional)</label>
            <textarea
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              placeholder="Descreva sobre a equipe..."
            />
          </div>
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="px-6 py-2.5 rounded-xl bg-primary text-white font-medium hover:bg-primary-600 disabled:opacity-50 transition-colors shadow-md shadow-primary/30"
            >
              {createMutation.isPending ? 'Criando...' : 'Criar Equipe'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!selectedTeam} onClose={() => setSelectedTeam(null)} title={`Membros: ${selectedTeam?.name}`}>
        <div className="space-y-6">
          <div className="flex gap-2">
            <select
              value={newMemberId}
              onChange={(e) => setNewMemberId(e.target.value)}
              className="flex-1 px-4 py-2.5 rounded-xl bg-muted border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
            >
              <option value="">Selecione um colaborador para adicionar</option>
              {(users || [])
                .filter((u: any) => !selectedTeam?.members?.some((m: any) => m.tenantUserId === u.id))
                .map((u: any) => (
                  <option key={u.id} value={u.id}>
                    {u.user?.name} {u.role?.name ? `(${u.role.name})` : ''}
                  </option>
                ))}
            </select>
            <button
              onClick={() => {
                if (newMemberId) addMemberMutation.mutate(newMemberId);
              }}
              disabled={!newMemberId || addMemberMutation.isPending}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white font-medium hover:bg-primary-600 disabled:opacity-50 transition-colors"
            >
              <UserPlus className="w-4 h-4" /> {addMemberMutation.isPending ? 'Adicionando...' : 'Adicionar'}
            </button>
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {selectedTeam?.members?.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-4">Nenhum membro nesta equipe.</p>
            ) : (
              selectedTeam?.members?.map((member: any) => (
                <div key={member.id} className="flex items-center justify-between p-3 rounded-xl border border-border bg-card">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                      <span className="text-xs font-semibold text-primary">{member.tenantUser?.user?.name?.charAt(0)}</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium">{member.tenantUser?.user?.name}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      if (confirm('Tem certeza que deseja remover este membro?')) {
                        removeMemberMutation.mutate(member.tenantUserId);
                      }
                    }}
                    disabled={removeMemberMutation.isPending}
                    className="p-2 rounded-lg text-muted-foreground hover:bg-red-50 hover:text-red-500 transition-colors"
                    title="Remover membro"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
