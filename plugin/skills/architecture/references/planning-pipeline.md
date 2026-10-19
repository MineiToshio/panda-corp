# Planning pipeline (architecture steps 2 to 9c)

The order below is the one that minimizes rework on a multi-FRD project. It formalizes what worked in funko-tracker
(8 FRDs, 42 work orders, 102 ACs) and removes what was improvised there. This file says WHAT each stage produces;
**`dispatch.md` says how it is executed**: the `TIER·effort` of every agent (resolved from
`runtime/model-tiers.json`, never a model name), the parallel groups G1 to G5, the inputs (context packs, not the doc
set), the owned outputs, the budgets and the stop rule.

| # | Stage | Who (group) | Output | Lead's mechanical check after it |
|---|---|---|---|---|
| 1 | Platform | `architect` ∥ installer ∥ `analytics` ∥ `devops` (G1) | `docs/product/architecture.md`, `docs/product/data-model.json`, ADRs from the locked decisions, `docs/analytics/events.md` (event catalog only if approved now; otherwise lead-written scope/N/A record), the deploy ADR, the installed scaffold | JSON parse of `data-model.json`, `bash .pandacorp/doc-lint.sh`, `resolve-versions.mjs`, `build-packs.mjs` (P1) |
| 2 | Cross-FRD work-order map | ONE `architect` (G2) | `.pandacorp/run/architecture/wo-map.md` from `wo-map-template.md` | AC count per FRD equals the packs'; `build-packs.mjs` (P2) |
| 3 | Blueprints + work orders | parallel `architect` authors, one per FRD (G3, tier by FRD size and novelty) | `blueprint.md` (+ `blueprints/`), `work-orders/README.md`, `wo-*.md` per FRD | none yet: authors are still writing |
| 4 | Cross-FRD requests | each author writes ITS ledger file | `.pandacorp/run/architecture/cross-issues/frd-NN.md` | every author reported; `cat cross-issues/*.md > cross-issues.md` |
| 5 | Reconciliation | ONE reconciler (G4) | every ledger item applied across all FRDs, or escalated | `waves.mjs`, `ac-matrix.mjs`, `plan-consistency.mjs`, `check-fdd-coverage.mjs --plan`, doc-lint, `verify.sh --only=residual-ambiguity` |
| 6 | Three gates, in parallel | readiness (scripts + one fresh checker) ∥ grounding ∥ consistency ∥ the digest (G5) | `docs/reviews/architecture-{readiness,grounding,consistency}-gate.md` | see `gates.md` |
| 7 | ONE fix pass | the authors/reconciler, resumed, per blocker | fixed docs | re-run every mechanical check |
| 8 | Re-verification | the LEAD (deterministic) | a "Resolution addendum" in each FAIL report | `flip-active.mjs --dry-run` green |
| 9 | Stamp + flip | the LEAD | ACTIVE blueprints + WOs, stamped | `flip-active.mjs` |

Then the digest (9c) and landing (step 10).

## Stage 1: platform first, from locked decisions

The platform architect writes against the decision round's ADRs; it never re-decides them. It fixes everything the
blueprint authors would otherwise each re-invent: the route map, the module map, the data-layer calling
convention, the derivation rules (one writer per fact, DR-115), caching and revalidation, auth helpers,
analytics/observability helpers only for providers explicitly approved for now (DR-131), the env var table (complete; `.env.example` mirrors it), and the cross-cutting seams
other units need (a copy loader and, only for approved analytics, an analytics emitter usable outside the framework when a worker/CLI exists). Seams
discovered later go through the ledger, which is why the more of them stage 1 names, the shorter stage 5 is.

## Context packs (between stages 1 and 2, and again after 2)

`scripts/build-packs.mjs` (the lead's shell, seconds) turns the doc set into one pack per FRD and a `_global.md`
(`dispatch.md` §2). The map planner, the authors, the reconciler and the gates read their packs plus the files they
own, plus the `frd.md` files they plan or judge in full; nobody after the decision round reads the whole doc set. Re-run it after any upstream write (an FRD amendment,
an architecture.md fix, the map).

## Stage 2: ONE cross-FRD work-order map

A single planner reads the packs (every FRD's ACs, routes, entities, oracle states and copy keys), every `frd.md`
in full (scope, business rules, edge cases and contracts are not in the packs), the architecture.md sections it
needs by line, the installed scaffold and the versions record, and writes
the map (`wo-map-template.md`). The map is FINAL for: WO ids and titles, AC ownership (every live AC in exactly one
WO), `artifacts`, `dependsOn`, `foundation`, `difficulty`, waves, the single owner of every shared file per wave, the
exact `pnpm add --save-exact` commands per WO (from the resolver table), and a "binding resolutions" section that
settles every inconsistency the planner found. Parallel authors without a map each decide coupling locally, and the
seams do not meet. Tell the owner "plan ready" at this point (milestone 2), with the WO count and the waves.

## Stage 3: parallel authors, one brief

Spawn every author in ONE dispatch message: one author per FRD (two FRDs of ≤ 4 ACs may share one), tiered by
`dispatch.md` G3, with `blueprint-author-brief.md` filled in (paths, its pack, the map, the versions record).
Authors write ONLY inside their FRD folders and their own ledger file; they never edit FRDs, FDDs, mocks,
architecture.md, ADRs or the decision log. Disjoint files → no merge conflicts. Authors do not commit; the lead
commits per stage.

## Stage 4: one ledger for cross-FRD requests

When an author needs something another FRD must provide (a seam, a builder, an export, a seed row, an extra
artifact, a dependency edge) or finds an FRD/architecture problem, it writes ONE line to its own ledger file
(`cross-issues/frd-NN.md`, so parallel authors never write the same file; the lead concatenates them): `- NEEDS <WO-id or doc>: <what>, because <AC/REQ>` or `- PROBLEM <doc>: <what>`. It also lists every
deviation from the map it made in its own files. It never edits another author's files.

## Stage 5: one reconciler

After every author reported, ONE reconciler applies the whole ledger across all FRDs in a single pass: adds the
artifacts/edges/seams, moves a conflicting shared file to its single owner, amends architecture.md for platform
facts (a platform DECISION change goes back to the G1 architect, resumed with `SendMessage`, with an ADR), and
escalates to the owner only a product-scope question.
Then the lead runs the mechanical checks and commits ("docs(architecture): reconcile cross-FRD plan").

## Stage 6 to 9

`gates.md`. Rules that keep it short: three gates only (no extra audits, no owner visual review blocking the
phase), one fix pass, deterministic re-verification by the lead, then the flip. A second full gate run happens only
when a fix changed scope (an FRD, the data model, or the WO set); otherwise the addendum is the evidence.

## Agent reality (who can run what)

- `architect`, `product-manager`, `copywriter` and `researcher` have **no Bash**: they cannot run node, JSON parse,
  doc-lint, the plan scripts or `git rm`. The LEAD runs every mechanical check and hands the output to the agent
  that must act on it. Do not ask a Bash-less agent to "verify with the script".
- **Tombstones.** A Bash-less agent that must delete a file replaces its content with one line
  `# OBSOLETE: <path> (reason)` and lists it in its report; the lead runs `git rm` on every tombstone before the
  next check (`grep -rl '^# OBSOLETE:' docs/`), so no tombstone ever reaches a gate.
- **Rate limits / usage cuts.** An agent cut by an API limit is resumed with `SendMessage` to the same agent id
  from the dispatch log ("continúa donde quedaste"), never restarted fresh: a fresh agent re-reads everything and
  may redo finished files (`dispatch.md` §4).
- Subagents get the brief, their pack and the files they own, not the conversation and not the doc set; the lead
  keeps the map, the ledger, the dispatch log and the check outputs, and reads reports, never the docs.

## Owner pacing (Pareto)

- At the start: the plan in five lines, the wall-clock and token budget from `dispatch.md` §3 scaled to this
  project. Then milestone messages only: (1) decision round, (2) plan ready, (3) gates passed, (4) merged with the
  digest.
- Before any step expected to take more than 30 minutes that the owner did not already see in the plan (a design
  mini-round, a spike, a second gate run), state the estimate and the cheaper alternative, and let the owner pick.
  A stage past 2× its budget stops the same way (`dispatch.md` §4).
- Budget the gate loop up front (BL-0245): "three gates in parallel, one fix pass, deterministic re-check; a second
  round only if a fix changes scope". Say why when a second round is needed.
- Owner visual reviews are welcome but never block the phase.
