#!/usr/bin/env python3
"""Remove placeholder 'const api = useAuthStore.getState' da sidebar."""
from pathlib import Path

p = Path("apps/web/src/components/layout/sidebar.tsx")
content = p.read_text(encoding="utf-8")

old = """  const clearSession = useAuthStore((s) => s.clearSession);
  const api = useAuthStore.getState; // placeholder, na verdade importamos api diretamente"""

new = """  const clearSession = useAuthStore((s) => s.clearSession);"""

if old not in content:
    print("PADRAO NAO ENCONTRADO (talvez ja corrigido)")
else:
    content = content.replace(old, new, 1)
    p.write_text(content, encoding="utf-8")
    print("OK: placeholder removido")