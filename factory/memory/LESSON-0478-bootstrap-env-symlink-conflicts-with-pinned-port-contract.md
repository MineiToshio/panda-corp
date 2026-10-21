---
id: LESSON-0478
type: gotcha
domain: env-config
tags: [bootstrap, server-env-json, symlink, dotenv, gate-isolation, skip-worktree]
context: a project's own bootstrap step rewrites a tracked env-pointer file (e.g. `e2e/server-env.json`) with `skip-worktree` and links it to `.env.local`, while an isolated gate run needs its own synthetic variables without disturbing that contract
trigger: use this when an isolated/parallel gate run needs environment variables distinct from the project's normal bootstrap, and that bootstrap manages its env pointer via a tracked file + symlink + `skip-worktree`
provenance: agent-inferred
source: "funko-tracker .ops/2026-10-20-one-piece ingestion work (agent-inferred)"
created: 2026-10-21
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0447, LESSON-0431]
---

**Situation:** the project's bootstrap step rewrites `e2e/server-env.json` with `git update-index
--skip-worktree` and links it to `.env.local`, but the CURRENT contract pins `PORT=4037` and
explicitly rejects a dotenv file that is itself a symlink. An isolated gate run that needed different
(synthetic) variables could not simply reuse or override that mechanism without breaking the pinned
port or tripping the symlink rejection.

**Lesson:** a bootstrap's own env-pointer management (a tracked file marked `skip-worktree`, linked to
a real dotenv file) is a specific, narrow contract — it is not a general-purpose mechanism for
injecting arbitrary environment variables for an unrelated isolated run, and fighting it (overriding
the symlink, changing the pinned port) risks breaking the normal bootstrap path for everyone else.

**Apply next time:** for an isolated/parallel gate that needs its own environment, keep the
bootstrap's symlink/pointer mechanism untouched and route the isolated run's synthetic variables
through a separate location (e.g. under `.ops`), restoring only that run's own fixture afterward.
Never modify the project's committed env-pointer contract or copy real secrets to satisfy an isolated
run's needs — inject clearly-synthetic test values instead.
