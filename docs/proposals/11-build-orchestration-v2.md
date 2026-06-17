# Build orchestration v2 — state, plans and tests live in the documents

> Drafted 2026-06-16 from the **Mission Control dogfood**: building MC with the pipeline ran ~8h,
> burned **~944 subagents for ~37 work orders** (~25:1, vs a design target of ~6:1), gave the owner
> **no signal** when it stalled, and crawled at **~5–8 WO/h**. Forensics showed **~76% of the effort
> was re-work, not ceremony**. The owner asked to redesign the build for sustainability, drawing on
> **PandaTrack** — a Pandacorp project that built fast and clean (47 coarse WOs, frontmatter state,
> per-feature plans). This proposal **completes what DR-049 took from PandaTrack** (the feature-centric
> *structure*) with the parts it left behind.
>
> **ADOPTED 2026-06-16 as DR-050.** Canonical standard: `factory/standards/build-orchestration.md`;
> policy DR-050 (`factory/decisions/registry.yaml`); MAJOR plugin **v8.0.0** (doc templates + skills
> `spec`/`blueprint`/`work-orders`/`iterate`/`new-version` + the `pandacorp-build.js` engine rewritten
> to the per-FRD loop). This document is kept as the rationale/design record. **Pending:** Mission
> Control migration (part 2) + a pass over the `implement` skill body + the Manual (DR-046).

## Problem (forensics from the MC build)

| Symptom | Root cause |
|---|---|
| 944 agents for 37 WOs; ~76% re-work | **State doesn't live in the data.** The "done" marker was prose in the body (`## Status:`) or implied by commits. Only 6 of 37 built WOs were actually marked done → every relaunch reconstructed ~31 finished WOs. |
| ~5–8 WO/h, very slow | **Review + full verify run *per work order*** (O(WOs)×suite). **Atomic WOs** (114, ~40 lines each) multiply the per-WO overhead. The Plan **re-infers** the whole dependency graph every relaunch (one architect reading 114 files). |
| Owner blind to stalls/decisions | No native notification; state only in files nobody reads without Mission Control (which doesn't exist yet). |
| Hard to integrate WOs | No hand-off; the next agent must re-read all prior code to find the seams. |

## The model — orchestration driven by the documents

The unifying principle: **state and plans live in structured data (frontmatter + blueprint), not in
the engine's runtime inference or in git.** Recovered and adapted from PandaTrack.

### 1. State in the frontmatter (two axes, on FRD · blueprint · work order)

- **`status`** — document lifecycle: `DRAFT → ACTIVE → BLOCKED → SUPERSEDED`. (PRD carries only this.)
- **`implementation_status`** — the build Kanban the engine reads:

| Owner's word | Value | Meaning for the engine |
|---|---|---|
| Abierto | `PLANNED` | available to build |
| En progreso | `IN_PROGRESS` | started; if interrupted, **continue**, don't restart |
| En revisión | `IN_REVIEW` | built + its own tests green; awaiting the FRD's review/test pass |
| Terminado | `VERIFIED` | FRD review + suite green; **closed, full certainty** |
| (lateral) | `BLOCKED` | stuck; needs an owner decision/intervention |

`IN_REVIEW` (not `IMPLEMENTED`) because it names *where the WO is in the pipeline*, which is what
tells you what to do with it. A WO/FRD's status is the single source of truth; Mission Control
**replicates the per-status counts in `.pandacorp/status.yaml`** for an at-a-glance read.

### 2. The build plan lives in the blueprint (per FRD)

Each FRD's blueprint gains a **Build Plan**: the DAG of its work orders — what depends on what, what
runs in parallel, and the integration order. Written **once**, at architecture time, by the architect.

The engine **reads** this plan; it does **not** re-infer it at runtime. This kills the expensive,
repeated "Plan" agent and makes parallelism and integration **explicit and correct** (WO-2 never
starts before its dependency WO-1).

### 3. Coarse work orders (one WO = one view/capability)

Granularity rule from PandaTrack: a work order is **a whole view, page or capability** (e.g. "order
detail view + payments panel + action menu" is ONE WO), not an atomic component. ~3× fewer WOs, each
with enough context for an agent to work end-to-end without thrashing. (PandaTrack: 47 WOs for a
real product; MC today: 114 for an internal tool.)

### 4. Hand-off (`## Status Note`) per work order

When a WO closes it writes a hand-off: **what it built, what interfaces/contracts it exposes, and the
integration seams**. The next agent reads the hand-off instead of re-reading all the code — cheaper
and more reliable integration.

### 5. Test per FRD, not per work order

The biggest single speed lever. Review/test cost drops from **O(WOs) to O(FRDs)** (~114 → ~18):

- Building a WO runs only **its own fast self-test** (the WO's tests + tsc) → marks it `IN_REVIEW`.
- When **all WOs of an FRD are `IN_REVIEW`**, run **one review + test pass over the whole FRD** — which
  also tests the WOs *together* (real integration, not isolated). On pass → every WO + the FRD → `VERIFIED`.
- **Three test layers, applied at the FRD gate:**
  1. **Unit/component** (vitest + jsdom) — already run per-WO during build.
  2. **Integration + adversarial** (the reviewer, across the whole feature) — at the FRD gate.
  3. **Functional/browser** (Claude Code preview tools / Claude-in-Chrome: start the app, navigate,
     click, snapshot the FRD's real flows) — **designed in, activable per project**; the closest thing
     to a human QA. Optional at first (owner's call), but the gate is built to host it.

Today's testing is shallow (unit + jsdom components, no real browser, no e2e). This layer is how a
feature stops passing "green" while being broken in the running app.

### 6. Iterate / new-version reopen work orders

When `iterate`/`new-version` add or change something:
- **Falls inside an existing WO** (e.g. add pagination+filters to a `VERIFIED` "product list" WO) →
  **reopen it** (`implementation_status: VERIFIED → PLANNED`), widen its scope + hand-off.
- **Is genuinely new** → **create a new WO** (`PLANNED`).
- The engine naturally picks up only `PLANNED`/`IN_PROGRESS` WOs, so **iterate doesn't have to "tell"
  the engine anything — changing the frontmatter state is the instruction.** (Elegance of state-in-data.)

## The engine, reworked

```
for each FRD in cross-FRD dependency order (from the blueprints):
  if all its WOs are VERIFIED: skip            # no re-work, read from frontmatter
  read the FRD blueprint's Build Plan          # deps + parallelism, not inferred
  for each wave in the Build Plan:
    build the wave's PLANNED/IN_PROGRESS WOs in parallel
      each: implement → fast self-test (WO tests + tsc) → IN_REVIEW + write hand-off
  FRD gate: one review + integration test (+ optional functional/browser) over the whole FRD
    pass → mark every WO + the FRD VERIFIED, update status.yaml counts, commit
    fail → reopen the offending WO(s) to IN_PROGRESS; if unrecoverable → BLOCKED + notify owner
```

No global Plan agent, no per-WO review, no re-work, integration explicit. Notifications (v7.3.0)
stay: freeze / unrepairable / end-of-run.

## Templates (the standard, recovered from PandaTrack)

Standardized templates in the plugin for **PRD · FRD · blueprint · work order · ADR**, each with the
frontmatter (`id, type, slug, title, status, parent, source_features, implementation_status,
last_updated`) and the canonical sections (WO: Summary · In/Out of Scope · Requirements · Blueprint
refs · Acceptance tests · **Status Note**). This is what makes everything above uniform and
machine-readable.

## Expected impact

- **Re-work → ~0** (state read from frontmatter; `VERIFIED` never rebuilt).
- **Review cost ÷ ~6** (per-FRD, not per-WO).
- **~3× fewer, coarser WOs** → less repeated overhead.
- **Better integration** (explicit build plan + hand-offs).
- Net: target **~4–6× throughput** and a sustainable agent budget, without lowering quality.

## Migration

- **Factory (the standard):** add the templates + frontmatter state to `factory/standards/`; teach
  `spec`/`blueprint`/`work-orders` to emit coarse WOs + the per-FRD Build Plan + frontmatter; teach
  `iterate`/`new-version` to reopen WOs; rewrite the build engine for the per-FRD loop. New DR +
  decision-log + registry.
- **Mission Control:** add frontmatter to the existing WOs; mark the 37 built ones `VERIFIED`;
  **re-group the ~77 remaining atomic WOs into coarse WOs** + write each FRD's Build Plan; relaunch.

## Open questions

- Exact `implementation_status` for an FRD that is partially built (rollup rule from its WOs).
- Whether the functional/browser layer is on by default for `web` projects or opt-in.
- WO sizing guidance: a target line/scope band so "coarse" doesn't become "too big to review".
