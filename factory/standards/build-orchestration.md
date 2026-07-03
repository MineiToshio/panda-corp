# Build orchestration standard (DR-050)

> Domain: Quality/Process · Severity: **MUST** · Enforcement: the build engine itself (state machine, FRD gates, heartbeat locks) + `verify.sh` — **factory-internal (process): not injected** as a rule file; projects meet it through the engine and the `.pandacorp/` overlay.

How the factory plans, tracks and runs a build. The orchestration is **driven by the documents** —
state and plans live in structured data the build engine reads, not in the engine's runtime
inference, not in git, not in body prose. Recovered and systematized from PandaTrack; see
`docs/proposals/11-build-orchestration-v2.md`.

## 1. State lives in the frontmatter (two axes)

Every FRD, blueprint and work order carries two state fields in its YAML frontmatter. The PRD carries
only `status`.

- **`status`** — document lifecycle: `DRAFT → ACTIVE → BLOCKED → SUPERSEDED`. Answers "is this doc the
  current approved source of truth?" A shipped feature can still be `ACTIVE`.
- **`implementation_status`** — the build Kanban, and **the build engine's single source of truth**:

| Value | Meaning | Engine behavior |
|---|---|---|
| `PLANNED` | not built yet | available to build |
| `IN_PROGRESS` | build started | resume it, don't restart |
| `IN_REVIEW` | built, its own tests green, awaiting the FRD review/test gate | not rebuilt; waiting on its FRD |
| `VERIFIED` | FRD review + suite green | **never rebuilt** |
| `BLOCKED` | stuck after a repair pass failed; carries a `blocked_reason` | skipped; surfaced to the owner with the reason |

**Rules:** the engine builds only `PLANNED`/`IN_PROGRESS` and never rebuilds `VERIFIED`. Never
hand-set `VERIFIED` without the FRD gate passing. Changing this field **is** the instruction to the
build — `iterate`/`new-version` reopen a work order by setting it back to `PLANNED`.

**Source of truth — the work order, always (DR-050).** The **work order** is the atomic source of
truth: its `implementation_status` is canonical. An FRD's (and blueprint's) `implementation_status`
is a **DERIVED rollup** of its work orders, never an independent state — `VERIFIED` iff **all** are
`VERIFIED`; else `BLOCKED` if any is `BLOCKED`; else `PLANNED` if any is `PLANNED`; else `IN_PROGRESS`
if any is; else `IN_REVIEW`. **On any discrepancy between an FRD and its work orders, the work orders
win** — the FRD field is a *cache* of the rollup, trustworthy on its own only when it reads `VERIFIED`
(only the gate writes that). "**Done**" means `VERIFIED`: a work order is done when `VERIFIED`, an FRD
when **all** its work orders are, the project when all FRDs are — never read "done" off an FRD field
that hasn't been re-derived. The engine keeps the cache honest: it **re-derives and persists** every
FRD/blueprint rollup when it **plans** (correcting drift left by an interrupted run, a crash mid-build
or a manual edit) and again **after each gate**, so the document never lies about progress. Readers
that need exactness (e.g. Mission Control's board) **derive from the work orders**, not from a possibly
stale FRD field — and prefer showing the breakdown (e.g. "7/11 verified") over a single rolled-up word.
`.pandacorp/status.yaml` replicates the per-status counts for Mission Control.

## 2. Coarse work orders

A work order is **one cohesive view / page / capability** (e.g. "order detail view + payments panel +
action menu"), NOT one atomic component. Enough context for an agent to build the slice end-to-end;
small enough to review on its own. Typically a handful per FRD — not dozens of tiny ones. Atomic
work orders multiply the per-slice overhead and were a primary cause of slow, expensive builds.

**Coarse, with a CALIBRATED ceiling AND floor (DR-100, empirically calibrated 2026-07-01).** The
sweet spot, measured on two real builds (personal-page-v2 + Mission Control):
- **Target: ~25–50 min of build / ~1.5–4k LOC of artifacts per WO.** In that band, ppv2 WOs passed
  their gate first-try or needed one ≤6-min fix; none exceeded 1 reopen.
- **Ceiling — split above ~4k LOC / ~45 min; hard evidence:** Mission Control WOs above 6k LOC
  averaged **3.0 gate rejects** vs 0.8 below 3k; the worst ("the whole Configuración surface in one
  WO", ~7k LOC) took **5 gate attempts and 20h wall-clock**, each gate uncovering the next layer. A
  whole settings/manual surface is NOT one WO. The qualitative triggers still apply: too big to
  review in one sitting, past the model's reliable context zone ("context rot"), or mixing more than
  one concern (one concern per WO).
- **Floor — the gate has a FIXED cost (~9 min, range 4–13, project-independent), so tiny slices pay
  disproportionate overhead:** ppv2's FRD-08 paid 12 min of gate for a 9.5-min build (**127%
  overhead**) vs 18% for a 47-min WO. **Do not emit an FRD whose only work order builds in under
  ~20 min** — the PM merges it into the feature it extends (at spec time) or the architect folds it
  into a sibling WO (at plan time). A 1-AC cosmetic change is a change-queue item or a WO inside an
  existing FRD, never its own feature.
The factory's coarse policy stands — this pins BOTH bounds with numbers instead of adjectives. (With
the global-wave scheduler (BL-0021) small FRDs no longer cost parallelism; the floor exists purely for
gate economics.)

**Global waves — the wave crosses FRD boundaries (BL-0021, 2026-07-01).** The engine schedules each
wave from the READY work orders of **ALL FRDs**, not one feature at a time: a WO is ready when its
`dependsOn` are satisfied (dep committed → `IN_REVIEW`/`VERIFIED`) and its artifacts are disjoint from
the rest of the wave; the wave is capped at the mode's size. The old strictly-sequential per-FRD loop
made the mode's parallelism theoretical for right-sized (small) FRDs — the personal-page-v2 run built
six INDEPENDENT 1-WO features single-file for ~4.5h in `powerful` (wave 8). The per-FRD **gates queue
and run SERIALIZED at wave boundaries** (waves are synchronous barriers), so a gate's whole-project
checks always see a **quiet tree** — the trust boundary is unchanged; only the scheduling unit moved
from "feature" to "ready set".

**Disjoint artifacts within a wave — declared and ENGINE-ENFORCED (DR-060).** Work orders that build
in parallel must NOT write the same file/module — parallel implementers collide (a real failure mode,
not theoretical: e.g. four WOs all creating one `lib/x.ts`). Each work order therefore **declares an
`artifacts: [globs]` frontmatter field** — the files/dirs it writes. The **engine enforces
disjointness from that field**: when it builds a wave it computes the artifact sets **across every FRD
in the wave** (BL-0021 — cross-FRD overlaps serialize too) and **serializes any WOs whose `artifacts`
overlap into different waves** (the overlapping WO waits a wave instead of racing). The Build Plan
should still be **disjoint by design** — the architect designs wave-parallel WOs with non-overlapping
artifacts, and prefers merging genuinely-coupled siblings into one coarse WO — but the engine is the
backstop: an overlap left in the plan is serialized, never raced. This rule also nudges granularity
coarser, the right way.

**Declared dependencies — `dependsOn` is the machine-readable source (DR-087).** Each work order
declares a **`dependsOn: [WO-NN-MMM]`** frontmatter field: the **real upstream work orders** it
depends on (a WO can depend on several, across FRDs; `[]` when none). This is the canonical,
machine-readable mirror of the Build Plan DAG and the work-orders README "Depends on" column — keep
the three in sync. It is **honest data, never a fabricated chain**: a WO with no real predecessor
declares `[]` (it is a root), not "the previous WO by number". **Mission Control's dependency graph
reads `dependsOn` verbatim** (it draws an independent node for `[]`, real cross-FRD edges otherwise);
fabricating a sequential chain to make the graph "look connected" is the defect this closes. (Wave
serialization itself stays artifact-driven, DR-060; `dependsOn` is the dependency *truth* for
traceability and visualization, and may inform ordering.)

**What counts as a dependency — capture the architectural couplings, not just the build order (DR-087a).**
`A depends on B` (`A.dependsOn` includes B) whenever A, to work, needs B to already exist because A:
*reads/consumes/imports* B's output, *renders based on / is driven by* B's data or engine, *is built on*
B's shared primitives, *extends / is conceptually part of* B, or *consumes* B's contract/data shape.
This is broader than "what builds before what". In practice a **UI-surface** work order almost always
depends on (1) its own lib/logic WOs, (2) the **design-system foundation** WOs it uses (the shared
primitives — titles/nav, banners/surfaces, RPG/state components), (3) the **data-reader** WOs whose
output it renders, and (4) any **other feature** whose data or engine it renders (e.g. a live view ←
the build-mode catalog; an achievements/gamification surface ← the event/metrics readers; a dashboard ←
the readers + feature surfaces it aggregates). A lib/reader WO usually depends on little. Under-capturing
deps (listing only sequential build order) yields a sparse, misleading dependency graph — declare the
real couplings. Don't over-connect either: only evidence-based deps (what the WO actually imports/reads).

**Per-WO API contract (DR-060).** Each backend work order writes its own contract at
`docs/api/<wo-id>.md` (e.g. `docs/api/WO-03-002.md`), NOT a single shared `docs/api.md`. The old
shared file was itself an overlapping artifact: N parallel agents racing one file caused lost-update /
torn-read. The per-WO file is in the WO's own `artifacts`, so it's disjoint by construction; the
frontend WO that consumes a contract reads the **specific** provider WO's file (it knows the id from
its `Dependencies`).

**Single-writer commit — Option B, NOT worktrees (DR-060); finer save points (DR-086).** The build
workers run in parallel on ONE shared working tree but **never call git**; the engine commits **each
work order the INSTANT its self-test greens** through **one serialized writer** (each WO staged by its
own disjoint files, one commit each) — **NOT batched at wave end**. Committing as-you-green is what
makes the rework on an interruption minimal: a kill/cut/crash keeps every WO already committed
(committed → `IN_REVIEW` → skipped on resume, never rebuilt) and only the **still-building**
(uncommitted) WOs are redone — a mid-wave cut used to discard the WHOLE wave (up to `wave` WOs). The
**serialization** (one git writer at a time, via a promise chain) kills the `git index.lock` race even
while sibling WOs of the same wave are still building, and the **selective `git add` of the WO's own
disjoint `artifacts`** can never capture a sibling's in-flight files — so there is still **no merge**
and no per-agent worktree. `last_green_sha` is still advanced only by the **FRD gate** (the
review-verified anchor for `safe_to_test` / the review worktree / baseline-skip); the per-WO commits
are finer *resume* points via the frontmatter, not new *verified* points.

**Durable build timeline — `.pandacorp/track.jsonl` (DR-086 → FRD-12).** At the same points it already
touches, the engine appends a per-project timing log: `wo_start` (when a work order begins building),
`wo_end` (at its commit, with state), and `review_start`/`review_end`/`frd_end` (at the FRD gate).
It is **committed machine-state** (like `status.yaml`; staged by the WO commit + the gate), so it is a
**durable** record — unlike the global `~/.claude/dashboard-events.ndjson`, which rotates and feeds the
live Party view. This track is the source Mission Control's **Observabilidad → Línea de tiempo** reads
(FRD-12): FRD ▸ work order ▸ review, real wall-clock durations, "keep the last attempt" per WO. Worktree-per-agent
was considered and rejected for this shape: the work is already partitioned into disjoint files, so the
isolation a worktree buys is already achieved by construction; Claude Code's own *agent-teams* guidance
is "partition the work so each teammate owns a different set of files" (worktrees are for independent,
human-run sessions, not a coordinated engine); and for Next.js+pnpm a worktree forces a per-tree
`node_modules` install + a cold `next build`, while a shared/symlinked `node_modules` breaks Next's
HMR. A worktree flow also ends in a merge, and a textual merge can pass while the code fails to compile
(CoAgent). "Keep writes single-threaded" (Cognition) is honored natively by the single-writer commit.

## 3. The Build Plan lives in the blueprint (per FRD)

Each per-FRD `blueprint.md` MUST include a **Build Plan**: the DAG of that FRD's work orders — order,
dependencies (intra- and cross-FRD), what runs in parallel, and the integration order. Written once,
at architecture time. **The engine reads it; it does not re-infer dependencies at runtime.** This is
what makes the build fast (no repeated planning agent) and the integration correct (a consumer is
never built before its provider).

**Foundation-first & the component inventory (DR-057).** Parallel feature agents can't see each
other's work, so given the same need they reinvent slightly-different versions of the same component
(the two-near-identical-banners bug). The Build Plan prevents it:

- **Shared foundation FIRST, then fan out.** The plan schedules the shared design-system primitives
  (Button, **Banner/Alert**, Card, Chip, Modal, **the persistent app shell / global nav — DR-075**) as
  the **first work order(s)** — a *foundation wave* that completes **before** feature work orders
  parallelize. Feature WOs declare a dependency on the foundation, so they build against real, existing
  primitives instead of inventing their own. (Sequencing it first is the cheapest fix; it's the owner's
  "build the common things first".) **The app shell is a foundation concern, built first (DR-075/076):**
  a whole-app prototype's persistent topbar/nav/footer/layout frame belongs to no single feature FRD, so
  the per-FRD shard drops it (the Mission Control "no nav menu shipped green" failure). Capture it as the
  `AppShell`/`Nav` foundation work order (`artifacts` include `app/layout.tsx`) so it builds first and
  every surface mounts into it — the foundation-completeness gate below then enforces "no surface until
  the shell is green" for free, with no engine change. **Do not AUTO-EMIT an orphan `frd-NN-app-shell` at
  greenfield shard time** (it would have no `REQ-NN-MMM` in any PRD and the engine has no "build this FRD
  between foundation and surfaces" primitive — that orphan is the failure mode DR-075 avoids). But a
  **deliberately-authored app-shell FRD, rooted in the PRD** (e.g. a brownfield re-anchor where the PM
  writes the shell's user contract — persistent nav, active-state, responsive — as real `REQ`/`AC`), **is
  correct and well-documented**: its work orders still carry `foundation: true` so they build first. FRD
  = where the shell's *contract* lives; the `foundation` flag = its *build-first ordering*. Both, not
  either/or (DR-076).
  **ENGINE-ENFORCED (DR-057), not just prose:** the planner marks the foundation WO `foundation: true`,
  and while any foundation WO is still pending the engine's wave is **foundation-only** — features
  cannot fan out before the primitives exist, regardless of whether the blueprint author threaded the
  dependency to every feature WO.
- **The foundation must be COMPLETE, not a subset — a foundation-completeness GATE (DR-057, extended).**
  Foundation-first only works if the foundation is the **UNION of every shared primitive that ANY
  surface's mock/FDD references** — derived from `docs/design/components.md` (+ each per-FRD `mocks/`/
  `fdd.md`), never a hand-picked list. The Party regression: the foundation was declared "ready" while
  **incomplete** (the `Room`/`AgentSprite`/`StoneBridge`/`FlowStrip` primitives the Party surfaces need
  were never in it), so the surfaces built **flat** and failed the fidelity gate. So the planner
  derives the complete set from `components.md`, and the engine runs a **foundation-completeness gate
  BEFORE any surface fans out**: it enumerates the primitives every surface references, checks each
  exists as a built shared component and its foundation WO is green, and **refuses to start surfaces
  until the foundation is complete + green**. An incomplete foundation triggers the **bounded
  auto-repair** below (§6) rather than building surfaces against missing primitives.
- **A living component inventory** at `docs/design/components.md` — each shared component with its
  name, one-line purpose, path and key props/variants. The foundation WO seeds it; every WO that adds
  a shared component appends a row. **The engine injects "read the inventory before creating any
  component" into every UI build prompt** (DR-057), so "reuse → adapt → create-only-if-new" is the
  path of least resistance. Research (Storybook manifests, shadcn registry) shows a machine-readable
  inventory measurably raises reuse; Claude Design's `_ds_manifest.json` is this inventory when used.
- **Enforced at the gate:** the `reviewer`'s quality lens rejects a component that re-implements an
  existing primitive (two banners/cards/modals) and flags sibling components that diverge from one
  shared pattern. Reuse is verified, not assumed.

## 3b. The readiness gate — cohesion before the build (DR-100)

A blueprint with holes produces ambiguous work orders, and ambiguity is the #1 cause of an agent
building the wrong thing. So between "blueprint + work orders written" and "build starts" there is an
explicit **readiness gate** (the build-side counterpart of DR-095's clarification gate): the architect
runs it before a blueprint goes `ACTIVE`, and `implement`'s preflight re-checks it. It asserts,
fail-closed:

1. **Requirement coverage** — every FRD `REQ-NN-MMM` maps to a component/interface (`CMP-NN-*`/`IF-NN-*`).
2. **AC coverage, exactly one WO** — the union of all work orders' `source_requirements` equals the FRD's
   `AC-NN-MMM.K` set: no acceptance criterion is unbuilt, none is built twice.
3. **Data model complete** — `docs/product/architecture.md` carries no `TBD`/`TK`/`FIXME`.
4. **Dependency graph sound** — `dependsOn` across the work orders is **acyclic** and every referenced WO
   exists (it mirrors the Build Plan DAG, DR-087).
5. **Disjoint by design** — wave-parallel WOs have non-overlapping `artifacts` (don't rely on the engine's
   serialization backstop, DR-060).
6. **Foundation complete** — every shared primitive any surface mock references is a `foundation: true`
   WO (DR-057's completeness gate, asserted at plan time, not only at build time).
7. **No residual ambiguity** — **no `[NEEDS CLARIFICATION]` survives** in any FRD/blueprint/work order
   reaching `ACTIVE`. An `[ASSUMPTION: … — source]` (a decision made, visible) passes; a
   `[NEEDS CLARIFICATION: <q>]` (a decision not made) BLOCKS until resolved or escalated.
8. **Contracts materialized** — each backend WO's `docs/api/<wo-id>.md` exists (structured:
   input/success/errors/invariants) **before** its consumer WO builds.

The trivially-scriptable parts — a residual `[NEEDS CLARIFICATION]` in a committed doc — are cabled
fail-closed in `verify.sh`; the coverage/graph checks live in the architect's readiness SOP (and the
advisory `doc-lint.sh`, DR-077, which already resolves REQ→WO IDs). This is PREVENT; the per-FRD test
gate (§5) and the bounded auto-repair (§6) are CURE.

## 4. Hand-off (`## Status Note`)

When a work order closes it writes a hand-off in its `## Status Note`: what it built, the
interfaces/contracts it exposes (names + signatures), the integration seams, and which tests cover
it. The next agent reads the hand-off instead of re-reading all the prior code.

## 5. Test per FRD, not per work order

The build engine reviews and tests **per FRD**, not per work order:

- Building a work order runs only **its own fast self-test** (its tests + tsc) → marks it `IN_REVIEW`. In
  solo mode the **builder itself runs the self-test and writes the `## Status Note` hand-off** (DR-108 — the
  separate selftest agent was a second same-model spawn per WO; the trust boundary is the FRD gate, never the
  self-test); split mode keeps a separate closer agent. The **PLANNED→IN_PROGRESS transition is stamped by
  the ENGINE at wave dispatch** (BL-0002/DR-097 enforcement — atomic, independent of the builder's first
  action, so the board never shows "En progreso: 0" over a busy wave), on the cheap tier.
- Each builder receives a **context pack (DR-108)** injected into its prompt: its WO file's path + the EARS
  acceptance-criteria lines that WO owns, copied verbatim by the planner (the one agent that reads every
  frd.md in full). One reader hands off to N builders — instead of N builders re-reading the same docs and
  still constructing against a one-line summary, which made gates catch missing-AC work late.
- When all of an FRD's work orders are `IN_REVIEW`, run **one review + test pass over the whole FRD**,
  which also exercises the work orders **together** (real integration). The gate's tests are **focused**:
  `verify.sh --since <last_green>` runs biome + tsc globally but only the vitest tests **affected since the
  last green** (fast, and scales as the suite grows — it does NOT re-run the whole suite every gate), and
  **scopes the browser layer the same way (DR-106)**: in `--since` mode only `smoke` + `shell` run — the e2e
  face of the DR-072 BLOCKING lenses (every route renders clean; the app shell is present) — while `visual` +
  `responsive` belong to the **full** unscoped run (fidelity is ADVISORY at the gate and may never block, so
  paying the whole serialized Playwright suite per FRD bought nothing but wall-clock: 11 gates ran it in
  the personal-page-v2 build). The **full** suite runs once at **close-out**; the intermediate re-verifiers
  (Visual QA after its fixes, the hardening security pass) also run `--since`, never a second full suite.
  On pass → every work order + the FRD become `VERIFIED`.
  These two — the per-FRD `--since` gate and the close-out full suite — are where strict whole-project
  enforcement lives **during a build**. The per-turn `Stop` hook (`verify-before-stop.sh`) deliberately
  **stands aside while a build is active** (DR-063): mid-build the tree is legitimately red between safe
  points, so running the full strict suite on every Stop would block every turn (and every other session
  parked at that `cwd`). The supervisor keeps a freshness-stamped lock at `.pandacorp/run/build.lock`; the
  Stop hook no-ops while it's fresh and re-engages strictly when the build ends. The engine owns the gate
  during a build; the Stop hook owns it at rest. See `quality.md` (Gates).
- **Three test layers** at the FRD gate: (1) unit/component (per WO during build); (2) integration +
  adversarial review across the feature; (3) **functional/browser — the Preview Smoke Gate (DR-055)**.
  This layer is **mandatory and fail-closed for any FRD that has UI routes** (default ON for web
  projects; only a genuinely headless project — pure API, scraper — opts out, and that is recorded as a
  decision, not an omission). It **renders each of the FRD's key routes in a real browser**, and **fails
  the gate** on any browser **console error / uncaught `pageerror` / failed request / blank-or-error
  render**, asserts a real-content sentinel (the route's `<main>`/`<h1>` is visible, not `error.tsx`),
  captures a screenshot to `docs/reviews/smoke/`, and (advisory) flags large divergence from the FRD's
  `mocks/`. **Fail-closed means: if the smoke harness is absent, the gate is RED, not skipped** — a
  missing layer must never read as "passed" (the exact hole that let Mission Control ship 112/112
  VERIFIED while every route threw React errors and matched no mockup: `verify.sh` ran only
  biome+tsc+vitest, nothing ever opened a browser). It runs inside `verify.sh` (so the FRD gate and
  close-out enforce it automatically) and is re-run independently by the `reviewer` (generator ≠
  verifier). This moves review cost from O(work orders) to O(FRDs).
- **Visual-fidelity gate (DR-056) — does the build MATCH the mock, not just render clean.** The
  per-route fidelity oracle is chosen by a **fallback chain (DR-091)**, so it never silently no-ops:
  per-FRD `docs/frds/<frd>/mocks/` → ELSE the FRD's `visual_source` (the global prototype's matching
  view/shard, rendered live and A/B'd) → ELSE a `ui: true` FRD with neither is a finding (and
  `doc-lint` flags it). When an oracle exists the smoke layer is upgraded to a real
  fidelity gate, **layered** because no single tool reliably compares an arbitrary mock to a build:
  - **Layer A — deterministic visual regression (the hard block).** Playwright `toHaveScreenshot()`
    diffs each route against its own **blessed baseline**; fail-closed (a missing or over-budget
    baseline is RED). Determinism is mandatory or it flakes: pinned Playwright Docker image,
    `workers:1`, fonts ready (`await document.fonts.ready`), animations disabled + caret hidden,
    deterministic seeded data + frozen clock, genuinely dynamic regions `mask`ed (never loosen the
    global threshold to hide them), `updateSnapshots:'none'` in CI, visual specs **excluded from
    retries** (a retry re-writes a missing baseline and turns the gate fail-OPEN). Budget: default
    `threshold` 0.2 + `maxDiffPixelRatio` ~0.01–0.02 so anti-aliasing/font noise doesn't false-fail.
    Catches drift once a screen is blessed.
  - **Layer B — VLM mock-judge (catches the FIRST divergence from the mock).** A vision model — a
    **different model from the builder** (generator ≠ verifier) — compares the route screenshot against
    the FRD's `mocks/<file>` at the same viewport with an explicit rubric (layout, components
    present/absent, color/tokens, spacing, typography); it enumerates the **named** divergences BEFORE a
    structured verdict, sampled ≥3× with image order randomized (majority vote, against position bias).
    **Calibrated to its real competence:** fail-closed only on NAMED structural divergences (missing/extra
    component, wrong color, gross layout swap); on fine pixel/spacing deltas it does NOT auto-fail, and an
    uncertain verdict (low score + empty divergence list) **escalates to the owner** (`needs-owner`),
    never silently passes. A pixel diff says "looks the same"; the VLM says "is the right thing" — they
    are complementary. Both layers run at **≥2 viewports** (single-viewport match is not real fidelity).
  This pairs with the builder's **in-loop** render→compare→correct (DR-056): the builder self-corrects
  against the mock first; the gate then verifies **independently**. Wired into `verify.sh` + re-run by
  the `reviewer`.
- **Responsive gate (DR-074) — does the build actually WORK at a mobile width.** Part of both the
  per-FRD gate and the close-out verification (it runs inside `verify.sh`, fail-closed). When the
  project's `target_platforms` (`.pandacorp/status.yaml`) includes mobile, it asserts at the mobile
  viewport, per scroll-root: no horizontal overflow, no silent off-canvas clip (`overflow-x:hidden|clip`
  while wider than the box), tap targets ≥ 24px (axe `target-size`, WCAG 2.2 SC 2.5.8), and `<main>` not
  occluded by a fixed bar (WCAG 2.4.11) — catching exactly the desktop-first overflow a baseline-match
  visual gate blesses. SMART, not naïve: a legit horizontal-scroll region (kanban/DAG/wide table) marks
  itself `data-scroll-x="intentional"` once. For a `desktop`-only / API / scraper project it is a vacuous
  pass. Ships VERBATIM (`e2e/responsive.spec.ts` + `e2e/_responsive-helper.ts`, propagated by `architecture`,
  conformance-checked by `upgrade`); canonical in `factory/standards/design.md` §4b + `quality.md`.
- **Shell-Presence gate (DR-075) — does the build have the prototype's global shell / nav.** Part of
  both the per-FRD gate and close-out (runs inside `verify.sh`, fail-closed). The visual gate proves
  *consistency* (matches its own baseline), NOT *fidelity*: a build rendered menu-less blessed menu-less
  baselines and passed green (the MC "no nav menu" failure). This gate asserts the app against the
  **prototype-anchored** nav contract `e2e/shell.ts` (author-declared at design time, never derived from
  the app's own routes): on every declared route (minus author-declared exempt routes) the persistent
  shell landmark is **visible**, every top-level destination is a **visible in-shell link to its correct
  path**, each destination **2xx-resolves**, and on mobile the nav is reachable. It iterates `SURFACES`
  (not `BLESSED` — the MC failure is a route that shipped *blessed* without the shell). An app with no
  persistent shell (empty contract) ⇒ a vacuous pass. The reviewer's whole-app fidelity check is the
  advisory companion (shell *resemblance* is a punch-list nit, never a block — DR-072 preserved); the
  **deterministic gate is the block**. Ships VERBATIM (`e2e/shell.spec.ts`, propagated by `architecture`,
  conformance-checked by `upgrade`; `e2e/shell.ts` is the per-project seed); canonical in
  `factory/standards/design.md` §5b + `quality.md`.
- **The conformance overwrite must not red-lock the gate it re-syncs (DR-076 amendment, BL-0003).** `upgrade`'s
  DR-059 conformance step overwrites the canonical gate config (`verify.sh`/`biome.json`/`knip.json`/the e2e
  set) VERBATIM from the plugin template, on DR-076's doctrine that the template is never behind a project.
  That doctrine is an ASSUMPTION, not an invariant: a project can legitimately race ahead when a pinned tool
  ships a config-format change before the template catches up (personal-page-v2's biome `2.5.1` needed schema
  `2.5.1` + `preset: recommended`; the stale template `2.5.0` + deprecated `recommended: true` overwrote it and
  **red-locked the whole-project baseline** under `--error-on-warnings`). Two guards, both in
  `plugin/skills/upgrade/SKILL.md`: (1) BEFORE overwriting, a **version-compare detector**
  (`scripts/detect-gate-config-newer.sh`) flags "project config newer than template" (schema version vs the
  installed tool) and **back-ports the project's version up to the template FIRST** so the overwrite is a
  no-op — never a silent downgrade; (2) AFTER conformance + the DR-079 canary, `upgrade` runs the **FULL
  project gate on the project** (`verify.sh`, a full baseline — not `--since`, which lints only changed files
  and hid the red-lock until pass-2) and **fails loud — BLOCKING the upgrade — if the freshly-synced config
  red-locks the gate**, so a broken baseline is never left for the next build to discover (`builtFrds:[]`,
  `blockedReasons:{baseline:error}`). The canary proves the gates still bite on a broken fixture; this run
  proves the REAL project still passes after the overwrite.

## 5b. The phase model & `deploy_target` (DR-085)

The project lifecycle (the `phase` in `.pandacorp/status.yaml`) has **six phases**, matching Mission
Control's six rooms: **research** (pre-project) → `product` → `design` → `architecture` →
`implementation` → `release`. Two changes over the old model:

- **Construction (`implementation`) owns the hardening — and the engine ENFORCES it (BL-0012, fail-closed).**
  The security audit, quality close-out and telemetry/metrics verification are the **last step of
  construction** (see §6 "Nothing is left"), not a separate release activity — and this is cabled, not
  prose: `pandacorp-build.js` runs a `Hardening` phase (security-auditor + analytics agents) once every FRD
  is `VERIFIED`, and the close-out **asserts the hardening evidence exists** (`docs/reviews/security-*.md`
  dated this run + the `## Verification` section in `docs/analytics/events.md`) **before it may set
  `phase: release`**. If a hardening stage fails, the engine keeps `phase: implementation`, files a
  needs-owner decision and notifies; the fail-safe close (fired when a close-out agent dies) NEVER touches
  `phase`. There is no path to `release` on the FRD loop alone.
- **`release` is the terminal phase = launched.** It means the product is **deployed / launched** (internal
  or external) and from there it is iterated (`/pandacorp:iterate`) and its results read
  (`/pandacorp:review-launch`). The old `operation` phase is **folded into `release`** — there is no
  separate "live/operating" phase. `/pandacorp:release` performs the deploy/launch + launch plan and sets
  `phase: release`.

**`deploy_target: internal | external`** — a `status.yaml` field, **NOT a phase**, recording *where* a
released product runs:

- **internal** — an in-house tool used as-is, no external host (e.g. Mission Control on `127.0.0.1`).
  "Launch" = it runs locally; no external deploy, no production gate, no landing/GTM.
- **external** — deployed to an external server (Vercel / AWS / …) for real users. "Launch" = the
  production deploy + launch plan, behind the human production gate (DR-004).

Both are a real release of a software product — the same `release` phase, distinguished only by
`deploy_target` (typically derived from the idea's `return_type`: `personal`/in-house ⇒ internal,
`monetary`/`mixed`/`opportunity` ⇒ external). A change that needs a second build pass may loop
`release → implementation` (conceptually allowed; the day-to-day is `/pandacorp:iterate`).

## 6. How a run stops — health & budget, never a feature count

The build **runs to completion** by default (owner decision 2026-06-16). It does NOT stop after N
features: one feature can cost 10x another, so a count protects neither tokens nor progress. A run
stops only when:

- **Nothing is left** — every FRD is `VERIFIED`, then the **final hardening step** runs (DR-085: security audit + quality close-out + telemetry/metrics verification — the audit that used to live in `/pandacorp:release` is now construction's last step) → `phase: release`. Reaching `release` means the build is hardened and ready to be **launched** (deployed internal or external) by `/pandacorp:release`; there is no `operation` phase after it.
- **Budget ceiling** — `maxAgents` (a hard cap on subagents spawned this run) is reached, or a `+Nk` turn
  directive / `maxSpend` is nearly spent → stop at the last safe point (a commit). For overnight runs,
  **`maxAgents` is the real guardrail**: counted **inside the engine** (each implementer/reviewer ≈ work ≈
  tokens), so it brakes reliably even when `budget.spent()` under-counts subagent work, or the supervisor has
  died and left the run orphaned (both observed 2026-06-17 — a run hit ~6M tokens with `maxSpend` set to 2M,
  because `budget.spent()` didn't reflect the subagents and the orphaned run had no supervisor enforcing it).
  `maxSpend` (output tokens via `budget.spent()`) is only a **secondary** ceiling.
  - **The cap must be HONEST and FINE-GRAINED (DR-070).** `agentSpawned` increments on **every** spawn
    (baseline, plan, close-out included — they were uncounted) and the ceiling is checked via `capHit()` at
    **two** safe points: the per-FRD-loop top **and the top of each build wave inside an FRD**. Checking it
    only between FRDs let a pass with a few large FRDs inflate the count inside one FRD and overshoot the
    ceiling arbitrarily (a `maxAgents=40` run reached **68** agents / ~4.95M tokens, MC Phase-2 pass-1,
    2026-06-21). A mid-FRD cap hit stops at the wave boundary, leaving that FRD's built WOs `IN_REVIEW`
    (resumable) and skipping its gate. The **supervisor also enforces a reliable EXTERNAL brake**: it counts
    the actual `agent-*.jsonl` files in the run's transcript dir and `TaskStop`s the workflow past the ceiling
    (small overshoot allowance), independent of the in-engine counter (which silently under-counted). The
    supervisor treats `maxAgents` as the **cumulative-across-passes** walk-away budget too — it does not
    relaunch once cumulative agents reach it.
- **Health breaker** — too many features `BLOCKED` in a row (default 3, excluding `external`) → stop;
  something is systemically wrong.
- **Needs the owner** — what remains is `BLOCKED: needs-owner`.

`maxFrds` bounds a deliberate, **supervised test run** and counts features **processed** (built + blocked +
**reopened** — a reopen counts, so chained reopens can't slip past the cap; a bug the 2026-06-16 overnight
test caught). It is never the overnight guardrail; `maxAgents` is.

**A gate reject PATCHES IN PLACE before reverting (DR-073), and the revert is the fallback (DR-070).** When
the FRD gate rejects a SPECIFIC work order for a localized CORRECTION fault, the build is typically ~correct
except a bounded fault — discarding a 99%-correct build to rebuild from scratch wastes a full multi-agent pass
AND re-introduces a new micro-bug (the WO-07-005 4-cycle non-convergence: 5 EARS → reverse cross-nav → dead-code
knip → dead Back button, each reject a different progressively-smaller finding, only converging when a human
patched the one bug). So the default is **patch-first**:
- The reviewer does NOT revert on a localized reject; it **reports the fixable fault(s)** — `findings: [{ wo,
  finding (file:line), failingTest (a RED-proven test that fails without the fix), files }]` — and leaves the
  WO `IN_REVIEW` (no `reopen_count` change yet).
- The engine attempts **one in-place patch** (`attemptPatch`, opus + `xhigh`): fix only the named
  finding on the EXISTING build, make the RED-proven test pass, then **re-gate WHOLE-PROJECT** — the full FRD
  adversarial + integration pass AND a whole-project `knip` + `biome` + `tsc` (NOT `verify.sh --since`: a dead
  export the patch leaves must not slip to a sibling FRD's global gate — the red-team-A fix). It commits
  **only on whole-project-clean** (an independent verifier then stamps `VERIFIED` — the patcher never
  certifies itself, constitution rule 4); the patch runs **synchronously inside this FRD's gate step**, so a
  sibling never sees broken committed code — DR-070's true invariant ("never broken-committed whole-project")
  is preserved without a revert.
- **Self-repair budget (DR-107).** A red the patch's OWN edits introduced (a type/lint error in a file the
  patcher just created or touched — e.g. a TS2345 in its own new test) does NOT end the patch: the patcher
  fixes it and re-gates, up to **2 internal cycles**, before giving up. The personal-page-v2 incident this
  encodes: a 1-line i18n fix was discarded — and its whole 1,397-line work order reverted and rebuilt from
  scratch — because the old "one shot, change NOTHING" contract forbade fixing a trivial type error in the
  patch's own new a11y spec.
- **Two-cause give-up verdict (BL-0001).** A failed patch returns `cause: 'code'` (the build is genuinely
  wrong) or `cause: 'gate-test-defective'` (a reviewer adversarial test is internally inconsistent /
  unsatisfiable by ANY correct implementation — e.g. asserting desktop-only nav visibility without forcing a
  viewport under a dual desktop+mobile Playwright config). The integrity rule stands — the patcher NEVER edits
  the reviewer's test — but it now has a valve: on `gate-test-defective` the engine routes to a
  **gate-test repair** (`repairGateTest`, an independent reviewer-role agent that judges the claim and, if the
  test is genuinely defective, repairs the TEST to assert the FRD's real acceptance criterion — never deleting
  coverage; if the test is upheld, the flow falls back to the normal revert). One fallback for two causes was
  rebuilding correct work in loops a defective test could never let converge (LESSON-0002). On give-up the
  patcher UNDOES its own edits, so the engine can still revert cleanly.
- **Only when the patch (and, if flagged, the gate-test repair) can't green it whole-project** does the engine
  fall back to `revertAndReopen` (the DR-070 path): set the WO `PLANNED`, **increment `reopen_count`**, and
  revert its files to `last_green_sha` — surgical `git checkout <sha> -- <files>` + `git rm` for newly-created
  files, **never a whole-tree hard reset** (that would discard verified siblings) — committed with the status
  change. **The revert preserves test evidence (DR-107):** a newly-created TEST file the reviewer authored or a
  `## Status Note` references is coverage, not rejected code — it MOVES to `.pandacorp/run/preserved-tests/<wo>/`
  instead of being deleted, and the rebuild restores it as its RED baseline (a green 6/6 a11y spec was deleted
  by a revert on personal-page-v2 and had to be re-authored blind a pass later).
- **In-run retry (DR-107).** After the revert, the engine retries the reopened WOs **once, in the SAME run**,
  from the clean green base (on opus — `reopen_count >= 1`), then re-gates. Deferring every reopen to the next
  pass re-paid the whole fixed overhead (baseline + full re-plan + rollup sync + safe-points) per reopened WO.
  Bounded: one in-run retry per FRD per run; skipped at the agent ceiling or when a reopened WO already hit the
  reopen cap; if the retry's gate rejects again there is NO second patch cycle — revert + defer to the next
  pass exactly as before. **One unified budget:** `reopen_count` is the single counter (the in-place patch is a
  sub-step of one reject cycle, NOT a second axis — this avoids the nesting/non-termination the red team
  flagged); at `MAX_REOPENS` (default 3) the gate BLOCKs `needs-owner` instead of grinding.

**Model selection — adaptive escalation within the mode (DR-073).** This is the build engine's own calibrated
instance of the general subagent-model-selection principle (CONV-12/DR-111 — calculate the tier by task
complexity, never inherit the caller's tier); it is not reopened by that broader rule. The mode's `P.worker` is
the **floor**, never
downgraded. `pickWorkerModel(wo)` escalates a work order's build to **opus** when **either** it is a-priori hard
— `difficulty: high` in the WO frontmatter (HYBRID, owner decision; the rubric is in `work-orders`) — **or** it
has already failed once — `reopen_count >= 1` (empirical: a sonnet build that didn't pass is unlikely to pass
again, so raise the model for the retry). The in-place patch always runs on opus. **Cost-weighted brake (the
red-team-B fix):** `maxAgents` counts AGENTS, not tokens, so an opus escalation would silently blow the token
budget while the counter reads low — so `agentSpawned` is **weighted by model cost** (opus ≈ 3 cost-units), making
`maxAgents` brake on a token-proxy. Every escalation is logged (`⤴ opus: <wo> (difficulty=high | reopen=N)`) so
spend is visible. A-priori difficulty is a *prior*; `reopen_count` is the *empirical* correction, so a
mis-estimated `medium` WO still escalates once it actually fails. **Mechanical steps run on the cheap tier
(DR-108):** the serialized per-WO commit, the per-wave IN_PROGRESS dispatch stamp, the per-FRD safe-point
check, the rollup sync, the change archive and the end-of-run notify run on `MECH` (default haiku,
`args.mechModel` overrides) — they execute a script, they exercise no judgement; real build/review/repair
work keeps the sonnet floor + opus escalation.

**Repair before block (the owner's rule).** When a work order or the FRD gate fails, the engine first
runs a **repair pass** (a strong-model agent diagnoses and tries to fix, re-verifying with
`verify.sh`). Only when the fix is genuinely out of reach does the feature go `BLOCKED`, and the block
carries a **`blocked_reason`**:

| `blocked_reason` | Meaning | What happens |
|---|---|---|
| `needs-owner` | a human must act: env var/secret, external account, product decision | logged to `.pandacorp/inbox/decisions.md`; owner notified; build continues with independent FRDs |
| `external` | transient outside failure (no internet, upstream 5xx) | retried on a later run; does NOT trip the health breaker |
| `error` | an unresolved technical fault | surfaced; build continues with independent FRDs |

A blocked FRD never halts the whole build unless it's a dependency of everything left, or the health
breaker trips. Notifications are macOS-desktop (`osascript`) from the engine plus a phone
`PushNotification` from the supervising agent when Remote Control is on (no third-party push app).

**Bounded auto-repair — resolve the known fix, don't stop to ask (DR-065).** Repair-before-block is a
general diagnose-and-fix pass. On top of it the engine has a **specific autonomy rule** for one
**high-confidence, recoverable, BOUNDED class**: *"a surface failed (looks flat / fails fidelity)
because a shared primitive it needs isn't in the foundation."* The Party build **detected this root
cause correctly but STOPPED to ask the owner** with 4 options — even though it already knew the fix
(its own recommended option: move the missing primitives into the foundation and retry). The gap was
**autonomy, not detection**. So for this class the engine **auto-resolves**: it resets to the last
green (discarding the flat half-built surfaces, never the verified foundation), **adds the missing
primitive(s) to the foundation** on the frozen tokens per their mock spec, appends them to
`components.md`, rebuilds + re-verifies, and lets the surfaces rebuild against the real primitives —
**capped at `foundationRepairCap` (default 2) auto-repairs per run**. It escalates to the owner ONLY
when: confidence is low, the gap is genuinely a human/design/product decision, or the cap is reached
after N failed auto-repairs. The signal is structured: the FRD gate returns `missingFoundation: [names]`
when it sees this class, and the engine routes it to the bounded foundation auto-repair instead of a
`needs-owner` block. This is the balance the owner asked for — **autonomy without loops or burning the
budget**. (PREVENT is §3's foundation-completeness gate; CURE is this bounded auto-repair — same root
cause, two defenses.)

**Working-tree health & no-stash recovery (DR-067).** The build is **resumable from the frontmatter +
commits** (DR-050), and the engine commits with a **single writer, no merge** (§2). Two corollaries are
now explicit, because a build went off-script and violated them — costing ~1h:
- **Never `git stash` to preserve in-flight work** across a kill / relaunch / stop. Killing a run discards
  only the uncommitted work between two safe points; the relaunch rebuilds it from `PLANNED`/`IN_PROGRESS`
  state. A stash popped later onto a tree that has moved on **conflicts** (the MC Phase-2 build stashed a
  killed run's `frd02-lacampana` work, then applied it onto an already-`VERIFIED` FRD-02 → `<<<<<<<` markers
  in `Button.tsx`, 130 gate errors, build wedged). The **only** safe recovery from a dirty/conflicted tree
  is to **restore it to `last_green_sha`** (a clean reset to the green commit); never hand-resolve a
  stash-pop. On startup the engine **drops stale build stashes and clears leftover temp `preview-wo*`
  pages** (baseline self-heal) — they're stale, the work is resumable.
- **The supervisor watches the tree's git health as a first-class signal**, not just `status.yaml` +
  liveness. The Monitor checks `git status --porcelain` each tick — any `UU`/unmerged path or conflict
  marker is a **broken tree** and emits an alarm, routed to the bounded auto-repair (restore to last green).
  This closes the gap that DR-066 didn't: DR-066 made *liveness* honest (the heartbeat can't lie about
  "alive"), but a tree can be **broken while perfectly alive** — the Phase-2 supervisor reported "healthy"
  for ~1h because it never looked at git. A monitor blind to a broken tree is the same failure class as one
  blind to liveness; both are now covered.

**Build-lifecycle honesty — `running:false` on every exit + stop-the-LOOP, never a lying flag (DR-068).**
The engine already cleans up on a NORMAL end (its close-out sets `running:false`, plus a fail-safe agent
"never leave a phantom running build"). Two gaps remained, exposed when a build sat dead ~1h with
`running:true` and a stuck spinner:
- **A KILLED/stopped run never reaches the engine close-out**, so clearing state is the **supervisor's**
  job — and it must be its **guaranteed LAST act on EVERY exit** (clean end, budget/health/needs-owner
  stop, owner stop signal, or being interrupted): write `running:false` + `rm -f .pandacorp/run/build.lock`.
  A stopped build that still reads `running:true` is a **lying flag**. Backstops: a stale `running:true`
  (heartbeat past the 10-min TTL) is **never trusted as alive** — every reader (the concurrent-run guard,
  the supervisor's health tick, Mission Control's display per DR-066) crosses `running` with heartbeat
  recency and reads it as STOPPED, and the next state-writer auto-corrects it to `false`.
- **Stopping a run ≠ stopping the loop.** The supervisor's design is to RELAUNCH the next pass, so a lone
  TaskStop just triggers another pass ("I stopped it but it came back"). To halt the **whole build** the
  owner sets a stop signal — `rethink_pending: true` (or `.pandacorp/run/stop`) — which the supervisor
  checks at each safe point **and before every relaunch**, halting the loop + running the guaranteed
  shutdown. This distinction must be surfaced to the owner, not implicit.

## 7. The build supervisor (unattended runs)

Launching a build is **never** just firing the workflow — it is always paired with a **live supervisor**
(the agent that runs `implement`), so an unattended/overnight run can't stall silently or run away on
tokens. The supervisor:

- **Watches live** with `Monitor` — a ~2-min bash poll (costs **no tokens**; only an emitted event wakes
  it) over `.pandacorp/status.yaml`, the run's journal mtime + active agents (frozen?), and the agent
  count (a spend proxy). It emits on: an FRD verified, **frozen** (~15 min no activity), a new block,
  pace below target, or run end. It covers the failure signatures, not just success — "silence is not success".
- **Heartbeats VISIBLY** — a message to the owner every ~20–30 min even with NO anomaly. The Monitor only
  wakes on events, so the heartbeat is scheduled separately (a `ScheduleWakeup` timer): WOs done/total, the FRD
  in progress, rough spend, "all green". Silence reads as "stuck" to the owner — the periodic heartbeat is what
  tells them it's alive.
- **Reacts**: a stall → unstick it; a block → the engine already attempted a repair; if the run is wedged
  or over budget → **stop it and notify**. Notifications: the engine fires a macOS desktop notification
  (`osascript`); the supervisor also sends a phone `PushNotification` (when Remote Control is on). No
  third-party push app.
- **Feeds the self-learning loop (DR-047)**: when it unsticks something it classifies it — uncontrollable
  (internet, upstream 5xx) → nothing to learn; **avoidable** (a recurring pattern, an engine bug, a config)
  → capture the lesson to `factory/memory/_inbox.md` and, if fixable factory-wide, fix it on the spot.
- **Holds a session budget ceiling**: it tracks cumulative agents/runs (a spend proxy) and stops + notifies
  at the owner's ceiling (it can't read exact plan usage, so the ceiling is conservative).
- **Announces each FRD (milestone visibility)** — on every FRD verified, sends the owner a visible (+ push)
  message: the FRD name, one line on what it does, the **route/page to try it**, and X/Y done. The owner
  should never have to ask "is it done?"; each milestone is reported, paired with the review worktree below.
- **Keeps a review worktree** — a worktree pinned at `last_green_sha` (`git worktree add ../<project>-review
  <sha>`, with its OWN `node_modules`; a symlink breaks Next's HMR), updated (`git checkout`) each time an FRD
  verifies, so the owner can browse the **latest GREEN version** without touching the running build. The owner
  views it via a Claude Desktop session opened in that worktree (native Preview) or an on-demand dev server —
  the build session's own Preview tool **cannot** point at an external worktree. No permanent dev server
  (Next's file watcher is flaky across `git checkout`).

The operable detail lives in the `implement` skill ("Unattended operation — the build supervisor"); this
section is the canonical statement that the supervisor is **mandatory**, not optional.

## 8. The change queue — talking to a running build (DR-069)

The owner needs to inject changes (a feature, an adjustment, a bug) **while a build runs** — a build can take
hours or more than a day, so "wait until it finishes" is not viable. The mechanism is a **durable, classified
queue** that the build drains at safe points. It is the same pattern production agent runtimes use (a thread-safe
injection queue drained at iteration boundaries) plus **Kanban classes of service** for urgency.

**One owner door, internal engines.** The owner uses a single command — **`/pandacorp:change`** — for ANY change
or bug. It classifies the request and files it; it does NOT remember which sub-skill to call. `bug` and `iterate`
remain the **internal engines** (`change` and the build invoke them) and still work as direct aliases. `decide`
stays separate — it is the owner *answering* a question the build asked, the opposite direction.

**The queue** lives at `.pandacorp/inbox/changes/` (one file per change + a `README.md` index), **in Spanish**
(gitignored owner layer). It **unifies** the former channels: `inbox/bugs/` folds in as `type: bug`. Each file
carries a machine header (`type`, `class`, `status`, `frd`, `rebuilds_verified`) + a Spanish body.

**Readiness gate — `status: draft | ready` (the owner's hold switch).** A queued item is one of: **`ready`** (the
description is complete enough to action → the build drains and builds it), **`draft`** (captured for visibility but
the owner is still working out the details, it depends on something not done yet, it needs a design pass, or it is
infra/deployment the build doesn't implement → **the build SKIPS it**, untouched), or **`done`** (built, set by the
build with the landing commit). This lets the owner **park half-formed ideas in the queue** — they show in Mission
Control without the build acting on them — and promote one with a single edit (`draft → ready`) when it's cooked.
`/pandacorp:change` defaults a clear, actionable request to `ready`; the owner says "just note it" for a `draft`.
**The build acts ONLY on `ready`** — this is the gate that separates "I'm still thinking" from "go build it."

**Classes of service** (Kanban — David J. Anderson): `expedite` (urgent / breaks something → jumps the queue at
the next safe point), `standard` (default, FIFO), and `intangible`/`fixed-date` for completeness (rarely needed).

**Capture is detection-free and doc-free (the safety property).** `/pandacorp:change` ONLY writes one file to the
queue — it never edits the build's docs/work-orders/code and **has no build-detection logic**. Therefore a
mis-detection of "is a build running?" **cannot corrupt anything**: the change waits durably in the queue until the
build itself pulls it. This is the fix for the owner's real fear — there is no "if no build, edit docs directly"
branch to get wrong. The ONLY place that decides "is a build running?" is `implement`'s concurrent-run guard
(DR-050 §11), a **lease + heartbeat + 10-min-TTL** check (no fencing token exists — that claim was corrected
2026-07-01, audit-20; the TTL + the engine's single-writer commit chain are the actual mechanism); and even that
decision is safe-when-wrong (a wrong launch aborts on the guard; a missed launch just leaves the change queued).

**The consumer — THE ENGINE ITSELF drains + routes at every safe point** (a safe-point check at each FRD boundary
in `pandacorp-build.js` reads `rethink_pending` + the ready queue + answered decisions — cabled 2026-07-01,
audit-20 P0-3; the supervisor only monitors/notifies, and before every relaunch re-checks the stop signal). It takes **only
`status: ready` items and skips `draft`** (see the readiness gate above). For each `ready` queued
change it decides, **work-conserving** (never stall the whole build for one item):
- `expedite` → handle at the next safe point, ahead of `standard`.
- `standard` → FIFO when the build reaches it.
- **autonomous-resolvable** (a clear scoped change) → integrate it **via the `iterate` engine** (PM/architect →
  FRD/work-orders/blueprint, calling `work-orders`/`design`) or the `bug` engine (regression test → fix), **at the
  safe point** (never mid-feature), then the **FRD review/test gate** — so a queued change passes the SAME quality
  gate as planned work.
- **needs-owner** (a product/money/irreversible/design decision) → write it to `inbox/decisions.md`, notify, and
  **DEFER it while continuing with independent FRDs**; only fully STOP if it blocks everything (a foundation/
  structural change). The owner answers with `/decide`; the next safe point/relaunch unblocks it.
- **structural / fundamental / new-design** → captured but routed to a **stop + guide**: the build pauses
  (`rethink_pending`) and tells the owner the command to run (e.g. `/design`), so it never silently rebuilds half
  the app or auto-approves a visual (the design gate is the owner's).

**Completion — verify the durable record, then ARCHIVE (never hand-delete).** When a change lands, the build does
NOT just flip a flag and leave the file in the active queue (that would clutter the owner's "what's pending?" view),
NOR hard-delete it (the folder is **gitignored** — a delete is **irreversible**, with no git history to recover the
owner's original phrasing). Instead it **archives**: (1) **verify the durable record exists** — independently
(generator ≠ verifier) confirm the landing commit **touched the canonical doc** (FRD/PRD/blueprint) AND a
`docs/decision-log.md` entry references the change; (2) stamp `status: done` + `shipped_sha` + `shipped_at`; (3)
**move the file to `changes/done/`** (a move, never an `rm`). The active `changes/` then holds **pending-only** (the
owner's clean queue) while the Spanish owner-language audit trail survives in `done/` (Mission Control reads it for a
"recently shipped" view). If the durable record is **missing**, the change is **not archived** — it stays in place
and the missing decision-log/FRD update is flagged as the real defect (archival is thus also the enforcement point
for the documentation discipline). This is the industry-standard *commit-before-retire* ordering (Kanban/issue-
trackers archive-not-delete; event-sourcing append-only; durable queues delete only after the durable write is
confirmed): the changes/ file is a transient intake artifact, but it is retired into an archive, **never destroyed**,
and **never auto-deleted** — any later prune of `done/` is a separate, owner-gated, reversible action.

**Why this doesn't overload the build.** The build stays an **orchestrator of specialized subagents over
deterministic control flow** (DR-013): docs → PM/architect, code → implementer, review → reviewer (a different
model), design → designer + the owner's gate. The queue adds one deterministic step — *drain → integrate → build →
gate*; no single agent's job grows, and quality is enforced by the **independent FRD gate + `verify.sh`** (generator
≠ verifier, constitution §22), not by trust.

Canonical surfaces: `plugin/skills/change/SKILL.md` (the door), `plugin/skills/implement/SKILL.md` (drain + route),
`plugin/skills/{bug,iterate}/SKILL.md` (engines), this section. Mission Control surfacing the pending `changes/` and
`decisions` items is a follow-up (the consumer UI).

## 9. Convergence — the split gate + the Visual QA pass (DR-072)

A build that NEVER FINISHES is the dominant overnight failure: every surface gets built, the gate rejects it on
visual fidelity, it's reopened and rebuilt, rejected again — hours of work, ~0 net `VERIFIED`. The research is
unanimous: **convergence is an engineering-of-the-gate problem.** A noisy subjective gate (a pixel/VLM judge:
re-runs flip, anti-aliasing/sub-pixel/dynamic-content deltas, trivially reward-hackable) used as a HARD BLOCKER
rejects spuriously; an over-broad adversarial reviewer harms convergence by over-engineering. The fix is NOT
"lower quality" — it's **splitting the gate by category and consolidating fidelity into a non-blocking pass.**

**The gate is SPLIT (the convergence keystone):**
- **CORRECTION — the hard, blocking gate (the no-bugs guarantee, kept STRICT):** renders clean (smoke — no console
  error / non-2xx / blank / error-boundary), tests + types + lint green, the FRD's **acceptance criteria** met
  (the required behavior/sections EXIST and work), security, no genuine DUPLICATE of an existing shared primitive
  (DR-057), and a **GROSS visual-structural mismatch** (the surface is not recognizably the designed thing — a
  flat list where the mock is a rich layout, a section missing). A real bug here BLOCKS.
- **VISUAL-FIDELITY NITS — ADVISORY, never block:** sizing (15px vs 16px), spacing, exact shade, density, "doesn't
  match 100%". The gate **never reopens a WO for a nit** — it appends each to `.pandacorp/comms/visual-punch-list.md`.
  A nit never gates `VERIFIED`. (The deterministic Playwright `toHaveScreenshot()` *regression* baseline stays a
  hard gate — it's a regression guard, not a fidelity-vs-mock judgment.)

**End-of-build VISUAL QA pass.** All the systematic fidelity work is consolidated into ONE dedicated phase at the
end of the run, scoped to the FRDs touched that run, run OUTSIDE the convergence loop (so being thorough here can't
cause churn): render each route → compare semantically to its mock/fdd/tokens → complete the punch-list → **fix the
cheap, unambiguous gaps DIRECTLY** (a size/spacing/color/token correction against the EXISTING design docs — the
doc already specified it, the build implemented it wrong; **no doc change, no `change`/`iterate` ceremony**) →
re-run `verify.sh` to confirm no regression → leave the residual for the owner. It is a **punch-list + bounded
polish, NEVER a reject-to-rebuild.** Two visual touchpoints, different jobs: a LIGHT advisory per-FRD check
(catches GROSS divergence early, in-loop, cheap) + this THOROUGH end pass (the complete polish, outside the loop).

**Non-progress stop (refuse to treat repeated failure as progress).** A WO carries a `reopen_count` — the **single**
attempt budget (DR-073: the in-place patch is a sub-step of one reject cycle, not a second axis, so there is no
separate `patch_attempts` to nest). A reject defaults to ONE in-place patch (above + §6); only the *revert*
fallback increments `reopen_count`. When the gate would reopen a WO already reopened `MAX_REOPENS` (default 3)
times, it BLOCKS `needs-owner` instead (the gate can't be satisfied autonomously — the owner must look), rather
than grinding the same fault every run.

**Selective reasoning effort.** Higher effort has diminishing returns by base-model strength, and `max` overthinks
structured tasks — so raise it only where reasoning is hardest: the FRD gate, the repair pass, and the cross-feature
close-out run `effort: 'xhigh'`; the build workers stay at the session default. Don't max everything.

**The realistic target this buys.** An overnight run lands a **functionally-complete, gate-green app (a working
draft, no functional bugs) + a short visual punch-list** the owner sweeps in the morning — NOT a pixel-perfect,
hands-off, accept-on-trust product (no agent system reliably does that at 2026 SOTA — METR/SWE-Marathon). The
build's job is to converge to that draft or STOP cleanly with a reason, never to burn the night looping on a gate.
Canonical: `pandacorp-build.js` (split `frdGate`, the Visual QA phase, `MAX_REOPENS`, `effort`), `plugin/agents/reviewer.md`.

## 10. Templates

The standard is embodied in `${CLAUDE_PLUGIN_ROOT}/templates/docs/`: `prd-template.md`,
`frd-template.md`, `blueprint-template.md` (with the Build Plan), `work-order-template.md` (with the
Status Note). The product-phase skills (`spec`/`architecture`/`work-orders`) generate from these; the
build engine (`implement`) consumes them; `iterate`/`new-version` reopen work orders through them.

## 11. Concurrent-run guard (heartbeat-based lock)

Only ONE build may run on a project at a time. A second `/pandacorp:implement` on the same project
while one is already active would cause race conditions on the frontmatter (double-pickup of the same
work order), `status.yaml` corruption, and conflicting git commits.

**The mechanism: TTL lock via supervisor heartbeat.**

`status.yaml` carries these fields written at launch and cleared on close:

```yaml
running: true
run_started_at: "2026-06-17T10:00:00Z"     # set once at launch
supervisor_heartbeat: "2026-06-17T10:08:30Z"  # advanced every ~2 min by the supervisor (liveness of the watcher)
last_event_at: "2026-06-17T10:08:12Z"       # advanced by the PRODUCER (engine) at every safe point — liveness of the build itself (DR-066)
```

The **supervisor** (the agent that runs `implement`) writes `supervisor_heartbeat` to `status.yaml`
on every Monitor tick (~2 min). This is the liveness signal — as long as the supervisor is alive, the
heartbeat stays fresh.

**Observability fidelity — the heartbeat must be POSITIVE and the consumer must cross it with recency (DR-066).**
A frozen `running: true` is not proof of life; the audit found exactly that (`running: true` + a stale
timestamp while the build was advancing). So:
- **The producer emits a positive, time-driven heartbeat.** The engine appends an `AgentWorking` event to
  the event stream as each agent starts (`~/.claude/dashboard-events.ndjson`) AND **advances `last_event_at`
  in `status.yaml` at every safe point** (each FRD gate, sync, close-out). The supervisor's tick is
  **time-driven** (a `ScheduleWakeup` timer, not only the event-driven `Monitor`) and on every tick it BOTH
  advances `supervisor_heartbeat` AND appends a positive `SupervisorTick` heartbeat event — so "sin señal"
  (no events at all) genuinely means *hung*, not merely *quiet between long agents*.
- **The consumer (Mission Control / any monitor) reads liveness as `running AND fresh`, never `running` alone**,
  and declares its own freshness in three bands (en vivo `< 3·T` / datos de hace X / sin señal `≥ 10 min`),
  where `T` ≈ the 2-min tick. This is the canonical observability standard; see
  [observability.md](observability.md) "Liveness & freshness fidelity".
- **Gate:** a transport/UI that claims to be live does not pass without proving (1) a real state change is
  reflected in the UI quickly — push/watch for near-real-time when cheap, polling **≤ 30 s** worst case — and
  (2) "sin señal" engages when the heartbeat stops. See [quality.md](quality.md) "Observability-fidelity gate".

The **`implement` preflight** checks, after confirming `status.yaml` exists:

| `running` | `supervisor_heartbeat` age | Action |
|---|---|---|
| `false` (or absent) | — | proceed normally |
| `true` | < 10 min | **ABORT**: tell the owner (in Spanish) there is already an active build; include `run_started_at` so they know when it started. Don't launch. |
| `true` | ≥ 10 min (or field missing) | **Stale lock**: supervisor died (internet cut, crash, etc.). Warn the owner, reset `running: false` + clear `supervisor_heartbeat`, then proceed. |

**Why 10 minutes?** The supervisor heartbeats every ~2 min. Five missed heartbeats (10 min of
silence) is a conservative signal that it is genuinely dead, not just slow. This avoids false
positives while still auto-recovering quickly after a crash.

**Zombie recovery is automatic.** The owner never needs to hand-edit `status.yaml` to clear a stale
lock — the next `implement` detects the stale heartbeat and resets it. If a run was interrupted
mid-build, the frontmatter state (`implementation_status`) is still valid and the resumable engine
picks up from where it left off without rebuilding `VERIFIED` work orders.

## Concurrent sessions on one repo (DR-093)

Two sessions (two agents, or two owner windows) on the **same working tree** collide: one session's
half-built, unformatted or knip-dirty WIP REDs the other's `verify-before-stop` gate, and both need
the same append-heavy shared files. Rules:

- **Isolate by default.** A second concurrent session works in its **own git worktree** (reuse the
  review-worktrees root pattern, DR-090) or its own branch, then merges — so neither session's
  uncommitted WIP can break the other's gate. Sharing one tree is the exception, not the default.
- **Never sweep another session's WIP.** Do NOT `git add -A` / `git commit -a` another session's
  incomplete files into your commit, and do NOT edit another session's uncommitted files to force the
  gate green — stage only your own paths.
- **Append-only the shared logs.** `decision-log.md` (every area), `factory/decisions/registry.yaml`
  and `plugin/.claude-plugin/plugin.json` are top-insert / append-only with a fresh dated block;
  never rewrite an existing entry, so two sessions add adjacent blocks instead of clobbering.
- The gate is owned by one session at a time: don't end-turn-gate against another session's in-flight
  WIP (it will flap until they land).

## Parallel manual sessions — worktree isolation + merge queue (DR-096)

DR-093 states the *policy* (isolate or serialize); this section is the *operational standard* that
makes it turnkey, **propagable to every project**. It targets the owner's real workflow: **N independent
natural conversations** ("make a plan… ya, ejecuta"), each launched by hand to advance several things at
once, **outside `/implement`**. Do not confuse the two parallelisms:

| | `/implement` (DR-060/086) | Manual parallel sessions (this section) |
|---|---|---|
| Who coordinates | a central engine | nobody — independent conversations |
| Isolation | by construction (disjoint `artifacts` + single-writer commit) | by **git worktree** (each session its own) |
| Concurrency rule | **one** build at a time (§9 guard) | **N** sessions at once, each isolated |
| Gate | engine owns it per-FRD + close-out | each session's own gate, in its own tree |

`/implement` is collision-safe by construction, so it does **not** use worktrees (and §2 explains why a
worktree would hurt the coordinated engine). The manual case is the opposite shape — uncoordinated, no
disjoint-artifacts guarantee — so worktree isolation is exactly right (Claude Code's own *agent-teams*
guidance: "worktrees are for independent, human-run sessions"). The two never conflict: a manual session
in its worktree isn't touching the main checkout, and the `merge.lock` here is analogous to but separate
from the `build.lock`.

**Why isolation, not a smarter gate.** The gate is **whole-program**: `tsc --noEmit`, `knip`, `madge`
and the Playwright visual baselines read the *entire* tree, so any in-flight WIP from any session
contaminates everyone's gate (a parallel session's `globals.css` edit fails another session's
`/manual` visual baseline — observed live, 2026-06-26). You cannot scope your way out in TypeScript:
`tsc` is whole-program. **Only isolation — the other session's file not being on your disk — makes "my
gate sees only my work" true, and is what lets each parallel session actually reach GREEN, not merely
"be blamelessly blocked."**

### 1. Self-isolation is a per-session REFLEX (no orchestrator)

Isolation is **not** an upfront "launch N agents" call — it is a default behavior of any session about
to change code, encoded as a standing rule in the **project overlay** (`CLAUDE.md`/guide/`AGENTS.md`):

- **Trigger = the SAME frontier as the write-gate.** A change significant enough to route through a
  skill (behavior, a canonical doc, state) is significant enough to isolate. Micro-edits — a typo, a
  comment, local config, a throwaway experiment — stay in-tree. No new decision boundary; reuse the one
  the overlay already defines.
- **The agent enters the worktree ITSELF** the moment it transitions from planning to executing
  ("ya, ejecuta" → isolate **first**, then edit, so no uncommitted work is stranded by the
  branch-from-a-commit base). This is `EnterWorktree`'s sanctioned path ("project instructions direct
  it") — never a worktree for a read/debug/answer turn.
- **Default-on, not detect-then-isolate.** Start-time "is anyone else active?" detection is racy (two
  sessions each see "solo", then collide). Isolating by default is deterministic and cheap (below).

### 2. Bootstrap on entry — reconstitute what git doesn't carry

A worktree checks out **tracked files only**; everything else must be reconstituted, cheaply:

- **`pnpm install`** over the shared content-addressable store — sub-second, **hardlinks** (no
  re-download). **Never** symlink `node_modules` across worktrees, and keep **`.next` per-worktree** (a
  shared/symlinked one breaks Next's HMR).
- **`launch.json` on autoPort** (below) — generated per worktree, named `*-<slug>`.
- **Secrets** need no copy: they live **outside any repo** (SOPS+age, `~/.config/pandacorp/`,
  `external-services.md`), so the worktree runs the same `sops exec-env` as the main checkout.
- **External data is referenced, owned state is isolated.** Mission Control is stateless — it points
  `PANDACORP_FACTORY_ROOT` at the real factory and reads live data (it does **not** copy it into the
  worktree, whose `cwd/..` would be empty). A stateful project isolates its DB per worktree (§4).

Cost is bounded and predictable: ~1–4 min of setup + one extra gate run per session, paid concurrently
in each worktree — far cheaper than the **unbounded** waste of an agent flailing on a foreign red, or
worse, "fixing"/masking another session's WIP. Practical ceiling ~4–5 concurrent sessions before
machine/rate-limit pressure dominates.

### 3. Ports — fixed for the canonical/stateful/callback, autoPort for the ephemeral

`factory/ports.yaml` reserves a 10-port block per project (its offset map already anticipates worktrees:
`+0 app agent`, `+1 app review`, `+2/3 Postgres`, `+4/5 Redis`). The rule by service kind:

- **Fixed reserved port** — the **canonical/always-on** instance, stateful backing services (DB,
  Redis), and anything an external party must reach at a known URL (OAuth callbacks, webhooks, CORS
  allowlists). The reserved block prevents **different projects** colliding.
- **autoPort** (`autoPort: true`, the OS assigns a free `PORT`; the app must **read `PORT`** — remove
  any hardcoded `--port`) — every **ephemeral/parallel** copy of one project. N worktrees never collide.

An internal tool with no external callbacks (e.g. Mission Control) may run even its canonical instance on
autoPort. To preview a worktree before merge: it is already a full checkout — run *its* dev server on
demand on its autoPort; mark a task "hold for owner" to keep the worktree on disk for review before it
merges. No "infinite previews".

### 4. Per-worktree state isolation (stateful projects)

The worktree isolates files + git, **not** a database. Parallel worktrees of a DB-backed app each point
`DATABASE_URL` at `<app>_<slug>`, cloned in sub-seconds from a connectionless `<app>_template`
(`CREATE DATABASE … TEMPLATE` — full isolation, no migration re-run, far lighter than a container per
worktree). Hard caveat: the template must have **zero active connections** during the clone, so
branch-creation serializes. `testcontainers`/`pg_tmp` own the *test* layer; Neon branching is the
CI/preview option. A stateless project (the MC case) declares "none".

### 5. The serialized merge queue (`merge.lock`)

Reunite branches through **one serialized writer** — the single-writer principle of §2, at *merge*
granularity. When a session's worktree work greens (its own gate passes), it joins the queue
**automatically**; the owner just sees "done and merged". Behind an atomic, freshness-stamped
`.pandacorp/run/merge.lock` (atomic `mkdir`, reclaimed when stale via `-mmin`, exactly like `build.lock`):

1. **Rebase** the branch onto the current `main` tip.
2. Run the **integration gate** (`verify.sh`) on the combined result.
3. **Fast-forward merge → `main`** if green; **remove the worktree + branch**.
4. Release the lock.

Because each merge advances `main`, the next holder rebases onto the **new** tip — the merge-queue
invariant ("frozen + up-to-date target"). A textual conflict git's 3-way merge can't resolve (`git
rebase`/`merge` exits non-zero, `<<<<<<<` markers) is **HANDED BACK, never auto-forced**; the agent may
auto-resolve only when it can read both diffs/intents **and** the gate then passes.

**The integration gate is the arbiter** of textual/type/test correctness — a clean *textual* merge can
still fail to compile (the CoAgent risk), so green-on-the-merged-result is the real bar. It **cannot**
close the **semantic-conflict** gap (two changes green alone, green merged, wrong together — CI checks
code against *your tests*, not an independent oracle). Mitigate, don't pretend to eliminate: strong
typing (a free fast semantic check), **seam tests on the contracts two changes share**, small/frequent
merges, and human review of the merged diff on same-region overlaps. Auto-merge holds for disjoint+green;
it **escalates** on same-region or gate-red. This is the same accepted limit as any merge-queue with CI.

### 6. Attribute every red — "not-mine → report, don't fix"

Even with isolation as the default, a session may end up in the shared tree (a micro-edit, or the owner
working the main checkout). So: a session **stamps the gate state at start**; on a Stop-hook RED it
attributes failures to **its own changed files vs. a foreign/pre-existing red** (the start stamp +
`git status` ownership). A failure outside the session's scope is **reported, and the session stops — it
never edits, nor `--update-snapshots`-masks, another session's WIP** (DR-093's no-sweep rule, made
executable). Inside a worktree this is mostly moot (the foreign WIP isn't on disk); it is the safety net
for the shared-tree fallback.

### 7. Visibility — never silently strand a worktree

The owner runs several conversations at once, steps away, and might forget one. Committed work is never
*lost* (a branch persists in git independently of the conversation), but it can be *forgotten*. The
defense rests on one **invariant** (recalibrated 2026-07-02): **a surviving worktree with an UNMERGED
branch or a dirty tree = work not yet in main**. `merge-queue.sh` deliberately does NOT delete the
worktree it merges — the invoking session is standing INSIDE it, and deleting a live session's cwd
dangles it (the next message dies with "Path … does not exist" and every background task is killed with
the forced restart; owner-reported, recurring). After a successful merge the script instructs the agent
to call `ExitWorktree(action: remove)` — the harness-level cleanup that ALSO restores the session cwd;
if that no-ops (a restarted session lost the binding), the fallback is an outside
`git worktree remove --force <wt> && git branch -D <branch>`. A fully-merged, clean leftover is
therefore a harmless session shell: `pending-work.sh` lists it apart as removable and never counts it
as pending. Three layers turn the invariant
into something the owner can't miss:

- **The manifest.** A gitignored registry under `.pandacorp/run/worktrees/` lists live worktrees (branch,
  port, task, started-at), written on entry by `worktree-bootstrap.sh` and removed on merge. Each session
  reads it on start (awareness: "2 other sessions active, here is their scope").
- **The pending-work check — `.pandacorp/pending-work.sh`.** The bullet-proof, runnable-now query:
  unions surviving worktrees (pending even with UNCOMMITTED work) with `git branch --no-merged <default>`
  (the branch outlives a swept worktree). Prints a table — branch · commits-ahead · age · status
  (🟡 in-progress · 🟢 ready-not-merged · 🔴 stale past `PANDACORP_STALE_HOURS`, default 3) — plus `--json`
  (for Mission Control to aggregate across projects) and `--notify` (a desktop notification + non-zero
  exit when anything is stale; drive it from a `/loop` or cron for a proactive nudge).
- **Mission Control surfacing.** PRIMARY = a **global, ambient indicator in the persistent shell**
  ("⎇ N pendientes", visible from every screen, alerts on stale) → opens the cross-project list; SECONDARY
  = a per-project breakdown in the **project's summary tab**. Not buried in one tab — the owner's fear is
  *not looking*, so the signal must be global. (The MC UI is a product feature via `/iterate`; the check +
  manifest + `--json` are the data layer it reads.)

### 8. The propagable contract (every project declares 3 things)

A project becomes parallel-safe by declaring, in its blueprint/overlay — injected like any other
standard, materialized at `/scaffold`/`:architecture` which already write `ports.yaml` → `launch.json`/
`.env`:

1. **Ports** — which services are fixed-reserved vs. autoPort (§3).
2. **A reproducible bootstrap** — one command reconstituting everything untracked (install + secrets +
   migrate + worktree `launch.json`) (§2).
3. **Per-worktree state isolation** — the DB strategy (§4) or "stateless, none" (the MC case).

### 9. Enforcement — the rule can't stay soft (DR-099)

§7's self-isolation is only a *documented* rule, and a documented rule gets rationalized past ("the tree
is quiet, I'll edit main directly") — leaving uncommitted WIP in the shared checkout that REDs another
session's gate (the exact failure §7 exists to prevent). Worse, a rule added mid-session isn't live in an
*already-running* session. Three mechanisms turn the rule into something an agent meets in the loop, not
just in a doc:

- **Edit-time isolation nudge (producer side).** The PreToolUse write hook
  (`plugin/scripts/warn-adhoc-write.sh`) detects when product CODE is edited directly in the SHARED main
  checkout (its git-dir has no `/worktrees/` segment) outside an active build, and reminds the agent to
  isolate FIRST (`EnterWorktree` → edit → `merge-queue.sh`). Proactive + attributable (it is THIS
  session's edit), so "looks quiet" can't silently strand WIP. **Non-blocking** — a hook can't reliably
  tell a significant change from a micro-edit, so it nudges every shared-tree code edit rather than
  trapping legit work; suppressed inside a worktree and during an active build (the engine edits main
  in-place by design, DR-060).
- **Loud merge hand-back — to the OWNER, in the conversation.** A merge that can't LAND is the session's
  OWN finished work stuck outside `main`: if the owner never hears, the work is silently lost when the
  conversation ends. So the hand-back is loud on **two** channels: (a) `merge-queue.sh` fires a desktop
  notification on any non-precondition hand-back (rebase conflict 10 / red gate 11 / busy main 12) so it
  survives a scrolled-past message; and (b) **the agent MUST surface it IN THE CONVERSATION immediately** —
  a desktop notification is easily missed. On any hand-back the agent stops and tells the owner, in plain
  language: *what* is blocked, *why* (the real reason — a foreign red on the build's files, a conflict, a
  busy main), that **the work is preserved** on its branch/worktree (nothing is lost), and what's needed
  (the owner's decision, or the condition to retry — e.g. "main goes green"). This is the owner's
  call to make; the agent does **not** go off doing silent workarounds (deploying elsewhere, sitting on it,
  or quietly retrying forever) without first telling the owner the merge is blocked. **This is NOT the
  cross-session noise the conversation-isolation rule below suppresses** — that rule silences OTHER
  sessions' reds; a blocked merge is THIS session's own deliverable and the owner must know. (Complements
  `--notify` on `pending-work.sh`, which covers the *forgotten* worktree.)
- **Conversation isolation.** An agent handles a FOREIGN red silently (recognise via `git status`
  ownership, never touch/mask — §7) and does NOT narrate to the owner what OTHER sessions are doing:
  cross-session status is PULL (Mission Control), never noise pushed into a conversation; and never
  reports work as "done" until it is in main. **At commit time:** when `git status` shows files this
  session did not touch (foreign WIP), `git add` ONLY this session's own files (never `git add -A`) and
  commit — do NOT ask the owner whether to commit, do NOT mention the other session's files. Committing
  only your own files is correct and permission-free (it leaves the foreign WIP untouched); pausing to
  narrate it or ask is the noise this removes.
- **Gate-level silence on foreign reds.** Conversation isolation can't rely on the agent's goodwill —
  the Stop gate (`verify-before-stop.sh`) itself used to DUMP the foreign red into the conversation,
  forcing the agent to see (and relay) it. Now the gate ATTRIBUTES first: `warn-adhoc-write.sh` records
  every edit of the session to `.pandacorp/run/sessions/<session_id>.touched` (gitignored), and on a red
  the gate compares the dirty + blamed files (by basename) against that record. If NONE of the session's
  edits are implicated → it ALLOWS THE STOP SILENTLY (logs to `run/foreign-red.log` for PULL, no stderr).
  **Fail-closed:** a red touching a file the session edited, or one it can't attribute (no record), still
  BLOCKS. Net: the owner is interrupted ONLY by their own session's reds; a foreign red never reaches the
  chat. (The needs-a-decision case — an unresolvable conflict — is surfaced by the loud hand-back, not the gate.)

Canonical surfaces: this section; `${CLAUDE_PLUGIN_ROOT}/templates/shared/.pandacorp/merge-queue.sh`
(the queue + loud hand-back) + `worktree-bootstrap.sh` (the reconstitution); `plugin/scripts/verify-before-stop.sh`
(foreign-red attribution) + `plugin/scripts/warn-adhoc-write.sh` (edit-time isolation nudge); the project
overlay (`guide.md.tpl`, the self-isolation + conversation-isolation rules); `docs/proposals/18`.
