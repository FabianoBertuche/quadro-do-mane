#!/usr/bin/env python3
"""Corrige o decorator COOKIE_SECURE para aceitar boolean."""
from pathlib import Path

p = Path("apps/api/src/common/config/env.validation.ts")
content = p.read_text(encoding="utf-8")

old = """  @Transform(({ value }) =>
    value === undefined ? false : ['1', 'true', 'yes'].includes(String(value).toLowerCase()),
  )
  @IsBooleanString()
  COOKIE_SECURE!: boolean;"""

new = """  @Transform(({ value }) => {
    if (typeof value === 'boolean') return value;
    if (value === undefined) return false;
    return ['1', 'true', 'yes'].includes(String(value).toLowerCase());
  })
  @IsBoolean()
  COOKIE_SECURE!: boolean;"""

if old not in content:
    print("PADRAO NAO ENCONTRADO")
    raise SystemExit(1)

content = content.replace(old, new, 1)
p.write_text(content, encoding="utf-8")
print("OK: COOKIE_SECURE agora usa @IsBoolean")