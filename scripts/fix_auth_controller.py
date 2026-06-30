#!/usr/bin/env python3
"""Corrige AuthController: simplifica spread no refresh."""
from pathlib import Path

p = Path("apps/api/src/modules/auth/auth.controller.ts")
content = p.read_text(encoding="utf-8")

old = "return applyAuthCookies(res, { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, ...tokens }, this.cookies);"
new = "return applyAuthCookies(res, tokens, this.cookies);"

if old not in content:
    print("PADRAO NAO ENCONTRADO")
    raise SystemExit(1)

content = content.replace(old, new, 1)
p.write_text(content, encoding="utf-8")
print("OK: refresh simplificado")