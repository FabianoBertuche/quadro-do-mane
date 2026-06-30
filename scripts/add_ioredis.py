#!/usr/bin/env python3
"""Adiciona ioredis e @types/passport-jwt faltando em apps/api/package.json."""
import json
from pathlib import Path

p = Path("apps/api/package.json")
pkg = json.loads(p.read_text(encoding="utf-8"))

deps = pkg.setdefault("dependencies", {})

# Adiciona ioredis
if "ioredis" not in deps:
    # inserir depois de imapflow, ordem alfabética mantida
    new_deps = {}
    inserted = False
    for k, v in deps.items():
        if not inserted and k > "ioredis":
            new_deps["ioredis"] = "^5.4.1"
            inserted = True
        new_deps[k] = v
    if not inserted:
        new_deps["ioredis"] = "^5.4.1"
    pkg["dependencies"] = new_deps

# Garante @types/ioredis como devDep
dev_deps = pkg.setdefault("devDependencies", {})
if "@types/ioredis" not in dev_deps:
    dev_deps["@types/ioredis"] = "^5.0.0"

p.write_text(json.dumps(pkg, indent=2) + "\n", encoding="utf-8")
print("OK: ioredis adicionado ao package.json")