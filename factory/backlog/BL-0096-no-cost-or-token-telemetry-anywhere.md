---
id: BL-0096
type: change
area: build-engine
title: "Add a per-run cost/token rollup to .pandacorp/track.jsonl — no $ or token telemetry exists anywhere"
status: done
severity: p1
opened: 2026-09-02
closed: 2026-09-03
source: "docs/proposals/33-model-era-audit.md §6 R-12 (Top-10 #4, Phase 1's FIRST item)"
closes: "plugin v9.99.0 — plugin/scripts/usage-rollup.mjs + implement/SKILL.md 'Per-run cost/token rollup' + factory/standards/build-orchestration.md 'usage_summary' shape"
links: [LESSON-0176]
---

## Problem
"Budget" in this codebase means a weighted count of subagent calls, never tokens or dollars.
`.claude/engines/pandacorp-build.js:177-198` — `TRACK()` writes `{kind, at, frd, wo, state, verdict}` with
**zero cost/token fields**. Mission Control's `docs/frds/frd-12-observability-dataviz/frd.md:62,66` scoped
this out as a v1 non-goal and listed it as Future, and FRD-12 has been `VERIFIED` since 2026-06-21 with no
follow-up item. Impact: **R-03, R-04, R-11, R-13 and R-56 are all unfalsifiable until this lands** — every
re-tier and threshold claim in proposal 33 rests on an unmeasured assumption. This is the prerequisite for
most of the audit's Wave 2.

## Fix plan
Minimal shape: derive a per-run rollup from `agent_transcript_path` and append ONE `usage_summary` line to
`.pandacorp/track.jsonl` (durable, per-project). **Do not widen `~/.claude/dashboard-events.ndjson`** — the
E5 slim-payload precedent is deliberate. `[UNVERIFIED]` whether the `SubagentStop` payload carries usage at
all: **no usage field was found in 6,621 inspected event lines**, so the transcript-derived path is the
likelier one; establish which works before building on it.

## Tests (prove the fix — TDD, RED → GREEN)
Instrument one build; assert a `usage_summary` line lands in `.pandacorp/track.jsonl` with per-model call
counts and token/cost totals, and that `dashboard-events.ndjson`'s schema is unchanged.

## Done when
One real build produces a per-run rollup readable without re-parsing transcripts; the event stream is not
widened; `factory/standards/build-orchestration.md` documents the new line; plugin version bumped.

## Out of scope
Mission Control UI for the new data, and the OTel cross-check (BL-0107).
