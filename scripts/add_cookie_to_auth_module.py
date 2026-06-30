#!/usr/bin/env python3
"""Adiciona CookieService ao AuthModule providers."""
from pathlib import Path

p = Path("apps/api/src/modules/auth/auth.module.ts")
content = p.read_text(encoding="utf-8")

# Adiciona import
if "CookieService" not in content:
    content = content.replace(
        "import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';",
        "import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';\nimport { CookieService } from '../../common/cookies/cookie.service';",
    )

# Adiciona provider
if "CookieService," not in content:
    content = content.replace(
        "providers: [AuthService, JwtStrategy, JwtAuthGuard],",
        "providers: [AuthService, JwtStrategy, JwtAuthGuard, CookieService],",
    )

p.write_text(content, encoding="utf-8")
print("OK: CookieService adicionado ao AuthModule")