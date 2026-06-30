#!/usr/bin/env python3
"""Instala deps vazias do ioredis via npm pack + tar."""
import os
import shutil
from pathlib import Path

ROOT = Path("c:/FB/quadro-do-mane").resolve()
API_DIR = ROOT / "apps" / "api"
NODE_MODULES = API_DIR / "node_modules"

PACKAGES = [
    "cluster-key-slot@1.1.2",
    "denque@2.1.0",
    "lodash.defaults@4.2.0",
    "lodash.isarguments@3.1.0",
    "redis-errors@1.2.0",
    "redis-parser@3.0.0",
    "standard-as-callback@2.1.0",
]

print(f"Working in: {API_DIR}")

for spec in PACKAGES:
    name = spec.split("@")[0]
    target_dir = NODE_MODULES / name

    # Pula se já tem conteúdo
    if target_dir.exists() and any(target_dir.iterdir()):
        print(f"  SKIP {name} (ja tem conteudo)")
        continue

    target_dir.mkdir(parents=True, exist_ok=True)
    print(f"  - {spec}")

    # npm pack direto no cwd correto
    rc = os.system(f'cd /d "{API_DIR}" && npm pack {spec} --no-audit --no-fund >nul 2>&1')
    if rc != 0:
        print(f"    ERRO ao baixar")
        continue

    # Encontrar tarball
    tarball_prefix = name.replace("@", "").replace("/", "-")
    tarballs = list(API_DIR.glob(f"{tarball_prefix}-*.tgz"))
    if not tarballs:
        print(f"    AVISO: tarball nao encontrado para {spec}")
        continue

    tb = tarballs[0]
    target_win = str(target_dir).replace("/", "\\")
    rc = os.system(f'cd /d "{API_DIR}" && tar -xzf "{tb.name}" -C "{target_win}" --strip-components=1 >nul 2>&1')
    tb.unlink(missing_ok=True)
    if rc == 0:
        files = list(target_dir.iterdir())
        print(f"    OK ({len(files)} arquivos)")
    else:
        print(f"    ERRO ao extrair")

print("\nVerificacao final:")
for spec in PACKAGES:
    name = spec.split("@")[0]
    d = NODE_MODULES / name
    if d.exists():
        contents = list(d.iterdir())
        status = "OK" if contents else "VAZIO"
        print(f"  {status}: {name} ({len(contents)} itens)")
    else:
        print(f"  AUSENTE: {name}")