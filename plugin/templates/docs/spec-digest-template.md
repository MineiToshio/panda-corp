<!--
  SPEC DIGEST — the owner-facing Spanish summary of the spec, rendered NATIVELY by Mission
  Control's "Spec" tab (between Propuesta and Documentos). It lives at
  `.pandacorp/comms/spec-resumen.md` (gitignored Spanish layer — the underlying PRD/research/FRD
  docs stay English in `docs/`). It is a HIGH-LEVEL, visual, scannable overview — NOT a copy of
  the docs. The tab shows it only when this file exists, so the column appears once the project
  reaches the product phase.

  HOW IT'S CONSUMED (the rendering contract — keep the markers EXACTLY):
  · YAML frontmatter `proyecto` + `fase` → the hero (title + a "fase · …" chip).
  · The first `>` blockquote line → the intro under the title.
  · Three `## ` sections, detected by keyword in the heading: one containing **PRD**, one
    containing **Research** (or "investig"), one containing **FRD**. Order them PRD → Research → FRDs.
  · PRD / Research are sets of `### subsection` blocks. The parser classifies each block BY ITS
    LABEL and renders it richly — so NAME the labels with these keywords:
      - "Usuarios"            → role cards     → bullets `- **Rol** — descripción`
      - "Métricas de éxito"   → green stat cards → bullets `- **Métrica** — descripción`
      - "Alcance v1"          → solid chips    → plain bullets `- texto`
      - "Fuera del v1"        → muted/struck chips → plain bullets `- texto`
      - "Decisiones abiertas" → amber callout  → bullets `- **Título** — descripción`
      - "Referentes"          → reference cards → bullets `- **nombre.com** — qué copiar`
      - anything else (e.g. "Hipótesis de valor", "El problema", "El diferenciador") → prose
        (write normal markdown; **bold** is allowed and is coloured by the renderer).
  · The FRDs section is a set of `### FRD-NN · Título · TAG` cards (TAG = UI / Infra / CLI …).
    Each card shows a one-line summary; clicking it opens a colour-coded modal. Per FRD, write:
      a one-line summary (prose, BEFORE any `**Label:**`), then these labelled blocks (omit any
      that don't apply): `**Overview:**` (prose), `**User stories:**` (bullets), `**Reglas de
      negocio:**` (bullets), `**Fuera de alcance:**` (bullets), `**Open questions:**` (bullets —
      the things the owner still has to resolve for that FRD).
  · Spanish (owner-facing). One FRD card per v1 FRD. Keep it SCANNABLE — a few bullets each, not
    the full FRD. The card summary is the one-liner; the depth lives in the modal blocks.

  This file is the blank contract; below is a FILLED MINI-EXAMPLE to copy the shape from.
-->
---
proyecto: "<Nombre del proyecto>"
fase: producto
---

> Vista de alto nivel del PRD, el research y los FRDs. Los documentos completos (en inglés) están en la pestaña Documentos.

## 📋 PRD

### Hipótesis de valor
Si <cambio>, entonces <resultado de valor> — en una o dos frases, con **negritas** en lo clave.

### El problema
La escena concreta del dolor (quién, el momento exacto), contada como storytelling.

### Usuarios
- **Usuario A** — qué busca en 10s y qué lo hace contactar / cerrar la pestaña.
- **Usuario B** — …

### Métricas de éxito
- **Métrica 1** — cómo y cuándo se mide.
- **Métrica 2** — …

### Alcance v1
- Feature 1
- Feature 2
- Feature 3

### Fuera del v1
- Lo que queda en backlog
- …

### Decisiones abiertas
- **Decisión 1** — qué falta decidir antes de avanzar.
- **Decisión 2** — …

## 🔬 Research

### Hallazgo clave
El insight que sostiene la apuesta, con su evidencia en una frase.

### El diferenciador
Por qué nuestra propuesta gana (el wedge), honesto.

### Referentes
- **referente.com** — qué hace bien / qué copiar.
- **otro.com** — …

## 🧩 FRDs

### FRD-01 · <Título> · UI
Resumen de una línea de qué es esta feature.
**Overview:** 2-3 líneas que amplían el resumen.
**User stories:**
- Como <rol>, quiero <X> para <Y>.
**Reglas de negocio:**
- <regla / invariante>.
**Fuera de alcance:**
- <lo que esta FRD NO hace>.
**Open questions:**
- <pregunta a resolver para esta FRD>.

### FRD-02 · <Título> · Infra
Resumen de una línea.
**Overview:** …
**User stories:**
- …
