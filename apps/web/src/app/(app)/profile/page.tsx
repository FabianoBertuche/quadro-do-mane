'use client';

import { useAuthStore } from '@/lib/auth';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useMemo, useState } from 'react';
import {
  UserCircle,
  Lock,
  ShieldCheck,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { EmailPasswordCard } from '@/components/emails/EmailPasswordCard';

/**
 * Calcula a "força" de uma senha em 4 níveis (0..3).
 * Critérios:
 *  - comprimento mínimo
 *  - mistura de tipos (lower/upper/digit/symbol)
 *  - penalidade para padrões comuns
 */
function scorePassword(pwd: string): { score: 0 | 1 | 2 | 3; label: string; color: string; pct: number } {
  if (!pwd) return { score: 0, label: '—', color: 'bg-muted', pct: 0 };
  let s = 0;
  if (pwd.length >= 8) s++;
  if (pwd.length >= 12) s++;
  if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) s++;
  if (/\d/.test(pwd)) s++;
  if (/[^A-Za-z0-9]/.test(pwd)) s++;
  // normaliza para 0..3
  const score = Math.min(3, Math.max(0, Math.floor(s / 2))) as 0 | 1 | 2 | 3;
  const meta = [
    { label: 'Muito fraca', color: 'bg-rose-500', pct: 20 },
    { label: 'Fraca', color: 'bg-amber-500', pct: 50 },
    { label: 'Boa', color: 'bg-emerald-500', pct: 80 },
    { label: 'Forte', color: 'bg-emerald-600', pct: 100 },
  ][score];
  return { score, ...meta };
}

function extractErrorMessage(err: any, fallback: string): string {
  const data = err?.response?.data;
  if (Array.isArray(data?.message)) return data.message.join(', ');
  if (typeof data?.message === 'string') return data.message;
  return fallback;
}

export default function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const setSession = useAuthStore((s) => s.setSession);

  // Estado do perfil (nome/telefone/avatar)
  const [profileData, setProfileData] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    avatarUrl: user?.avatarUrl || '',
  });

  // Estado da seção de segurança (senhas)
  const [pwdData, setPwdData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showCurrentPwd, setShowCurrentPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [pwdSuccessMsg, setPwdSuccessMsg] = useState('');
  const [pwdErrorMsg, setPwdErrorMsg] = useState('');

  const [profileSuccessMsg, setProfileSuccessMsg] = useState('');
  const [profileErrorMsg, setProfileErrorMsg] = useState('');

  const pwdStrength = useMemo(() => scorePassword(pwdData.newPassword), [pwdData.newPassword]);

  const pwdValidations = useMemo(() => {
    const v = pwdData.newPassword;
    return [
      { ok: v.length >= 8, label: 'Pelo menos 8 caracteres' },
      { ok: /[A-Z]/.test(v), label: 'Pelo menos uma letra maiúscula' },
      { ok: /[a-z]/.test(v), label: 'Pelo menos uma letra minúscula' },
      { ok: /\d/.test(v), label: 'Pelo menos um número' },
      {
        ok: v.length > 0 && v !== pwdData.currentPassword,
        label: 'Diferente da senha atual',
      },
      {
        ok:
          v.length > 0 &&
          pwdData.confirmPassword.length > 0 &&
          v === pwdData.confirmPassword,
        label: 'Confirmação confere',
      },
    ];
  }, [pwdData.newPassword, pwdData.currentPassword, pwdData.confirmPassword]);

  const allValidationsPassed = pwdValidations.every((v) => v.ok);

  const updateProfileMutation = useMutation({
    mutationFn: (data: typeof profileData) => api.patch('/users/me', data),
    onSuccess: (res) => {
      const state = useAuthStore.getState();
      if (state.accessToken && state.refreshToken && state.tenant) {
        setSession({
          accessToken: state.accessToken,
          refreshToken: state.refreshToken,
          user: res.data,
          tenant: state.tenant,
          permissions: state.permissions,
        });
      }
      setProfileSuccessMsg('Perfil atualizado com sucesso!');
      setProfileErrorMsg('');
      setTimeout(() => setProfileSuccessMsg(''), 3000);
    },
    onError: (err: any) => {
      setProfileErrorMsg(extractErrorMessage(err, 'Erro ao atualizar perfil.'));
      setTimeout(() => setProfileErrorMsg(''), 3000);
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string }) =>
      api.patch('/users/me/password', data),
    onSuccess: () => {
      setPwdSuccessMsg('Senha alterada com sucesso! Você precisará fazer login novamente em outros dispositivos.');
      setPwdErrorMsg('');
      setPwdData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setTimeout(() => setPwdSuccessMsg(''), 6000);
    },
    onError: (err: any) => {
      const msg = extractErrorMessage(err, 'Erro ao alterar senha.');
      setPwdErrorMsg(msg);
      setPwdSuccessMsg('');
    },
  });

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfileMutation.mutate(profileData);
  };

  const handlePwdSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pwdData.currentPassword) {
      setPwdErrorMsg('Informe a senha atual para confirmar a alteração.');
      return;
    }
    if (!allValidationsPassed) {
      setPwdErrorMsg('Verifique os requisitos da nova senha antes de salvar.');
      return;
    }
    changePasswordMutation.mutate({
      currentPassword: pwdData.currentPassword,
      newPassword: pwdData.newPassword,
    });
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Meu Perfil</h1>
        <p className="text-muted-foreground mt-1">
          Gerencie suas informações pessoais e credenciais de acesso
        </p>
      </div>

      {/* ───── Card: Informações pessoais ───── */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
        <form onSubmit={handleProfileSubmit} className="space-y-6">
          <div className="flex items-center gap-6 pb-6 border-b border-border">
            <div className="relative">
              <div className="w-24 h-24 rounded-full bg-primary/20 flex flex-shrink-0 items-center justify-center overflow-hidden border-4 border-card shadow-sm">
                {profileData.avatarUrl ? (
                  <img src={profileData.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-4xl font-bold text-primary">
                    {profileData.name?.charAt(0) || 'U'}
                  </span>
                )}
              </div>
            </div>
            <div className="flex-1 space-y-2">
              <label className="block text-sm font-medium text-foreground">URL da Foto de Perfil</label>
              <input
                type="url"
                value={profileData.avatarUrl}
                onChange={(e) => setProfileData({ ...profileData, avatarUrl: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl bg-muted border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="https://exemplo.com/m/foto.png"
              />
              <p className="text-xs text-muted-foreground">
                Cole o link de uma imagem para o seu avatar.
              </p>
            </div>
          </div>

          <div className="space-y-4 pt-2">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <UserCircle className="w-5 h-5 text-primary" /> Informações Pessoais
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Nome Completo</label>
                <input
                  type="text"
                  required
                  value={profileData.name}
                  onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl bg-muted border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">E-mail (Login)</label>
                <input
                  type="email"
                  disabled
                  value={user?.email || ''}
                  className="w-full px-4 py-2.5 rounded-xl bg-muted/50 border border-border text-muted-foreground cursor-not-allowed"
                />
                <p className="text-xs text-muted-foreground mt-1">O e-mail não pode ser alterado.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Telefone / WhatsApp</label>
                <input
                  type="text"
                  value={profileData.phone}
                  onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                  placeholder="(00) 00000-0000"
                  className="w-full px-4 py-2.5 rounded-xl bg-muted border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
          </div>

          {profileErrorMsg && (
            <div className="p-3 rounded-lg bg-red-50 text-red-600 text-sm font-medium border border-red-100">
              {profileErrorMsg}
            </div>
          )}
          {profileSuccessMsg && (
            <div className="p-3 rounded-lg bg-emerald-50 text-emerald-600 text-sm font-medium border border-emerald-100">
              {profileSuccessMsg}
            </div>
          )}

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={updateProfileMutation.isPending}
              className="px-6 py-2.5 rounded-xl bg-primary text-white font-medium hover:bg-primary-600 disabled:opacity-50 transition-colors shadow-lg shadow-primary/30"
            >
              {updateProfileMutation.isPending ? 'Salvando...' : 'Salvar Informações'}
            </button>
          </div>
        </form>
      </div>

      {/* ───── Card: Segurança (senha de login) ───── */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
        <form onSubmit={handlePwdSubmit} className="space-y-6">
          <div className="flex items-center gap-3 pb-2 border-b border-border">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Segurança</h3>
              <p className="text-sm text-muted-foreground">
                Altere sua senha de acesso. Recomendamos uma combinação forte.
              </p>
            </div>
          </div>

          {/* Senha atual */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Senha atual <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showCurrentPwd ? 'text' : 'password'}
                value={pwdData.currentPassword}
                onChange={(e) => setPwdData({ ...pwdData, currentPassword: e.target.value })}
                className="w-full px-4 py-2.5 pr-10 rounded-xl bg-muted border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Digite sua senha atual"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowCurrentPwd((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-muted-foreground hover:text-foreground"
                aria-label={showCurrentPwd ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {showCurrentPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Pedimos a senha atual para confirmar que é você.
            </p>
          </div>

          {/* Nova senha + força */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Nova senha <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showNewPwd ? 'text' : 'password'}
                value={pwdData.newPassword}
                onChange={(e) => setPwdData({ ...pwdData, newPassword: e.target.value })}
                className="w-full px-4 py-2.5 pr-10 rounded-xl bg-muted border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Mínimo 8 caracteres"
                autoComplete="new-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowNewPwd((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-muted-foreground hover:text-foreground"
                aria-label={showNewPwd ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {showNewPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Barra de força */}
            <div className="mt-3 space-y-1.5">
              <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${pwdStrength.color}`}
                  style={{ width: `${pwdStrength.pct}%` }}
                />
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Força da senha</span>
                <span className="font-medium">{pwdStrength.label}</span>
              </div>
            </div>

            {/* Lista de requisitos */}
            <ul className="mt-3 space-y-1">
              {pwdValidations.map((v, i) => (
                <li
                  key={i}
                  className={`flex items-center gap-2 text-xs ${
                    v.ok ? 'text-emerald-600' : 'text-muted-foreground'
                  }`}
                >
                  {v.ok ? (
                    <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 flex-shrink-0 opacity-50" />
                  )}
                  {v.label}
                </li>
              ))}
            </ul>
          </div>

          {/* Confirmar senha */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Confirmar nova senha <span className="text-rose-500">*</span>
            </label>
            <input
              type={showNewPwd ? 'text' : 'password'}
              value={pwdData.confirmPassword}
              onChange={(e) => setPwdData({ ...pwdData, confirmPassword: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl bg-muted border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Digite novamente a nova senha"
              autoComplete="new-password"
              required
            />
          </div>

          {pwdErrorMsg && (
            <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm font-medium border border-red-100">
              {pwdErrorMsg}
            </div>
          )}
          {pwdSuccessMsg && (
            <div className="p-3 rounded-lg bg-emerald-50 text-emerald-700 text-sm font-medium border border-emerald-100">
              {pwdSuccessMsg}
            </div>
          )}

          <div className="pt-2 flex items-center justify-between">
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" />
              Após salvar, todos os outros dispositivos precisarão fazer login novamente.
            </p>
            <button
              type="submit"
              disabled={changePasswordMutation.isPending || !allValidationsPassed}
              className="px-6 py-2.5 rounded-xl bg-primary text-white font-medium hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-primary/30"
            >
              {changePasswordMutation.isPending ? 'Salvando...' : 'Alterar Senha'}
            </button>
          </div>
        </form>
      </div>

      {/* ───── Card: Configurações de E-mail (senha IMAP/SMTP pessoal) ───── */}
      <EmailPasswordCard />
    </div>
  );
}
