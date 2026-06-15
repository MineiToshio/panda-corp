#!/usr/bin/env python3
"""Crop a 3x3 grid of avatars into 9 PNGs, one per agent.
Usage: python3 crop-avatars.py <grid-path.png> [output-folder]
Reading order (rows, left→right) = the order of the agents in Configuration."""
import sys, os
from PIL import Image

ORDER = [
    "researcher", "product-manager", "designer",      # row 1
    "architect", "backend-dev", "frontend-dev",       # row 2
    "test-writer", "reviewer", "security-auditor",    # row 3
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
print(f"OK — grid {W}x{H}, cells {cw}x{ch}, 9 avatars in {out}")
