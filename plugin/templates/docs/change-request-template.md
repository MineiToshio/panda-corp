<!--
  TEMPLATE for a change-queue card: .pandacorp/inbox/changes/<slug>.md
  Written by /pandacorp:change (and the /pandacorp:bug, /pandacorp:iterate engines). This is the
  OWNER CHANNEL: gitignored, so the FRONTMATTER is English (machine-stable) and the BODY is Spanish.
  Writing the card is always capture + classify only. What happens NEXT depends on the card: a
  queued one is drained by the build at a safe point (DR-067/069); a `ready` micro/normal one with
  no build running is implemented and closed in the same turn by `/pandacorp:change --now`. Keep the
  flavor that fits (bug vs feature/change) and delete the other.

  `rigor` is DERIVED, never asked: run `plugin/scripts/classify-change.sh` over the change's diff
  (plus this card) and copy its verdict in. `class` decides WHEN a change is picked up; `rigor`
  decides HOW MUCH evidence it must collect. An agent may only ESCALATE the derived level, stating
  why in `rigor_reasons`; nothing may lower it, and a floor hit (auth, money, PII, persistence,
  irreversible, secrets, the oracles, the factory's machinery) is always `critical`.
  `/pandacorp:change` writes a PROVISIONAL verdict at capture time, derived with `--files` over the
  paths the change will plausibly touch; `--files` carries no diff body, so it can never certify
  `micro`. The DEFINITIVE verdict is recomputed with `--range` over the real diff before close-out
  and overwrites the provisional one.

  A change handed back for the owner (the fast path's gate stayed red, or the real diff came out
  `critical`) is recorded as `status: draft` plus a `## Bloqueado` section in the body, never as a
  new status token: the build drains only `ready`, so `draft` already keeps it from being drained,
  and the queue's readers (the build's drain, Mission Control's validator) accept no other value.

  `implemented_sha` / `closing_at` are written ONLY by `/pandacorp:sync`'s close-out mode, the
  instant it starts closing an already-implemented card (`status: closing`); never authored by
  `change`/`bug`. Blank until then. `doc-lint.sh` reds a `closing` card whose `closing_at` is
  older than 48h (proposal 37 §A.6): an interrupted close-out stays visible, never silently lost.
-->
---
type: change             # bug | feature | change
class: standard          # expedite | standard | intangible | fixed-date  (urgency, DR-069)
status: ready            # ready | draft | closing | done   (build builds `ready`, skips `draft`; `closing` = /pandacorp:sync close-out in flight; `done` = closed and archived)
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
