---
id: LESSON-0094
type: gotcha
domain: build-engine
tags: [subagent, delegation, fanout, rate-limit, audit, drift-detection]
context: fanning out a docs-vs-code or SSOT audit across many features/units to background subagents
trigger: use this when delegating a multi-unit audit (docs-vs-code, SSOT sweep, drift check) to parallel background subagents and deciding which agent type to dispatch
source: "panda-corp — factory-wide docs-vs-code audit 2026-07-05, FRD-06 fdd/blueprint frozen at pre-v2 design"
provenance: agent-inferred
created: 2026-07-06
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0096]
---

**Situation:** fanning out a docs-vs-code audit to `general-purpose` subagents (with `run_in_background`)
caused the children to recursively self-delegate — each spawned its own sub-children instead of doing the
read-only work directly — and returned placeholder "waiting…" text instead of findings. The cascade
tripped API rate-limiting and the audit produced little usable output. Separately, the inline keyword-grep
sweep that DID run (checking for stale names/counts/SSOT markers) missed a real behavioral/design drift:
an entire feature's fdd/blueprint had frozen at a pre-v2 design ("La Fragua v2" superseded a whole prior
design) with no keyword signature to grep for — only a semantic read of that high-churn feature caught it.

**Lesson:** two independent traps compound in a multi-unit audit. (1) `general-purpose` subagents are
full agents with their own delegation authority — dispatching many of them in parallel background mode
risks a self-delegation cascade that a read-only, non-delegating agent type would not. (2) A keyword-grep
sweep only catches drift that left a textual trace (a stale name, a wrong count, a missing marker); it
is structurally blind to a feature whose entire narrative silently stopped tracking a redesign — that
class of drift requires an agent to actually read and compare the current intent against the doc, not
just search for signatures.

**Apply next time:** for a fan-out audit across many units, dispatch read-only `Explore`-class agents (or
sweep inline) instead of `general-purpose` subagents — they cannot recursively self-delegate, so they
don't compound into a rate-limit cascade. Pair the cheap keyword-grep pass with a targeted semantic read
of the highest-churn features (recent large diffs, recently-redesigned areas) specifically because grep
cannot see behavioral drift that has no keyword signature.
