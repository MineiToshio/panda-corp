---
id: BL-0118
type: change
area: plugin-agent
title: "Determine which cache-TTL knob applies to workflow-spawned agents before asserting a cache gap exists"
status: done
severity: p2
opened: 2026-09-02
closed: 2026-09-03
source: "docs/proposals/33-model-era-audit.md §6 R-25"
closes: "plugin v9.98.13 — plugin/docs/decision-log.md 2026-09-03 entry records both reachable knobs (subagentPromptCacheTtl setting, experimental.cacheTtl frontmatter) and their precedence, resolving the R-25 [UNVERIFIED] positive; no adoption made (deferred pending a measured hit-ratio comparison)"
links: [LESSON-0176]
---

## Problem
9 of 14 agents set `effort:`; none sets `experimental.cacheTtl`. But the gap may be **unreachable from
frontmatter at all**: workflow-spawned agents *"fall outside the main conversation's cache TTL bucket…
five minutes by default"*, and the documented lever is the **`subagentPromptCacheTtl` setting**, not the
per-agent field. Which knob applies is `[UNVERIFIED]` (§4.1). Impact: M **if reachable** — `implementer` is
the highest-volume agent and the one plausible candidate. **Do not assert a gap before this is settled.**

## Fix plan
1. Read `LESSON-0176` first (the audit is explicit about this ordering).
2. Establish against a primary doc which knob governs workflow-spawned agents. If neither is reachable,
   close the item as "not actionable, `[UNVERIFIED]` resolved negative" — that is a valid outcome.
3. Only if reachable: compare the prompt-cache hit ratio (the per-session prompt-cache line in `/usage`)
   across one FRD at 5 min versus 1 h TTL, and adopt only on a measured win.

## Tests (prove the fix — TDD, RED → GREEN)
The cache-hit-ratio comparison across one FRD, or a documented primary-source finding that no reachable knob
exists.

## Done when
`plugin/docs/decision-log.md` records which knob governs workflow agents (or that none does), with its
source; any adoption is backed by a measured hit-ratio delta.

## Out of scope
Changing any agent's `model:` or `effort:` pin (DR-114 rule 5 — governance-gated).
