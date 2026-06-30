#!/usr/bin/env python3
"""Restaura NEXT_PUBLIC_API_URL para URL absoluta."""
from pathlib import Path

p = Path(".env")
content = p.read_text(encoding="utf-8")
content = content.replace(
    "NEXT_PUBLIC_API_URL=/api",
    "NEXT_PUBLIC_API_URL=http://localhost:3001/api",
)
p.write_text(content, encoding="utf-8")

# Tambem apps/api/.env
p2 = Path("apps/api/.env")
if p2.exists():
    content2 = p2.read_text(encoding="utf-8")
    content2 = content2.replace("NEXT_PUBLIC_API_URL=/api", "NEXT_PUBLIC_API_URL=http://localhost:3001/api")
    p2.write_text(content2, encoding="utf-8")

print("OK: NEXT_PUBLIC_API_URL = http://localhost:3001/api")