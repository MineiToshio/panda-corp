# Planning pipeline (architecture steps 2 to 9c)

The order below is the one that minimizes rework on a multi-FRD project. It formalizes what worked in funko-tracker
(8 FRDs, 42 work orders, 102 ACs) and removes what was improvised there. Each stage names who does it and its
PORT-2 tier (CONV-12: MECH / STANDARD / JUDGE; on Claude haiku / sonnet / opus, named agents keep their pinned
model).

| # | Stage | Who (tier) | Output | Lead's mechanical check after it |
|---|---|---|---|---|
| 1 | Platform | `architect` (JUDGE) | `docs/product/architecture.md`, `docs/product/data-model.json`, ADRs from the locked decisions, `docs/analytics/events.md` (`analytics`), deploy section (`devops`) | JSON parse of `data-model.json`, `bash .pandacorp/doc-lint.sh` |
| 2 | Cross-FRD work-order map | ONE `architect` (JUDGE) | `.pandacorp/run/architecture/wo-map.md` from `wo-map-template.md` | `waves.mjs`-style sanity by reading the map's wave table; AC count per FRD equals the FRDs' |
| 3 | Blueprints + work orders | parallel `architect` authors, one per FRD group (JUDGE for the platform/foundation FRD and any `high` FRD, STANDARD otherwise) | `blueprint.md` (+ `blueprints/`), `work-orders/README.md`, `wo-*.md` per FRD | none yet: authors are still writing |
| 4 | Cross-FRD requests | each author appends to ONE ledger | `.pandacorp/run/architecture/cross-issues.md` | ledger is complete (every author reported) |
| 5 | Reconciliation | ONE reconciler (`architect`, JUDGE) | every ledger item applied across all FRDs, or escalated | `waves.mjs`, `ac-matrix.mjs`, `plan-consistency.mjs`, `check-fdd-coverage.mjs --plan`, doc-lint, `verify.sh --only=residual-ambiguity` |
| 6 | Three gates, in parallel | three fresh JUDGE agents | `docs/reviews/architecture-{readiness,grounding,consistency}-gate.md` | see `gates.md` |
| 7 | ONE fix pass | the authors/reconciler, per blocker | fixed docs | re-run every mechanical check |
| 8 | Re-verification | the LEAD (deterministic) | a "Resolution addendum" in each FAIL report | `flip-active.mjs --dry-run` green |
| 9 | Stamp + flip | the LEAD | ACTIVE blueprints + WOs, stamped | `flip-active.mjs` |

Then the digest (9c) and landing (step 10).

## Stage 1: platform first, from locked decisions

The platform architect writes against the decision round's ADRs; it never re-decides them. It fixes everything the
blueprint authors would otherwise each re-invent: the route map, the module map, the data-layer calling
convention, the derivation rules (one writer per fact, DR-115), caching and revalidation, auth helpers,
analytics/observability helpers, the env var table (complete; `.env.example` mirrors it), and the cross-cutting seams
other units need (a copy loader and analytics emitter usable outside the framework when a worker/CLI exists). Seams
discovered later go through the ledger, which is why the more of them stage 1 names, the shorter stage 5 is.

## Stage 2: ONE cross-FRD work-order map

A single planner reads every FRD/FDD, the platform docs, the installed scaffold and the versions record, and writes
the map (`wo-map-template.md`). The map is FINAL for: WO ids and titles, AC ownership (every live AC in exactly one
WO), `artifacts`, `dependsOn`, `foundation`, `difficulty`, waves, the single owner of every shared file per wave, the
exact `pnpm add --save-exact` commands per WO (from the resolver table), and a "binding resolutions" section that
settles every inconsistency the planner found. Parallel authors without a map each decide coupling locally, and the
seams do not meet. Tell the owner "plan ready" at this point (milestone 2), with the WO count and the waves.

## Stage 3: parallel authors, one brief

Spawn one author per FRD group (balance by AC count; a FRD with more than ~15 ACs or a platform role gets its own
author) with `blueprint-author-brief.md` filled in (paths, the map, the versions record, the FRD list). Authors
write ONLY inside their FRD folders; they never edit FRDs, FDDs, mocks, architecture.md, ADRs or the decision log.
Disjoint files → no merge conflicts. Authors do not commit; the lead commits per stage.

## Stage 4: one ledger for cross-FRD requests

When an author needs something another FRD must provide (a seam, a builder, an export, a seed row, an extra
artifact, a dependency edge) or finds an FRD/architecture problem, it appends ONE line to the ledger under its own
heading: `- NEEDS <WO-id or doc>: <what>, because <AC/REQ>` or `- PROBLEM <doc>: <what>`. It also lists every
deviation from the map it made in its own files. It never edits another author's files.

## Stage 5: one reconciler

After every author reported, ONE reconciler applies the whole ledger across all FRDs in a single pass: adds the
artifacts/edges/seams, moves a conflicting shared file to its single owner, amends architecture.md for platform
facts (with an ADR when a platform decision changes), and escalates to the owner only a product-scope question.
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
  ("continúa donde quedaste"), never restarted fresh: a fresh agent re-reads everything and may redo finished
  files. Record which agents were running before the cut so each is resumed.
- Subagents get the brief and the files they own, not the conversation; the lead keeps the map, the ledger and the
  check outputs.

## Owner pacing (Pareto)

- At the start: the plan in five lines and a rough duration (decision round ~30 min of owner time spread over the
  round; platform ~1 h; map ~1 h; authors ~1 to 2 h in parallel; reconcile + gates + fix ~2 h for a 40-WO plan;
  install ~1 h). Then milestone messages only: (1) decision round, (2) plan ready, (3) gates passed, (4) merged with
  the digest.
- Before any step expected to take more than 30 minutes that the owner did not already see in the plan (a design
  mini-round, a spike, a second gate run), state the estimate and the cheaper alternative, and let the owner pick.
- Budget the gate loop up front (BL-0245): "three gates in parallel, one fix pass, deterministic re-check; a second
  round only if a fix changes scope". Say why when a second round is needed.
- Owner visual reviews are welcome but never block the phase.
