# Proposal 27 — Fable Hardening Sprint II: finish-the-job + verify

**Status:** handoff brief · **Date:** 2026-07-04 · **Executor:** Claude Fable 5 (temporary, one-shot; access window closes ~2026-07-07)

## 0. Why this exists

Sprint I (`docs/proposals/26-fable-hardening-sprint.md`) landed WS1 (process
hardening) and part of WS3 (the 4 high-judgment agent prompts + the new
`prompting-conventions.md` standard, DR-114) fully and tested; it left WS2 as a
characterization test net (no redesign), WS3's remaining agents + skill sweep
untouched, and WS4 deferred. This sprint **finishes everything that is left AND
independently verifies Sprint I's own work** before the window closes.

Same selection rule as Sprint I: only work that leaves a **durable artifact**
operated afterwards by Sonnet/Opus. Same owner opt-in for one-shot Fable use
(DR-111 intact — do not wire Fable into any skill/agent).

## 1. Inherit the rules (obey verbatim)

Read and obey **all of** `docs/proposals/26-fable-hardening-sprint.md` §1 (read
first), §2 (invariant rules — language, human gates, verify-before-claiming,
decision-log discipline, capture-lessons, worktree isolation, MC mirror, security
caveat), and §3 (execution protocol). They apply unchanged.

**Two additions learned from Sprint I (both are your own captured lessons — do not
repeat the mistakes):**

- **A1 — After every parallel sub-agent editing wave, diff BOTH trees.** In
  Sprint I WS3, 5 of 15 rewriter sub-agents landed their Edits in the MAIN
  checkout instead of the worktree (they resolved repo-root-relative paths). After
  any parallel editing wave, run `git status` in the worktree AND in the main
  checkout; transplant strays with `git diff | git apply` before merging. Never
  trust that parallel sub-agents wrote where you told them.
- **A2 — Never inline dangerous strings when testing the command gate.**
  `block-dangerous.sh` pattern-matches the whole Bash command string, so a carrier
  command that merely mentions a dangerous phrase is itself blocked. Write
  canary/test matrices to a script file with the Write tool and execute the file.

## 2. Sprint I state (your starting point)

- **WS1 — done, tested:** drift gate, dangerous-command + ad-hoc-write guards
  hardened (+ tests all green), state backup, audit-20 closed, BL-0039..0041.
- **WS3 — partial:** `architect`, `designer`, `product-manager`, `reviewer`
  recalibrated; `prompting-conventions.md` (DR-114) written; skill preflight
  canonicalized (BL-0042). **Remaining:** the other 10 agents + `copywriter`, and
  a full pass of `plugin/skills/*/SKILL.md` against DR-114.
- **WS2 — safety net only:** `test-pandacorp-build.mjs` (11 scenarios/70 asserts,
  green) locks CURRENT engine behavior; BL-0024 fixed. The actual hardening/redesign
  was NOT done.
- **WS4 — deferred:** proposals 21/22 header reconciliation only; 21/22/25 not
  executed.

Plugin is at **9.68.0** (both manifests). Continue bumping from there per
`CLAUDE.md` §Plugin maintenance (bump BOTH manifests; regen Codex mirrors if any
agent changed; validate).

## 3. Execution order & workstreams

**Order: A → B → C → D → E.** Each is a safe point. Land completely in order —
prefer fewer workstreams fully done and merged over all five touched shallowly.
A's findings feed B; do A before hardening anything in B.

### WS-A — Adversarial verification of Sprint I (do this FIRST)
- **Goal:** independently verify Sprint I's own commits (`c5fb93b`, `f203d77`,
  `bad3329`, `a793738`) with **fresh-context verifier sub-agents acting as an
  independent oracle** — not by re-running the green tests (that only proves
  self-consistency).
- **Critical focus — the WS2 characterization tests:** for each of the 11
  scenarios in `plugin/scripts/test-pandacorp-build.mjs`, ask *"is the asserted
  current behavior actually CORRECT per DR-060 / DR-086 / DR-069, or merely
  current?"* A characterization test blesses latent bugs. Any scenario where the
  locked behavior is wrong → fix the engine AND the test (feeds WS-B1), or file a
  `BL-*` with the reasoning.
- **Also verify:** WS3's recalibrated prompts did not silently soften any
  never-degrade rule (§2 invariant list, human gates, language, state-machine
  words); WS1's new guards have no bypass; no Sprint I edit landed in the wrong
  tree (A1) and slipped through.
- **Durable artifact:** a verification report on disk + every confirmed defect
  either fixed or filed as `BL-*` with evidence; decision-log entry.
- **Acceptance:** every WS2 scenario has an explicit correct/incorrect verdict
  from an independent-oracle argument; confirmed defects fixed or filed.

### WS-B — Finish the partials
- **B1 — Build engine deep hardening.** Now safe because the test net exists (and
  is A-verified). Fix the real weak spots (parallel-WO collisions DR-060,
  commit/resume correctness DR-086, budget-brake accuracy) informed by WS-A.
  Extend the test suite for each fix. Do NOT change the cross-runtime resume
  contract (state in files, never in a session) without documenting it.
- **B2 — Finish the prompt recalibration.** Apply DR-114 to the remaining agents
  (`implementer`, `backend-dev`, `frontend-dev`, `test-writer`, `researcher`,
  `security-auditor`, `librarian`, `analytics`, `devops`, `copywriter`) and do a
  full pass of every `plugin/skills/*/SKILL.md`. Preserve each file's `model:` pin
  and frontmatter exactly; keep the never-degrade content verbatim. **Apply A1
  after the parallel wave.** Regen Codex mirrors; bump plugin version.
- **B3 — Execute the pending plans.** Read `docs/proposals/21`, `22`, and
  `25-multi-runtime-portability.md`; confirm each is still valid; implement per its
  own acceptance criteria. If a plan is stale or superseded, say so and mark it
  closed-without-build rather than force it.
- **Durable artifact:** hardened engine + tests, all agents/skills recalibrated,
  the pending features shipped; canonical docs + decision-logs updated.
- **Acceptance:** all engine tests green (old + new); plugin `validate` passes;
  each pending plan executed or explicitly closed with reason.

### WS-C — Live end-to-end dry-run on a throwaway idea
- **Goal:** WS1/WS-A audited the process; this **runs** it. Take one trivial
  disposable idea and drive the real pipeline — `spec → design → architecture →
  implement` — capturing every process break, friction, or promise-without-mechanism
  that only shows up when the flow actually executes.
- **Hard constraints:** the sample product is real code, so it goes in a **sibling
  folder OUTSIDE `panda-corp`** (product code never lives in the factory —
  `AGENTS.md`). Stop before any external release (human gate); `deploy_target`
  internal only; spend no money; the sample project is disposable.
- **Durable artifact (the point):** every break filed as a `BL-*` in
  `factory/backlog/` (the sample app itself is throwaway). This is the
  "run it, don't just audit it" oracle WS1 couldn't be.
- **Acceptance:** the pipeline was actually executed to `implement`; a defect
  list exists as backlog items with repro context.

### WS-D — Independent eval oracle for the eval-gate (stretch)
- **Goal:** the factory's recurring meta-risk is "green = self-consistency, not
  fidelity to an independent oracle." Build the beginning of a real oracle for the
  self-learning loop's eval-gate (DR-047 loop v2): a small corpus of known-good /
  known-bad examples + a scorer, so a future "green" means fidelity, not
  agreement-with-itself.
- **Durable artifact:** corpus schema + a seed set + either wired into the
  eval-gate or a `BL-*` describing the wiring.
- **Acceptance:** seed corpus + scorer exist and run; integration done or filed.

### WS-E — Codex / multi-runtime parity (stretch)
- **Goal:** DR-113 shipped the portability layer. You cannot run Codex, but you
  can: confirm the `.codex/agents/*.toml` mirrors are in sync (the drift gate
  covers this — verify it actually catches drift), reason through the attended
  build-loop path for gaps against the Claude Dynamic-Workflows path, and generate
  a parity checklist/test.
- **Durable artifact:** a parity test or checklist committed; gaps filed as `BL-*`.
- **Acceptance:** parity artifact exists; known gaps enumerated.

## 4. Reporting

End with the plain-prose outcome summary (Sprint I §6 format): what landed per
workstream with commit refs, what you deferred as `BL-*` with reasons, what needs
an owner decision, and the state of `verify.sh` / the engine test suite / plugin
`validate`. Lead with the outcome. If you had to stop mid-way, stop at a clean
workstream boundary and say exactly where.
