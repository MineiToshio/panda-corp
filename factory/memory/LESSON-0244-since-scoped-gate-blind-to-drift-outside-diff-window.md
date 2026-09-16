---
id: LESSON-0244
type: gotcha
domain: build-orchestration
tags: [verify-sh, since-scoped-gate, baseline, knip, madge, drift]
context: a per-FRD `verify.sh --since <last_green>` gate structurally only lints/tests files changed since the last green run; a defect introduced OUTSIDE that diff window (dead export, import cycle, a test whose fixture assumption silently broke) stays invisible to every incremental gate run until a full, non-`--since` baseline runs
trigger: use this when a full (non-`--since`) verify.sh baseline run surfaces defects that weren't caught by any of the incremental `--since` gates run in between, or when deciding whether a long-running project needs a full baseline run before starting new build work
source: "mission-control 2026-09-03: an overlay upgrade's mandated full baseline run (the first non-`--since` verify.sh since last_green_sha 2026-07-07) and, same day, a separate FRD-24 pre-build hardening pass both surfaced the SAME 4 pre-existing defects (6 stale knip unused-export findings, 1 madge import cycle, 2 stale test failures) — all stale since a single commit 7 weeks earlier (5ee83d4e, 2026-07-11), invisible to every `--since`-scoped gate run across that whole window"
provenance: agent-inferred
created: 2026-09-16
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0242]
---

**Situation:** a project ran only `--since`-scoped incremental gates for seven weeks. A single commit had introduced several latent defects (dead exports, a type-only import cycle, two tests whose underlying assumptions had silently changed) that never touched a diff any `--since` gate happened to scope over. The defects surfaced only when two unrelated full (non-`--since`) baseline runs — an overlay upgrade's mandated full run, and a build's own pre-build hardening pass — both hit the same stale drift on the same day.

**Lesson:** a `--since`-scoped gate is a deliberate wall-clock tradeoff (lint/test only what changed) and is therefore structurally blind to any defect sitting outside its diff window, no matter how many `--since` runs pass green in a row. A long green streak of `--since` gates is not evidence the whole tree is clean — only a full baseline run (build Baseline step, close-out, or an explicit "run full verify.sh" pass) can make that claim. The longer the gap between full runs, the more drift can silently accumulate before something forces a full run to notice it.

**Apply next time:** don't read a passing `--since` gate as "the whole project is green" — it only proves the diff is green. Before starting non-trivial new build work (or when an overlay upgrade/other maintenance task happens to trigger one anyway), run a full non-`--since` `verify.sh` baseline explicitly if a long stretch has passed since the last one, rather than assuming the incremental streak already covers it.
