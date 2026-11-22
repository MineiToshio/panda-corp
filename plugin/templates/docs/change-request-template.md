---
type: change             # bug | feature | change
class: standard          # expedite | standard | intangible | fixed-date (metadata, not automatic scheduling)
status: draft            # draft | ready | building | closing | done | discarded; capture starts as draft, never auto-drained
date: YYYY-MM-DD
frd:                     # affected feature/screen if known (frd-NN-<slug>), else blank
ui: false               # true for a UI delta, including a small existing-surface adjustment
design_source: not-applicable # agreed | existing | pending | not-applicable (only ui: false)
design_refs: []         # agreed/existing: real owner citations or FDD/mock/prototype paths + states
design_decision_by: owner # owner | agent; agent for a delegated lightweight design decision
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
  never automatically drained. For "write it down", create a draft, check its metadata
  and scope against this template, and stop at capture.
  Fill Dentro with the requested scope and a real quote from the owner; name exclusions in Fuera
  and unresolved questions in Dudas. Never invent a quote. Keep the bug or feature detail below.
  UI agreed/existing: preserve the cited source, no redesign. UI pending: lightweight design before
  coding; when the owner delegates everything, the agent decides reversibly without a visual approval
  wait. Non-UI: not-applicable, no designer. Routing belongs to the conversation, never skill-to-skill.
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
Por qué, y cualquier detalle que lo haga accionable. Si hay UI, cita el diseño acordado o
los archivos/estados existentes en design_refs; si falta, declara design_source: pending.
El diseño ligero delegado lo decide el agente de forma reversible y el owner puede iterarlo después.
