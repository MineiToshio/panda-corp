---
time_box: 2h
started_at: <YYYY-MM-DDTHH:MM±hh:mm>
finished_at:
elapsed: 0m
owner_wait: 0m
outcome: in-progress
preflight-ack:
---

# Design freeze tracker — <Product>

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
| S0 | S0.1 Preflight the approved prototype | MECH·low | — | lead shell | planned | | | |
| S0 | S0.2 Open this tracker | MECH·low | — | lead | planned | | | |
| S0 | S0.3 Context packs + config screens/states | STANDARD·medium | S0.2 | designer | planned | | | |
| S1 | S1.1 `freeze.mjs split` (CSS split, tokens) | MECH·low | S0.1 | lead shell | planned | | | |
| S1 | S1.2 `freeze.mjs all` (background capture) | MECH·low | S1.1, S0.3 | lead shell | planned | | | |
| S1 | S1.3 Functional reconciliation (DR-064) | JUDGE·high | S0.3 | designer | planned | | | |
| S1 | S1.4-NN Copy reconciliation, FRD-NN *(one row per UI FRD)* | STANDARD·medium | S0.3 | copywriter | planned | | | |
| S1 | M1 Owner status 1 + A/B list | — | S1.* | lead | planned | | | |
| S2 | S2.1 Prototype/copy batch + `--only` recapture | STANDARD·medium | M1 | designer | planned | | | |
| S2 | S2.2 FRD amendments | STANDARD·medium | M1 | product-manager | planned | | | |
| S2 | S2.3-NN FDD, FRD-NN *(one row per UI FRD)* | STANDARD·medium | M1, S1.2 | designer | planned | | | |
| S2 | S2.4 DESIGN.md, design-decisions.md, components.md | STANDARD·medium | M1, S1.1 | designer | planned | | | |
| S2 | S2.5 fidelity-checklist.md, technical-assumptions.md | STANDARD·medium | S1.1, S1.2 | designer | planned | | | |
| S2 | S2.6 Fixtures, oracle states, build recipes | STANDARD·medium | S1.2, S2.1 | designer | planned | | | |
| S3 | S3 Independent audit (15 min) | JUDGE·high | S2.* | reviewer (fresh, read-only) | planned | | | |
| S3 | M2 Owner status 2 | — | S3 | lead | planned | | | |
| S4 | S4.n Fix blocker n *(one row per blocker; none → delete the row)* | owner task's tier | S3 | owner task's agent | planned | | | |
| S5 | S5.1 Preflight + incremental regression + gate READY | MECH·low | S4.* | lead shell | planned | | | |
| S5 | S5.2 Decision log, close tracker, commit | MECH·low | S5.1 | lead | planned | | | |
| S5 | M3 Owner status 3 + advance gate | — | S5.2 | lead | planned | | | |

## Blockers from audit

The blockers come from `docs/design/freeze/audit.md` (S3). Each is fixed by its S4.n row above, and that row carries the status. After 3 failed attempts the row becomes `deferred(owner)` and the owner is told.

| # | Finding | File(s) | S4 row | Attempts |
|---|---|---|---|---|
| 1 | | | S4.1 | 0 |

## Fidelity backlog

Non-blockers go to `.pandacorp/comms/visual-punch-list.md`, the file the end-of-build Visual QA works. Past the time box, unfinished optional work goes there too. Each item is one line: `- [ ] <frd|global> · <screen/state> · <gap> · <reference file> (design freeze)`. That file is the only home of the items; this section keeps only the record:

- Items written: 0
- Written at: <stage>
- Reason: <audit non-blockers | time box reached at HH:MM>

## Owner messages

| Milestone | Sent | Answer |
|---|---|---|
| M1 | | |
| M2 | | |
| M3 | | |
