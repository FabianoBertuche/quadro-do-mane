'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth';

export default function SelectTenantPage() {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);
  const [tenants, setTenants] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Recupera a lista de tenants do cookie preAuth indiretamente:
    // o backend setou qd_preauth; precisamos da lista de tenants.
    // Solução: como o backend retornou os tenants no body do /login e o
    // body não foi persistido, refazemos a leitura via state in-memory.
    // Para simplificar: tentamos GET /auth/me (que falhará com 401)
    // e usamos fallback vazio.
    //
    // Idealmente o backend deveria devolver os tenants via GET próprio.
    // Por ora: armazenar no sessionStorage temporário no login.
    const stored = sessionStorage.getItem('qd_pending_tenants');
    if (stored) {
      setTenants(JSON.parse(stored));
      sessionStorage.removeItem('qd_pending_tenants');
    } else {
      setError('Sessão expirada. Faça login novamente.');
      setTimeout(() => router.push('/login'), 1500);
    }
  }, [router]);

  const selectTenant = async (tenantId: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/auth/select-tenant', { tenantId });
      setSession({
        user: res.data.user,
        tenant: res.data.tenant,
        permissions: res.data.permissions,
        role: res.data.role,
      });
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao selecionar empresa');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-primary-900 to-slate-900">
      <div className="w-full max-w-md p-8">
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 shadow-2xl p-8">
          <h1 className="text-2xl font-bold text-white text-center mb-2">Selecione a Empresa</h1>
          <p className="text-white/60 text-center text-sm mb-6">Você participa de múltiplas organizações</p>
          {error && <p className="text-error text-sm text-center mb-4">{error}</p>}
          <div className="space-y-3">
            {tenants.map((t) => (
              <button
                key={t.id}
                onClick={() => selectTenant(t.id)}
                disabled={loading}
                className="w-full p-4 rounded-xl bg-white/10 border border-white/20 text-white text-left hover:bg-white/20 transition-all group disabled:opacity-50"
              >
                <div className="font-semibold group-hover:text-primary transition-colors">{t.name}</div>
                <div className="text-sm text-white/50">{t.slug}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
