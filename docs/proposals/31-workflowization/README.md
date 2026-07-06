# Proposal 31 — Workflowization: hidden engines + deterministic orchestration

**Date:** 2026-07-06 · **Author:** Fable 5 (principal architect session) · **Status:** APPROVED by owner (Phase-0 verdicts OK'd in chat)

Cross-cutting upgrade: move Dynamic Workflow engines out of the `/` menu (T0), then convert the two highest-return orchestrations to deterministic workflow scripts (T1.1) and split the build engine's FRD review gate into parallel lenses with adversarial verification (T1.2).

## Phase-0 verdicts (owner-approved)

| Item | Verdict | Reason |
|---|---|---|
| T0 hide workflows | **BUILD** (Opus) | Engine is path-agnostic; resume is frontmatter-driven (relaunch reads disk, no run-id dependency); launch points are a bounded set. High UX value: `pandacorp-build` leaks into the `/` menu today. |
| T1.1 implement-backlog drain-all | **BUILD** (Sonnet) | Cleanest fan-out (N items × identical recipe) + serialized merge with a validator between merges — exactly what a model improvises inconsistently. |
| T1.2 review-gate split | **BUILD** (Opus) | Today's gate is ONE serial Opus reviewer. Diverse finder lenses + per-finding adversarial verification is the canonical quality pattern; gated behind a new profile flag to bound cost. |
| T1.3 memory | CUT | Single `librarian` delegate per mode; deterministic gates already exist as scripts. |
| T2.1 discover | DEFER | Real two-phase shape, but skill v2 just shipped and its value is judgment, not orchestration. |
| T2.2 sync cold | CUT | Fan-out is one unspecified clause; cold mode is rare — fix the prose, not a .js. |
| T2.3 architecture gates | DEFER | BUILD-worthy on merit (3-gate + stamp + flip mechanization) but below the budget line. |
| T3.1 design / T3.2 spec / T3.3 review-launch | CUT | Human-interactive by nature / no real fan-out / no orchestration at all. |

## Verified facts the design rests on

- `pandacorp-build.js` (1169 lines) never references its own path/name; identity comes from `args.projectDir`/`args.project` (BL-0022).
- Resume is **frontmatter-driven** (`implementation_status` + git commits + `status.yaml`); relaunching the same script re-reads disk. `Workflow({scriptPath, resumeFromRunId})` is the tool's native resume form — scriptPath is *required* for it, so T0 improves resumability.
- Launch/copy points for the engine: `plugin/skills/implement/SKILL.md` (4 `Workflow({name:...})` snippets + supervisor relaunch + preflight path mention), `scaffold/SKILL.md` L20, `adopt/SKILL.md` L31, `upgrade/SKILL.md` L13+L50, plus prose mentions in `factory/standards/build-orchestration.md`.
- Existing `PROFILES.split` flag = worker-team split (test→backend→frontend), **not** review — T1.2 needs a new `reviewSplit` flag.
- Factory-root `.claude/` is committed except `settings.local.json`/`launch.json` → a factory `.claude/engines/` dir is git-tracked.
- Workflow discovery scans only `.claude/workflows/` and `~/.claude/workflows/` (official docs, owner-verified). Empirical in-repo test impossible from this sandbox (nested CLI has no login); final acceptance = owner's next session shows no `pandacorp-build` in `/`.

## T0 — Hidden engines dir + scriptPath launching

**New canonical location:** `.claude/engines/` (template: `plugin/templates/shared/.claude/engines/pandacorp-build.js`; factory root gets its own `.claude/engines/` for factory-run workflows).

Changes:
1. `git mv` the template `…/.claude/workflows/pandacorp-build.js` → `…/.claude/engines/pandacorp-build.js`.
2. `implement/SKILL.md`: all launch/relaunch snippets become `Workflow({ scriptPath: '<projectDir>/.claude/engines/pandacorp-build.js', args: {…} })`; preflight path mention updated; supervisor SOP relaunch updated; the `{scriptPath}` escape-hatch note rewritten (it is now the primary form).
3. `scaffold/SKILL.md`, `adopt/SKILL.md`: path mentions updated (wholesale `cp -r` of `templates/shared/.` brings the new dir automatically).
4. `upgrade/SKILL.md`: regen step points at the new path **and adds a migration step — delete a leftover `<project>/.claude/workflows/pandacorp-build.js`** (and the dir if empty), else the `/` menu entry lingers.
5. `factory/standards/build-orchestration.md`: path references updated.
6. Live migration of mission-control's copy (`mv .claude/workflows/pandacorp-build.js .claude/engines/`) as the first real instance; its `overlay_version` stays until next `/pandacorp:upgrade` (upgrade regenerates machinery unconditionally).
7. Versioning: plugin `9.75.0 → 9.76.0` (MINOR) in both manifests; `plugin/templates/OVERLAY_VERSION` `8.67.0 → 8.68.0`; entry in `plugin/docs/decision-log.md`.

**Verification:** grep proves zero remaining `Workflow({ name: 'pandacorp-build'` or `.claude/workflows/pandacorp-build` references (outside historical logs/proposals); `node --check` on the moved file; a trivial scratch workflow launched via `scriptPath` from an `engines/` dir proves the launch form; `claude plugin validate plugin/`. Residual risk (accepted): menu absence confirmed by owner next session.

## T1.1 — `pandacorp-backlog.js` (factory root `.claude/engines/`)

Deterministic drain-all engine for `factory/backlog/`. Contract:

- **meta:** name `pandacorp-backlog`; phases Scan → Implement → Merge → Report.
- **args:** `{ items?: string[], maxItems?: number, factoryRoot?: string }` (factoryRoot defaults to the repo root; parameterized so the harness can point at a fixture repo).
- **Scan:** one haiku agent reads `factory/backlog/*.md` frontmatter → schema-forced list `{id, path, title, status, tier}` where `tier ∈ haiku|sonnet|opus` per CONV-12/DR-111 rubric (doc/rename → haiku; default → sonnet; core orchestration/cross-cutting → opus). Filter `open|doing`; honor `args.items`; cap at `maxItems`, `log()` what was dropped (no silent caps).
- **Implement:** `parallel()` over items — one agent per item, `model: tier`, `isolation: 'worktree'`, schema `{id, branch, status: done|blocked, reason?, summary}`. The item agent implements + commits **in its worktree**; it never merges. Blocked/null results collected, never retried automatically.
- **Merge (serialized):** plain `for…await` loop, one sonnet merge agent per successful item, in array order: rebase/ff-only onto main; named collision hotspots (plugin.json version → keep higher; decision-log → prepend both, most-recent-on-top; backlog README count → recount); run `plugin/scripts/validate-backlog.sh` after EACH merge; set the item `status: done`; remove worktree+branch before the next merge. Validator red → revert that merge, mark item blocked, continue.
- **Report:** return `{done[], blocked[]}`; the skill renders the owner table (Spanish) from it.
- **Resume:** natural — re-run re-scans; `done` items excluded by frontmatter status.
- **Wiring:** `implement-backlog/SKILL.md` drain-all mode → `Workflow({ scriptPath: '<factory-root>/.claude/engines/pandacorp-backlog.js', … })`. Single-item mode unchanged (direct, in-conversation).
- **Versioning:** plugin `9.76.0 → 9.77.0` (MINOR, new capability); decision-log entry.

**Verification:** harness run against a throwaway git repo in the scratchpad (2 tiny fake BL items + stub validate script) via `args.factoryRoot` — proves fan-out, serialized merge, validator gate and blocked-path handling with cheap haiku agents. The 4 real open BL items (BL-0047…50) are NOT drained in this mission (out of scope; they belong to the skill's normal operation).

## T1.2 — Review-gate split inside `pandacorp-build.js`

New `reviewSplit` flag in `PROFILES`: `true` for `powerful` and `deep`, `false` for `pro`/`balanced`. When false, today's serial `frdGate()` runs unchanged.

When true, `frdGateSplit()` replaces the single reviewer spawn with:
1. **Find (parallel):** 4 sonnet finder agents (`agentType: 'pandacorp:reviewer'`), one lens each — correctness/AC, security, quality (duplication + SSOT/DR-115), runtime/visual — schema-forced findings; read-only (no test writing, no fixes).
2. **Dedup (plain code):** merge by file+claim key.
3. **Verify (parallel, adversarial):** one sonnet skeptic per finding (cap 8; overflow passes through unverified but labeled, `log()`ged) prompted to REFUTE; refuted findings die.
4. **Close (one opus `pandacorp:reviewer`):** receives only confirmed findings; writes the adversarial tests, runs `verify.sh --since`, applies the DR-072 CORRECTION-vs-NITS classification, returns the **same GATE_SCHEMA** as `frdGate()` — `gateAndConverge()` and all downstream convergence machinery untouched.
- **Budget honesty:** `agentSpawned` accounting = 4×COST(sonnet) + verifies + COST(opus); pre-check remaining `maxAgents` — if the split doesn't fit, fall back to serial `frdGate()` with a `log()`.
- **Fail-safe:** any finder/verifier returning null degrades gracefully (closer still runs with what survived) — never a silent skip of the gate itself.
- **Versioning:** plugin `9.77.0 → 9.78.0`; `OVERLAY_VERSION 8.68.0 → 8.69.0` (engine template changed); decision-log entry; `factory/standards/build-orchestration.md` updated (gate section).

**Verification:** new minimal offline harness `plugin/scripts/test-build-engine.mjs` — loads the engine source, strips `export`, wraps in AsyncFunction with stubbed `agent()/parallel()/pipeline()/phase()/log()` globals returning canned schema objects keyed by label, and a fixture project dir; asserts (a) plan-and-exit path still works, (b) forced `frdGateSplit` path: finders fan out, refuted findings die, closer receives survivors, GATE_SCHEMA shape returned, (c) `reviewSplit:false` path bypasses the split. `node --check` + `claude plugin validate plugin/`. Verification re-run by a DIFFERENT agent than the implementer.

## Order, model tiers, landing discipline

T0 (Opus implementer) → T1.1 (Sonnet) → T1.2 (Opus implementer + separate verifier). No subagent runs on Fable. Direct implementation on main (factory repo has no merge queue; concurrent-session dirty files — factory/memory, factory/backlog, factory/decision-log.md, mission-control status.yaml — are NEVER staged: `git add` explicit paths only, DR-099). Each item: version bumps in BOTH plugin manifests, one `plugin/docs/decision-log.md` line, `claude plugin validate plugin/` green before commit. Nothing lands red; a failing item is reverted and marked BLOCKED here.

## CHECKPOINT (update after EVERY item)

| Item | Status | Commit | Notes |
|---|---|---|---|
| Plan written | DONE | 75a16e3d | this file |
| T0 hidden engines | DONE | b9106894 | plugin 9.76.0 / overlay 8.68.0, installed-plugin updated; verified independently (greps 0, shim L18 both copies, validate ✔). Extra: args arrive as JSON STRING on scriptPath launches (3 live runs) → normalization shim added to engine. MC's engine copy renamed but still overlay 8.66.1 content (regens on next upgrade). Residual: `/` menu absence = owner's next session. |
| T1.1 pandacorp-backlog | DONE | 411a01de | plugin 9.77.0, `.claude/engines/pandacorp-backlog.js` (Scan→Implement→Merge→Report), `implement-backlog/SKILL.md` drain-all mode now launches it via `scriptPath`; verified independently (node --check via wrap trick, greps for Date.now/Math.random/new Date + shim + git -C anchoring all clean, `claude plugin validate plugin/` green); scratch fixture repo built at `/private/tmp/.../scratchpad/backlog-fixture/` (BL-9001/9002 open, BL-9003 done, stub validator) for the architect to run the workflow against directly — not launched by this session. |
| T1.2 reviewSplit gate | PENDING | — | after T1.1; contract note: finder/verify shims must account for scriptPath string-args (already normalized engine-side) |

**Handoff note for a fresh session:** verdicts + contracts above are owner-approved and closed; execute per contract, update this table after each landed item. Known foreign RED in mission-control (`frd-11-gate` tests, `localStorage.clear`) predates this mission — do not touch (DR-099).
