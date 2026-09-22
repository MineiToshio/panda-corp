<!--
  TEMPLATE for a change-queue card: .pandacorp/inbox/changes/<slug>.md
  Written by /pandacorp:change (and the /pandacorp:bug, /pandacorp:iterate engines). This is the
  OWNER CHANNEL: gitignored, so the FRONTMATTER is English (machine-stable) and the BODY is Spanish.
  The card only captures + classifies; the build drains it at a safe point (DR-067/069). Keep the
  flavor that fits (bug vs feature/change) and delete the other.

  `rigor` is DERIVED, never asked: run `plugin/scripts/classify-change.sh` over the change's diff
  (plus this card) and copy its verdict in. `class` decides WHEN a change is picked up; `rigor`
  decides HOW MUCH evidence it must collect. An agent may only ESCALATE the derived level, stating
  why in `rigor_reasons`; nothing may lower it, and a floor hit (auth, money, PII, persistence,
  irreversible, secrets, the oracles, the factory's machinery) is always `critical`.
-->
---
type: change             # bug | feature | change
class: standard          # expedite | standard | intangible | fixed-date  (urgency, DR-069)
status: ready            # ready | draft | done   (build builds `ready`, skips `draft`, marks `done`)
date: YYYY-MM-DD
frd:                     # affected feature/screen if known (frd-NN-<slug>), else blank
rebuilds_verified: false # true if this redoes already-VERIFIED work (the build flags & guides first)
rigor:                   # micro | normal | critical — DERIVED, never asked: `plugin/scripts/classify-change.sh`
rigor_reasons:           # the signals behind it, e.g. "S2 (47 lines, 4 files), S14 (route UI)"
depends_on:              # optional: another change/WO that must land first
supersedes:              # optional (DR-116): the old rule/claim this change REPLACES — iterate then verifies no doc still asserts it. Blank for adding-only changes.
---

# Replace with a one-line title (español)

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
