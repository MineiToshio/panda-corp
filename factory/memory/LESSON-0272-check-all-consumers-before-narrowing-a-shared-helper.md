---
id: LESSON-0272
type: pattern
domain: code-architecture
tags: [shared-helper, consumers, ssot, regression]
context: about to "fix" a shared derived-value helper to match the requirement of ONE call site/FRD, when the helper has multiple consumers across different features
trigger: use this before narrowing or changing a shared helper's derived set/logic to satisfy one caller's requirement
source: "mission-control .pandacorp/run/lessons.md 2026-09-30 (agent-inferred) — before narrowing a shared helper's ACTIVE_PHASES set to match FRD-03's requirement, grepping its other consumers found FRD-18 REQ-18-016 and the /projects/<slug> route needed the WIDER set; the rail got its own derived subset (railProjects) instead of narrowing the shared helper itself"
provenance: agent-inferred
created: 2026-10-01
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0252, LESSON-0266]
---

**Situation:** a shared helper computed a derived set (e.g. which phases count as "active") that one
feature's FRD now wanted narrowed. Narrowing the shared helper directly would have been the obvious,
minimal-looking fix — but the helper had other consumers (a different feature's FRD, and a route) that
needed the WIDER, original set. The actual fix was to derive a new, narrower subset specifically for the
caller that needed it, leaving the shared helper's original (wider) contract intact for its other
consumers.

**Lesson:** a shared derived-value helper usually has more than one consumer, and "fixing" it to match
whichever FRD you're currently implementing is a narrowing that can silently break every OTHER consumer's
requirement — the kind of regression that won't surface until that other feature's own tests or review
catch it, if they do at all. The single-source-of-truth principle (one writer, many readers) does not mean
every reader wants the SAME view of that truth; when two call sites need almost-but-not-quite the same
derived value, the fix is usually a second, explicitly-named derived subset, not a changed shared contract.

**Apply next time:** before changing a shared helper's logic/set to satisfy one FRD's new requirement, grep
every OTHER consumer of that helper and check which FRD/route owns it. If even one other consumer needs the
original (wider or different) behavior, don't narrow the shared helper — derive a new, explicitly-named
subset for the caller that needs the narrower view instead.
