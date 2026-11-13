# Build orchestration standard (DR-050)

> Domain: Quality/Process · Severity: **MUST** · Enforcement: planning/readiness gates + the runtime-neutral CLI and its deterministic suites; **factory-internal (process) — not injected** except the session-isolation contract carried by the overlay.

This standard owns durable planning, work-order state and session isolation. Runtime policy lives in [build-engine.md](build-engine.md) **BUILD-7..BUILD-15**: entry/scope, cards, planning/admission, review, quota, doubts, landing, relay and failure recovery. Command/schema interfaces live in [build-engine-cli.md](../../plugin/docs/build-engine-cli.md). Do not copy the engine's thresholds or routing tables here.

From plugin 10.0.0, `/pandacorp:implement` is the single entry for a feature, change, bug, pending plan or resumed run. Saving a request for later creates a draft card plus `card check`; it does not start construction. The CLI never drains unrelated cards into the selected scope.

The retired executor's text is recoverable at tag `archive/engine-dynamic-workflows-v9.157.0` (commit `1477e9a5`); restoration is an owner decision. See [engine-v1-reactivation.md](../../plugin/docs/engine-v1-reactivation.md). Its launchers, flags and simulated workflow topology are not an alternative operational contract.

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
hand-set `VERIFIED` without the FRD gate passing. Reopening work is a governed CLI transition inside the selected scope; workers never edit build state by hand.

**Source of truth — the work order, always (DR-050).** The **work order** is the atomic source of
truth: its `implementation_status` is canonical. An FRD's (and blueprint's) `implementation_status`
is a **DERIVED rollup** of its work orders, never an independent state — `VERIFIED` iff **all** are
`VERIFIED`; else `BLOCKED` if any is `BLOCKED`; else `PLANNED` if any is `PLANNED`; else `IN_PROGRESS`
if any is; else `IN_REVIEW`. **On any discrepancy between an FRD and its work orders, the work orders
win** — the FRD field is a *cache* of the rollup, trustworthy on its own only when it reads `VERIFIED`
(only the gate writes that). "**Done**" means `VERIFIED`: a work order is done when `VERIFIED`, an FRD
when **all** its work orders are, the project when all FRDs are — never read "done" off an FRD field
that hasn't been re-derived. The CLI owns rollup commits on the integration branch. Readers needing current progress derive from that branch's work orders and the active run snapshot, rather than treating the main checkout's last landed rollup as live. `.pandacorp/status.yaml` on `main` changes only at landing; it is not a live lock.

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
  into a sibling WO (at plan time). A 1-AC cosmetic change is a scoped touch or a WO inside an
  existing FRD, never its own feature.
The factory's coarse policy pins both bounds. These historical measurements guide planning; they are not runtime admission constants. The current planner's dependency, chain and artifact-overlap rules are owned by [build-engine.md](build-engine.md) BUILD-9.

## 3. The Build Plan lives in the blueprint (per FRD)

Each per-FRD `blueprint.md` MUST carry a Build Plan: work-order dependencies, intra- and cross-FRD order, artifact ownership and integration order. The engine reads the declared plan; it does not invent dependencies at runtime. Machine-readable `dependsOn` on every WO is the DAG; the prose explains it.

**Foundation first (DR-057/DR-075).** Plan shared primitives and the persistent app shell/navigation before the surfaces that consume them. Derive the complete inventory from `docs/design/components.md`, the frozen mocks and FDDs. Declare foundation dependencies explicitly on consuming WOs; a `foundation: true` label does not replace the dependency edges. A deliberately authored shell FRD must trace to PRD requirements; do not emit an orphan shell FRD solely to fit the scheduler.

Keep a living `docs/design/components.md` with names, paths, props and variants. Builders read it before creating UI components: reuse, adapt, then create only when absent. The reviewer's quality lens rejects duplicated primitives and missing shell/navigation. These are architecture/readiness and review obligations; do not claim that the CLI implements a separate automatic foundation-completeness pass.

Declare each WO's `artifacts` and exact EARS `source_requirements`. No parallel writers share a checkout. The current planner enforces dependencies, conservative artifact-overlap exclusion, barriers and scoped chains through `plugin/runtime/build/planner.mjs`; admission is BUILD-9.

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
gate (§5) and the failure policy (BUILD-15 in [build-engine.md](build-engine.md)) are CURE.

## 4. Hand-off (`## Status Note`)

When a work order closes it writes a hand-off in its `## Status Note`: what it built, the
interfaces/contracts it exposes (names + signatures), the integration seams, and which tests cover
it. The next agent reads the hand-off instead of re-reading all the prior code.

## 5. Test per FRD, not per work order

A builder runs its own fast self-test and writes its Status Note; this is handoff evidence, never independent verification. The CLI owns the WO transitions and commits. Feature review exercises the FRD's WOs together against the complete normative contract: requirements, numbered ACs, invariants, edges, limits, errors and exclusions. Missing contract inventory or applicable boundary coverage is RED. A touch uses the review unit defined by BUILD-10.

Exactly one reviewer is selected under [build-engine.md](build-engine.md) BUILD-10, including its cross-company, quota and degraded-review rules. The reviewer re-runs evidence and writes adversarial tests. Deterministic gates stay fail-closed; `quality.md` and `design.md` own project testing and visual obligations. A green self-test cannot substitute for review or the landing gate.

## 5a. Concurrent gates and pinned snapshots

The CLI schedules reviews and G2 jobs against pinned integration snapshots, not another worker's changing checkout. See BUILD-9/BUILD-10 and `plugin/runtime/build/next/g2.mjs`. No coordinator implements an additional scheduler or shares a writable checkout between workers.

## 5c. Parallel FRD gates

Legacy gate-slot flags and semaphore procedures are retired. Admission and heavy-tool capacity have one owner: BUILD-9. Read `status`/`admission.json`; do not infer available slots from an old mode or a specific host's RAM.

## 5d. Deterministic build plumbing

The CLI owns frontmatter transitions, commits, journal, state projection and gate harvesting. Its implementation is `plugin/runtime/build/**`; the supported interface is `plugin/scripts/pandacorp-build.mjs`. There is no second mechanical executor. See BUILD-7, BUILD-9 and BUILD-13.

## 5b. The phase model & `deploy_target` (DR-085)

The lifecycle is research (pre-project) → `product` → `design` → `architecture` → `implementation` → `release`. `release` is the launched/terminal phase; there is no separate operation phase. Construction owns security, quality and the explicitly approved telemetry scope; release performs deployment and the launch plan. Never infer launch merely from a finished run or verified target.

`deploy_target: internal | external` records the deployment kind, not a phase. Internal tools run locally; an external production deployment requires the owner's order. A targeted build does only its selected scope. Runtime audit/close-out scheduling is BUILD-10/BUILD-13/BUILD-15; only the release skill may claim a deployment actually occurred.

## 6. How a run stops

See BUILD-11..BUILD-15 for quota, parked units, human gates, explicit stop/resume, the three-execution failure budget and engine-fault recovery. Only build and patch executions spend that budget. A red G2/G3 repairs the attributed failing work, preserving healthy WOs; an unattributed gate failure has its own bounded fallback. Never rebuild an entire FRD to repair a localized red.

Memory pressure reduces admission rather than killing live workers or pausing work that can safely continue. Disk and human gates retain their safeguards. Adaptive steps, the performance journal and the disk floor live only in BUILD-9; source: `plugin/runtime/build/admission/**` and `perf.mjs`.

## 7. Coordination and the `drive` relay

The session drives CLI-returned actions. `drive` is the Codex-only relay, armed and transferred under BUILD-14; it uses the same run id with a higher lease epoch and fences the previous holder. It never dispatches Claude. A relay is not evidence of unattended survival on a real host: report only what was exercised. Runtime boundaries live in `agent-portability.md` PORT-5.

## 8. Scoped requests and owner answers

`implement` is the build entry; `.pandacorp/inbox/changes/` holds cards with readers, not an automatic drain. A card is selected by the scope rules of BUILD-7/BUILD-8. Saving a draft uses `card check`. New unrelated requests wait for a later selected run.

Owner questions are front-loaded or handled under BUILD-12. Parked questions have a durable decision record, and `.pandacorp/inbox/decisions.pending.md` mirrors tracked decision files for the main-checkout reader without writing tracked files there. `decide` uses the CLI's `answer` for questions in `open_questions`; editing the mirror is not an answer. A nested project's engine-failure handback stays in its own ignored run state, not the factory's main checkout.

## 9. Convergence — the split gate (DR-072/DR-129)

**Blocking corrections:** requirements/behavior, security, tests/types/lint, smoke/rendering, missing shell or sections, duplicated shared primitives and gross structural divergence. A measured mismatch against the project's recorded fidelity target blocks unless the owner selected advisory mode.

**Advisory visual nits:** judged size, spacing, shade or density gaps go to the visual punch-list and never reopen a healthy WO. A deterministic screenshot regression remains a hard gate. Visual polish stays bounded to the approved design and the selected scope; verify changes and hand residual nits back honestly. Review routing and execution budgets are BUILD-10/BUILD-15, not an independent reopen counter here.

A dashboard must tell the truth about freshness, real-change latency and loss of signal. See `observability.md` and `quality.md`; engine liveness comes from the fenced lease, not a frozen `running` flag or a retired supervisor tick.

## 10. Templates

`plugin/templates/docs/{prd,frd,blueprint,work-order}-template.md` embody the document contract. `spec`, `architecture` and `work-orders` author the plan; `implement` builds it through the CLI and internal engines. Preserve independent review, the Status Note and source traceability when reopening work.

## 10b. Testing the executor

`plugin/scripts/test-build-v2-*.mjs` exercise fixture projects and fake workers. The integrator discovers them through `plugin/scripts/run-engine-tests.sh`; an individual task runs its acceptance subset. Fixture success does not establish live-provider, detached-process or overnight reliability. Historical executor suites are recoverable from the retirement tag, not active gates.

## 10c. Invocation mechanics

Read `plugin/skills/implement/SKILL.md` and [build-engine-cli.md](../../plugin/docs/build-engine-cli.md). Use `node <plugin>/scripts/pandacorp-build.mjs` for detection, preflight, start/resume and the returned actions. No mode keyword or alternative launcher selects another engine. Never invent a background mechanism when the runtime only supports attended execution.

## 11. Concurrent-run guard

The epoch-fenced lease is the only live-run authority (`plugin/runtime/build/state.mjs:169` renews/fences through `build-state.mjs`). `status` exposes lease freshness and the active run; a committed `running` flag on `main` is not a lock. Transfers within an authorized run and cold continuation of released state are different operations (PORT-5/BUILD-14). Never upgrade a project while a build is live, or mix plugin versions across its sessions: after plugin update, restart or close every session working on that project before continuing.

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
  are shared canonical files: serialize edits with the owning session and read the latest contents before writing. Logs get new dated entries; registry rules may be amended explicitly. Plugin manifests are generated from `plugin/runtime/plugin-metadata.json`, never hand-edited.
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
| Isolation | isolated unit worktrees + one integration writer | by **git worktree** (each session its own) |
| Concurrency rule | **one** run per project (epoch-fenced lease) | **N** sessions at once, each isolated |
| Gate | engine owns it per-FRD + close-out | each session's own gate, in its own tree |

`/implement` uses unit and integration worktrees under BUILD-9/BUILD-13. Manual sessions use their own worktrees and the same serialized merge queue. Neither topology authorizes tracked writes to the main checkout during a build. The merge lock and build lease protect different operations; neither is a substitute for the other.

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

- Run **`.pandacorp/worktree-bootstrap.sh`**. It reuses dependencies only with matching lockfile content and compatible platform/runtime, trying `pnpm install --offline --frozen-lockfile` before a frozen online install. Dependencies use pnpm's shared store; never symlink `node_modules` across worktrees. Build output stays per-worktree. The disk floor and post-gate output cleanup are implemented by `plugin/templates/shared/.pandacorp/{worktree-bootstrap,merge-queue}.sh`.
- **`launch.json` on autoPort** (below) — generated per worktree, named `*-<slug>`.
- **Secrets** need no copy: they live **outside any repo** (SOPS+age, `~/.config/pandacorp/`,
  `external-services.md`), so the worktree runs the same `sops exec-env` as the main checkout.
- **External data is referenced, owned state is isolated.** Mission Control is stateless — it points
  `PANDACORP_FACTORY_ROOT` at the real factory and reads live data (it does **not** copy it into the
  worktree, whose `cwd/..` would be empty). A stateful project isolates its DB per worktree (§4).

Measure setup, gate cost and resource pressure on the actual host; do not infer a universal session ceiling. BUILD-9 owns build admission and its machine-local performance journal.

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
branch-creation serializes. Automated tests use native local PostgreSQL with zero residue under `infra.md` INFRA-9/10; Neon dev is not a test database. A stateless project (the MC case) declares "none".

### 5. Batch integration through the serialized merge queue (DR-141, BUILD-4)

**Rule (MUST; enforcement: landing-session checklist).** When two or more finished branches
are waiting to land, each already independently verified on its own branch, combine them in
**one integration branch from the current `main`**. Merge every selected branch, resolve conflicts,
and run the **full integration gate ONCE on the combined result**, through
`bash .pandacorp/merge-queue.sh` from that integration worktree. Never run the queue/full gate
once per waiting branch. A single finished change still lands alone as before. Do not wait for
unfinished work or combine WIP; branch verification and per-FRD review gates remain required.
One session owns the batch and its worktree; source sessions must stop writing the selected tips.

**Manual procedure (existing tooling; no multi-branch CLI).** Record the selected branch names,
immutable SHAs, owning changes and green branch evidence in the landing handoff. Create a fresh
worktree/branch from the local current `main`, bootstrap it, and merge each recorded tip there.
Use `git merge --squash <recorded-sha>` followed by a scoped commit for each source (name the
source SHA and owning change in the commit body). Resolve conflicts from both changes' intent
before committing; unresolved intent is handed back, never forced. Do not run the full gate
between these commits. Squash commits keep conflict resolutions in ordinary commits: the existing
queue's plain rebase must not discard a resolution stored only in a merge commit.

Example (replace the names/SHAs; record evidence first):

```sh
git worktree add -b integration/ready-batch /tmp/project-ready-batch main
cd /tmp/project-ready-batch
bash .pandacorp/worktree-bootstrap.sh
git merge --squash <first-verified-sha>
git commit -m "chore(integration): include first verified change" -m "Source: <first-verified-sha>; owner: <change-id>"
git merge --squash <second-verified-sha>
git commit -m "chore(integration): include second verified change" -m "Source: <second-verified-sha>; owner: <change-id>"
bash .pandacorp/merge-queue.sh
```

The queue remains **one serialized writer**: it locks the shared git directory, rebases the
integration branch onto the current `main`, gates that whole result, fast-forwards `main` only
if green and releases the lock. Keep the worktree while a session is inside it (§7).
Never invoke the queue again on every source branch after the batch lands. Squashed source tips
are not ancestors of `main`: retain those branches and the source-to-integration mapping;
cleanup must not infer safety from the batch landing or force-delete them.

**On RED:** keep the complete batch on its branch, attribute the failing assertion/file/contract
to its owning change (including a conflict-resolution error), repair only that defect, commit,
and re-run the full queue/gate once on the repaired combined result. Repeat only for a new
observed failure within the existing repair budget, never a per-source gate loop. An unknown
owner, unresolved conflict, busy main or exhausted budget gets DR-099's immediate, honest hand-back;
never sweep unrelated failures or mask a red.

**Human gates unchanged:** after external launch, production merge/push still requires the
owner's explicit order for the **selected batch**, and `PANDACORP_OWNER_RELEASE_OK=1` only for
that authorized landing (DR-138). Without it, exit 21 preserves the branch. Never reuse an
approval for additional changes. The existing queue still rechecks on a later authorized retry after
exit 21 or an advanced main; record that safety/authorization retry separately, never as a
per-source gate loop. **Certified tree (DR-146):** the queue's recheck after its rebase is skipped
only when `green-stamp.sh check` proves the rebased tree is byte-identical to one a FULL `verify.sh`
passed in that checkout (clean, no skip-worktree entries, same `verify.sh`, stamp under 12 h); the
log says `[certified-tree]` or `[full-gate]`. An advanced main, a partial/`--light`/`--since` run, a red
run (which drops the stamp), a dirty or bootstrap-overridden tree or a stale/corrupt stamp all run the
full gate. Order the landing as commit → `verify.sh` → queue to benefit. The DR-138 owner check runs
after the gate decision and is never bypassed by a skip. Single-change behavior and all other human gates remain intact.

**How it is verified (binary, review-only):** the landing session checks the recorded source
SHAs/branch-green evidence, the commits including all selected changes, and the queue log: exactly
one full gate for the assembled batch before any repair (the queue's own `[full-gate]` run, or the full `verify.sh` that certified that exact combined tree, after which the queue logs `[certified-tree]`), with each further
invocation linked to an observed red and its scoped fix (or the existing queue’s documented
exit-21/advanced-main safety retry). Per-source queue/full-gate invocations
fail this checklist. `plugin/scripts/test-batch-integration.sh` rehearses the manual procedure
against the real queue (one combined gate, fail-closed red, scoped repair); the checklist, not
this fixture, enforces session compliance. `test-merge-queue-release-gate.sh` guards DR-138.

**Why:** a full suite per already-verified waiting branch multiplies landing latency without
checking the final combined result any better. One combined pass exposes interactions; attribution
keeps repairs bounded. This amends DR-096's per-branch landing default, not the build engine's
per-FRD verification or the factory backlog engine's lightweight per-merge catalog validator.

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
to restore the actual session cwd without removal, before validated DR-145 cleanup;
restore the harness/session cwd WITHOUT removing the worktree, stop its writers, then run the
validated session cleanup below from outside. Never use force removal or force branch deletion.
A merged clean survivor is cleanup debt, reported separately from unmerged product work.
Three layers turn the invariant
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
  *not looking*, so the signal must be global. (The MC UI is a product change through `/pandacorp:implement`; the check +
  manifest + `--json` are the data layer it reads.)

### 8. The propagable contract (every project declares 3 things)

A project becomes parallel-safe by declaring, in its blueprint/overlay — injected like any other
standard, materialized at `/scaffold`/`:architecture` which already write `ports.yaml` → `launch.json`/
`.env.local` (local-only block):

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
  trapping legit work; suppressed inside a worktree and during an active build (the engine owns isolated unit/integration worktrees, BUILD-9/BUILD-13).
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


## Session resource teardown (BUILD-5, DR-145)

**Rule — MUST; enforcement: session cleanup CLI + coordinator close-out checklist.** Register owned worktrees and temporary resources before dispatch. Reclaim eligible worktrees immediately when implementation closes; retain branch refs, reports and pending owner state. Never leave cleanup as commands for the owner, or ask again for the already authorized removal of owned disposable resources. Never widen it to other sessions, shared caches or arbitrary temp files.

**Ordinary manual sessions.** After successful verification and merge, stop owned writers, move the actual session/harness cwd outside the tree without removing it, then execute `session-cleanup.mjs finish`. The protocol lives in `plugin/skills/worktrees/SKILL.md` §Implementation teardown. Cleanup rechecks receipt identity, actual default-branch ancestry (no patch-equivalent/squash inference), locks, process inventory, cleanliness and owner state before removal. Use `git worktree remove` without force; keep branches.

**Engine checkouts.** Runtime removal at landing, finish, stop and attempt replacement belongs to BUILD-9/BUILD-15; pending work remains recoverable on its retained branches. The separate sweeper uses `plugin/scripts/worktree-sweep.mjs:115` (`engineRoot`) and `:275` (`scan`) to recognize eligible terminal run worktrees, including the run-layer carve-out, and `:391` (`cleanEngineWorktrees`) to reclaim them. It preserves live ownership, suspended/non-terminal runs and `waiting_gate`, process cwds, locked/deployed/nested worktrees, dirty files and unknown owner data. Its terminal-tree carve-out can remove a clean unmerged checkout while preserving its branch; this never means the work landed. Do not apply ordinary session ancestry rules as a claim that every engine branch is merged. Follow the current CLI lifecycle for which waiting checkouts must remain, rather than manually deleting them.

**One cleanliness predicate.** Hidden assume-unchanged/skip-worktree flags are not proof of cleanliness. Compare tracked content against HEAD; only validated bootstrap provenance may explain a reproducible skip-worktree override. Ignored files must be known generated caches or exact generated files with unchanged SHA-256 receipts (`register --generated-file`). Preexisting private dotenv and owner-state files are never made disposable by bootstrap. `worktreeCleanReason` in `plugin/scripts/worktree-sweep.mjs:169` supplies the shared check. An unknown file or missing provenance preserves the tree. Never recursively remove `.pandacorp/`, its parent state layer or an archive containing owner records.

**Capability and completion.** Cleanup requires write access to shared git metadata and worktree parents. A restricted worker hands its files back to the capable coordinator; it never changes sandbox mode or protections, clears index.lock/HEAD.lock, or calls EPERM a stale lock. `session-cleanup.mjs run --repo <repo> -- <command> ...` provides an owned temp/cache environment and cleanup in finally; tool-driven sessions explicitly create/register/finish even on partial/error exits. A child shell cannot change the harness cwd.

Removal may take minutes: use a resumable tool process, report progress at least each minute, await the final exit/JSON report and verify directory absence. Never call a yielded/timed-out removal finished or start a second remover against it. Unsafe survivors remain with a nonzero report/receipt; report the reason. Binary checks: `test-session-cleanup.mjs`, `test-session-cleanup-adversarial.mjs`, `test-worktree-sweep.mjs`.

## How it is verified

- Planning/state: `plugin/scripts/test-build-v2-{planner,state,next,cli}.mjs` and architecture/readiness review; frontmatter is checked on the integration branch.
- Runtime policy: the specific `test-build-v2-*.mjs` suites named in `build-engine.md`; historical executor evidence cannot certify the active CLI.
- Landing: `test-batch-integration.sh`, `test-merge-queue-certified-tree.sh`, `test-merge-queue-release-gate.sh`; one combined full gate and the owner's release order where required.
- Isolation/bootstrap: `test-worktree-bootstrap.sh`, the edit-time nudge and the session's ownership checklist.
- Cleanup: `test-session-cleanup.mjs`, `test-session-cleanup-adversarial.mjs`, `test-worktree-sweep.mjs`; finished-run eligibility never authorizes deleting owner state or live/dirty worktrees.
- Standard shape: `bash factory/standards/check-standards.sh`. Policy, doc and Manual propagation are reviewed together before release.

## Verification cost without weaker certification (DR-158)

[Quality: verification cost](quality.md#verification-cost-without-weaker-certification-dr-158)
owns the execution policy: full G3 before main; fail-fast with diagnostic replay; one kernel
verification owner per checkout (contention is infrastructure); fingerprint-bound certified-tree
reuse; one production artifact/server, explicit mobile coverage and audited parallel-safe specs.
The scheduler's G1 remains light, G2 remains scoped, and `--affected` is an attended iteration
option, always partial, never an alternative to the G3 command or a VERIFIED transition.
The queue's certified-tree decision occurs before its port probe; a live verification owner
prevents reuse, and exit 75 must not trigger deletion of the active owner's generated artifacts.
