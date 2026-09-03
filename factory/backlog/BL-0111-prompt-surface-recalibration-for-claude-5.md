---
id: BL-0111
type: change
area: standards
title: "Re-run a DR-114-style fresh-context PROMPT-6 pass over the 14 agents and 26 skills against Claude 5"
status: done
severity: p2
opened: 2026-09-02
closed: 2026-09-03
source: "docs/proposals/33-model-era-audit.md §6 R-02 (recalibration half; owner decision §12.2)"
closes: "proposal 36 sprint + red-team (commits dd3442ee, 33f06792)"
links: []
---

## Problem
`factory/standards/prompting-conventions.md:5-6` declares itself tuned for a superseded generation —
*"consumed daily by **Opus 4.8 / Sonnet-class models**… degrade when shouted at in triplicate, and
over-trigger on absolutist imperatives written for weaker models"* — repeated at `:48` and verbatim in
`factory/decisions/registry.yaml:661`. The standard's own stated trigger condition (a generation change)
has recurred. Impact: **H** — a stale premise sits inside a `MUST`-tier standard with real gates
(PROMPT-1..7 registered, PROMPT-5 wired).

## Fix plan
Re-run the DR-114 / proposal-26 shape: a fresh-context PROMPT-6 pass over the 14 `plugin/agents/*.md` and 26
`plugin/skills/*/SKILL.md` against Claude 5, diffing trigger and compliance behaviour versus the 2026-07-04
baseline. **PROMPT-4/6 require the never-degrade list survive verbatim** — that is the acceptance boundary.
If the owner approves the §12.2 Fable opt-in, record scope, expected cost (+$13.20 in call-units over the
same sprint on Opus 5) and success criteria in a `docs/proposals/` entry BEFORE launching, exactly as
proposal 26 did. Otherwise run it on Opus 5.

## Tests (prove the fix — TDD, RED → GREEN)
Run PROMPT-6's fresh-context verifier on `reviewer.md` and `designer.md` under Claude 5 and diff
trigger/compliance against the 2026-07-04 baseline. RED = any never-degrade item lost.

## Done when
The sweep's diff is recorded; every changed prompt carries its own PROMPT-6 receipt; the never-degrade list
is verified intact; `factory/decision-log.md` noted; plugin version bumped.

## Out of scope
The de-versioning of `prompting-conventions.md`'s own prose — that ships through `/pandacorp:learn` with its
own PROMPT-6 receipt, separately and first.
