'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Clipboard, ExternalLink, KeyRound, Link2, RefreshCw, Unplug } from 'lucide-react';
import {
  completeChatGptAuthorization,
  disconnectChatGptConnection,
  getAiOAuthErrorMessage,
  listChatGptConnections,
  reconnectChatGptConnection,
  startChatGptAuthorization,
  type ChatGptConnection,
} from '@/lib/ai-oauth';

function formatExpiry(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('pt-BR');
}

export function AiOAuthConnectionCard() {
  const queryClient = useQueryClient();
  const [authorizationUrl, setAuthorizationUrl] = useState<string>();
  const [authorizationExpiresAt, setAuthorizationExpiresAt] = useState<string>();
  const [callbackUrl, setCallbackUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const connections = useQuery({ queryKey: ['ai-oauth-connections'], queryFn: listChatGptConnections });

  const start = useMutation({
    mutationFn: startChatGptAuthorization,
    onSuccess: (result) => {
      setAuthorizationUrl(result.authorizationUrl);
      setAuthorizationExpiresAt(result.expiresAt);
      setCopied(false);
    },
  });
  const complete = useMutation({
    mutationFn: () => completeChatGptAuthorization(callbackUrl.trim()),
    onSuccess: () => {
      setCallbackUrl('');
      setAuthorizationUrl(undefined);
      queryClient.invalidateQueries({ queryKey: ['ai-oauth-connections'] });
    },
  });
  const refresh = useMutation({
    mutationFn: (id: string) => reconnectChatGptConnection(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ai-oauth-connections'] }),
  });
  const disconnect = useMutation({
    mutationFn: (id: string) => disconnectChatGptConnection(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ai-oauth-connections'] }),
  });
  const error = start.error ?? complete.error ?? refresh.error ?? disconnect.error ?? connections.error;
  const activeConnections = connections.data?.filter((connection) => connection.status === 'connected') ?? [];

  async function copyAuthorizationUrl() {
    if (!authorizationUrl) return;
    await navigator.clipboard.writeText(authorizationUrl);
    setCopied(true);
  }

  return (
    <aside className="rounded-2xl border border-border bg-card p-4" aria-labelledby="chatgpt-connection-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-primary/10 p-2 text-primary"><KeyRound className="h-5 w-5" /></div>
          <div>
            <h2 id="chatgpt-connection-title" className="font-semibold">Conectar ao ChatGPT</h2>
            <p className="text-sm text-muted-foreground">Use sua conta ChatGPT sem substituir a chave de API configurada.</p>
          </div>
        </div>
        {!activeConnections.length && <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">Não conectado</span>}
      </div>

      {connections.data?.map((connection) => <ConnectionStatus key={connection.id} connection={connection} onRefresh={() => refresh.mutate(connection.id)} onDisconnect={() => disconnect.mutate(connection.id)} busy={refresh.isPending || disconnect.isPending} />)}

      {!activeConnections.length && (
        <div className="mt-4 space-y-3">
          <button type="button" onClick={() => start.mutate()} disabled={start.isPending} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
            <ExternalLink className="h-4 w-4" />
            {start.isPending ? 'Preparando...' : 'Continuar com ChatGPT'}
          </button>
          {authorizationUrl && (
            <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-3">
              <p className="text-sm">Abra a autorização e, ao concluir, copie a URL completa exibida pelo navegador.</p>
              <div className="flex flex-wrap gap-2">
                <a href={authorizationUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium"><ExternalLink className="h-4 w-4" />Abrir autorização</a>
                <button type="button" onClick={copyAuthorizationUrl} className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium"><Clipboard className="h-4 w-4" />{copied ? 'URL copiada' : 'Copiar URL'}</button>
              </div>
              {authorizationExpiresAt && <p className="text-xs text-muted-foreground">Link válido até {formatExpiry(authorizationExpiresAt)}.</p>}
              <label htmlFor="chatgpt-callback-url" className="block text-sm font-medium">URL completa do callback</label>
              <textarea id="chatgpt-callback-url" value={callbackUrl} onChange={(event) => setCallbackUrl(event.target.value)} rows={3} placeholder="http://127.0.0.1:1455/auth/callback?code=...&state=..." className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono" aria-describedby="chatgpt-callback-help" />
              <p id="chatgpt-callback-help" className="text-xs text-muted-foreground">Cole a URL inteira, incluindo os parâmetros após o ponto de interrogação. Não cole códigos ou tokens separadamente.</p>
              <button type="button" onClick={() => complete.mutate()} disabled={!callbackUrl.trim() || complete.isPending} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white disabled:opacity-50"><Link2 className="h-4 w-4" />{complete.isPending ? 'Conectando...' : 'Conectar conta'}</button>
            </div>
          )}
        </div>
      )}

      {error && <p role="alert" className="mt-3 rounded-lg bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300">{getAiOAuthErrorMessage(error)}</p>}
    </aside>
  );
}

function ConnectionStatus({ connection, onRefresh, onDisconnect, busy }: { connection: ChatGptConnection; onRefresh: () => void; onDisconnect: () => void; busy: boolean }) {
  const connected = connection.status === 'connected';
  return (
    <div className={`mt-4 rounded-xl border p-3 ${connected ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-border bg-muted/30'}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1 text-sm">
          <p className="flex items-center gap-2 font-medium">{connected ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Unplug className="h-4 w-4 text-muted-foreground" />}{connected ? 'Conectado' : 'Desconectado'}</p>
          <p className="text-muted-foreground">Conta: {connection.email ?? 'conta ChatGPT'}</p>
          <p className="text-muted-foreground">Provedor: {connection.provider}</p>
          <p className="text-muted-foreground">Permissões: {connection.scopes.join(', ') || 'Nenhuma informada'}</p>
          <p className="text-muted-foreground">Expira em: {formatExpiry(connection.expiresAt)}</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onRefresh} disabled={busy} className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium disabled:opacity-50"><RefreshCw className="h-3.5 w-3.5" />Reconectar</button>
          {connected && <button type="button" onClick={onDisconnect} disabled={busy} className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium disabled:opacity-50"><Unplug className="h-3.5 w-3.5" />Desconectar</button>}
        </div>
      </div>
    </div>
  );
}
