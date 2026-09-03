---
id: BL-0114
type: change
area: plugin-skill
title: "Trial AskUserQuestion in the decide skill only — every owner gate is currently freeform prose"
status: done
severity: p2
opened: 2026-09-02
closed: 2026-09-03
source: "docs/proposals/33-model-era-audit.md §6 R-29"
closes: "plugin/docs/decision-log.md v9.99.0 (2026-09-03) -- verdict ADOPT in decide"
links: []
---

## Problem
`AskUserQuestion` has **zero hits** across `plugin/skills/*/SKILL.md`; every owner gate in the factory is
freeform prose. The recorded objection ("adopting it would reduce portability") is **factually wrong** —
`factory/standards/agent-portability.md:65` already defines the fallback (ask in chat) — but the gain is
unproven, and prose gates carry rationale a fixed option list cannot. Impact: M, on the highest-stakes
gates, `[expected, not demonstrated]`.

## Fix plan
Trial it in **ONE** skill: `plugin/skills/decide/SKILL.md`, whose job is literally answering a pending
decision from a structured file. Keep the prose rationale alongside the structured options — the option list
supplements the explanation, never replaces it. **Do not apply it to `design`'s open-ended visual feedback
or `explore`'s conversation**; those are the cases a fixed option list would damage.

## Tests (prove the fix — TDD, RED → GREEN)
Run `/pandacorp:decide` with structured questions against a real pending `.pandacorp/inbox/decisions.md`
file; the owner judges whether choice capture improved. A "no clear improvement" verdict closes the item as
tried-and-rejected, which is a valid GREEN.

## Done when
The trial is run on a real decision file; the verdict (adopt in `decide` / do not adopt) is recorded in
`plugin/docs/decision-log.md`; no other skill is changed.

## Out of scope
Rolling `AskUserQuestion` out across all skills — deliberately a single-skill trial.
