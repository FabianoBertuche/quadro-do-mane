'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { 
  TrendingUp, 
  Search, 
  Calendar as CalendarIcon, 
  User,
  AlertCircle
} from 'lucide-react';

interface RoutineLog {
  id: string;
  routineItemId: string;
  tenantUserId: string;
  date: string;
  completedAt: string | null;
  notes: string | null;
  routineItem: { id: string; title: string; description?: string | null };
  tenantUser: {
    user: { id: string; name: string; email: string };
    role?: { id: string; name: string } | null;
  };
}

interface EfficiencyData {
  percentage: number;
}

interface TenantUserOption {
  id: string;
  user: { id: string; name: string; email: string };
  role: { id: string; name: string } | null;
}

export default function DailyRoutineAdminPage() {
  const [filters, setFilters] = useState({
    userId: '',
    startDate: '',
    endDate: '',
  });

  const { data: users } = useQuery<TenantUserOption[]>({
    queryKey: ['users-list'],
    queryFn: () => api.get('/users').then((r) => r.data),
  });

  const { data: logsData, isLoading, isError } = useQuery<{ logs: RoutineLog[]; efficiency: number | null }>({
    queryKey: ['daily-routine-admin-logs', filters],
    queryFn: () => 
      api.get('/daily-routine/admin/logs', { 
        params: filters 
      }).then((r) => r.data),
    enabled: !!filters.startDate && !!filters.endDate,
  });

  const logs = logsData?.logs ?? [];

  const { data: efficiency } = useQuery<EfficiencyData>({
    queryKey: ['daily-routine-admin-efficiency', filters],
    queryFn: () => 
      api.get('/daily-routine/admin/efficiency', { 
        params: filters 
      }).then((r) => r.data),
    enabled: !!filters.startDate && !!filters.endDate,
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Monitoramento de Rotinas</h1>
        <p className="text-muted-foreground mt-1">Acompanhe a disciplina e eficiência da equipe.</p>
      </div>

       {/* Filters Section */}
       <div className="p-6 rounded-2xl bg-card border border-border shadow-sm grid grid-cols-1 md:grid-cols-3 gap-4 relative">
         <div className="space-y-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Colaborador</label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <select
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-muted border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none text-sm appearance-none"
              value={filters.userId}
              onChange={(e) => setFilters(f => ({ ...f, userId: e.target.value }))}
            >
              <option value="">Todos</option>
              {users?.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.user.name}{u.role ? ` — ${u.role.name}` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Data Início</label>
          <div className="relative">
            <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="date"
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-muted border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none text-sm"
              value={filters.startDate}
              onChange={(e) => setFilters(f => ({ ...f, startDate: e.target.value }))}
            />
          </div>
        </div>

         <div className="space-y-2">
           <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Data Fim</label>
           <div className="relative">
             <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
             <input
               type="date"
               className="w-full pl-9 pr-4 py-2 rounded-xl bg-muted border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none text-sm"
               value={filters.endDate}
               onChange={(e) => setFilters(f => ({ ...f, endDate: e.target.value }))}
             />
           </div>
         </div>
         <div className="absolute -bottom-6 left-0 right-0 text-center">
           <p className="text-[10px] text-muted-foreground/60 italic">
             * Datas de início e fim são obrigatórias para a pesquisa.
           </p>
         </div>
       </div>

      {/* Efficiency Widget */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 p-8 rounded-3xl bg-primary text-primary-foreground shadow-lg flex flex-col items-center justify-center text-center relative overflow-hidden group">
          {/* Decorative Background element */}
          <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:scale-110 transition-transform duration-500" />
          
          <TrendingUp className="w-12 h-12 mb-4 opacity-80" />
          <span className="text-sm font-medium opacity-80 uppercase tracking-widest">Eficiência da Equipe</span>
           <div className="text-5xl font-black mt-2 tabular-nums flex items-center justify-center">
             {efficiency?.percentage !== undefined ? `${efficiency.percentage}%` : 
              (filters.startDate && filters.endDate) ? (
                <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin" />
              ) : '--%'}
           </div>
          <p className="text-xs mt-4 opacity-60 max-w-[200px]">
            Calculado com base na taxa de conclusão de rotinas no período selecionado.
          </p>
        </div>

        <div className="md:col-span-2 p-6 rounded-2xl bg-card border border-border shadow-sm flex flex-col justify-center">
          <div className="flex items-center gap-3 mb-4">
            <Search className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">Resumo de Atividade</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            {isLoading ? 'Carregando logs...' : 
             logsData?.logs && logsData.logs.length > 0 ? `Encontrados ${logsData.logs.length} registros de conclusão para o período.` : 
             'Selecione um período de datas para visualizar o histórico de rotinas.'}
          </p>
        </div>
      </div>

      {/* Logs Table */}
      <div className="rounded-2xl bg-card border border-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="px-6 py-4 font-semibold text-muted-foreground">Colaborador</th>
                <th className="px-6 py-4 font-semibold text-muted-foreground">Item da Rotina</th>
                <th className="px-6 py-4 font-semibold text-muted-foreground">Data/Hora de Conclusão</th>
                <th className="px-6 py-4 font-semibold text-muted-foreground">Notas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-muted-foreground">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      Carregando dados...
                    </div>
                  </td>
                </tr>
              ) : isError ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-destructive">
                    <div className="flex items-center justify-center gap-2 mx-auto">
                      <AlertCircle className="w-5 h-5" />
                      Erro ao carregar logs de atividade.
                    </div>
                  </td>
                </tr>
              ) : logs.length > 0 ? (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-muted/30 transition-colors group">
                    <td className="px-6 py-4 font-medium text-foreground">{log.tenantUser.user.name}</td>
                    <td className="px-6 py-4 text-muted-foreground">{log.routineItem.title}</td>
                    <td className="px-6 py-4 tabular-nums text-muted-foreground">
                      {log.completedAt 
                        ? new Date(log.completedAt).toLocaleString('pt-BR', { 
                            day: '2-digit', 
                            month: '2-digit', 
                            year: 'numeric', 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })
                        : log.date}
                    </td>
                    <td className="px-6 py-4 italic text-muted-foreground/70">{log.notes || '—'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-muted-foreground">
                  {(!filters.startDate || !filters.endDate) 
                    ? 'Aguardando seleção de período para buscar registros.' 
                    : 'Nenhum registro encontrado para os filtros aplicados.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
