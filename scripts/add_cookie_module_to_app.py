#!/usr/bin/env python3
"""Adiciona CookieModule ao AppModule."""
from pathlib import Path

p = Path("apps/api/src/app.module.ts")
content = p.read_text(encoding="utf-8")

if "CookieModule" not in content:
    content = content.replace(
        "import { RedisModule } from './common/redis/redis.module';",
        "import { RedisModule } from './common/redis/redis.module';\nimport { CookieModule } from './common/cookies/cookie.module';",
    )
    content = content.replace(
        "    RedisModule,",
        "    RedisModule,\n    CookieModule,",
    )

p.write_text(content, encoding="utf-8")
print("OK: CookieModule adicionado ao AppModule")