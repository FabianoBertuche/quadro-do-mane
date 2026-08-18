'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth';
import { CheckCircle2, Circle, Clock, AlertCircle, Plus, Lock, AlertTriangle } from 'lucide-react';

interface RoutineItem {
  id: string;
  title: string;
  description: string;
  scheduledTime: string;
  /** The API returns `completedToday`, mapped to `isCompleted` for frontend use */
  isCompleted: boolean;
  orderIndex: number;
}

interface RoutineItemRaw {
  id: string;
  title: string;
  description: string;
  scheduledTime: string;
  completedToday: boolean;
  log: { id: string; isCompleted: boolean; date: string } | null;
}

export default function DailyRoutinePage() {
  const queryClient = useQueryClient();
  const role = useAuthStore((s) => s.role);
  const canManage = role === 'admin' || role === 'gestor';

  const [error, setError] = useState<string | null>(null);

  const { data: routines, isLoading, isError } = useQuery<RoutineItem[]>({
    queryKey: ['daily-routine'],
    queryFn: () =>
      api.get('/daily-routine').then((r) => {
        // The API returns `completedToday` but the UI expects `isCompleted`.
        // Map the raw response so downstream components get the expected shape.
        const items: RoutineItem[] = (r.data as RoutineItemRaw[]).map((raw, index) => ({
          id: raw.id,
          title: raw.title,
          description: raw.description,
          scheduledTime: raw.scheduledTime,
          isCompleted: raw.completedToday,
          orderIndex: index,
        }));
        return items;
      }),
  });

  const mutation = useMutation({
    mutationFn: (id: string) => api.patch(`/daily-routine/${id}/complete`),
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['daily-routine'] });
    },
    onError: (err: any) => {
      if (err?.response?.status === 409) {
        // Check if it's an "already completed" (no message) or "sequential block" (has message)
        const msg = err?.response?.data?.message;
        if (msg && msg.includes('completar as tarefas anteriores')) {
          setError(msg);
        } else {
          // Already completed — refresh silently
          queryClient.invalidateQueries({ queryKey: ['daily-routine'] });
        }
        return;
      }
      setError('Erro ao atualizar status da rotina. Por favor, tente novamente.');
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

    if (isError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-6">
          <AlertCircle className="w-12 h-12 text-destructive mb-4" />
          <h2 className="text-xl font-bold">Erro ao carregar rotinas</h2>
          <p className="text-muted-foreground mt-2">Não foi possível obter sua lista de tarefas diárias.</p>
        </div>
      );
    }

    // Calculate which tasks are blocked (all previous tasks not completed)
    const firstIncompleteIndex = routines?.findIndex(r => !r.isCompleted) ?? -1;

    return (
      <div className="space-y-6 max-w-3xl mx-auto">
        {error && (
          <div className="p-4 bg-destructive/10 border border-destructive/20 text-destructive rounded-2xl flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p className="text-sm font-medium">{error}</p>
            <button 
              onClick={() => setError(null)} 
              className="ml-auto text-xs underline opacity-70 hover:opacity-100"
            >
              Fechar
            </button>
          </div>
        )}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Rotina Diária</h1>
            <p className="text-muted-foreground mt-1">Organize seu dia e mantenha a consistência.</p>
          </div>
          {canManage && (
            <Link
              href="/daily-routine/create"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Nova Rotina
            </Link>
          )}
        </div>

      <div className="grid gap-4">
        {routines && routines.length > 0 ? (
          routines.map((item) => {
            const isBlocked = !item.isCompleted && item.orderIndex > (firstIncompleteIndex ?? -1);
            return (
            <div
              key={item.id}
              className={`group relative p-5 rounded-2xl border transition-all duration-200 ${
                item.isCompleted 
                  ? 'bg-muted/50 border-border opacity-60' 
                  : 'bg-card border-border shadow-sm hover:shadow-md hover:border-primary/30'
              }`}
            >
              <div className="flex items-start gap-4">
                <button
                  onClick={() => !isBlocked && mutation.mutate(item.id)}
                  disabled={mutation.isPending || isBlocked}
                  className={`mt-1 transition-colors duration-200 ${
                    item.isCompleted 
                      ? 'text-emerald-500' 
                      : isBlocked
                        ? 'text-muted-foreground/30 cursor-not-allowed'
                        : 'text-muted-foreground group-hover:text-primary'
                  }`}
                >
                  {item.isCompleted ? (
                    <CheckCircle2 className="w-6 h-6" />
                  ) : isBlocked ? (
                    <Lock className="w-6 h-6" />
                  ) : (
                    <Circle className="w-6 h-6" />
                  )}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className={`font-semibold transition-all ${
                      item.isCompleted ? 'line-through text-muted-foreground' : 'text-foreground'
                    }`}>
                      {item.title}
                    </h3>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
                      <Clock className="w-3 h-3" />
                      <span>{item.scheduledTime}</span>
                    </div>
                  </div>
                  <p className={`text-sm mt-1 ${
                    item.isCompleted ? 'text-muted-foreground/60' : 'text-muted-foreground'
                  }`}>
                    {item.description}
                  </p>
                  {isBlocked && !item.isCompleted && (
                    <p className="text-xs mt-2 text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Complete a tarefa anterior primeiro para desbloquear esta.
                    </p>
                  )}
                </div>
              </div>
              
               {mutation.isPending && (
                 <div className="absolute inset-0 bg-muted/50 backdrop-blur-[1px] rounded-2xl flex items-center justify-center">
                   <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                 </div>
               )}
            </div>
          );
 })
        ) : (
          <div className="text-center py-12 border-2 border-dashed border-border rounded-2xl bg-muted/20">
            <p className="text-muted-foreground">Nenhuma rotina configurada para hoje.</p>
          </div>
        )}
      </div>
    </div>
  );
}
