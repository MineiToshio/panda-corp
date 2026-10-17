---
id: BL-0239
type: bug
area: plugin-skill
title: "Make the design freeze refuse an FDD that specifies UI the frozen prototype (the fidelity oracle) never draws"
status: done
severity: p0
opened: 2026-10-17
closed: 2026-10-17
source: "funko-tracker architecture phase, 2026-10-17: FRD-06/07 FDDs specify an operator console the prototype never drew; owner: this must never happen again"
closes: "DR-130 + DES-8; plugin v9.128.0 (check-fdd-coverage.mjs in the design gate and the architecture readiness gate)"
links: [DR-128, DR-129, DR-064, DR-100]
---

## Problem
funko-tracker finished its design phase (29 rounds, `check-design-gate.mjs` READY) and entered architecture. Writing
the blueprints, the architects found that `docs/frds/frd-06-franchise-backfill/fdd.md` and
`frd-07-delta-discovery/fdd.md` specify an operator console with controls the frozen prototype never drew: "Nueva
carga", the "Ver ejecución" select, a per-source progress table, a media readiness line, "Configurar", "Ver más
candidatos", "Volver a la cola". Their strings exist in `docs/design/microcopy.es.json` but appear 0 times in
`docs/design/prototype/funko-tracker.html` (`#operador`). The FDDs also contradict the prototype on behaviour
(Publicar aria-disabled vs enabled; the Motivo error drawn at rest vs only after a press; coverage column order), and
`docs/design/prototype/reference/oracle-states.md` holds ONE `operator` capture for both FRDs.

The build's fidelity gate is blocking (DR-129 Gate mode) and compares the build with that oracle, so a build that
follows the FDD can never pass it, and a build that follows the prototype violates the FDD. The design gate said
READY anyway. A read-only run of the new check over funko-tracker shows the same defect class in every UI FRD (rows
under a "Designed GAP states (no prototype picture)" heading, strings named but never drawn), not only FRD-06/07.

## Root cause
1. The freeze process SANCTIONED pictureless UI: Step 8b Group B said "build it into the prototype **or flag it as an
   explicit gap**", and S2.3 told the FDD writer to add "GAP states for flagged Group B items". A flagged gap became
   an FDD row with no capture, i.e. UI specified outside the oracle.
2. Nothing compared the FDD's content with the oracle. `check-design-gate.mjs` only checked that `fdd.md` exists, is
   at least 1000 bytes and has `## Fidelity references`. The single S3 audit is judged and time-boxed, so a whole
   console slipped through.
3. Architecture's readiness gate (step 9) checks REQ/AC/WO cohesion, not that the UI it plans exists in the oracle.

## Fix plan
1. `plugin/skills/design/scripts/check-fdd-coverage.mjs` (new, deterministic, fail-closed, no browser): per UI FRD,
   (a) every table row under `## Screens` / `## States` cites in backticks a captured state of the FRD's shard
   (`mocks/*.html` `mock-screen` section ids, or file stems for hand-drawn mocks); (b) when
   `prototype/reference/oracle-states.json` exists, each row cites an entry of it for this FRD; (c) every microcopy
   key in backticks and every quoted label equal to a microcopy value is drawn in this FRD's captured states (visible
   text plus aria-label/placeholder/title/alt/value, hidden/demo-only/script/svg excluded), a string captured only in
   another FRD passing only when the line names that FRD; (d) no FDD line overrules the prototype ("the prototype's
   ... is a demonstration", "unlike the prototype"...); `--plan` adds (e): the FRD's blueprint and work orders name
   only drawn copy. Requires `docs/design/microcopy*.json`.
2. `check-design-gate.mjs` imports it, so READY needs FDD <-> oracle coverage.
3. Design process: SKILL.md Steps 7, 8, 8b, 9 + `references/freeze-and-fidelity.md` (S2.1, S2.3, S2.6, S3 blocker
   list) + `agents/designer.md` + `templates/docs/fdd-template.md`: no pictureless GAP; Group B is built into the
   prototype as a configured, captured state with an oracle entry, or taken out of the FRD/FDD by the owner; the FDD
   cites the oracle state id on every screen/state row; the prototype wins for visuals, a contradiction is resolved
   by amending the FDD or the prototype before freeze.
4. `plugin/skills/architecture/SKILL.md` step 9: the readiness gate runs `check-fdd-coverage.mjs --plan`
   fail-closed; a plan for UI the oracle lacks goes back to design, never forward.
5. Copywriter: the keyed strings live in `docs/design/microcopy.<locale>.json`.

## Tests (prove the fix — TDD, RED → GREEN)
- `plugin/scripts/test-fdd-coverage.mjs` with fixtures `plugin/scripts/fixtures/fdd-coverage/{funko-like,synced}/`:
  the funko-like project (operator console named in the FDD, GAP rows, one shared capture, an override sentence, a
  work order planning an undrawn control) is RED on every check, with the expected lines; the synced project is
  GREEN, including with `--plan`; unit cases for the mock text extractor (hidden, demo-only, shard chrome, attributes).
- `plugin/scripts/test-design-gate.mjs`: the ready fixture stays READY with a synced FDD; overlay cases go NOT READY
  for a pictureless GAP row, an undrawn label, an override sentence, a missing copy file and a missing oracle entry.

## Done when
- Both test files pass; `check-fdd-coverage.mjs` is RED on funko-tracker FRD-06/07 (read-only run).
- SKILL.md, freeze-and-fidelity.md, designer.md, copywriter.md, fdd-template.md and architecture SKILL.md updated.
- DR-130 in `factory/decisions/registry.yaml`, a DES row in `factory/standards/rule-registry.md`, the plugin decision
  log entry, plugin MINOR bump with regenerated manifests and Codex mirrors.

## Out of scope
- Fixing funko-tracker itself (its own session decides with the owner whether the console is designed or removed).
- Mechanically proving behaviour statements (enabled/disabled, error timing, column order) beyond the override
  tripwire: that agreement stays a BLOCKER of the one S3 audit.
