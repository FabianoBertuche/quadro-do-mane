'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Mail, KeyRound, Server, Eye, EyeOff, CheckCircle2, XCircle } from 'lucide-react';
import { emailsApi } from '@/lib/emails-api';
import type { EmailSettingsSnapshot } from '@/types/email';

interface EmailSetupCardProps {
  snapshot: EmailSettingsSnapshot;
  onSaved?: () => void;
}

/**
 * Card de configuração inicial (estilo Gmail setup).
 *
 * Mostra o servidor IMAP/SMTP configurado pelo admin (somente leitura)
 * e dois campos de senha (IMAP e SMTP) — uma para cada protocolo.
 *
 * Após salvar, invalida a query `email-settings` para o parent remontar a inbox.
 */
export function EmailSetupCard({ snapshot, onSaved }: EmailSetupCardProps) {
  const queryClient = useQueryClient();
  const [imapPwd, setImapPwd] = useState('');
  const [smtpPwd, setSmtpPwd] = useState('');
  const [showImap, setShowImap] = useState(false);
  const [showSmtp, setShowSmtp] = useState(false);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!snapshot.server) throw new Error('Servidor do tenant não configurado.');
      if (imapPwd) {
        await emailsApi.setPassword({ protocol: 'imap', password: imapPwd });
      }
      if (smtpPwd) {
        await emailsApi.setPassword({ protocol: 'smtp', password: smtpPwd });
      }
      if (imapPwd) {
        await emailsApi.testConnection({ password: imapPwd });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-settings'] });
      onSaved?.();
    },
  });

  const server = snapshot.server;
  const noTenant = !server;

  return (
    <div className="max-w-2xl mx-auto my-8 p-8 rounded-3xl bg-card border border-border shadow-xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
          <Mail className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold">Configure sua caixa de entrada</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Sua conta de e-mail corporativo, pronta em poucos segundos.
          </p>
        </div>
      </div>

      {noTenant ? (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-sm flex items-start gap-3">
          <XCircle className="w-5 h-5 mt-0.5 shrink-0" />
          <div>
            <strong className="font-semibold">Servidor ainda não configurado.</strong>
            <p className="mt-1">
              Peça ao administrador da empresa para configurar o servidor IMAP/SMTP em
              <span className="mx-1 px-1.5 py-0.5 rounded-md bg-muted font-mono text-xs">Configurações → Empresa</span>
              antes de continuar.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Server (readonly) */}
          <div className="p-5 rounded-2xl bg-muted/40 border border-border mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Server className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Servidor (definido pelo admin)
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">IMAP (entrada)</div>
                <div className="font-mono text-foreground">
                  {server.imapHost}:{server.imapPort}
                  <span className="ml-2 text-xs text-muted-foreground">
                    {server.imapSecure ? 'SSL/TLS' : 'STARTTLS'}
                  </span>
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">SMTP (saída)</div>
                <div className="font-mono text-foreground">
                  {server.smtpHost}:{server.smtpPort}
                  <span className="ml-2 text-xs text-muted-foreground">
                    {server.smtpSecure ? 'SSL/TLS' : 'STARTTLS'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* User email (readonly) */}
          <div className="mb-5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">
              Sua conta de e-mail
            </label>
            <input
              readOnly
              value={snapshot.userEmail}
              className="mt-1 w-full px-4 py-2.5 rounded-xl bg-muted border border-border text-sm font-mono"
            />
          </div>

          {/* Passwords */}
          <div className="space-y-4">
            <PasswordField
              label="Senha do e-mail (IMAP)"
              hint="Mesma senha que você usa no webmail / Outlook."
              value={imapPwd}
              onChange={setImapPwd}
              show={showImap}
              onToggleShow={() => setShowImap((v) => !v)}
              alreadySet={snapshot.imapConfigured}
            />
            <PasswordField
              label="Senha do e-mail (SMTP)"
              hint="Geralmente a mesma. Se sua conta exige senha de aplicativo, use-a aqui."
              value={smtpPwd}
              onChange={setSmtpPwd}
              show={showSmtp}
              onToggleShow={() => setShowSmtp((v) => !v)}
              alreadySet={snapshot.smtpConfigured}
            />
          </div>

          {saveMutation.isError && (
            <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-300 text-sm">
              {(saveMutation.error as any)?.response?.data?.message ??
                'Não foi possível salvar. Verifique a senha e tente novamente.'}
            </div>
          )}

          {saveMutation.isSuccess && (
            <div className="mt-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-sm flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Configuração salva. Carregando sua caixa de entrada…
            </div>
          )}

          <button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || (!imapPwd && !smtpPwd)}
            className="mt-6 w-full py-3 rounded-2xl bg-primary text-white font-bold hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-primary/20"
          >
            {saveMutation.isPending ? 'Salvando…' : 'Salvar e conectar'}
          </button>
        </>
      )}
    </div>
  );
}

interface PasswordFieldProps {
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggleShow: () => void;
  alreadySet: boolean;
}

function PasswordField({
  label,
  hint,
  value,
  onChange,
  show,
  onToggleShow,
  alreadySet,
}: PasswordFieldProps) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">
          {label}
        </label>
        {alreadySet && !value && (
          <span className="text-[10px] uppercase tracking-wider text-emerald-600 font-bold flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> já configurada
          </span>
        )}
      </div>
      <div className="mt-1 relative">
        <KeyRound className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={alreadySet ? '•••••••• (deixe vazio para manter)' : 'Sua senha'}
          className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-background border border-border focus:ring-2 focus:ring-primary outline-none text-sm"
        />
        <button
          type="button"
          onClick={onToggleShow}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-muted-foreground hover:bg-muted"
          aria-label={show ? 'Ocultar senha' : 'Mostrar senha'}
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
      <p className="text-[11px] text-muted-foreground mt-1 ml-1">{hint}</p>
    </div>
  );
}