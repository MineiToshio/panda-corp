---
id: BL-0052
type: bug
area: hooks
title: "Wire the universal per-commit read-model regen trigger (FRD-23) — documented but never installed; factory store + sibling-project resolution unhandled"
status: open
severity: p1
opened: 2026-07-07
closed:
source: "owner/conversation — FRD-23 factory-store write-side gap close (2026-07-07, plugin v9.81.0)"
closes:
links: [DR-115, DR-078]
---

## Problem

FRD-23's **universal per-commit write trigger** for the materialized Informe read-model is fully
**documented** but was **never wired anywhere**. `mission-control/scripts/read-model/README.md`
("Universal write trigger — regenerate on every commit") specifies it as a git `post-commit` hook
**or** a Claude Code Stop hook that calls `regen` for the committed project, "so the commit is the
correct trigger" — but:

- **No `post-commit` hook exists** in any repo (`ls .git/hooks/post-commit` — absent in the factory
  repo and in sibling projects); the factory repo's git hooks path holds no such hook.
- **No Stop hook regenerates the read-model** — `plugin/hooks/hooks.json` has only the
  dangerous-command gate (PreToolUse), verify-before-stop + lesson-capture (Stop) and telemetry
  (SubagentStop). None calls `regen`/`stats:factory`.
- **`regen` only covers the per-project portada, not the factory store.** `regen.mjs` →
  `regenerateForCommit(projectPath)` writes `<project>/.pandacorp/stats.json` only. The factory-wide
  store `<factory-root>/.pandacorp/stats-factory.json` (the SSOT-split second scope — `phaseTransitions`,
  `scalars.{projects,decisions}`, `lessons`; DR-115) has its **own separate seal** and a **separate
  writer** (`writeStatsFactory`, now exposed as the `stats:factory` CLI, plugin v9.81.0). A per-commit
  `regen` would leave the factory store stale even where it fires.
- **Sibling projects can't resolve the factory root as `cwd/..`.** A `post-commit` hook running in a
  sibling project's repo (not inside `panda-corp/mission-control/`) has no way to reach the factory
  root from its cwd: `resolveFactoryRoot()`'s `cwd/..` fallback is only correct for the in-factory MC
  case, and `stats:factory` needs the real factory root (`PANDACORP_FACTORY_ROOT` or a robust probe).

**Concrete evidence (2026-07-07):** closing the factory-store write-side gap (plugin v9.81.0) wired
`stats:factory` into `/pandacorp:sync-portfolio` step 5c — which means **`sync-portfolio` is the factory
store's ONLY invoker**. Between two `sync-portfolio` runs, ANY commit that changes an Informe input
(a phase move, a new decision, a harvested lesson, a VERIFIED work order) staled the materialization
with nothing to refresh it. FRD-23's own design says the commit — not a skill's close — is the correct
trigger *precisely because* the Informe mixes sources from many skills; without the trigger the
materialization decays to stale after every commit and the Informe silently falls back to live git
(the O(N) render FRD-23 set out to eliminate) until the next periodic `sync-portfolio`.

**Impact:** the materialized read-model — the whole point of FRD-23 (stop deriving git at render
time, O(N)→O(1)) — is only ever fresh right after a manual `sync-portfolio`. Every commit in between
silently degrades the Informe back to the live-git path. The honesty contract holds (the reader falls
back correctly, never lies — DR-078), but the performance win the FRD promised is not realized in
steady state.

## Root cause

The FRD-23 build shipped the read-model's **readers, writers and CLIs** and the **periodic** refresh
(`sync-portfolio`), but the **event-driven** refresh (the per-commit trigger) was documented as a
future wiring step and never installed. Compounding it, the trigger as documented (`regen` per
committed project) predates the SSOT split (DR-115) that introduced the *separate* factory store — so
even the documented design would not refresh the factory-wide scope, and it has no answer for
resolving the factory root from a sibling project's `post-commit` cwd.

## Fix plan

Files in `plugin/` (+ the MC read-model scripts):
1. **Install the trigger (the missing wiring).** Add a Stop hook to `plugin/hooks/hooks.json` (and/or a
   `post-commit` hook template projects install) that, after a commit/session that touched an Informe
   input, regenerates the read-model for the affected scope. Prefer the Stop hook (no per-repo install;
   fires on session end even without a git commit) as the primary, with the `post-commit` hook as the
   documented alternative already in `scripts/read-model/README.md`.
2. **Extend regen to the factory store.** Have the trigger also refresh the factory-wide store when its
   seal is stale — either by teaching `regen` to additionally call `writeStatsFactory` when the
   factory-wide seal has moved, or by invoking `stats:factory` alongside `stats:regen`. A stale-seal
   check (compare `currentFactorySeal` against the stored `seal`) avoids rewriting an already-fresh store.
3. **Robust factory-root resolution from sibling projects.** The trigger must resolve the factory root
   without relying on `cwd/..`: honor `PANDACORP_FACTORY_ROOT`, else probe upward for the repo that
   contains `factory/` + `mission-control/`. Sibling-project commits must be able to refresh both their
   own portada and the shared factory store.

Bump plugin semver (+ `OVERLAY_VERSION` if a hook template projects install changes); regenerate the
Codex agent mirrors only if an agent prompt changes (this item touches hooks/scripts, not agents).

## Tests (prove the fix — TDD, RED → GREEN)

- A scenario/asserting test that a commit touching an Informe input leaves both the per-project portada
  AND the factory store fresh (seal matches after the trigger fires) — **RED** today (nothing fires),
  **GREEN** after the hook is installed. A `verify.sh --canary`-style fixture or a scripted CLI
  assertion fits (the trigger is a hook, so a hook-invocation harness or a documented manual repro of
  "commit → stores refreshed" is acceptable where full hook automation is infeasible).
- A unit test for the robust factory-root resolver: from a sibling-project cwd (no `factory/` at
  `cwd/..`), it still resolves the real factory root (env override + upward probe).
- A stale-seal test: the factory-store refresh is a no-op when the seal already matches (no needless
  rewrite), and rewrites when it has moved.

## Done when

- A per-commit / Stop trigger is installed (`plugin/hooks/hooks.json` and/or the documented
  `post-commit` template) and regenerates BOTH scopes for the affected project + the factory store.
- The factory-root resolution works from a sibling project (not just in-factory MC).
- The new tests pass (RED before, GREEN after); `scripts/read-model/README.md`'s "Universal write
  trigger" section is updated from "wire it via either mechanism" to the actually-installed wiring.
- Plugin semver bumped (+ `OVERLAY_VERSION` if a project-installed template changed).

## Out of scope

The periodic `sync-portfolio` refresh (already shipped, plugin v9.80.0/9.81.0) stays as the belt-and-
suspenders backstop — this item ADDS the event-driven trigger, it does not remove the periodic one.
Does not change the read-model's data shape, seals or the reader's fallback semantics (DR-078) — only
*when* and *by whom* the stores are written.
