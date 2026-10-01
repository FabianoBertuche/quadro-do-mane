'use client';

import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, CircleOff, LockKeyhole } from 'lucide-react';
import { api } from '@/lib/api';

interface AiProvider {
  id: string;
  name: string;
  status: 'active' | 'coming_soon';
  connectionStatus?: 'connected' | 'disconnected';
  connectable: false;
}

export function AiProviderSettings() {
  const providers = useQuery({
    queryKey: ['ai-provider-settings'],
    queryFn: async () => {
      const { data } = await api.get<{ providers: AiProvider[] }>('/settings/ai/providers');
      return data.providers;
    },
  });

  return (
    <section className="space-y-4" aria-labelledby="ai-providers-title">
      <div>
        <h1 id="ai-providers-title" className="text-2xl font-bold">Provedores de IA</h1>
        <p className="mt-1 text-sm text-muted-foreground">Acompanhe a conexão global do tenant e os provedores disponíveis.</p>
      </div>
      {providers.isLoading && <div className="h-32 animate-pulse rounded-2xl bg-muted" />}
      {providers.isError && <p role="alert" className="rounded-xl bg-red-500/10 p-4 text-sm text-red-700">Não foi possível carregar o status dos provedores.</p>}
      {providers.data && (
        <div className="grid gap-4 md:grid-cols-2">
          {providers.data.map((provider) => {
            const active = provider.status === 'active';
            const connected = provider.connectionStatus === 'connected';
            return (
              <article key={provider.id} className={`rounded-2xl border border-border bg-card p-5 ${!active ? 'opacity-70' : ''}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold">{provider.name}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{active ? 'Conexão global do ChatGPT' : 'Disponível em uma próxima versão'}</p>
                  </div>
                  {active ? (connected ? <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-label="Conectado" /> : <CircleOff className="h-5 w-5 text-muted-foreground" aria-label="Desconectado" />) : <LockKeyhole className="h-5 w-5 text-muted-foreground" aria-label="Em breve" />}
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-border pt-4 text-sm">
                  <span className={active && connected ? 'text-emerald-700' : 'text-muted-foreground'}>{active ? (connected ? 'Conectado' : 'Desconectado') : 'Em breve'}</span>
                  {!active && <span className="text-xs text-muted-foreground">Sem ação de conexão</span>}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
