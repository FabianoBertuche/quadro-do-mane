'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Mail, AlertCircle, RefreshCw, KeyRound, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { emailsApi } from '@/lib/emails-api';
import { EmailSetupCard } from '@/components/emails/EmailSetupCard';
import { EmailList } from '@/components/emails/EmailList';
import { EmailReader } from '@/components/emails/EmailReader';
import { EmailComposer } from '@/components/emails/EmailComposer';
import { useAuthStore } from '@/lib/auth';
import type { EmailMessageDetail, EmailMessageSummary } from '@/types/email';

export default function EmailsPage() {
  const queryClient = useQueryClient();
  const [selectedUid, setSelectedUid] = useState<string | number | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);

  // Não disparar queries enquanto a sessão não estiver hidratada. Sem
  // isso, a primeira requisição sai sem Authorization no DEV (cross-port
  // 3000↔3001) e o banner de erro "Não foi possível carregar suas
  // configurações" pisca até o useSession concluir o refresh.
  const hydrated = useAuthStore((s) => s.hydrated);

  // Snapshot leve: tenant + senhas configuradas
  const {
    data: snapshot,
    isLoading: isLoadingSnapshot,
    isError: isSnapshotError,
    refetch: refetchSnapshot,
  } = useQuery({
    queryKey: ['email-settings'],
    queryFn: () => emailsApi.getMySettings(),
    enabled: hydrated,
    refetchOnWindowFocus: false,
  });

  // Lista de mensagens (apenas carrega quando o setup está pronto)
  const tenantOk = !!snapshot?.tenantConfigured;
  const userOk = !!snapshot?.imapConfigured && !!snapshot?.smtpConfigured;
  const setupReady = tenantOk && userOk;

  const {
    data: messages,
    isLoading: isLoadingMessages,
    isError: isMessagesError,
    error: messagesError,
    refetch: refetchMessages,
  } = useQuery({
    queryKey: ['emails-messages'],
    queryFn: () => emailsApi.listMessages(),
    enabled: setupReady,
    retry: 1,
  });

  // Detalhe da mensagem selecionada
  const { data: selectedMessage, isLoading: isLoadingDetail } = useQuery({
    queryKey: ['email-detail', selectedUid],
    queryFn: () => emailsApi.getMessage(String(selectedUid)),
    enabled: !!selectedUid,
  });

  // Estado de erro do IMAP (ex: senha incorreta) — banner no card
  const [imapAuthError, setImapAuthError] = useState<string | null>(null);

  const checkImapError = (err: any) => {
    const status = err?.response?.status;
    const message = err?.response?.data?.message ?? '';
    if (status === 500 || status === 401 || /auth|credential|password|login/i.test(message)) {
      setImapAuthError(
        'Senha recusada pelo servidor. Verifique a senha IMAP e tente novamente.',
      );
      return true;
    }
    if (status === 404 && /Senha|IMAP/i.test(message)) {
      setImapAuthError(message);
      return true;
    }
    return false;
  };

  function handleSelect(msg: EmailMessageSummary) {
    setSelectedUid(msg.uid);
    setImapAuthError(null);
  }

  function handleSetupSaved() {
    setImapAuthError(null);
    refetchSnapshot();
  }

  function handleAfterReply() {
    setImapAuthError(null);
    refetchMessages();
  }

  const refreshMutation = useMutation({
    mutationFn: () => emailsApi.listMessages(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['emails-messages'] }),
  });

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
            <Mail className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">E-mail</h1>
            <p className="text-sm text-muted-foreground">
              {snapshot?.userEmail ? `Conectado como ${snapshot.userEmail}` : 'Carregando…'}
            </p>
          </div>
        </div>
        {setupReady && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => refetchMessages()}
              className="p-2 rounded-xl hover:bg-muted text-muted-foreground"
              aria-label="Atualizar"
              title="Atualizar"
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingMessages ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setComposerOpen(true)}
              className="px-4 py-2 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary-600 transition-colors shadow-md shadow-primary/20"
            >
              Escrever
            </button>
          </div>
        )}
      </header>

      {/* Loading inicial: sessão ainda hidratando OU snapshot carregando */}
      {(isLoadingSnapshot || !hydrated) && (
        <div className="h-32 rounded-3xl bg-muted animate-pulse" />
      )}

      {hydrated && isSnapshotError && (
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-300 text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
          <div className="flex-1">
            <strong>Não foi possível carregar suas configurações.</strong>
            <p className="mt-1 text-xs">Tente recarregar a página ou faça login novamente.</p>
            <button
              onClick={() => refetchSnapshot()}
              className="mt-2 px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-xs font-bold"
            >
              Tentar novamente
            </button>
          </div>
        </div>
      )}

      {imapAuthError && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
          <div>
            <strong>Senha incorreta.</strong>
            <p className="mt-1">{imapAuthError}</p>
          </div>
        </div>
      )}

      {/* Caso 1: tenant NÃO configurado → pedir para admin */}
      {snapshot && !tenantOk && (
        <EmailSetupCard snapshot={snapshot} onSaved={handleSetupSaved} />
      )}

      {/* Caso 2: tenant OK mas usuário SEM senha IMAP → configurar no /profile */}
      {snapshot && tenantOk && !userOk && (
        <div className="p-6 rounded-3xl bg-card border border-border shadow-sm flex flex-col md:flex-row items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
            <KeyRound className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold">Configure sua senha de e-mail</h2>
            <p className="text-sm text-muted-foreground mt-1">
              O servidor {snapshot.server?.imapHost} já está configurado pelo
              administrador. Agora você precisa informar a sua senha pessoal
              (a mesma que você usa no seu cliente de e-mail) para que o
              Quadro do Mané consiga abrir sua caixa de correio.
            </p>
            <Link
              href="/profile"
              className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary-600 transition-colors shadow-md shadow-primary/20"
            >
              Ir para Meu Perfil
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      )}

      {/* Caso 3: setup completo → inbox */}
      {setupReady && (
        <div className="flex h-[calc(100vh-200px)] bg-card rounded-3xl border border-border overflow-hidden shadow-xl">
          {isMessagesError ? (
            <div className="flex-1 p-8 text-center text-muted-foreground flex flex-col items-center justify-center gap-3">
              <AlertCircle className="w-10 h-10 text-amber-500" />
              <p className="text-sm">
                Não foi possível listar mensagens. Verifique sua conexão IMAP.
              </p>
              <button
                onClick={() => refetchMessages()}
                className="px-4 py-2 rounded-xl bg-primary text-white text-sm font-bold"
              >
                Tentar novamente
              </button>
              {checkImapError(messagesError)}
              {(messagesError as any)?.response?.data?.message && (
                <p className="text-xs text-muted-foreground">
                  {(messagesError as any).response.data.message}
                </p>
              )}
            </div>
          ) : (
            <>
              <EmailList
                messages={messages}
                isLoading={isLoadingMessages}
                selectedUid={selectedUid}
                onSelect={handleSelect}
                onRefresh={() => refreshMutation.mutate()}
              />
              <EmailReader
                message={(selectedMessage as EmailMessageDetail) ?? null}
                isLoading={isLoadingDetail}
                onAfterReply={handleAfterReply}
              />
            </>
          )}
        </div>
      )}

      <EmailComposer
        isOpen={composerOpen}
        onClose={() => setComposerOpen(false)}
        onSent={() => refetchMessages()}
      />
    </div>
  );
}
