'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Mail, ShieldCheck, Eye, EyeOff, CheckCircle2, AlertCircle, KeyRound } from 'lucide-react';
import { emailsApi } from '@/lib/emails-api';
import type { EmailSettingsSnapshot } from '@/types/email';

function extractErrorMessage(err: any, fallback: string): string {
  const data = err?.response?.data;
  if (Array.isArray(data?.message)) return data.message.join(', ');
  if (typeof data?.message === 'string') return data.message;
  return fallback;
}

interface EmailPasswordCardProps {
  /**
   * Snapshot opcional vindo do /emails. Se não vier, o componente
   * busca por conta própria. Útil para evitar refetch em cascata.
   */
  snapshot?: EmailSettingsSnapshot;
}

/**
 * Card de "Configurações de E-mail" do usuário.
 *
 * Aparece para TODOS os usuários (perfil /profile). Mostra:
 *  - Status do tenant (configurado ou pendente)
 *  - E-mail IMAP e servidor (host/porta) derivados do preset
 *  - Formulário para definir/alterar a senha pessoal (IMAP e SMTP)
 *  - Botão "Testar conexão" que valida IMAP + SMTP no servidor
 *
 * Se o tenant ainda não foi configurado, mostra um aviso pedindo para
 * o admin configurar primeiro (em Configurações → E-mail da Empresa).
 */
export function EmailPasswordCard({ snapshot: externalSnapshot }: EmailPasswordCardProps) {
  const queryClient = useQueryClient();

  // Se não receber snapshot por prop, busca por conta própria.
  const { data: internalSnapshot, isLoading } = useQuery({
    queryKey: ['email-settings'],
    queryFn: () => emailsApi.getMySettings(),
    refetchOnWindowFocus: false,
    enabled: !externalSnapshot,
  });

  const snapshot = externalSnapshot ?? internalSnapshot;
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const setPasswordMutation = useMutation({
    mutationFn: (pwd: string) => emailsApi.setPassword({ protocol: 'imap', password: pwd }),
    onSuccess: () => {
      setSuccessMsg('Senha salva com sucesso! Sua conta de e-mail está pronta para uso.');
      setErrorMsg('');
      setPassword('');
      setTestResult(null);
      queryClient.invalidateQueries({ queryKey: ['email-settings'] });
      setTimeout(() => setSuccessMsg(''), 5000);
    },
    onError: (err: any) => {
      setErrorMsg(extractErrorMessage(err, 'Erro ao salvar senha.'));
      setSuccessMsg('');
    },
  });

  const testMutation = useMutation({
    mutationFn: (pwd: string) => emailsApi.testConnection({ password: pwd }),
    onSuccess: (res) => {
      const imapOk = !!res?.imap?.ok;
      const smtpOk = !!res?.smtp?.ok;
      const allOk = imapOk && smtpOk;
      const imapErr = res?.imap?.error;
      const smtpErr = res?.smtp?.error;
      const msg = allOk
        ? 'Conexão IMAP e SMTP funcionando!'
        : `Falha: ${imapOk ? '' : `IMAP: ${imapErr || 'erro'} · `}${smtpOk ? '' : `SMTP: ${smtpErr || 'erro'}`}`.trim();
      setTestResult({ ok: allOk, message: msg });
    },
    onError: (err: any) => {
      setTestResult({ ok: false, message: extractErrorMessage(err, 'Erro ao testar conexão.') });
    },
  });

  if (isLoading) {
    return (
      <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
        <div className="h-6 w-48 bg-muted rounded animate-pulse" />
        <div className="mt-4 h-20 bg-muted rounded-xl animate-pulse" />
      </div>
    );
  }

  // Tenant ainda não configurado pelo admin
  if (!snapshot?.tenantConfigured) {
    return (
      <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-3 pb-2 border-b border-border">
          <div className="w-10 h-10 rounded-xl bg-muted text-muted-foreground flex items-center justify-center">
            <Mail className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Configurações de E-mail</h3>
            <p className="text-sm text-muted-foreground">
              Conecte sua conta de e-mail para ler, responder e enviar mensagens.
            </p>
          </div>
        </div>
        <div className="mt-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
          <div>
            <strong>Servidor de e-mail ainda não foi configurado.</strong>
            <p className="mt-1 text-xs">
              Peça ao administrador para acessar <em>Configurações → E-mail da Empresa</em> e
              cadastrar o provedor (ex.: montemoria.com.br, Gmail, Office 365).
            </p>
          </div>
        </div>
      </div>
    );
  }

  const hasPassword = !!snapshot.imapConfigured && !!snapshot.smtpConfigured;

  return (
    <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
      <div className="flex items-center gap-3 pb-2 border-b border-border">
        <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
          <KeyRound className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold">Configurações de E-mail</h3>
          <p className="text-sm text-muted-foreground">
            Sua senha pessoal para acessar a caixa de correio.
          </p>
        </div>
        <span
          className={`text-[11px] font-bold px-2 py-1 rounded-full ${
            hasPassword
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
          }`}
        >
          {hasPassword ? 'CONFIGURADO' : 'PENDENTE'}
        </span>
      </div>

      <div className="mt-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <span className="block text-xs font-medium text-muted-foreground mb-1">
              Sua conta IMAP
            </span>
            <code className="block px-3 py-2 rounded-lg bg-muted border border-border font-mono text-xs">
              {snapshot.userEmail || '(sem e-mail)'}
            </code>
          </div>
          <div>
            <span className="block text-xs font-medium text-muted-foreground mb-1">
              Servidor IMAP / SMTP
            </span>
            <code className="block px-3 py-2 rounded-lg bg-muted border border-border font-mono text-xs">
              {snapshot.server?.imapHost}:{snapshot.server?.imapPort}
              {'  •  '}
              {snapshot.server?.smtpHost}:{snapshot.server?.smtpPort}
            </code>
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (password.length < 4) {
              setErrorMsg('A senha deve ter pelo menos 4 caracteres.');
              return;
            }
            setErrorMsg('');
            setSuccessMsg('');
            setTestResult(null);
            setPasswordMutation.mutate(password);
          }}
          className="space-y-3"
        >
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Senha IMAP/SMTP <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showPwd ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={hasPassword ? '•••••••• (digite para alterar)' : 'Digite sua senha de e-mail'}
                autoComplete="off"
                className="w-full px-4 py-2.5 pr-10 rounded-xl bg-muted border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-muted-foreground hover:text-foreground"
                aria-label={showPwd ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              A senha é criptografada (AES-256-GCM) e nunca exposta no frontend.
            </p>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm font-medium border border-red-100 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
          {successMsg && (
            <div className="p-3 rounded-lg bg-emerald-50 text-emerald-700 text-sm font-medium border border-emerald-100 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}
          {testResult && (
            <div
              className={`p-3 rounded-lg text-sm font-medium border flex items-start gap-2 ${
                testResult.ok
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                  : 'bg-red-50 text-red-700 border-red-100'
              }`}
            >
              {testResult.ok ? (
                <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              )}
              <span>{testResult.message}</span>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
            <button
              type="button"
              disabled={!password || testMutation.isPending}
              onClick={() => {
                setErrorMsg('');
                setTestResult(null);
                testMutation.mutate(password);
              }}
              className="px-4 py-2 rounded-xl bg-muted text-foreground font-medium hover:bg-muted/70 disabled:opacity-50 transition-colors"
            >
              {testMutation.isPending ? 'Testando...' : 'Testar conexão'}
            </button>
            <button
              type="submit"
              disabled={setPasswordMutation.isPending || !password}
              className="px-6 py-2.5 rounded-xl bg-primary text-white font-medium hover:bg-primary-600 disabled:opacity-50 transition-colors shadow-lg shadow-primary/30 flex items-center gap-2"
            >
              <ShieldCheck className="w-4 h-4" />
              {setPasswordMutation.isPending ? 'Salvando...' : 'Salvar Senha'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
