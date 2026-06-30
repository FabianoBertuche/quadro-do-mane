#!/usr/bin/env python3
"""Persiste a lista de tenants em sessionStorage quando há múltiplos."""
from pathlib import Path

p = Path("apps/web/src/app/(auth)/login/page.tsx")
content = p.read_text(encoding="utf-8")

old = """      if (res.data.requiresTenantSelection) {
        router.push('/select-tenant');
        return;
      }"""

new = """      if (res.data.requiresTenantSelection) {
        sessionStorage.setItem('qd_pending_tenants', JSON.stringify(res.data.tenants));
        router.push('/select-tenant');
        return;
      }"""

if old not in content:
    print("PADRAO NAO ENCONTRADO")
    raise SystemExit(1)

content = content.replace(old, new, 1)
p.write_text(content, encoding="utf-8")
print("OK: login persiste tenants em sessionStorage")