---
id: BL-0307
type: bug
area: templates
title: "Change-queue cards stay ready after their work shipped or was superseded"
status: done
severity: p1
opened: 2026-11-10
closed: 2026-11-10
source: "owner, 2026-11-10: funko-tracker Cambios tab showed 9 'Listos para construir', 8 already done or obsolete"
closes: "DR-147; overlay 8.120.0; plugin 9.152.0"
links: [DR-069, DR-097, DR-147]
---

## Problem
Mission Control's Cambios tab for funko-tracker listed 9 cards as `ready` ("Listos para construir"). An
audit on 2026-11-10 found 8 of them stale (closed by hand into `.pandacorp/inbox/changes/done/`):

- `catalog-standardized-names` (shipped in 2dd09318) and `export-checklist-sheet-redesign` (45b05370):
  built directly in chat on 2026-10-28, FRDs and decision log updated, card never touched.
- `launch-public-discovery`, `launch-measurement-observability`, `launch-contextual-reports`,
  `launch-public-performance`: specified as new FRD-08/10/11/12 on 2026-11-07 (e9be30d4), built by the
  launch packages (squash 3e44b10f), WOs marked VERIFIED in 4d5e883b. Card never touched.
- `bitty-pop-unboxed-photos`, `bitty-pop-boxed-photo-orientation`: superseded by owner decisions in
  `docs/decision-log.md` (2026-11-06); the decision entries never named the cards.

The owner's requirement: however the work is done, the queue must show only what is really pending.
A stale `ready` card is also a hazard, not just clutter: the next bare `/implement` drains every `ready`
card, so it would re-integrate already-shipped work.

## Root cause
The queue had exactly ONE closing path that worked by construction: the build engine archives cards it
drained itself (`status: building` + `affected_frds`, `reconcileBuildingChange`). Every other landing path
depended on an agent remembering an optional step, and nothing linked the landed work back to the card:

1. **Direct work in chat** — closing needs `/pandacorp:change --now` or `/pandacorp:sync --close-out <slug>`.
   Neither the guide nor `merge-queue.sh` asks for it; commits carry no card reference, so nothing can
   detect the card later.
2. **Work built as FRDs/WOs from spec/new-version/a launch plan** — the card names an FRD (`frd:`) but the
   WOs never name the card, and the engine's close-out sweep only reads `building` cards. A `ready` card
   whose FRD was built through another door is invisible to it.
3. **Owner decisions that supersede a card** — `decide`/direct decision-log entries have no step that
   updates the queue; the decision text does not name the card.

## Fix plan
1. `templates/shared/.pandacorp/change-reconcile.mjs` — a deterministic reconciler (no deps):
   - STRONG evidence, auto-applied: a commit reachable from the default branch with a `Change: <slug>`
     trailer (→ done) or `Supersedes-Change: <slug>` (→ discarded); or ≥1 WO declaring
     `source_change: <slug>` with all such WOs VERIFIED (→ done).
   - WEAK evidence, flag only (`stale_suspect` frontmatter, never a status change): the slug named in a
     commit message or `docs/decision-log.md`; or every WO of the card's FRDs VERIFIED with the FRD born
     on/after the card's date. Owner resolves with `--confirm-done`, `--supersede` or `--dismiss`
     (a dismissal is fingerprinted, so it re-flags only on new evidence).
   - Only `ready`/`draft` cards; `building`/`closing` stay engine/sync-owned. Refuses `--apply` while a
     build is live unless `--in-build`.
2. Wire it into every landing path: `merge-queue.sh` after the ff-merge; the build engine's archive
   sweep (close-out) and its pre-drain safe point; `sync` (close-out commit trailer + warm mode); `change
   --now`; `decide`; `iterate`/`spec`/`new-version` stamp `source_change` on WOs created from a card.
3. Engine drain skips `stale_suspect` cards (never rebuild suspected-shipped work).
4. Mission Control: read `stale_suspect`; show those cards in their own "¿Ya hecho?" group, outside
   "Listos para construir" and out of every pending count.
5. Guide + standards + registry (DR-147): commit trailer convention and the reconciler contract.

## Tests
- `plugin/scripts/test-change-reconcile.mjs`: fixtures in a temp git repo for each path (trailer done,
  supersede trailer, `source_change` WOs, partial WOs stay ready, slug-in-message flag, FRD-born-after flag,
  FRD verified BEFORE the card does NOT flag, dismissal fingerprint, build-live refusal, building cards
  untouched, idempotence, file moved never deleted).
- Mission Control unit tests for the reader field and the panel grouping.
- Replay against a copy of funko-tracker's pre-audit queue: the 4 launch cards and the 2 direct cards flag.
