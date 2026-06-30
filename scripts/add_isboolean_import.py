#!/usr/bin/env python3
"""Adiciona IsBoolean aos imports."""
from pathlib import Path

p = Path("apps/api/src/common/config/env.validation.ts")
content = p.read_text(encoding="utf-8")

if "IsBoolean," not in content:
    content = content.replace(
        "IsBooleanString,",
        "IsBoolean,",
        1,
    )
    p.write_text(content, encoding="utf-8")
    print("OK: IsBoolean importado")
else:
    print("Ja tem IsBoolean")