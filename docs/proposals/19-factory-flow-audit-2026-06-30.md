---
title: Pandacorp factory flow audit
date: 2026-06-30
status: audit
scope: factory, plugin, Mission Control, workflow, gates, documentation
---

# Pandacorp Factory Flow Audit — 2026-06-30

This audit consolidates two read-only reviews of the Panda Corp repository. It intentionally excludes future portability to non-Claude runtimes; that topic is deferred by owner choice. The focus here is the current Claude Code-based factory: factory standards, plugin skills/agents/hooks/templates, Mission Control, build orchestration, gates, and documentation drift.

No production code changes were made as part of the audit.

> **Routing (DR-103, 2026-06-30).** This document is a **narrative proposal** (plane 2) — the *why* and the
> analysis. Its **actionable findings** (plane 3) have been extracted to closeable items so they don't rot
> inside the narrative:
> - **Factory-tooling findings → `factory/backlog/`:** BL-0004 (build-workflow fail-open edges),
>   BL-0005 (stop-gate basename attribution), BL-0006 (merge/pending script robustness),
>   BL-0007 (`/bug` stale description), BL-0008 (`operation` vocab sweep in factory templates),
>   BL-0009 (greenfield fail-closed doc-lint).
> - **Already resolved** (see `factory/decision-log.md`, 2026-06-30): the git-policy contradiction (P2),
>   the hard-vs-advisory gate list + the DR-079 gate canary (P1), `/change` front-door surfacing (P1), the
>   write-gate-stays-a-nudge decision (P1), the responsive two-tier decision (P2).
> - **Mission-Control-specific drift** (overlay behind, `verify.sh` DR-100 gate, `operation`/FRD-15 in MC
>   docs, MC architecture staleness, MC pending queue items, MC read-only boundary docs, MC `api.md`) is a
>   PROJECT concern → it routes to Mission Control's own change queue (`.pandacorp/inbox/changes/` via
>   `/pandacorp:change`), NOT the factory backlog.
>
> The narrative below is preserved as history.

## Executive Summary

Pandacorp is already a real autonomous software-factory system, not just a concept. It has a constitution, standards, decision registry, skills, agents, Mission Control, a self-learning loop, build orchestration, gates, and project overlays.

The highest-value improvement is not adding more process. It is making the existing decisions propagate cleanly and keeping enforcement synchronized with the doctrine. The strongest recurring pattern is drift: the code is often newer than the canonical docs or templates, and some promised gates are still advisory, vacuous, or not installed in the active project.

## Strengths

- The constitution is strong: spec before code, artifacts before chat, adversarial verification, TDD, design before implementation, traceability, and hard human gates.
- Build orchestration is unusually complete: feature-centric documents, coarse work orders, Build Plans, per-FRD gates, serialized commits, budgets, repair loops, and shutdown semantics.
- The decision registry prevents repeated policy debates and records recurring defaults.
- Mission Control has the right architectural boundary: mostly read-only, observational, and not an executor of builds or agents.
- The plugin already encodes many lessons from real failures: shell gates, responsive gates, visual QA, worktree isolation, merge queue, doc lint, overlay upgrades, and self-learning memory.

## Priority Findings

### P0 — Mission Control Overlay Is Behind the Factory Template

Mission Control reports `overlay_version: "8.44.0"` while the current overlay template is `8.47.0`.

Evidence:
- `mission-control/.pandacorp/status.yaml`
- `plugin/templates/OVERLAY_VERSION`

Impact:
- Mission Control's local gate wiring is behind the factory's current gate standard.
- Its `.pandacorp/verify.sh` is missing the DR-100 residual-ambiguity gate present in the current template.

Recommended fix:
- Run/apply the overlay upgrade for Mission Control.
- Reconcile Mission Control's gate files against `plugin/templates/stack-a-nextjs/`.
- Verify that the upgrade does not overwrite local fixes that should be back-ported to the templates.

### P0 — DR-100 Gate Drift: Mission Control `verify.sh` Misses the Active-Doc Ambiguity Blocker

The canonical Next.js `verify.sh` template blocks `[NEEDS CLARIFICATION]` markers in ACTIVE docs, but Mission Control's `verify.sh` does not.

Evidence:
- `plugin/templates/stack-a-nextjs/verify.sh`
- `mission-control/.pandacorp/verify.sh`

Impact:
- A project can appear green while carrying unresolved build-changing ambiguity in ACTIVE documents.
- This contradicts the new readiness-gate doctrine.

Recommended fix:
- Propagate the canonical `verify.sh` to Mission Control through `/pandacorp:upgrade`.
- Add a conformance check or test that catches drift between stack templates and active project gate files.

### P0 — Lifecycle Vocabulary Drift: `operation` Still Appears After DR-085

The current policy says there is no separate `operation` phase; `release` is the launched/terminal phase. Code paths mostly reflect that, but templates and Mission Control docs still contain the old `operation` vocabulary.

Evidence:
- `factory/decisions/registry.yaml`
- `factory/standards/build-orchestration.md`
- `plugin/templates/shared/.pandacorp/status.yaml.tpl`
- `mission-control/docs/frds/frd-02-ideas-board/frd.md`
- `mission-control/docs/frds/frd-01-data-reading/blueprint.md`
- `mission-control/docs/frds/frd-03-portfolio/blueprint.md`
- `mission-control/docs/frds/frd-04-project-workspace/blueprint.md`
- `mission-control/docs/api.md`
- `mission-control/docs/design/prototype/index.html`

Impact:
- Agents that follow the docs can regenerate old behavior.
- New projects can inherit stale phase comments from the status template.
- Mission Control docs disagree with the current code, where `release` already maps to shipped.

Recommended fix:
- Sweep `operation` from templates, canonical docs, work orders, generated API docs, and prototype sample data where it refers to the old phase model.
- Preserve historical decision-log mentions as history.
- Add a doc lint rule for forbidden current-state lifecycle vocabulary outside decision logs/reviews.

### P0 — FRD-15 Has Two Competing Truths

FRD-15 and the implementation now use semver-based plugin freshness, but the blueprint and work orders still describe SHA/dirty-state drift.

Evidence:
- `mission-control/docs/frds/frd-15-plugin-out-of-sync-warning/frd.md`
- `mission-control/src/lib/plugin-sync/plugin-sync.ts`
- `mission-control/docs/frds/frd-15-plugin-out-of-sync-warning/blueprint.md`
- `mission-control/docs/frds/frd-15-plugin-out-of-sync-warning/work-orders/`
- `CLAUDE.md`

Impact:
- The canonical feature docs disagree internally.
- A future sync/iterate/rebuild may reintroduce the old SHA-based behavior.

Recommended fix:
- Reconcile FRD-15 blueprint, work orders, FDD/API docs, and root operating docs to the semver model.
- Mark the SHA model as historical only in the decision log.

### P1 — Mission Control Product Architecture Is Stale in Several Places

Mission Control's product architecture still says v1 has no Playwright/e2e, while the app has Playwright scripts and gates.

Evidence:
- `mission-control/docs/product/architecture.md`
- `mission-control/package.json`
- `mission-control/.pandacorp/verify.sh`

Impact:
- The architecture no longer describes the shipped verification strategy.
- Future agents may under-plan browser verification.

Recommended fix:
- Update Mission Control architecture to reflect current Playwright smoke, visual, responsive, and shell gates.
- Reconcile architecture sections that still describe old phase and plugin-sync models.

### P1 — Some Gates Are Advisory or Vacuous

`doc-lint.sh` is advisory by design and always exits `0`. `verify.sh --canary` is vacuous unless `.pandacorp/canary.sh` exists, and no canary script was found in the templates.

Evidence:
- `plugin/templates/shared/.pandacorp/doc-lint.sh`
- `plugin/templates/stack-a-nextjs/verify.sh`
- `factory/standards/quality.md`

Impact:
- The factory can report green while known classes of drift are only warnings.
- The canary doctrine exists, but the fixture machinery is incomplete.

Recommended fix:
- Decide which doc-lint findings should become fail-closed for new projects.
- Add a template canary harness and broken fixtures.
- Keep brownfield retrofits advisory where needed, but make new greenfield projects stricter.

### P1 — Write-Gate and Manual-Sync Hooks Are Reminders, Not Enforcement

The write-gate, manual-sync reminder, and gate-config backport reminder are intentionally non-blocking. This is useful for ergonomics but weaker than the constitution's hard-gate language.

Evidence:
- `plugin/hooks/hooks.json`
- `plugin/scripts/warn-adhoc-write.sh`
- `factory/decisions/registry.yaml`
- `factory/constitution.md`

Impact:
- Agents can still make direct behavior/doc changes and leave the two-layer documentation cascade incomplete.
- Manual drift remains possible unless the agent voluntarily follows the reminder.

Recommended fix:
- Keep low-friction reminders for small edits.
- Add a stricter mode for non-trivial product/code/doc changes: block or require `/pandacorp:change`, `/pandacorp:iterate`, `/pandacorp:sync`, or an explicit owner override.

### P1 — Build Workflow Has Fail-Open Edges

The build workflow contains a few robustness risks:
- Foundation completeness can be treated as complete when the gate data is missing/invalid.
- `maxAgents` can be exceeded within a planned wave if the external supervisor is absent or dead.
- Old work orders without `artifacts` weaken overlap detection.

Evidence:
- `plugin/templates/shared/.claude/workflows/pandacorp-build.js`
- `factory/standards/build-orchestration.md`

Impact:
- The workflow may continue when it should block.
- Parallelism safety degrades on old or partially migrated work orders.

Recommended fix:
- Make missing/invalid foundation-completeness data fail closed.
- Enforce `maxAgents` before scheduling each spawn or wave.
- Treat missing `artifacts` as a warning that forces serialization, not as "no overlap".

### P1 — Stop-Gate Foreign-Red Attribution Uses Basenames

`verify-before-stop.sh` classifies foreign red failures by comparing basenames of touched, dirty, and failing files.

Evidence:
- `plugin/scripts/verify-before-stop.sh`

Impact:
- Two files with the same basename in different folders can confuse attribution.
- The hook may silence an owned failure or block on a foreign one.

Recommended fix:
- Attribute using normalized repo-relative paths.
- Where possible, record touched-file hashes or pre/post snapshots per session.

### P1 — Mission Control Is Released With Pending Queue Items

Mission Control reports `phase: release`, `94/94` work orders verified, and full green status, but still has `pending_decisions: 1` and `pending_changes: 8`.

Evidence:
- `mission-control/.pandacorp/status.yaml`

Impact:
- The project appears finished while operational debt remains active.

Recommended fix:
- Classify the pending items as post-release backlog, active blockers, or stale queue entries.
- Surface them explicitly in Mission Control as release/backlog health.

### P1 — `/pandacorp:change` Is the Real Front Door but Is Under-Surfaced

`/pandacorp:change` is now the single owner-facing command for bugs/features/adjustments, but the root operation table does not list it as a main command. `/pandacorp:bug` also has stale frontmatter description mentioning `.pandacorp/inbox/bugs/` while the body uses `.pandacorp/inbox/changes/`.

Evidence:
- `CLAUDE.md`
- `plugin/skills/change/SKILL.md`
- `plugin/skills/bug/SKILL.md`

Impact:
- The owner or agents may continue using older flows.
- Documentation hides an important operational simplification.

Recommended fix:
- Add `/pandacorp:change` to the root operating table and Manual narrative.
- Update `/pandacorp:bug` description to match the unified change queue.

### P1 — Mission Control Read-Only Boundary Docs Are Incomplete

Mission Control's architecture says bounded writes include discard/restore/favorite, while the PRD still frames the surface more narrowly in places.

Evidence:
- `mission-control/docs/product/prd.md`
- `mission-control/docs/product/architecture.md`
- `mission-control/docs/frds/frd-02-ideas-board/frd.md`

Impact:
- The read-only invariant is correct in spirit, but its exception list is scattered.

Recommended fix:
- Centralize the bounded-write list in architecture and reference it from FRDs.
- Keep PRD wording aligned with actual discard/restore/favorite behavior.

### P2 — Git Policy Contradiction

The constitution and DR-040 favor direct commits to main, while `factory/standards/quality.md` still describes PR-based CI and protected branches.

Evidence:
- `factory/constitution.md`
- `factory/decisions/registry.yaml`
- `factory/standards/quality.md`

Impact:
- Agents receive two incompatible Git operating models.

Recommended fix:
- Decide whether product projects use direct-main by default, PRs by default, or direct-main local with CI as optional external governance.
- Update the quality standard accordingly.

### P2 — Merge/Pending Work Scripts Have Small Robustness Edges

`pending-work.sh --json` builds JSON manually without escaping branch/path values. `merge-queue.sh` checks whether main can fast-forward only after rebase and verify.

Evidence:
- `plugin/templates/shared/.pandacorp/pending-work.sh`
- `plugin/templates/shared/.pandacorp/merge-queue.sh`

Impact:
- Unusual branch/path names can produce invalid JSON.
- A busy main checkout can waste time before failing.

Recommended fix:
- Use `jq` or a safe JSON emitter.
- Preflight main checkout cleanliness before long integration work, while still rechecking before merge.

### P2 — Responsive Gate Defaults Are Conservative for Brownfield

Brownfield/adopted projects default to `target_platforms: desktop`, causing mobile responsive checks to pass vacuously.

Evidence:
- `plugin/skills/adopt/SKILL.md`
- `factory/standards/quality.md`
- `mission-control/.pandacorp/status.yaml`

Impact:
- This is intentional for avoiding red-lock, but it can hide mobile debt.

Recommended fix:
- Add a clear Mission Control nudge for desktop-only projects.
- Make promotion to `responsive` a visible backlog decision.

### P2 — Generated API Docs Appear Stale

`mission-control/docs/api.md` contains old phase and FRD-15 SHA language.

Evidence:
- `mission-control/docs/api.md`

Impact:
- Generated/reference docs no longer match source code and canonical FRDs.

Recommended fix:
- Regenerate or reconcile API docs after the FRD/blueprint sweep.
- Add a check that flags generated docs containing known obsolete terms.

## Recommended Execution Plan

### Phase 1 — Reconcile Drift

1. Upgrade Mission Control overlay to the current template.
2. Propagate the canonical `verify.sh` and e2e gate files.
3. Sweep `operation` from current-state docs/templates.
4. Reconcile FRD-15 semver behavior across FRD, blueprint, work orders, API docs, and root docs.
5. Update Mission Control architecture to reflect actual Playwright/gate wiring.

### Phase 2 — Harden Gates

1. Add real canary fixtures and a template `.pandacorp/canary.sh`.
2. Promote selected doc-lint checks to hard gates for new projects.
3. Add conformance tests that compare project gate files against stack templates.
4. Strengthen Stop-gate attribution from basename matching to repo-relative path matching.

### Phase 3 — Harden Workflow Runtime

1. Make missing foundation-completeness data fail closed.
2. Enforce `maxAgents` before each spawn/wave.
3. Serialize or block old work orders missing `artifacts`.
4. Improve `pending-work.sh` JSON generation and `merge-queue.sh` preflights.

### Phase 4 — Clean Operating Surface

1. Add `/pandacorp:change` to the main operation table and Manual narrative.
2. Fix `/pandacorp:bug` description.
3. Resolve the direct-main vs PR/protected-branch wording.
4. Classify Mission Control's pending changes and decisions as active or backlog.

## Suggested Validation

- `claude plugin validate plugin/`
- Mission Control overlay diff check after upgrade
- Mission Control `.pandacorp/verify.sh`
- `pnpm --dir mission-control test`
- `pnpm --dir mission-control typecheck`
- `pnpm --dir mission-control lint`
- Mission Control Playwright smoke/visual/responsive/shell gates
- A targeted search for obsolete current-state terms:
  - `operation`
  - `gitCommitSha`
  - `installed SHA`
  - `No Playwright`
  - `[NEEDS CLARIFICATION]`

## Notes

- Historical mentions in decision logs and reviews should be preserved unless they are misleading as current-state guidance.
- The audit intentionally avoids future non-Claude portability work.
- The biggest near-term win is closing the gap between standards, templates, active project overlay, and Mission Control documentation.
