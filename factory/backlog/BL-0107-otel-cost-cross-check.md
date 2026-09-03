---
id: BL-0107
type: change
area: build-engine
title: "Cross-check the in-engine cost counter against Claude Code's own OTel cost.usage / token.usage"
status: open
severity: p2
opened: 2026-09-02
closed:
source: "docs/proposals/33-model-era-audit.md §6 R-27"
closes:
links: []
---

## Problem
The factory hand-rolls `~/.claude/dashboard-events.ndjson` (`CLAUDE.md:34`) via `emit-event.sh` on
`SubagentStop` (`plugin/hooks/hooks.json:82-87`), and DR-070 already declares the in-engine counter
unreliable on its own. `factory/standards/observability.md:12,54,61` discusses OTel **only** for product
apps, so the one available independent measurement of the factory's own spend is unused. Impact: DR-070's
own pattern is "validate the internal counter against an external source", and there is no external source.

## Fix plan
Enable OTel export for one build and compare `claude_code.cost.usage` against `agentSpawned × COST()` and
against BL-0096's `usage_summary` rollup. **Complement, not replacement** — the hand-rolled stream carries
factory-domain events (FRD verified, WO commit) that generic OTel metrics do not know about, so nothing is
removed. Net-new machinery: sequence after BL-0096.

## Tests (prove the fix — TDD, RED → GREEN)
One build with all three numbers recorded side by side, and the divergence quantified.

## Done when
The three-way comparison is recorded in `plugin/docs/decision-log.md`; `observability.md` states whether OTel
is adopted for factory runs; the existing event stream is unchanged.

## Out of scope
Replacing `dashboard-events.ndjson` or widening its payload (the E5 slim-payload precedent).
