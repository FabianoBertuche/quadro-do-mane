#!/usr/bin/env python3
"""Adiciona TenantContextModule ao AppModule."""
from pathlib import Path

p = Path("apps/api/src/app.module.ts")
content = p.read_text(encoding="utf-8")

if "TenantContextModule" not in content:
    content = content.replace(
        "import { TenantMiddleware } from './common/tenant/tenant.middleware';",
        "import { TenantMiddleware } from './common/tenant/tenant.middleware';\nimport { TenantContextModule } from './common/tenant/tenant-context.module';",
    )
    content = content.replace(
        "    CookieModule,",
        "    CookieModule,\n    TenantContextModule,",
    )

p.write_text(content, encoding="utf-8")
print("OK: TenantContextModule adicionado")