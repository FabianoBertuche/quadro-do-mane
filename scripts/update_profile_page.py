#!/usr/bin/env python3
"""Substitui setAuth -> setSession no profile/page.tsx."""
from pathlib import Path

p = Path("apps/web/src/app/(app)/profile/page.tsx")
content = p.read_text(encoding="utf-8")

# Substitui o nome do método setAuth por setSession
content = content.replace("setAuth", "setSession")

p.write_text(content, encoding="utf-8")
print("OK: profile/page.tsx agora usa setSession")