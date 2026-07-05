# Proposal 26 — Fable Hardening Sprint (handoff brief)

**Status:** handoff brief · **Date:** 2026-07-04 · **Executor:** Claude Fable 5 (temporary, one-shot; access window closes ~2026-07-07)

## 0. Why this exists

Pandacorp has a short window of cheap access to Claude Fable 5 — Anthropic's most
capable long-horizon agentic model. After the window it is too expensive to run
routinely. The goal is **not** to wire Fable into the factory's skills/agents
(those stay on Sonnet/Opus — DR-111, Fable is never auto-selected). The goal is
to use the window to have Fable act as a **temporary senior engineer** that
leaves the factory materially better, then leaves.

**Selection rule for everything below:** only do work that leaves a *durable
artifact* — committed code, a standard, a blueprint/ADR, or a recalibrated
prompt — that survives once Fable is gone and is then operated by Sonnet/Opus.
A diagnosis that is not executed, or a refactor Opus could do just as well, is a
waste of the window.

This is the owner's **explicit opt-in** to Fable for a one-shot factory-improvement
run (satisfies DR-111's "owner request only"). It does not change the runtime
tiering.

## 1. Read first (the factory's own rules bind you)

Before touching anything, read and obey:

- `AGENTS.md` (canonical operating manual — planes, rules, runtime portability)
- `factory/constitution.md` (non-negotiable principles)
- `factory/standards/` (all — especially `build-orchestration.md`, `agent-portability.md`, `conventions.md`, `rule-registry.md`)
- `factory/memory/MEMORY.md` (the memory index — your leads for the audit)
- `DECISION-LOG.md` + each area's `decision-log.md` (history)
- `factory/decisions/registry.yaml` (policy / pre-approved defaults)

You are operating the **factory itself** (`panda-corp`), not a product project.
Changes to the factory's own tooling are governed by the "route by plane" table
in `AGENTS.md`: durable rules/standards/skills → `learn` + `factory/standards/`
+ registry; actionable defects → `factory/backlog/` (`BL-*`); durable lessons →
`factory/memory/`; research/strategy → `docs/proposals/`.

## 2. Invariant rules — these NEVER degrade

1. **Language (DR-009):** committed artifacts (code, commits, technical docs,
   standards, prompts) in **English**; owner-facing chat and gitignored personal
   files in **Spanish**. `.pandacorp/status.yaml`-style machine state in English.
2. **Human gates (owner only):** never deploy to external production, spend money,
   delete data, or send external communications without stopping and asking. When
   you hit one, STOP that thread and surface it — do not work around it.
3. **Verify before claiming (repo rule):** never declare something done/green from
   assumption. Re-run `verify.sh` / tests / lint where they exist and cite real
   output. Read real state or report an honest gap — never fabricate.
4. **Decision-log discipline:** every change is TWO things — update the canonical
   doc (current truth) AND record the decision in the area's `decision-log.md`
   (history: date, what, why, doc touched). Keep the registry (policy) distinct.
5. **Capture lessons in the same turn (DR-047):** the moment a capture event
   happens (a fix after a failure, a library verdict, a non-obvious gotcha), jot
   one line to `factory/memory/_inbox.md` (tag `gap ·` = defect→backlog, or
   `gotcha ·/verdict ·/pattern ·` = knowledge→memory).
6. **Isolation (DR-096):** every non-trivial change lands via an isolated git
   worktree, one workstream at a time, merged with `.pandacorp/merge-queue.sh`
   when green. Do not leave uncommitted WIP in the shared checkout — it REDs other
   sessions' gates.
7. **Mission Control mirrors the factory (DR-046):** if you change an operable
   surface (skill, agent, flow, gate, rule, standard), surface it in Mission
   Control's Manual in the same change.
8. **Security caveat:** Fable's safety classifiers may refuse genuinely
   offensive-security reasoning. Editing the `security-auditor` agent's prompt
   or the dangerous-command gate's config is fine. If you hit an actual refusal
   on security reasoning, flag it for the owner — do not silently skip.

## 3. Execution protocol

- **Order:** Workstream 1 → 3 → 2 → 4 (highest leverage first; 2 and 4 only if the
  window allows).
- **Per workstream:** enter a worktree → produce a short written plan on disk →
  implement → verify → update canonical docs + decision-log → capture lessons →
  merge when green. Each workstream is its own safe point.
- **Use your strengths:** delegate independent sub-tasks to parallel sub-agents
  (auditing multiple subsystems, recalibrating multiple prompts) and keep working
  while they run; check their output. Establish a way to verify your own work and
  run it on a cadence — prefer fresh-context verifier sub-agents over self-critique.
- **Autonomy:** you are operating without the owner watching in real time. For
  reversible actions that follow from this brief, proceed without asking. Only
  stop for the §2 human gates. Before ending, make sure your final message leads
  with the outcome (what changed, what's left, what needs the owner) in plain
  prose — not working shorthand.
- **Durable-first:** if you must bound scope, write down what you dropped and why.
  Never leave a workstream in a half-built state; prefer fewer workstreams fully
  landed over all four half-done.

## 4. Workstreams

### WS1 — End-to-end adversarial audit of the factory process + execute the P0 fixes
- **Goal:** red-team the whole factory flow (idea → explore → spec → design →
  architecture → implement → release → review-launch → change/iterate/sync), find
  the "promise-without-mechanism" gaps, and **cable the fixes** — not just report.
- **Known leads (verify against real state, don't assume):** `docs/proposals/20`
  (the 4-phase fix plan, "pending ok"); the 2026-07-01 process audit
  ("promesa-sin-mecanismo", 4 P0: duplicate BL ids, two release paths without
  hardening, DR-069 broken, upgrade mid-build); the meta-pattern "green =
  self-consistency, not fidelity to an independent oracle". Read the actual memory
  notes and proposals before deciding scope.
- **Durable artifact:** the enforcement mechanisms wired in (hooks/scripts/gates),
  canonical docs updated, decision-log entries. An audit report alone is NOT
  sufficient — the fixes must land.
- **Acceptance:** each P0 has either a landed mechanism or an explicit `BL-*` with
  a reason it was deferred; `verify.sh` / relevant CI green; decision-log recorded.

### WS3 — Recalibrate every agent + skill prompt FOR Opus 4.8 / Sonnet
- **Goal:** the factory's prompts are consumed daily by Sonnet/Opus. Many are
  written for older models (prescriptive "CRITICAL: YOU MUST" framing) which now
  *reduces* quality and over-triggers tools. Audit and rewrite `plugin/agents/*.md`
  (14 agents) and `plugin/skills/*/SKILL.md` for the models actually in use.
- **Direction:** state goals/constraints over enumerating steps; remove
  overtriggering imperatives; keep human gates, language rules, and documentation
  discipline **verbatim** — those never soften. Preserve each file's `model:` pin
  and frontmatter exactly.
- **Durable artifact:** recalibrated prompts (committed), a short standard/note in
  `factory/standards/` on the prompting conventions you applied so future edits
  stay consistent, decision-log entry, plugin version bump per
  `CLAUDE.md` §"Plugin maintenance" (and Codex mirror regen if any agent changed).
- **Acceptance:** no behavioral regression to gates/rules; plugin `validate` passes;
  version bumped in BOTH `plugin/.claude-plugin/plugin.json` and
  `plugin/.codex-plugin/plugin.json`.

### WS2 — Harden / redesign the build engine
- **Goal:** the build engine (`plugin/templates/shared/.claude/workflows/pandacorp-build.js`)
  is the most complex, most fragile component. Robustify the known weak spots
  (parallel-WO collisions per DR-060, commit/resume correctness per DR-086,
  budget-brake accuracy) with tests.
- **Durable artifact:** hardened code + tests that Sonnet/Opus operate; ADR/blueprint
  or `build-orchestration.md` updates for any behavior change; decision-log entry.
- **Acceptance:** existing build-engine tests green + new tests for the fixed
  failure modes; no change to the cross-runtime resume contract (state in files,
  never in a session) unless documented.

### WS4 — Close the already-designed, pending plans
- **Goal:** execute plans you already designed but left "pending ok":
  `docs/proposals/21`, `docs/proposals/22`, `docs/proposals/25-multi-runtime-portability.md`,
  and any Fase-X items flagged pending in the memory index (self-learning loop
  validation, standards-catalog project upgrades). Read each, confirm it's still
  valid, then implement.
- **Durable artifact:** the features shipped, canonical docs + decision-logs updated.
- **Acceptance:** per each plan's own acceptance criteria; verify green.

## 5. Guardrails specific to Fable

- Every Fable API call you spawn for sub-agents should carry a refusal fallback to
  `claude-opus-4-8` so a classifier false-positive doesn't kill a long run.
- Do not route the `security-auditor`'s offensive-security reasoning through Fable
  (see §2.8).
- Give sub-agents the full spec up front; do not drip instructions.

## 6. Reporting

End with a plain-prose summary: what landed per workstream (with commit refs),
what was deferred (with `BL-*` ids), what needs an owner decision, and the state
of `verify.sh` / CI. Lead with the outcome.
