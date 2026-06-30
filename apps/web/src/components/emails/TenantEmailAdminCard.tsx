'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Server, Save, CheckCircle2, AlertCircle, Search } from 'lucide-react';
import { emailsApi } from '@/lib/emails-api';
import type {
  EmailDetectionMode,
  EmailServerPreset,
  TenantEmailSettings,
  UpdateTenantEmailSettingsPayload,
} from '@/types/email';

/**
 * Card de configuração IMAP/SMTP no nível do tenant.
 *
 * Visível APENAS para admin. Permite:
 *  - Detectar automaticamente por domínio (preset: montemoria, gmail, office365).
 *  - Configurar manualmente (host/porta/secure personalizados).
 *  - Testar conexão usando a senha atual do admin.
 */
export function TenantEmailAdminCard() {
  const queryClient = useQueryClient();

  const { data: tenant, isLoading } = useQuery({
    queryKey: ['email-tenant-settings'],
    queryFn: () => emailsApi.getTenantSettings(),
  });

  const { data: presetsResp } = useQuery({
    queryKey: ['email-domain-presets'],
    queryFn: () => emailsApi.getDomainPresets(),
  });

  const presets: EmailServerPreset[] = presetsResp?.presets ?? [];

  const [mode, setMode] = useState<EmailDetectionMode>('PRESET');
  const [emailDomain, setEmailDomain] = useState('');
  const [presetKey, setPresetKey] = useState('');
  const [imapHost, setImapHost] = useState('');
  const [imapPort, setImapPort] = useState(993);
  const [imapSecure, setImapSecure] = useState(true);
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState(465);
  const [smtpSecure, setSmtpSecure] = useState(true);

  // Hidrata form quando tenant carrega
  useEffect(() => {
    if (!tenant) return;
    setEmailDomain(tenant.emailDomain ?? '');
    setMode((tenant.detectionMode as EmailDetectionMode) ?? 'PRESET');
    setPresetKey(tenant.presetKey ?? '');
    setImapHost(tenant.imapHost ?? '');
    setImapPort(tenant.imapPort ?? 993);
    setImapSecure(tenant.imapSecure ?? true);
    setSmtpHost(tenant.smtpHost ?? '');
    setSmtpPort(tenant.smtpPort ?? 465);
    setSmtpSecure(tenant.smtpSecure ?? true);
  }, [tenant?.emailDomain, tenant?.presetKey, tenant?.imapHost]);

  // Auto-aplica preset quando modo PRESET + domínio bate
  useEffect(() => {
    if (mode !== 'PRESET') return;
    const found = presets.find((p) => p.domain === emailDomain.toLowerCase());
    if (found) {
      setPresetKey(found.key);
      setImapHost(found.imapHost);
      setImapPort(found.imapPort);
      setImapSecure(found.imapSecure);
      setSmtpHost(found.smtpHost);
      setSmtpPort(found.smtpPort);
      setSmtpSecure(found.smtpSecure);
    }
  }, [mode, emailDomain, presets]);

  const saveMutation = useMutation({
    mutationFn: (payload: UpdateTenantEmailSettingsPayload) =>
      emailsApi.updateTenantSettings(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-tenant-settings'] });
    },
  });

  function handleSave() {
    const payload: UpdateTenantEmailSettingsPayload = {
      emailDomain: emailDomain.trim().toLowerCase(),
      detectionMode: mode,
      presetKey: mode === 'PRESET' ? presetKey : undefined,
      imapHost,
      imapPort,
      imapSecure,
      smtpHost,
      smtpPort,
      smtpSecure,
    };
    saveMutation.mutate(payload);
  }

  if (isLoading) {
    return <div className="h-32 rounded-2xl bg-muted animate-pulse" />;
  }

  return (
    <div className="p-6 rounded-2xl bg-card border border-border shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <Server className="w-5 h-5 text-primary" />
        <h2 className="font-semibold">Servidor de E-mail da Empresa</h2>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Configure UMA vez o servidor IMAP/SMTP. Cada colaborador só precisará cadastrar a senha da própria conta.
      </p>

      <div className="space-y-4">
        {/* Domínio + detecção */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-sm text-muted-foreground">Domínio de e-mail</label>
            <input
              value={emailDomain}
              onChange={(e) => setEmailDomain(e.target.value)}
              placeholder="montemoria.com.br"
              className="mt-1 w-full px-4 py-2.5 rounded-xl bg-muted border-0 focus:ring-2 focus:ring-primary outline-none text-sm"
            />
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Modo de configuração</label>
            <div className="mt-1 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMode('PRESET')}
                className={`flex-1 px-3 py-2.5 rounded-xl text-sm font-medium border ${
                  mode === 'PRESET'
                    ? 'bg-primary text-white border-primary'
                    : 'bg-muted text-foreground/80 border-transparent hover:border-border'
                }`}
              >
                Detectar (recomendado)
              </button>
              <button
                type="button"
                onClick={() => setMode('CUSTOM')}
                className={`flex-1 px-3 py-2.5 rounded-xl text-sm font-medium border ${
                  mode === 'CUSTOM'
                    ? 'bg-primary text-white border-primary'
                    : 'bg-muted text-foreground/80 border-transparent hover:border-border'
                }`}
              >
                Personalizado
              </button>
            </div>
          </div>
        </div>

        {mode === 'PRESET' && (
          <div>
            <label className="text-sm text-muted-foreground">Preset disponível</label>
            <select
              value={presetKey}
              onChange={(e) => {
                const found = presets.find((p) => p.key === e.target.value);
                setPresetKey(e.target.value);
                if (found) {
                  setEmailDomain(found.domain);
                  setImapHost(found.imapHost);
                  setImapPort(found.imapPort);
                  setImapSecure(found.imapSecure);
                  setSmtpHost(found.smtpHost);
                  setSmtpPort(found.smtpPort);
                  setSmtpSecure(found.smtpSecure);
                }
              }}
              className="mt-1 w-full px-4 py-2.5 rounded-xl bg-muted border-0 focus:ring-2 focus:ring-primary outline-none text-sm"
            >
              <option value="">Selecione um preset…</option>
              {presets.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-muted-foreground mt-1">
              O preset preenche automaticamente host/porta/secure. Você pode ajustar manualmente depois.
            </p>
          </div>
        )}

        {/* IMAP / SMTP */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <fieldset className="space-y-3 p-4 rounded-xl bg-muted/40 border border-border">
            <legend className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-2">
              IMAP (entrada)
            </legend>
            <input
              value={imapHost}
              onChange={(e) => setImapHost(e.target.value)}
              placeholder="mail.exemplo.com.br"
              className="w-full px-4 py-2.5 rounded-xl bg-card border border-border focus:ring-2 focus:ring-primary outline-none text-sm font-mono"
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                value={imapPort}
                onChange={(e) => setImapPort(parseInt(e.target.value) || 0)}
                className="px-4 py-2.5 rounded-xl bg-card border border-border focus:ring-2 focus:ring-primary outline-none text-sm font-mono"
                placeholder="993"
              />
              <label className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-card border border-border text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={imapSecure}
                  onChange={(e) => setImapSecure(e.target.checked)}
                />
                SSL/TLS
              </label>
            </div>
          </fieldset>

          <fieldset className="space-y-3 p-4 rounded-xl bg-muted/40 border border-border">
            <legend className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-2">
              SMTP (saída)
            </legend>
            <input
              value={smtpHost}
              onChange={(e) => setSmtpHost(e.target.value)}
              placeholder="mail.exemplo.com.br"
              className="w-full px-4 py-2.5 rounded-xl bg-card border border-border focus:ring-2 focus:ring-primary outline-none text-sm font-mono"
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                value={smtpPort}
                onChange={(e) => setSmtpPort(parseInt(e.target.value) || 0)}
                className="px-4 py-2.5 rounded-xl bg-card border border-border focus:ring-2 focus:ring-primary outline-none text-sm font-mono"
                placeholder="465"
              />
              <label className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-card border border-border text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={smtpSecure}
                  onChange={(e) => setSmtpSecure(e.target.checked)}
                />
                SSL/TLS
              </label>
            </div>
          </fieldset>
        </div>

        {saveMutation.isError && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-300 text-sm flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5" />
            {(saveMutation.error as any)?.response?.data?.message ??
              'Falha ao salvar configurações.'}
          </div>
        )}
        {saveMutation.isSuccess && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-sm flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" /> Configuração salva com sucesso.
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={saveMutation.isPending || !emailDomain || !imapHost || !smtpHost}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-white font-medium hover:bg-primary-600 disabled:opacity-50 transition-colors shadow-md shadow-primary/30 text-sm"
        >
          <Save className="w-4 h-4" />
          {saveMutation.isPending ? 'Salvando…' : 'Salvar configuração'}
        </button>
      </div>
    </div>
  );
}