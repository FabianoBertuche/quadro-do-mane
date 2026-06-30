#!/usr/bin/env python3
"""Ajusta o DATABASE_URL do .env para apontar para o Postgres andromeda."""
from pathlib import Path

p = Path(".env")
content = p.read_text(encoding="utf-8")
content = content.replace(
    'DATABASE_URL="postgresql://postgres:postgres@localhost:5432/quadro_do_mane?schema=public"',
    'DATABASE_URL="postgresql://andromeda:andromeda@localhost:5432/quadro_do_mane?schema=public"',
)
p.write_text(content, encoding="utf-8")
print("OK: DATABASE_URL apontando para andromeda")