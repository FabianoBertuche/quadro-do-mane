#!/usr/bin/env python3
"""Instala ioredis e suas deps via npm pack + tar."""
import os
from pathlib import Path

API_DIR = Path("apps/api")

PACKAGES = [
    "@ioredis/commands@1.2.0",
    "cluster-key-slot@1.1.2",
    "denque@2.1.0",
    "lodash.defaults@4.2.0",
    "lodash.isarguments@3.1.0",
    "redis-errors@1.2.0",
    "redis-parser@3.0.0",
    "standard-as-callback@2.1.0",
]

print("Instalando deps do ioredis via npm pack...")
for spec in PACKAGES:
    name = spec.split("@")[0] if not spec.startswith("@") else "@" + spec.split("@")[1]
    target_dir = API_DIR / "node_modules" / name
    target_dir.mkdir(parents=True, exist_ok=True)

    print(f"  - {spec}")
    os.system(f'cd /d {API_DIR} && npm pack {spec} --no-audit --no-fund >nul 2>&1')

    tarball_prefix = name.replace("@", "").replace("/", "-")
    tarballs = list(API_DIR.glob(f"{tarball_prefix}-*.tgz"))
    if not tarballs:
        print(f"    AVISO: tarball nao encontrado para {spec}")
        continue

    tb = tarballs[0]
    target_win = str(target_dir).replace("/", "\\")
    os.system(f'cd /d {API_DIR} && tar -xzf {tb.name} -C "{target_win}" --strip-components=1 >nul 2>&1')
    tb.unlink(missing_ok=True)
    print(f"    OK")

# Renomeia _pkg.json do ioredis
pkg_tmp = API_DIR / "node_modules" / "ioredis" / "_pkg.json"
pkg_real = API_DIR / "node_modules" / "ioredis" / "package.json"
if pkg_tmp.exists():
    pkg_real.write_bytes(pkg_tmp.read_bytes())
    pkg_tmp.unlink()
    print("OK: package.json do ioredis restaurado")

# Verifica
built = API_DIR / "node_modules" / "ioredis" / "built" / "index.js"
print(f"\nioredis built/index.js: {built.exists()}")