#!/usr/bin/env python3
"""Incrusta los avatares y fondos de zona como data-URI base64 dentro del index.html,
para que el prototipo sea autocontenido (se ve en el preview de Claude Code y en el navegador)."""
import re, base64, io, os, json
from PIL import Image

HERE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "prototype")
os.chdir(HERE)

avatars = ["researcher","product-manager","designer","architect","backend-dev","frontend-dev","test-writer","reviewer","security-auditor"]
zones = ["investigacion","testing","backend","frontend"]

def enc(path, size):
    im = Image.open(path).convert("RGBA")
    im.thumbnail((size, size), Image.LANCZOS)
    buf = io.BytesIO(); im.save(buf, "PNG", optimize=True)
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()

IMG = {}
for a in avatars: IMG[a] = enc(f"assets/agents/{a}.png", 96)
for z in zones:   IMG[z] = enc(f"assets/zones/{z}.png", 320)

imgjs = "var IMG=" + json.dumps(IMG) + ";\n"

html = open("index.html").read()
if "var IMG=" in html:
    html = re.sub(r"var IMG=\{.*?\};\n", imgjs, html, count=1, flags=re.S)
else:
    html = html.replace("var PIPE=", imgjs + "var PIPE=", 1)

# Reemplazar referencias a archivos por las imágenes incrustadas
repl = [
    ('src="assets/agents/\'+n+\'.png"',   'src="\'+(IMG[n]||"")+\'"'),
    ('src="assets/agents/\'+s[1]+\'.png"', 'src="\'+(IMG[s[1]]||"")+\'"'),
    ("background:url(assets/zones/'+z[2]+'.png) center/cover",
     "background:url('+(IMG[z[2]]||\"\")+') center/cover"),
]
for old, new in repl:
    html = html.replace(old, new)

open("index.html", "w").write(html)
print("OK — incrustadas", len(IMG), "imágenes; index.html ahora autocontenido")
