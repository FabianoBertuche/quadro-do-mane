#!/usr/bin/env python3
"""Substitui logout local por chamada /auth/logout + clearSession."""
from pathlib import Path

p = Path("apps/web/src/components/layout/sidebar.tsx")
content = p.read_text(encoding="utf-8")

# Substitui a função logout para chamar API e limpar Zustand
old = """  const logout = useAuthStore((s) => s.logout);"""
new = """  const clearSession = useAuthStore((s) => s.clearSession);
  const api = useAuthStore.getState; // placeholder, na verdade importamos api diretamente"""

if old not in content:
    print("PADRAO logout NAO ENCONTRADO")
    raise SystemExit(1)

content = content.replace(old, new, 1)

# Substitui o onClick do botão Sair
old_btn = """        <button
          onClick={() => { logout(); window.location.href = '/login'; }}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-sidebar-foreground/70 hover:bg-red-500/20 hover:text-red-400 transition-all w-full"
        >"""

new_btn = """        <button
          onClick={async () => {
            try {
              // chama via import dinâmico para evitar ciclo
              const { api } = await import('@/lib/api');
              await api.post('/auth/logout');
            } catch {
              // ignora — o cookie já pode estar expirado
            }
            clearSession();
            window.location.href = '/login';
          }}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-sidebar-foreground/70 hover:bg-red-500/20 hover:text-red-400 transition-all w-full"
        >"""

if old_btn not in content:
    print("PADRAO botao Sair NAO ENCONTRADO")
    raise SystemExit(1)

content = content.replace(old_btn, new_btn, 1)

p.write_text(content, encoding="utf-8")
print("OK: sidebar.tsx agora chama /auth/logout + clearSession")