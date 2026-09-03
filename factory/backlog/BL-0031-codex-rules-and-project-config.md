---
id: BL-0031
type: change
area: templates
title: "Add .codex project config: destructive-command rules + profiles mirroring build modes"
status: open
severity: p2
opened: 2026-07-04
closed:
source: "Codex independent verification of proposal 25 (2026-07-04), findings 5 + D2 — docs/proposals/25-codex-verification-handoff.md"
closes:
links: [DR-113, DR-120, BL-0030]
---

## Problem

> **blocked-by: DR-120 (Codex freeze, 2026-09-02; reopen trigger: "Codex ships wake-capable local scheduling").** The owner froze every non-Claude runtime at read/review-only on project build state and suspended R10/R11. No new Codex-side capability work is scoped until the trigger fires. This item stays OPEN (the backlog schema has only `open | doing | done`, and a frozen item is not a done item) but must NOT be drained while the freeze holds.
> **Scope split under the freeze.** The *profile* half of this item (mapping build modes pro/balanced/powerful/deep to Codex model + reasoning-effort combos) serves a build capability Codex no longer has — frozen. The *declarative guardrail* half (sandbox/approval defaults, denied command patterns in `.codex/config.toml` + rules) still has value for read/review sessions, but it is subsumed by BL-0030 (p0), which owns making read-only real. Work it there, not here.

The Codex verification session flagged that not every shell path is covered by a PreToolUse-style hook, and Codex offers declarative surfaces we left unused: project-level `.codex/config.toml` (loaded when the project is trusted) and rules files for command policy. Today a Codex session in the factory or a product project has no declarative guardrails (sandbox/approval defaults, denied command patterns) and no profile mapping for our build modes (pro/balanced/powerful/deep → model + reasoning-effort combos).

## Fix plan
1. Author `.codex/config.toml` for the factory repo (and a `.codex/` template in `plugin/templates/shared/` for product projects): sensible `approval_policy`/`sandbox_mode` defaults, `[agents]` caps, and profiles (`pro`/`balanced`/`powerful`/`deep`) mirroring the mode table in `implement` (worker/judge tier per PORT-2).
2. Add the destructive-command rules surface (`.codex/rules/pandacorp.rules` or the config-native equivalent — verify the current official mechanism first; the verification session cited it, confirm against https://developers.openai.com/codex/config-reference).
3. Stamp via scaffold/upgrade like the rest of the overlay; OVERLAY_VERSION bump.

## Proof
- Opening the factory in Codex shows the profiles available; `codex --profile pro` resolves the cheap tier.
- A denied pattern (e.g. `git push --force`) is refused declaratively even with hooks absent.
