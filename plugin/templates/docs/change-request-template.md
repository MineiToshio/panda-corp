---
type: change             # bug | feature | change
class: standard          # expedite | standard | intangible | fixed-date (metadata, not automatic scheduling)
status: draft            # draft | ready | building | closing | done | discarded; capture starts as draft, never auto-drained
date: YYYY-MM-DD
frd:                     # affected feature/screen if known (frd-NN-<slug>), else blank
rebuilds_verified: false # true if this redoes already-VERIFIED work (the build flags & guides first)
rigor:                   # micro | normal | critical — DERIVED, never asked: `plugin/scripts/classify-change.sh`
rigor_reasons:           # the signals behind it, e.g. "S2 (47 lines, 4 files), S14 (route UI)"
depends_on:              # optional: another change/WO that must land first
supersedes:              # optional (DR-116): the old rule/claim this change REPLACES — iterate then verifies no doc still asserts it. Blank for adding-only changes.
implemented_sha:         # written by sync close-out when it sets status: closing: the commit(s) that implemented this change
closing_at:              # written by sync close-out alongside implemented_sha: ISO timestamp; doc-lint.sh reds it past 48h in status: closing
---

<!--
  TEMPLATE for .pandacorp/inbox/changes/<slug>.md. Frontmatter is English and the owner-facing
  body is Spanish. /pandacorp:implement is the single build entry; the queue is a file format,
  never automatically drained. For "write it down", create a draft and stop after validating:
  node <plugin>/scripts/pandacorp-build.mjs card check <path>
  Resolve <plugin> from the factory path in .pandacorp/guide.md.
  Fill Dentro with the requested scope and a real quote from the owner; name exclusions in Fuera
  and unresolved questions in Dudas. Never invent a quote. Keep the bug or feature detail below.
  Legacy rigor metadata may be retained for readers; the v2 CLI classifies the real diff.
  implemented_sha / closing_at belong only to sync close-out; leave them blank at capture.
  A closing card older than 48h is a doc-lint failure. Cards are moved to done/, never deleted.
-->

# Replace with a one-line title (español)

## Dentro
- Alcance solicitado, con cita textual del owner: "…".

## Fuera
- Lo que queda fuera de este cambio.

## Dudas
- Preguntas pendientes, o ninguna.

<!-- Para un BUG: -->
## Pasos para reproducir
1. …

## Esperado
Qué debería pasar.

## Actual
Qué pasa en su lugar (pantalla/FRD afectado).

<!-- Para una FEATURE / CAMBIO (borra el bloque de bug): -->
## Qué se quiere
La capacidad o el ajuste, en lenguaje del owner.

## Contexto
Por qué, y cualquier detalle que lo haga accionable. Si toca diseño/visual, indícalo
("necesita pase de `/pandacorp:design`").
