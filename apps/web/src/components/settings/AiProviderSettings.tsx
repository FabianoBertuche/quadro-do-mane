'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, CircleOff, KeyRound, LockKeyhole, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { AiOAuthConnectionCard } from '@/components/ai/AiOAuthConnectionCard';
import { AiModelCombobox } from '@/components/ai/AiModelCombobox';
import {
  getAiRuntime,
  getAiRuntimeErrorMessage,
  selectAiProviderModel,
  setAiFailoverProvider,
  setAiPrimaryProvider,
  type AiProviderName,
  type AiRuntime,
} from '@/lib/ai-runtime';

interface AiProvider {
  id: string;
  name: string;
  status: 'active' | 'coming_soon';
  connectionStatus?: 'connected' | 'disconnected';
  connectable: false;
}

const PROVIDER_OPTIONS: Array<{ value: AiProviderName; label: string }> = [
  { value: 'chatgpt', label: 'ChatGPT' },
  { value: 'ollama', label: 'Ollama Cloud' },
];

export function AiProviderSettings() {
  const queryClient = useQueryClient();
  const [ollamaKey, setOllamaKey] = useState('');
  const [keyMessage, setKeyMessage] = useState<string>();

  const runtime = useQuery({ queryKey: ['ai-runtime'], queryFn: getAiRuntime });
  const providers = useQuery({
    queryKey: ['ai-provider-settings'],
    queryFn: async () => {
      const { data } = await api.get<{ providers: AiProvider[] }>('/settings/ai/providers');
      return data.providers;
    },
  });

  const applyRuntime = (updated: AiRuntime) => queryClient.setQueryData(['ai-runtime'], updated);

  const setPrimary = useMutation({ mutationFn: setAiPrimaryProvider, onSuccess: applyRuntime });
  const setFailover = useMutation({ mutationFn: setAiFailoverProvider, onSuccess: applyRuntime });
  const selectModel = useMutation({
    mutationFn: ({ provider, slug }: { provider: AiProviderName; slug: string }) => selectAiProviderModel(provider, slug),
    onSuccess: applyRuntime,
  });
  const saveKey = useMutation({
    mutationFn: async (apiKey: string) => {
      const { data } = await api.put<{ status: string }>('/settings/ai/ollama/key', { apiKey });
      return data;
    },
    onSuccess: async () => {
      setOllamaKey('');
      setKeyMessage('Chave do Ollama salva.');
      await queryClient.invalidateQueries({ queryKey: ['ai-runtime'] });
    },
    onError: () => { setKeyMessage('Não foi possível salvar a chave do Ollama.'); },
  });
  const removeKey = useMutation({
    mutationFn: async () => {
      const { data } = await api.delete<{ status: string }>('/settings/ai/ollama/key');
      return data;
    },
    onSuccess: async () => {
      setKeyMessage('Chave do Ollama removida.');
      await queryClient.invalidateQueries({ queryKey: ['ai-runtime'] });
    },
    onError: () => { setKeyMessage('Não foi possível remover a chave do Ollama.'); },
  });

  if (runtime.isLoading) return <div className="h-40 animate-pulse rounded-2xl bg-muted" />;

  return (
    <section className="space-y-4" aria-labelledby="ai-providers-title">
      <div>
        <h1 id="ai-providers-title" className="text-2xl font-bold">Provedores de IA</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure o provedor principal, um substituto automático e os modelos por provedor. A alteração vale para todos os usuários do tenant.
        </p>
      </div>

      {runtime.data && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="font-semibold">Failover</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="block text-sm">
              <span className="text-xs font-medium text-muted-foreground">Provedor principal</span>
              <select
                value={runtime.data.primaryProvider}
                onChange={(event) => setPrimary.mutate(event.target.value as AiProviderName)}
                disabled={setPrimary.isPending}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
              >
                {PROVIDER_OPTIONS.map((provider) => <option key={provider.value} value={provider.value}>{provider.label}</option>)}
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-xs font-medium text-muted-foreground">Provedor substituto</span>
              <select
                value={runtime.data.failoverProvider ?? ''}
                onChange={(event) => setFailover.mutate((event.target.value || null) as AiProviderName | null)}
                disabled={setFailover.isPending}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="">Nenhum</option>
                {PROVIDER_OPTIONS
                  .filter((provider) => provider.value !== runtime.data.primaryProvider)
                  .map((provider) => <option key={provider.value} value={provider.value}>{provider.label}</option>)}
              </select>
            </label>
          </div>
        </div>
      )}

      {runtime.data && runtime.data.primaryProvider === 'chatgpt' && (
        <AiOAuthConnectionCard />
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {runtime.data && (
          <>
            <article className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold">ChatGPT</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Catálogo ao vivo via conexão global.</p>
                </div>
                {runtime.data.providers.chatgpt.connectionStatus === 'connected'
                  ? <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-label="Conectado" />
                  : <CircleOff className="h-5 w-5 text-muted-foreground" aria-label="Desconectado" />}
              </div>
              {runtime.data.providers.chatgpt.models.length > 0 && (
                <div className="mt-4">
                  <AiModelCombobox
                    models={runtime.data.providers.chatgpt.models}
                    value={runtime.data.providers.chatgpt.selectedModel?.slug}
                    disabled={selectModel.isPending}
                    onSelect={(slug) => selectModel.mutate({ provider: 'chatgpt', slug })}
                  />
                </div>
              )}
            </article>

            <article className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-primary/10 p-2 text-primary"><KeyRound className="h-5 w-5" /></div>
                  <div>
                    <h2 className="font-semibold">Ollama Cloud</h2>
                    <p className="mt-1 text-sm text-muted-foreground">API key de ollama.com/settings/keys.</p>
                  </div>
                </div>
                {runtime.data.providers.ollama.connectionStatus === 'connected'
                  ? <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-label="Conectado" />
                  : <CircleOff className="h-5 w-5 text-muted-foreground" aria-label="Desconectado" />}
              </div>
              <div className="mt-4 flex items-end gap-2">
                <label className="min-w-0 flex-1 text-sm">
                  <span className="text-xs font-medium text-muted-foreground">API key</span>
                  <input
                    type="password"
                    value={ollamaKey}
                    onChange={(event) => setOllamaKey(event.target.value)}
                    placeholder={runtime.data.providers.ollama.connectionStatus === 'connected' ? 'Chave salva (digite para substituir)' : 'Cole sua API key'}
                    className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                    autoComplete="new-password"
                  />
                </label>
                {runtime.data.providers.ollama.connectionStatus === 'connected' && (
                  <button
                    type="button"
                    onClick={() => removeKey.mutate()}
                    disabled={removeKey.isPending}
                    className="rounded-xl border border-border p-2.5 hover:bg-muted disabled:opacity-50"
                    aria-label="Remover chave do Ollama"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => saveKey.mutate(ollamaKey.trim())}
                  disabled={saveKey.isPending || ollamaKey.trim().length < 8}
                  className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  {saveKey.isPending ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
              {keyMessage && <p role="status" className="mt-2 text-sm text-muted-foreground">{keyMessage}</p>}
              {runtime.data.providers.ollama.models.length > 0 && (
                <div className="mt-4">
                  <AiModelCombobox
                    models={runtime.data.providers.ollama.models}
                    value={runtime.data.providers.ollama.selectedModel?.slug}
                    disabled={selectModel.isPending}
                    onSelect={(slug) => selectModel.mutate({ provider: 'ollama', slug })}
                  />
                </div>
              )}
            </article>
          </>
        )}
      </div>

      {runtime.isError && <p role="alert" className="rounded-xl bg-red-500/10 p-4 text-sm text-red-700">{getAiRuntimeErrorMessage(runtime.error)}</p>}
      {(setPrimary.isError || setFailover.isError || selectModel.isError) && <p role="alert" className="rounded-xl bg-red-500/10 p-4 text-sm text-red-700">{getAiRuntimeErrorMessage(setPrimary.error ?? setFailover.error ?? selectModel.error)}</p>}

      {providers.data && (
        <div className="grid gap-4 md:grid-cols-2">
          {providers.data.filter((provider) => provider.status === 'coming_soon').map((provider) => (
            <article key={provider.id} className="rounded-2xl border border-border bg-card p-5 opacity-70">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold">{provider.name}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Disponível em uma próxima versão</p>
                </div>
                <LockKeyhole className="h-5 w-5 text-muted-foreground" aria-label="Em breve" />
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}