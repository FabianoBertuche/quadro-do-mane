#!/usr/bin/env python3
"""Remove Domain=localhost do CookieService (causa bug cross-port)."""
from pathlib import Path

p = Path("apps/api/src/common/cookies/cookie.service.ts")
content = p.read_text(encoding="utf-8")

# Substitui usos de domain por vazio
content = content.replace(
    "      domain,\n      path: '/',",
    "      path: '/',",
)
content = content.replace(
    "      domain,\n      path: '/api/auth',",
    "      path: '/api/auth',",
)
content = content.replace(
    "      domain,\n    };\n    res.clearCookie(CookieService.ACCESS_TOKEN",
    "    };\n    res.clearCookie(CookieService.ACCESS_TOKEN",
)
content = content.replace(
    "      domain,\n    };\n    res.clearCookie(CookieService.REFRESH_TOKEN",
    "    };\n    res.clearCookie(CookieService.REFRESH_TOKEN",
)

# Remove a leitura do COOKIE_DOMAIN já que não vamos usar
content = content.replace(
    "  private get cookieDomain() {\n    return this.config.get<string>('COOKIE_DOMAIN', 'localhost');\n  }\n",
    "",
)

# Remove a chamada this.cookieDomain
content = content.replace(
    "      domain: this.cookieDomain,\n",
    "",
)

p.write_text(content, encoding="utf-8")
print("OK: Domain removido dos cookies")