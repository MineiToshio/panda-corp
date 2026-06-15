# Idea origen — Pandacorp (el panel de la fábrica)

Surgió en la conversación de diseño de la fábrica (2026-06-13). El dueño quería una **interfaz gráfica**, no operar todo por terminal, pero con una condición dura: **usar solo su suscripción Claude Max** (no el pool headless de `claude -p`).

La solución: un dashboard web **local y de solo-lectura** que **nunca llama a Claude** — solo lee archivos y le dice al dueño qué comando copiar y pegar en Claude Code. Es la **interfaz de la propia fábrica**, por eso vive dentro de `panda-corp/cockpit/` (excepción a "aquí no vive código de producto": no es un producto-cliente).

Es el primer proyecto de la fábrica y sirve de dogfooding del pipeline. El prototipo navegable (`cockpit/prototype/index.html`) hizo de fase de diseño; este PRD + FRDs formalizan el producto.
