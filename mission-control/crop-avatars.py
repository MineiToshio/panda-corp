#!/usr/bin/env python3
"""Recorta una grilla 3x3 de avatares en 9 PNG, uno por agente.
Uso: python3 crop-avatars.py <ruta-grid.png> [carpeta-salida]
Orden de lectura (filas, izq→der) = orden de los agentes en Configuración."""
import sys, os
from PIL import Image

ORDER = [
    "researcher", "product-manager", "designer",      # fila 1
    "architect", "backend-dev", "frontend-dev",       # fila 2
    "test-writer", "reviewer", "security-auditor",    # fila 3
]

src = sys.argv[1] if len(sys.argv) > 1 else "assets/agents/grid.png"
out = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "prototype", "assets", "agents")
os.makedirs(out, exist_ok=True)

img = Image.open(src).convert("RGBA")
W, H = img.size
cw, ch = W // 3, H // 3
for i, name in enumerate(ORDER):
    r, c = divmod(i, 3)
    cell = img.crop((c * cw, r * ch, (c + 1) * cw, (r + 1) * ch))
    cell.save(os.path.join(out, name + ".png"))
print(f"OK — grilla {W}x{H}, celdas {cw}x{ch}, 9 avatares en {out}")
