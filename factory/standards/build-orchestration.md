# Build orchestration standard (DR-050)

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

**Disjoint artifacts within a wave — declared and ENGINE-ENFORCED (DR-060).** Work orders that build
in parallel must NOT write the same file/module — parallel implementers collide (a real failure mode,
not theoretical: e.g. four WOs all creating one `lib/x.ts`). Each work order therefore **declares an
`artifacts: [globs]` frontmatter field** — the files/dirs it writes. The **engine enforces
disjointness from that field**: when it builds a wave it computes the artifact sets and **serializes
any WOs whose `artifacts` overlap into different waves** (the overlapping WO waits a wave instead of
racing). The Build Plan should still be **disjoint by design** — the architect designs wave-parallel
WOs with non-overlapping artifacts, and prefers merging genuinely-coupled siblings into one coarse WO
— but the engine is the backstop: an overlap left in the plan is serialized, never raced. This rule
also nudges granularity coarser, the right way.

**Per-WO API contract (DR-060).** Each backend work order writes its own contract at
`docs/api/<wo-id>.md` (e.g. `docs/api/WO-03-002.md`), NOT a single shared `docs/api.md`. The old
shared file was itself an overlapping artifact: N parallel agents racing one file caused lost-update /
torn-read. The per-WO file is in the WO's own `artifacts`, so it's disjoint by construction; the
frontend WO that consumes a contract reads the **specific** provider WO's file (it knows the id from
its `Dependencies`).

**Single-writer commit — Option B, NOT worktrees (DR-060).** The build workers run in parallel on ONE
shared working tree but **never call git**; after a wave, the engine commits the wave's green work
orders through **one serialized writer** (each WO staged by its own disjoint files, one commit each).
This kills the `git index.lock` race with no per-agent worktree and **no merge**. Worktree-per-agent
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

## 4. Hand-off (`## Status Note`)

When a work order closes it writes a hand-off in its `## Status Note`: what it built, the
interfaces/contracts it exposes (names + signatures), the integration seams, and which tests cover
it. The next agent reads the hand-off instead of re-reading all the prior code.

## 5. Test per FRD, not per work order

The build engine reviews and tests **per FRD**, not per work order:

- Building a work order runs only **its own fast self-test** (its tests + tsc) → marks it `IN_REVIEW`.
- When all of an FRD's work orders are `IN_REVIEW`, run **one review + test pass over the whole FRD**,
  which also exercises the work orders **together** (real integration). The gate's tests are **focused**:
  `verify.sh --since <last_green>` runs biome + tsc globally but only the vitest tests **affected since the
  last green** (fast, and scales as the suite grows — it does NOT re-run the whole suite every gate). The
  **full** suite runs once at **close-out**. On pass → every work order + the FRD become `VERIFIED`.
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
- **Visual-fidelity gate (DR-056) — does the build MATCH the mock, not just render clean.** When the
  feature has an approved mock (`docs/frds/<frd>/mocks/`), the smoke layer is upgraded to a real
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
  pass. Ships VERBATIM (`e2e/responsive.spec.ts` + `e2e/_responsive-helper.ts`, propagated by `blueprint`,
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
  **deterministic gate is the block**. Ships VERBATIM (`e2e/shell.spec.ts`, propagated by `blueprint`,
  conformance-checked by `upgrade`; `e2e/shell.ts` is the per-project seed); canonical in
  `factory/standards/design.md` §5b + `quality.md`.

## 6. How a run stops — health & budget, never a feature count

The build **runs to completion** by default (owner decision 2026-06-16). It does NOT stop after N
features: one feature can cost 10x another, so a count protects neither tokens nor progress. A run
stops only when:

- **Nothing is left** — every FRD is `VERIFIED` → `phase: release`.
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
- The engine attempts **exactly ONE in-place patch** (`attemptPatch`, opus + `xhigh`): fix only the named
  finding on the EXISTING build, make the RED-proven test pass, then **re-gate WHOLE-PROJECT** — the full FRD
  adversarial + integration pass AND a whole-project `knip` + `biome` + `tsc` (NOT `verify.sh --since`: a dead
  export the patch leaves must not slip to a sibling FRD's global gate — the red-team-A fix). It commits + sets
  the WOs `VERIFIED` (and resets their `reopen_count: 0`) **only on whole-project-clean**; the patch runs
  **synchronously inside this FRD's gate step**, so a sibling never sees broken committed code — DR-070's true
  invariant ("never broken-committed whole-project") is preserved without a revert.
- **Only if the patch can't green it whole-project** does the engine fall back to `revertAndReopen` (the DR-070
  path): set the WO `PLANNED`, **increment `reopen_count`**, and revert its files to `last_green_sha` — surgical
  `git checkout <sha> -- <files>` + `git rm` for newly-created files, **never a whole-tree hard reset** (that
  would discard verified siblings) — committed with the status change, so the next pass rebuilds it from a clean
  green base. **One unified budget:** `reopen_count` is the single counter (the in-place patch is a sub-step of
  one reject cycle, NOT a second axis — this avoids the nesting/non-termination the red team flagged); at
  `MAX_REOPENS` (default 3) the gate BLOCKs `needs-owner` instead of grinding.

**Model selection — adaptive escalation within the mode (DR-073).** The mode's `P.worker` is the **floor**, never
downgraded. `pickWorkerModel(wo)` escalates a work order's build to **opus** when **either** it is a-priori hard
— `difficulty: high` in the WO frontmatter (HYBRID, owner decision; the rubric is in `work-orders`) — **or** it
has already failed once — `reopen_count >= 1` (empirical: a sonnet build that didn't pass is unlikely to pass
again, so raise the model for the retry). The in-place patch always runs on opus. **Cost-weighted brake (the
red-team-B fix):** `maxAgents` counts AGENTS, not tokens, so an opus escalation would silently blow the token
budget while the counter reads low — so `agentSpawned` is **weighted by model cost** (opus ≈ 3 cost-units), making
`maxAgents` brake on a token-proxy. Every escalation is logged (`⤴ opus: <wo> (difficulty=high | reopen=N)`) so
spend is visible. A-priori difficulty is a *prior*; `reopen_count` is the *empirical* correction, so a
mis-estimated `medium` WO still escalates once it actually fails.

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
  wakes on events, so the latido is scheduled separately (a `ScheduleWakeup` timer): WOs done/total, the FRD
  in progress, rough spend, "all green". Silence reads as "stuck" to the owner — the periodic latido is what
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
(DR-050 §9), a **lease + heartbeat + TTL** check with a **fencing token** (the run-id) so a zombie run can't write
stale state; and even that decision is safe-when-wrong (a wrong launch aborts on the guard; a missed launch just
leaves the change queued).

**The consumer — the supervisor drains + routes at each safe point** (and before every relaunch). It takes **only
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

## 8. Templates

The standard is embodied in `${CLAUDE_PLUGIN_ROOT}/templates/docs/`: `prd-template.md`,
`frd-template.md`, `blueprint-template.md` (with the Build Plan), `work-order-template.md` (with the
Status Note). The product-phase skills (`spec`/`blueprint`/`work-orders`) generate from these; the
build engine (`implement`) consumes them; `iterate`/`new-version` reopen work orders through them.

## 9. Concurrent-run guard (heartbeat-based lock)

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
