#!/usr/bin/env python3
"""Regenera APENAS o ENCRYPTION_KEY com 32 bytes (64 hex chars)."""
import secrets
from pathlib import Path

NEW_KEY = secrets.token_hex(32)  # 32 bytes = 64 hex chars

for path in [".env", "apps/api/.env"]:
    p = Path(path)
    if not p.exists():
        continue
    content = p.read_text(encoding="utf-8")
    lines = content.splitlines()
    new_lines = []
    for line in lines:
        if line.startswith("ENCRYPTION_KEY="):
            new_lines.append(f'ENCRYPTION_KEY="{NEW_KEY}"')
        else:
            new_lines.append(line)
    p.write_text("\n".join(new_lines) + "\n", encoding="utf-8")
    print(f"OK: {path} atualizado com ENCRYPTION_KEY de 64 chars")