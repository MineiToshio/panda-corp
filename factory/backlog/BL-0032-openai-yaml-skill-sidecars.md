---
id: BL-0032
type: change
area: plugin-skill
title: "Add agents/openai.yaml sidecars gating internal/dangerous skills under Codex"
status: open
severity: p2
opened: 2026-07-04
closed:
links: [DR-113]
source: "Codex independent verification of proposal 25 (2026-07-04), finding 6 — docs/proposals/25-codex-verification-handoff.md block D2"
closes:
---

## Problem
Codex ignores our Claude-only `user-invocable: false` frontmatter, so internal engine skills (`bug`, `iterate`, `scaffold`, `work-orders`, `new-version`) surface as user-invocable and are eligible for implicit auto-invocation by description match. Codex's official sidecar `agents/openai.yaml` (per skill dir — https://developers.openai.com/codex/skills) supports `allow_implicit_invocation: false` and invocation policies, which is the native way to express "internal engine: reachable, but never auto-triggered".

## Fix plan
1. For each internal skill, add `plugin/skills/<slug>/agents/openai.yaml` with `allow_implicit_invocation: false` (verify current schema against the official docs before writing).
2. Consider the same for gated/dangerous skills (`release` — production gate; `learn` — mutates standards) if the sidecar supports a confirmation/default-prompt policy.
3. Confirm Claude Code ignores the extra dir (plugin validate + a smoke session) — it should, but verify, don't assume.

## Proof
- In a Codex session, `/skills` still lists the internal engines but none auto-fires on a description-matching request (e.g. "tengo un bug" routes to `change`, not directly to `bug`).
- `claude plugin validate plugin/` still passes.
