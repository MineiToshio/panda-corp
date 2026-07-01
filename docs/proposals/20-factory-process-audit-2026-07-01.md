---
title: Pandacorp factory process audit — end-to-end
date: 2026-07-01
status: audit
scope: the factory process end-to-end (discover → spec → design → architecture → implement → release → post-launch → self-learning), plugin skills/agents/templates/hooks, standards/constitution/registry, the state machine. Mission Control app excluded by owner request.
---

# Pandacorp Factory Process Audit — 2026-07-01

Owner-requested full audit of the factory **process** (not Mission Control): find weak spots, stale
documentation, and improvement opportunities across the whole pipeline.

**Method.** Six parallel read-only auditors, each reading its segment in full: (1) front of funnel
(discover/explore/new-idea/recommend/onboarding/sync-portfolio + ideas base), (2) spec→design→architecture
(skills, PM/architect/designer agents, doc templates, DR-100/102 gates), (3) the build engine
(`pandacorp-build.js`) + change flows (implement/iterate/change/bug/decide/sync/upgrade, hooks, scripts),
(4) release + post-launch + self-learning (release/review-launch/adopt/learn/memory, backlog hygiene),
(5) the doctrine layer (constitution, all 17 standards, the full registry, rules templates, 4 stacks),
(6) the end-to-end state machine (every state artifact, writers/readers, versioning discipline).
All findings deduped against `docs/proposals/19-factory-flow-audit-2026-06-30.md`, `factory/backlog/BL-0001..0013`,
and the 2026-06-14 (economic arc) and 2026-06-22 (self-consistency meta-pattern) audits. The highest-impact
claims were re-verified directly (greps/reads) before inclusion.

> **Routing (DR-103).** This is a plane-2 narrative. Its actionable findings become `BL-*` items in
> `factory/backlog/` when the owner approves the improvement plan (§ Plan — candidate items are listed
> there). Nothing was changed by this audit except one micro-fix: stray tool-call tags removed from the
> tail of the gitignored `factory/profile.md`.

## Executive summary

The factory's bones remain excellent — the doctrine core is coherent, the 2026-06-30 fixes verifiably
landed, and the engine is in places *stronger than its own open backlog implies* (BL-0004/0005 are already
fixed in code). But this audit, the first to trace every promise to its mechanism, found that the factory's
recurring disease has a sharper form than "drift":

**The factory writes checks its machinery doesn't cash.** The single biggest pattern — bigger than sweep
decay — is *promise-without-mechanism*: canonical docs assert that a gate/re-check/drain/loop exists, and
the code or skill it names implements none of it. Four canonical docs say `/implement`'s preflight re-checks
the DR-100/102 gates (it checks nothing but marker/overlay/lock); DR-069 promises the build drains the
change queue "at its next safe point" (the engine has zero drain outside opt-in `args.change`, and nothing
clears `rethink_pending`); `infra.md` claims human gates ship as mechanical deny-rules (no rule blocks a
production deploy); DR-047 says agents retrieve factory memory before building (1 of 8 build agents does);
`review-launch` is "designed to run as a /loop job" (nothing schedules it; it has never run once).

Second pattern, confirmed from audit-19 but now measured: **sweep decay** — every rename/redefinition
(blueprint→architecture, DR-069's queue, DR-085's phases, DR-090's worktrees, DR-052's toolchain) left 2–9
stale current-state references, including in the constitution itself. The 2026-06-29 rename log's claims
("every LIVE command reference updated", "no templates/shared file referenced the command") are both false.

Third: **store hygiene doesn't transfer**. The id-collision class fixed for memory on 2026-07-01 (BL-0013)
is live in the backlog *today*: two BL-0010 and two BL-0011, with Mission Control's new fail-loud reader
(commit 4cdc61d) presumably erroring on them, no validator, and no drain mechanism (14/15 items open, 0 doing).

## The seven diseases (cross-cutting)

| # | Disease | Instances |
|---|---|---|
| D1 | **Promise-without-mechanism** — a canonical doc asserts an enforcement/loop that no code or skill step implements | P0-2, P0-3, P1-1..P1-7, P1-13 |
| D2 | **Sweep decay** — a rename/redefinition updated the decision but not every downstream current-state reference | P1-16, P2 cluster A |
| D3 | **Template drift vs mandates** — agents are mandated to produce sections/fields the birth templates don't carry | P1-8..P1-11 |
| D4 | **Stack-A-only enforcement** — the conformance/gate doctrine is only implementable for Next.js | P1-12 |
| D5 | **Store hygiene** — ids, validators and drains exist for one store but not its siblings | P0-1, P1-14 |
| D6 | **Unserialized writers** — only implement-vs-implement is locked; every other `status.yaml`/repo writer races | P0-4, P1-15 |
| D7 | **Open loops** — the economic arc and the learning loop are structurally complete but operationally never turn | P1-5, P1-6, P1-7 |

## P0 — broken today, live impact

### P0-1 · Backlog id collision, live, with a fail-loud consumer
`factory/backlog/` holds **two `BL-0010`** (memory-skill ergonomics · owner-activity-feed noise) and **two
`BL-0011`** (blocked-route redlock · WO summary section), all open. The README's "monotonic, zero-padded"
rule is prose with no mechanism; no validator exists (`plugin/scripts/` has none for the backlog), and the
head commit (4cdc61d) made Mission Control's backlog reader **fail loud on duplicate ids** — the consuming
surface presumably errors on the current store. Ids are the linking currency (`links: [BL-0011]` in
LESSON-0021 is now ambiguous). Same failure class BL-0013 fixed for LESSONs the same day the collision
happened here. **Fix:** renumber the two later files (→ BL-0014/0015), extend a validator to the backlog
(or generalize `validate-memory.sh`), and make filing skills scan for the next free id.

### P0-2 · Two hardening-free paths to `phase: release`
Beyond BL-0012 (the engine's close-out sets `phase: release` after FRD loop + integration + full suite,
**never running the DR-085 hardening pass** — security audit/quality close-out/telemetry): the engine's
**fail-safe branch** (`pandacorp-build.js` ~712–714) fires when the close-out agent died or returned
`done:false` and instructs a worker to write `running:false` "**and phase:release if every FRD is
VERIFIED**" — i.e. release can be stamped **without even the integration review or full suite**, judged by
a sonnet worker. LESSON-0022 documents the first path biting a real project (personal-page-v2). **Fix:**
make `phase: release` writable only by a step that verifies hardening evidence exists (fail-closed in both
paths); BL-0012's fix must cover the fail-safe branch.

### P0-3 · The DR-069 change flow is broken at three joints
The unified change queue — the owner's single front door — does not work as documented:
1. **No executable drain.** The engine has **zero** reads of `inbox/changes/`, `decisions.md` or
   `rethink_pending` outside the opt-in `args.change` block (verified by grep). The drain lives only in
   supervisor prose; the engine's safe points (FRD boundaries) are unreachable by the supervisor (it acts
   between passes). An `expedite` change waits a whole pass — or forever if no supervisor is mounted.
   Nothing anywhere is documented to clear `rethink_pending`.
2. **`/bug` files a status the drain never accepts.** `bug/SKILL.md` writes `status: pending`; the drain
   and the targeted build accept only `ready` (enum: `draft | ready | done`). A bug filed via `/bug` is
   invisible forever. (`bug` also says implement marks it "`resolved`" vs the canonical `done`+archive, and
   redirects features to the hidden `/pandacorp:iterate` instead of `/change`.)
3. **The targeted change build never closes the change.** Engine (~line 230) defers archiving to "the FRD
   gate" — whose prompt contains no mention of `inbox/changes`, `done`, `shipped_sha` or archiving. A built
   change stays `ready` → re-processed next run; `pending_changes` never decrements.
Plus: **the propagated project guide routes around the front door** — `guide.md.tpl`/`AGENTS.md.tpl` send
owners to `iterate`/`bug` directly (`/pandacorp:change` absent, 0 hits), re-creating the concurrent-doc-edit
hazard the queue was built to remove. Audit-19's fix touched only the factory root `CLAUDE.md`.

### P0-4 · `/upgrade` can rewrite the engine and gates mid-build
`change`/`bug`/`iterate` preflights order an unconditional `/pandacorp:upgrade` when the overlay is behind
(DR-048) — and `/change` is *designed* to run mid-build. `upgrade` regenerates `pandacorp-build.js`,
overwrites `verify.sh`/`biome.json`/e2e specs and **commits on its own**, with no check of
`running:`/heartbeat anywhere in the skill. That races the engine's "SOLE git writer" chain (DR-086) and
can change gate semantics between a WO's self-test and its FRD gate. Not covered by DR-096/099 (manual
sessions) or BL-0003 (content downgrade). **Fix:** upgrade preflight = abort/defer if `running: true` with
fresh heartbeat; change/bug preflights defer the upgrade instead of forcing it.

## P1 — materially weakens the process

### Enforcement honesty (D1)
- **P1-1 · The `/implement` preflight re-check is fiction.** `architect.md`, `blueprint-template.md`,
  `build-orchestration.md` §3b, DR-100 and DR-102 all state implement's preflight re-checks the readiness /
  repo-grounding gates. The preflight checks only the DR-045 marker, overlay version and run lock; the
  engine has 0 occurrences of "readiness"/"NEEDS CLARIFICATION". Only `verify.sh`'s marker scan survives.
- **P1-2 · DR-100's readiness gate is self-certified.** It is run by the same `architect` that authored the
  blueprint/WOs (constitution rule 4: agents never check off their own checks). DR-102's step 9b correctly
  demands "a fresh agent, not the author"; DR-100 never got the same treatment, and only 1 of its 8
  conditions is mechanized. Condition 8 (API contracts materialized before consumers) is structurally
  unevaluable at gate time — the contract is authored *by the backend WO at build time* (DR-060).
- **P1-3 · The DRAFT→ACTIVE flip is owned by nobody.** Every gate hangs on "may not move to ACTIVE", yet no
  step in spec/design/architecture instructs the flip, and `work-orders` births WOs directly `ACTIVE`.
  Docs either sit DRAFT forever (making verify.sh's ACTIVE-only marker gate vacuous for the whole spec) or
  get flipped ad-hoc with no gate having run.
- **P1-4 · `/decide` never unblocks.** The engine never reads `decisions.md` (only appends); planner treats
  `BLOCKED` = skip; no skill flips `BLOCKED → PLANNED` on an answered decision. An answered decision leaves
  its WO stranded on every future run short of a hand edit.
- **P1-5 · The production gate is prose-only.** `infra.md` ("Human gates as hard rules") claims gates ship
  as `deny` rules + `block-dangerous.sh`; nothing blocks `vercel --prod`/`flyctl deploy` etc. The factory's
  most important human gate is its softest.
- **P1-6 · The post-launch loop has never turned.** `review-launch` has never run (portfolio business
  columns all "—"); nothing schedules it or `/pandacorp:memory review` (zero scheduled tasks); one portfolio
  row is a full phase behind reality (personal-page-v2 `Fase: product` vs actual `release`). DR-043's
  founding sentence — "the factory ships but never reads results" — is still literally true.
- **P1-7 · Memory retrieval is dead weight.** DR-047's RETRIEVE half is wired into exactly one agent
  (`architect.md`); designer/implementer/backend/frontend/reviewer/test-writer, the spec/design/implement
  skills and the engine contain zero references to `factory/memory/`. No mechanism increments
  `times_applied` (all 22 lessons at 0 — the prune criterion will condemn useful lessons); 0 promotions
  approved ever. Harvest is genuinely alive now (inbox drained, DR-103 routing correct) — the loop's back
  half doesn't turn.
- **The supervisor is load-bearing and optional.** Concretely specified (Monitor poll, heartbeat,
  PushNotification) but nothing asserts it exists; the skill itself recommends direct `Workflow(...)`
  relaunches (supervisor-less). Everything in P0-3, BL-0012's fallback, the phone channel and the budget
  brake depend exclusively on it. DR-069's claimed "fencing token (run-id)" does not exist in any template
  or code.

### Template birth defects (D3)
- **P1-8 · `status.yaml.tpl` never learned DR-069.** It declares `pending_bugs` (dead — no writer since
  DR-069) and lacks `pending_changes` (which `change`/`bug`/`implement` write). `scaffold`/`spec`/`adopt`
  still create `.pandacorp/inbox/bugs/` (never `changes/`); `guide.md.tpl` maps the old tray;
  `librarian.md`/`memory` harvest from `inbox/bugs/`. Every new project is born pre-DR-069.
- **P1-9 · The PRD template lacks five mandated, owner-gated sections:** monetization + "v1 payments yes/no"
  (DR-035), launch market & language (DR-041), unit economics + recorded demand signal (DR-042), activation
  milestone + numeric kill-signals (DR-043), target platforms (DR-074). The PM agent mandates all five; a
  template-following PM produces a "complete" PRD that review-launch can't anchor on (its verdict degrades
  to vibes) and no gate notices. `events-template.md` also lacks the activation-milestone slot;
  `research-template.md` lacks the launch-market section; the spec step-0 demand signal has no named
  artifact to be recorded in.
- **P1-10 · `difficulty` (DR-073) is missing from the WO template and the architecture skill** (only the
  standalone `work-orders` skill mentions it). The engine reads it (default `medium`) — so in the normal
  flow the a-priori opus escalation for `high` WOs silently never triggers.
- **P1-11 · `decision-log.md.tpl` seeds the retired lifecycle** ("product → design → architecture → build →
  release → **operation**") into every new project's decision log; `guide.md.tpl` says "build" for the
  `implementation` phase. (Inside BL-0008's category but not its cited files — flag to that fixer.)

### Doctrine contradictions (D2/D3)
- **P1-12 · Stacks B/C/D are outside the enforcement doctrine.** They ship a prose-only STACK.md (~1 KB)
  with a hand-rolled 4-line `set -e` verify snippet — no canonical verify.sh/biome/knip/canary/e2e files to
  conform against, no doc-lint, no DR-100 gate, no declared browser-gate opt-out. The entire DR-059/076
  conformance thesis ("installed byte-for-byte, upgrade diffs against the template") is implementable only
  for stack A. The day a Hono/FastAPI/scraper project is built, its gates are hand-rolled — the exact
  pre-audit failure mode DR-059 closed. stack-b even instructs the banned `biome init`.
- **P1-13 · Package manager and i18n defaults contradict themselves.** `stack.md` says **npm** while
  infra.md/build-orchestration/stack-a+b's every command say **pnpm**; `stack.md` says next-intl "Spanish by
  default" vs DR-041/conventions/constitution §15 (launch locale from market research). Inside stack-a:
  header says Prisma, install command says Drizzle. Agent-consumed defaults with two values.
- **P1-14 · The constitution itself is stale on the change channel.** §23 + `infra.md` + DR-020 still cite
  the retired `.pandacorp/inbox/bugs/` tray (DR-069 unified into `changes/`).
- **P1-15 · The DR-051 mirror is broken in both directions.** `rules/quality-and-testing.md` omits four
  HARD gates (madge, visual DR-056, responsive DR-074, shell DR-075) + the DR-100 gate + every numeric bar
  (mutation ≥60%, branch ≥80%, max-3-repairs, DR-080); `rules/typescript.md` cites ESLint rules a DR-052
  project cannot run; `patterns.md` (the standard!) still prescribes `prettier-plugin-tailwindcss`.
  Inversely, ~70% of `rules/web-security.md` and nearly all of `rules/accessibility.md` carry policy with
  **no canonical standard behind it**, and the security rule drops the "hstspreload = owner approves" gate.
- **P1-16 · Versioning discipline is leaking (DR-034/051).** Three no-bump plugin changes, one
  self-declared "exempt" (an exemption DR-034 doesn't grant: `validate-memory.sh` behavior change,
  2026-07-01), and one shipped-template edit (`stack-a e2e specs`, 2026-06-27) with **no OVERLAY bump** —
  propagation to projects piggybacked on later unrelated bumps.

### Funnel + phase seams
- **P1-17 · `release` instructs a dead card status** (`lanzada`, retired 2026-06-15) in its summary while
  step 7 correctly says `shipped`; and **`sync-portfolio`'s reconciliation check can never fire** — it
  compares "project is `shipped`" (a card status; projects have `phase`). Live proof: Mission Control has
  been `phase: release` for 6 days with its card still `in-pipeline`, unflagged.
- **P1-18 · `new-idea`/`recommend` write to a phantom card section** ("Notas de evaluación") deleted by the
  memo-pitch redesign — score rationale is silently dropped; recommend ranks on an input that no longer
  exists. Newest card (panda-learn) confirms the section is gone.
- **P1-19 · The standalone `work-orders` skill auto-advances `phase: implementation`** unconditionally
  (violates DR-032; run on a released project it *regresses* the phase); three writers disagree on who owns
  the architecture→implementation transition.
- **P1-20 · `block-dangerous.sh` blocks the engine's own sanctioned recovery.** Line 26 blocks any
  `git reset --hard`; the engine's DR-065/DR-067 repair path explicitly instructs
  `git reset --hard <last_green_sha>` (engine line 454). The overnight autonomous repair is un-executable
  with the hooks installed; no DR resolves the precedence. (The substring match even fires on read-only
  greps that merely contain the phrase.)

## P2 — polish / long tail

**Cluster A — rename/vocab sweep leftovers** (`blueprint`→`architecture`, 2026-06-29; the log's "every live
reference updated" claim is false): registry DR-100 Canonical points at removed
`plugin/skills/{blueprint,...}` (+ stale refs in DR-054/074/075/077 notas); `CLAUDE.md:47`;
`spec/SKILL.md:15`, `design/SKILL.md:28-29`, `scaffold:33`, `architecture:33`; `plugin/agents/analytics.md:3`
+ `devops.md:3` frontmatter ("Works in :blueprint" — **propagates into MC's Manual**, which derives from
frontmatter); `factory/standards/design.md` §13 broken paths ×3 + build-orchestration 287/300/634/860;
`plugin/templates/README.md`; **`iteration.md.tpl`** (a templates/shared file — the "no OVERLAY change"
rationale was false; it also names the phase-thread `blueprint` while architecture reads thread
`architecture`); `factory/ports.yaml` header. Also `devops.md:16` still presents "the audit result" at the
release gate (DR-085 moved it); `architecture/SKILL.md:19` says the event plan is "verified in `release`";
`privacy.md` still gates PII at `/release` and cites Supabase RLS.

**Cluster B — registry/store hygiene:** DR-092 + DR-057 cite nonexistent `factory/standards/clean-code.md`
(lives only in rules/); DR-082–084 missing with no tombstone; DR-020 partially superseded, unmarked; the
registry at 100 entries is one 87k-token Spanish-keyed YAML with no index/categories (DR-009's own nota
admits the key migration is pending); `build-orchestration.md` has duplicate `## 8`/`## 9` section numbers
(every "§9" cross-reference ambiguous); plugin decision-log has one Spanish entry (v9.33.2) + a
version-tagless header + date-order inversion; BL-0004/BL-0005 are **already fixed in code but sit open**
(plane-3 state drift); BL-0007's headline is fixed while the item stays open.

**Cluster C — engine refinements:** `agentSpawned` cost-weighting is inconsistent (opus judge/gate/repair
spawns counted bare; close-out agents not counted at all — under-counts the most expensive spawns);
`build-orchestration.md`'s state table says IN_PROGRESS = "resume it, don't restart" while engine + DR-086
rebuild-from-scratch (the standard's row is the odd one out); `attemptPatch` is generator=verifier (patches,
re-gates itself, self-stamps VERIFIED + advances `last_green_sha`; the baseline agent then trusts that
anchor and skips verify.sh when HEAD == last_green_sha) — blessed by DR-073's text, so a deliberate design
decision to revisit, not a bug; `iterate` vs `new-version` disagree on who bumps `version:`.

**Cluster D — design/architecture seams:** design Step 0's Claude-Design procedure consumes artifacts
produced in Steps 1–3 (references.md, voice, microcopy); the design advance-gate checklist omits the
a11y-report + screenshots (silently skippable); the DR-064 functional-reconciliation confirmation has no
recorded artifact; `architecture` never re-checks the DR-054 design artifacts exist (trusts the same-session
gate); no defined non-UI path through the design phase (a headless project technically can't pass the
advance gate); the DR-075 nav contract has no structured slot in `components-inventory-template.md` (rides
free text that architecture step 6 must parse to seed `e2e/shell.ts`).

**Cluster E — funnel polish:** DR-032/CLAUDE.md claim `explore`/`new-idea` set `advance_pending` — no
mechanism can exist pre-project (no status.yaml; card has no field); the owner's documented selection verb
(`/pandacorp:scaffold`) is `user-invocable: false` (docs disagree on the selection verb: scaffold vs spec);
DR-011 auto-discards on a self-generated score < 30 while discover/template say discard is owner-only, and
discover has no scoring rubric (weights live only in new-idea); card schema drift (MC writes
`status_before_discard`, ISO timestamps vs template's date; 7/10 discarded cards lack `discard_reason`);
`scan-ideas.sh` uses the Spanish identifier `estado` in a committed script.

**Cluster F — adopt/ops:** adopt never reserves a `dev_port_base` block in `factory/ports.yaml` (breaks
"zero collisions by construction"); release-phase adoptions are pointed at review-launch with no event plan
and nothing routes them toward instrumentation; `ports.yaml` records `developer-portfolio-redesign` while
the project/portfolio slug is `personal-page-v2` (ledger reuse lookup misses); 12 orphaned worktree
manifests in `.pandacorp/run/worktrees/` vs 0 live worktrees, and `.gitignore` mischaracterizes the
factory-root `.pandacorp/` as "stale agent runtime" while DR-099 actively depends on it.

**Cluster G — doctrine coverage gaps (no standard AND no DR):** backup/restore for launched products;
incident response (Sentry fires → then what: no runbook/rollback/severity standard); post-launch cost
monitoring (free-tier ceilings are documented pre-launch; no watcher for PostHog 1M/R2 10GB/Neon compute);
model/API version pinning for the factory's own agents; a data-migration engineering standard (DR-006 covers
approval only). Also: tap-target 44px (patterns.md + a11y rule) vs the wired 24px gate with no stated
relationship; constitution §16 lacks the ADOPT-VISUAL carve-out; STACK.md CI framed "on PR" vs DR-040
direct-main; "(Neon/Supabase)" reads as co-default vs external-services' explicit Neon-over-Supabase; an
owner idea (Labubu/collectible pitch) lives in the committed `idea-card-example.md` (DR-033 tension);
`README.md` operating table omits adopt/change/sync-portfolio and the repo diagram omits
`factory/memory/`+`factory/backlog/`; stack-a STACK.md teaches the retired `-review` sibling worktree
pattern vs DR-090, omits the canary + DR-100 stages its own verify.sh contains.

## Contradictions requiring an owner decision (can't be fixed unilaterally)

1. **Hook vs engine recovery** (P1-20): allow `git reset --hard` when it targets `last_green_sha` (narrow
   allowlist), or change the engine's recovery to a non-reset mechanism?
2. **Patch self-verification** (Cluster C): keep DR-073's self-gating patch agent (cheap) or require an
   independent re-gate before VERIFIED + `last_green_sha` advance (honest, costlier)?
3. **npm vs pnpm** (P1-13): pick one (evidence says pnpm) and sweep.
4. **DR-011 auto-discard** vs owner-only discard (Cluster E): keep the <30 auto-rule (then give discover a
   rubric) or retire it?
5. **Stacks B/C/D**: invest in canonical gate templates now, or explicitly mark them "not production-ready
   stacks" until first use (a declared, honest opt-out)?
6. **44px vs 24px tap targets**: declare 24 the gated floor and 44 the design target, in both docs.

## Improvement plan (proposed — for the owner session that follows)

**Phase 0 — stop the bleeding (hours):**
renumber BL-0010b→BL-0014, BL-0011b→BL-0015 + fix LESSON links; close BL-0004/0005/0007 (code already
fixed) with their done-when residue extracted; fix `/bug` → `status: ready`|`draft` semantics; add the
`running:` guard to `/upgrade` and make change/bug preflights defer it; fix `release`'s `lanzada` and
`sync-portfolio`'s dead check.

**Phase 1 — release + change-flow integrity (the P0s):**
hardening-evidence precondition on `phase: release` in BOTH engine paths (extends BL-0012); implement the
drain/decide-unblock/archive triangle — decide: in-engine at FRD boundaries (engine reads queue + decisions
+ rethink between FRDs) vs supervisor-mandatory (then enforce the supervisor exists: engine refuses to run
headless past N hours, or a heartbeat-checking gate); sweep `/change` into guide.md.tpl/AGENTS.md.tpl;
status.yaml.tpl `pending_changes` + `inbox/changes/` scaffolding (+ OVERLAY bump).

**Phase 2 — honest gates:**
make the implement preflight actually re-run the DR-100 marker/coverage checks (or delete the claim from
the four docs — honesty either way); DR-100 readiness gate → fresh agent (align with DR-102); assign the
DRAFT→ACTIVE flip (architecture step, after the gate, before the owner ok); deny-rules for prod deploys;
`difficulty` into the WO template + architecture skill.

**Phase 3 — close the loops:**
PRD/events/research templates gain the five mandated sections (then re-run doc-lint doctrine over them);
schedule `review-launch` + `memory review` (cron/loop) and add the RETRIEVE step to the builder agents +
`times_applied` increment at retrieval; a backlog validator + next-free-id scan + a drain ritual (e.g.
`/pandacorp:learn` step 0 also surfaces the top-3 open BL items).

**Phase 4 — sweeps + doctrine:**
one mechanical sweep per decayed decision (blueprint rename incl. registry Canonicals + agent frontmatter;
DR-069 vocab incl. constitution §23/infra/DR-020; DR-085 template stragglers; DR-052 prettier/eslint refs;
DR-090 worktree pattern); registry hygiene (fix DR-092/057 pointers, tombstone DR-082–084, add an index +
category field — consider deriving a catalog like the Manual's); stacks B/C/D decision (owner decision 5);
rules↔standards re-mirror (quality rule gains the 4 HARD gates; write the missing security/a11y standards
or demote the rules); README refresh; coverage-gap standards as needed (incident response first).

**Candidate BL items** (to file on approval): ~18 — the Phase 0/1/2 bullets map 1:1; Phase 3/4 items split
into one BL per sweep/template/mechanism. Two candidates are DRs, not BLs (owner decisions 1–6 → registry).

## Prior-audit reconciliation

- **2026-06-14 (economic arc):** DR-042/043 closed it on paper; P1-6/P1-9 show the back half has never
  executed and the templates can't carry its anchors. Still the mission's biggest open loop.
- **2026-06-22 (self-consistency meta-pattern):** confirmed and sharpened — P1-1/P1-2/Cluster C are the
  same "green = self-consistency" root; the self-learning wiring half-landed (harvest yes, retrieve no).
- **2026-06-30 (audit-19):** its resolutions verifiably landed (git policy, hard-vs-advisory, DR-079
  canary); its backlog items BL-0004/0005 are fixed in code but open (state drift); BL-0007/0008/0012 need
  scope extensions noted above.
