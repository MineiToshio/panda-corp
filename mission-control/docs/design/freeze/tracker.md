---
time_box: 2h
started_at: 2026-10-21T20:43-05:00
finished_at: 2026-10-22T07:55-05:00
elapsed: 652m
owner_wait: 20m
outcome: shipped with backlog
preflight-ack: literalLengths
---

# Design freeze tracker — Mission Control (Órbita v2)

The freeze's checkpoint (DR-129). Plan and rules: `${CLAUDE_PLUGIN_ROOT}/skills/design/references/freeze-and-fidelity.md`. Capture-step state lives in `docs/design/freeze/state.json` (the toolkit's). `check-design-gate.mjs` reads this file.

**Fields.**
- `started_at` is set at S0.2 and `finished_at` at S5.2.
- `elapsed` is wall-clock minus `owner_wait` (time idle on an owner reply), updated at every stage boundary.
- `outcome` goes from `in-progress` to `shipped`. When `elapsed` exceeds `time_box`, it takes the over-time outcome named in the plan's § Time box.
- `preflight-ack` lists the preflight `warn` check ids judged acceptable, with the reason in Notes. A `fail` is never acknowledged.

**Rules.**
- Status is one of `planned`, `in-progress`, `done` or `deferred(owner)`. The gate accepts only `done` and `deferred(owner)`.
- A row becomes `done` only after its outputs exist on disk.
- On resume after a cut, `done` rows are never redone and `in-progress` rows are re-run from scratch.
- Times are `HH:MM`. Tier is the PORT-2 tier·effort, resolved from `plugin/runtime/model-tiers.json`.
- Keep the Stages table the only table with a Status column. The gate reads every row under that column.

## Stages

| Stage | Task | Tier | Depends on | Owner agent | Status | Started | Finished | Notes |
|---|---|---|---|---|---|---|---|---|
| S0 | S0.1 Preflight the approved prototype | MECH·low | — | lead shell | done | 20:40 | 20:42 | 0 fail, 1 warn (literalLengths, acknowledged) |
| S0 | S0.2 Open this tracker | MECH·low | — | lead | done | 20:43 | 20:45 | |
| S0 | S0.3 Context packs + config screens/states | STANDARD·medium | S0.2 | designer | done | 20:46 | 21:24 | 20 packs + _global; config 128 states / 137 components. Pre-capture prototype fixes by the lead: demo flag hides re-rendered demo controls, skip link focuses only, Inicio H1 = nav label, dialog pop without fade |
| S1 | S1.1 `freeze.mjs split` (CSS split, tokens) | MECH·low | S0.1 | lead shell | done | 20:47 | 20:52 | 56 files, 1554/1554 rules; tokens light 94 / dark 32 / 19 overrides; stale Atelier curated keys removed, `fonts` recorded |
| S1 | S1.2 `freeze.mjs all` (background capture) | MECH·low | S1.1, S0.3 | lead shell | done | 21:31 | 21:38 | measure 137 components / 849 records; shard 20 FRDs, 128 states, 694 shots; screens 54; catalog 137 + 64 icons; identity 8/8. Lead fixed 11 config actions (`doc:`/`$` clicks) and empty Manual images |
| S1 | S1.3 Functional reconciliation (DR-064) | JUDGE·high | S0.3 | designer | done | 21:31 | 21:38 | A 79 · B 53 (35 out for v2, 3 behaviour, 12 safety states, 3 owner) · 20 contradictions · 13 prototype corrections |
| S1 | S1.4-02 Copy reconciliation, FRD-02 | STANDARD·medium | S0.3 | copywriter | done | 21:32 | 21:35 | freeze/copy/ |
| S1 | S1.4-03 Copy reconciliation, FRD-03 | STANDARD·medium | S0.3 | copywriter | done | 21:32 | 21:35 | freeze/copy/ |
| S1 | S1.4-04 Copy reconciliation, FRD-04 | STANDARD·medium | S0.3 | copywriter | done | 21:32 | 21:35 | freeze/copy/ |
| S1 | S1.4-05 Copy reconciliation, FRD-05 | STANDARD·medium | S0.3 | copywriter | done | 21:32 | 21:35 | freeze/copy/ |
| S1 | S1.4-06 Copy reconciliation, FRD-06 | STANDARD·medium | S0.3 | copywriter | done | 21:32 | 21:35 | freeze/copy/ |
| S1 | S1.4-07 Copy reconciliation, FRD-07 | STANDARD·medium | S0.3 | copywriter | done | 21:32 | 21:35 | freeze/copy/ |
| S1 | S1.4-08 Copy reconciliation, FRD-08 | STANDARD·medium | S0.3 | copywriter | done | 21:32 | 21:35 | freeze/copy/ |
| S1 | S1.4-09 Copy reconciliation, FRD-09 | STANDARD·medium | S0.3 | copywriter | done | 21:32 | 21:35 | freeze/copy/ |
| S1 | S1.4-10 Copy reconciliation, FRD-10 | STANDARD·medium | S0.3 | copywriter | done | 21:32 | 21:35 | freeze/copy/ |
| S1 | S1.4-11 Copy reconciliation, FRD-11 | STANDARD·medium | S0.3 | copywriter | done | 21:32 | 21:35 | freeze/copy/ |
| S1 | S1.4-12 Copy reconciliation, FRD-12 | STANDARD·medium | S0.3 | copywriter | done | 21:32 | 21:35 | freeze/copy/ |
| S1 | S1.4-13 Copy reconciliation, FRD-13 | STANDARD·medium | S0.3 | copywriter | done | 21:32 | 21:35 | freeze/copy/ |
| S1 | S1.4-15 Copy reconciliation, FRD-15 | STANDARD·medium | S0.3 | copywriter | done | 21:32 | 21:35 | freeze/copy/ |
| S1 | S1.4-17 Copy reconciliation, FRD-17 | STANDARD·medium | S0.3 | copywriter | done | 21:32 | 21:35 | freeze/copy/ |
| S1 | S1.4-18 Copy reconciliation, FRD-18 | STANDARD·medium | S0.3 | copywriter | done | 21:32 | 21:35 | freeze/copy/ |
| S1 | S1.4-19 Copy reconciliation, FRD-19 | STANDARD·medium | S0.3 | copywriter | done | 21:32 | 21:35 | freeze/copy/ |
| S1 | S1.4-20 Copy reconciliation, FRD-20 | STANDARD·medium | S0.3 | copywriter | done | 21:32 | 21:35 | freeze/copy/ |
| S1 | S1.4-21 Copy reconciliation, FRD-21 | STANDARD·medium | S0.3 | copywriter | done | 21:32 | 21:35 | freeze/copy/ |
| S1 | S1.4-22 Copy reconciliation, FRD-22 | STANDARD·medium | S0.3 | copywriter | done | 21:32 | 21:35 | freeze/copy/ |
| S1 | S1.4-26 Copy reconciliation, FRD-26 | STANDARD·medium | S0.3 | copywriter | done | 21:32 | 21:35 | freeze/copy/ |
| S1 | M1 Owner status 1 + A/B list | — | S1.* | lead | done | 21:40 | 21:52 | freeze/m1-decisions.md |
| S2 | S2.1 Prototype/copy batch + `--only` recapture | STANDARD·medium | M1 | designer | done | 21:55 | 05:40 | escalated to JUDGE (opus). 4 M1 items + safety states drawn (31 new state entries, 9 components, FRD-14 pack); 13 corrections; ~75 copy fixes; flows 77/77, preflight 0 fail, freeze all 159 states / 146 components, identity 8/8. Lead aligned FRD-04 REQ-04-005 command with FRD-14 |
| S2 | S2.2 FRD amendments | STANDARD·medium | M1 | product-manager | done | 21:55 | 22:15 | 21 UI FRDs: 79 Group A ACs, Group B out-of-v2 marks, C-01..C-20 amended (FRD-15/13 keep FRD); open points listed for S3 |
| S2 | S2.3-02 FDD, FRD-02 | STANDARD·medium | M1, S1.2 | designer | done | 05:55 | 06:10 | |
| S2 | S2.3-03 FDD, FRD-03 | STANDARD·medium | M1, S1.2 | designer | done | 05:55 | 06:10 | |
| S2 | S2.3-04 FDD, FRD-04 | STANDARD·medium | M1, S1.2 | designer | done | 05:55 | 06:10 | |
| S2 | S2.3-05 FDD, FRD-05 | STANDARD·medium | M1, S1.2 | designer | done | 05:55 | 06:10 | |
| S2 | S2.3-06 FDD, FRD-06 | STANDARD·medium | M1, S1.2 | designer | done | 05:55 | 06:10 | |
| S2 | S2.3-07 FDD, FRD-07 | STANDARD·medium | M1, S1.2 | designer | done | 05:55 | 06:10 | |
| S2 | S2.3-08 FDD, FRD-08 | STANDARD·medium | M1, S1.2 | designer | done | 05:55 | 06:10 | |
| S2 | S2.3-09 FDD, FRD-09 | STANDARD·medium | M1, S1.2 | designer | done | 05:55 | 06:10 | |
| S2 | S2.3-10 FDD, FRD-10 | STANDARD·medium | M1, S1.2 | designer | done | 05:55 | 06:10 | |
| S2 | S2.3-11 FDD, FRD-11 | STANDARD·medium | M1, S1.2 | designer | done | 05:55 | 06:10 | |
| S2 | S2.3-12 FDD, FRD-12 | STANDARD·medium | M1, S1.2 | designer | done | 05:55 | 06:10 | |
| S2 | S2.3-13 FDD, FRD-13 | STANDARD·medium | M1, S1.2 | designer | done | 05:55 | 06:10 | |
| S2 | S2.3-14 FDD, FRD-14 | STANDARD·medium | M1, S1.2 | designer | done | 05:55 | 06:10 | added: FRD-14 drawn at M1 |
| S2 | S2.3-15 FDD, FRD-15 | STANDARD·medium | M1, S1.2 | designer | done | 05:55 | 06:10 | |
| S2 | S2.3-17 FDD, FRD-17 | STANDARD·medium | M1, S1.2 | designer | done | 05:55 | 06:10 | |
| S2 | S2.3-18 FDD, FRD-18 | STANDARD·medium | M1, S1.2 | designer | done | 05:55 | 06:10 | |
| S2 | S2.3-19 FDD, FRD-19 | STANDARD·medium | M1, S1.2 | designer | done | 05:55 | 06:10 | |
| S2 | S2.3-20 FDD, FRD-20 | STANDARD·medium | M1, S1.2 | designer | done | 05:55 | 06:10 | |
| S2 | S2.3-21 FDD, FRD-21 | STANDARD·medium | M1, S1.2 | designer | done | 05:55 | 06:10 | |
| S2 | S2.3-22 FDD, FRD-22 | STANDARD·medium | M1, S1.2 | designer | done | 05:55 | 06:10 | |
| S2 | S2.3-26 FDD, FRD-26 | STANDARD·medium | M1, S1.2 | designer | done | 05:55 | 06:10 | |
| S2 | S2.4 DESIGN.md, design-decisions.md, components.md | STANDARD·medium | M1, S1.1 | designer | done | 21:55 | 22:08 | deviations D-1..D-8 recorded for S3; data-model layout-worker states resolved by M1 decision 2 (app engine kept, outside the pixel oracle) |
| S2 | S2.5 fidelity-checklist.md, technical-assumptions.md | STANDARD·medium | S1.1, S1.2 | designer | done | 21:55 | 22:00 | missing for the gate: logo SVGs (brand mark is an AI raster, owner question at M2), microcopy.es.json (added as S2.7), oracle-states (S2.6) |
| S2 | S2.6 Fixtures, oracle states, build recipes | STANDARD·medium | S1.2, S2.1 | designer | done | 05:55 | 06:10 | 159 oracle entries, 12 build-side doubles, recipes + fixtures README |
| S2 | S2.7 Keyed microcopy `docs/design/microcopy.es.json` (copywriter's final strings) | STANDARD·medium | S2.1 | copywriter | done | 05:55 | 06:08 | added: the gate's FDD-coverage check reads it |
| S3 | S3 Independent audit (15 min) | JUDGE·high | S2.* | reviewer (fresh, read-only) | done | 06:20 | 06:31 | 18 blockers, 24 backlog lines (freeze/audit.md) |
| S3 | M2 Owner status 2 | — | S3 | lead | done | 06:35 | 06:44 | logo kept as raster exception; theme button drawn (freeze/m1-decisions.md §M2) |
| S4 | S4.A Prototype batch: blockers 1-6 + theme button (M2), recapture | STANDARD·medium | S3 | designer | done | 06:45 | 07:55 | flows 77/77, preflight 0 fail, freeze all ran then up-to-date, identity 8/8, coverage COVERED. Lead then aligned 5 FDD lines (captura wording, theme button in FDD-19) and the ThemeToggle row |
| S4 | S4.B FRD sentence fixes: blockers 7-14 + theme AC | STANDARD·medium | S3 | product-manager | done | 06:45 | 07:20 | 9 FRDs; AC-19-005.5 theme; brand exception noted in FRD-19 |
| S4 | S4.C Contract/fidelity docs: blockers 15-18 + M2 decisions | STANDARD·medium | S3 | designer | done | 06:45 | 07:22 | ThemeToggle row to be checked against S4.A's selector |
| S4 | S4.D Logo export (M2 exception) | MECH·low | M2 | lead | done | 06:45 | 07:18 | prototype/logo/: original PNG bytes + lossless SVG wrapper + README stating the exception |
| S5 | S5.1 Preflight + incremental regression + gate READY | MECH·low | S4.* | lead shell | done | 07:45 | 07:50 | preflight 0 fail / 1 acked warn; freeze all: every stage up-to-date (no regression); gate READY once S5.2/M3 rows close |
| S5 | S5.2 Decision log, close tracker, commit | MECH·low | S5.1 | lead | done | 07:50 | 07:55 | caches and logs gitignored (freeze/.gitignore) |
| S5 | M3 Owner status 3 + advance gate | — | S5.2 | lead | done | 07:55 | 07:55 | no phase change: MC stays in implementation; next is the v2 milestone via /pandacorp:change (owner scope) |

## Notes

- **Context.** This freeze runs for a redesign of a built app: Mission Control stays in `phase: implementation` until the v2 milestone (owner scope: freeze now, then `/pandacorp:change` → new-version). Entry conditions met before the clock, in commits e723b681 and 409a0564: the approved prototype in `docs/design/prototype/`, a privacy-safe fixture (the repo is public), the authored config (a pre-clock task) and self-hosted fonts.
- **preflight-ack literalLengths:** 881 literal px lengths sit outside the token blocks. They are the prototype's component dimensions, captured exactly by `computed-styles.json`; the build implements them through Tailwind tokens. Moving them into prototype tokens adds no fidelity.
- **Owner decisions in force (decision log, 2026-10-21):**
  - targets desktop, tablet and phone;
  - app features the prototype does not draw stay out of v2;
  - artifact names stay in English;
  - the interface is Spanish, and shown content keeps its language;
  - shared component rules (iteration 28).

## Blockers from audit

The blockers come from `docs/design/freeze/audit.md` (S3). Each is fixed by its S4.n row above, and that row carries the status. After 3 failed attempts the row becomes `deferred(owner)` and the owner is told.

| # | Finding | File(s) | S4 row | Attempts |
|---|---|---|---|---|
| 1-6 | Prototype blockers (audit.md) | prototype + config + microcopy | S4.A | 1 |
| 7-14 | FRD sentences | docs/frds/*/frd.md | S4.B | 1 |
| 15-18 | Contract/fidelity docs | DESIGN.md, components.md, design-decisions.md, technical-assumptions.md, fidelity-checklist.md | S4.C | 1 |

## Fidelity backlog

Non-blockers go to `.pandacorp/comms/visual-punch-list.md`, the file the end-of-build Visual QA works. Past the time box, unfinished optional work goes there too. Each item is one line: `- [ ] <frd|global> · <screen/state> · <gap> · <reference file> (design freeze)`. That file is the only home of the items; this section keeps only the record:

- Items written: 24
- Written at: S3
- Reason: audit non-blockers (the time box was exceeded during S2.1; no optional work was skipped beyond those)

## Owner messages

| Milestone | Sent | Answer |
|---|---|---|
| M1 | 21:40 | all recommendations taken (freeze/m1-decisions.md) |
| M2 | 06:35 | keep raster logo; draw a theme button |
| M3 | 07:55 | |
