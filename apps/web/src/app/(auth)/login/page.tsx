'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth';

function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const setSession = useAuthStore((s) => s.setSession);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const savedEmail = localStorage.getItem('qd_last_email');
    const savedPassword = localStorage.getItem('qd_last_password');
    if (savedEmail) setEmail(savedEmail);
    if (savedPassword) setPassword(savedPassword);
  }, []);

  const next = search?.get('next') ?? '/dashboard';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await api.post('/auth/login', { email, password });

      if (res.data.requiresTenantSelection) {
        sessionStorage.setItem('qd_pending_tenants', JSON.stringify(res.data.tenants));
        router.push('/select-tenant');
        return;
      }

      // Em DEV: cookies HttpOnly cross-port são bloqueados pelo Chrome, então
      // usamos os tokens do body. Em produção (HTTPS + mesmo domínio), os cookies
      // HttpOnly são preferidos.
      setSession({
        accessToken: res.data.accessToken,
        refreshToken: res.data.refreshToken,
        user: res.data.user,
        tenant: res.data.tenant,
        permissions: res.data.permissions,
        role: res.data.role,
        hydrated: true,
      });

      localStorage.setItem('qd_last_email', email);
      localStorage.setItem('qd_last_password', password);

      // Define um cookie curto não-HttpOnly que permite navegação imediata
      // sem necessidade de refresh enquanto o backend configura os cookies
      // HttpOnly. Expira em 30 segundos.
      try {
        document.cookie = 'qd_client_auth=1; Path=/; Max-Age=30';
      } catch {
        // noop
      }

      router.push(next);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao conectar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-primary-900 to-slate-900">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyem0wLTMwVjBIMjR2NGgxMnpNMjQgMjRoMTJ2LTJIMjR2MnoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-30" />

      <div className="relative w-full max-w-md p-8">
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 shadow-2xl p-8">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center w-16 h-16 rounded-2xl mb-4 shadow-lg shadow-primary/30">
              <img src="/logo.png" alt="Monte Moria Logo" className="w-full h-full object-contain" />
            </div>
            <h1 className="text-2xl font-bold text-white">Monte Moria</h1>
            <p className="text-white/60 mt-1 text-sm">Gestão de tarefas e projetos</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-white/80 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                placeholder="seu@email.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white/80 mb-1.5">Senha</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                placeholder="••••••••"
                required
              />
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-error/20 border border-error/30 text-error text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl bg-primary hover:bg-primary-600 text-white font-semibold transition-all duration-200 shadow-lg shadow-primary/30 hover:shadow-primary/50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Entrando...
                </span>
              ) : (
                'Entrar'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-primary-900 to-slate-900">
        <div className="text-white/60 text-sm">Carregando...</div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
