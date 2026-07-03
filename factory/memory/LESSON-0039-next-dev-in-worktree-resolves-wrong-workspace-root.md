---
id: LESSON-0039
type: gotcha
domain: nextjs
tags: [turbopack, next-dev, worktree, monorepo-detection, dr-096]
context: running next dev (Turbopack) from inside a git worktree when multiple lockfiles are present on disk (main checkout + worktree)
trigger: use this when running `next dev` from inside a git worktree for preview/verification and multiple lockfiles exist on the machine
source: "personal-page-v2 .pandacorp/run/lessons.md — worktree preview verification"
provenance: agent-inferred
created: 2026-07-03
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0034]
---

**Situation:** `next dev` (Turbopack) run from inside a git worktree under `.claude/worktrees/`
sometimes resolved the wrong workspace root — it picked the MAIN checkout instead of the worktree —
when it detected multiple lockfiles on disk, silently serving the main checkout's content/state instead
of the worktree's changes.

**Lesson:** this is distinct from (and compounds) LESSON-0034's preview-tool `.claude/launch.json`
resolution gotcha — here the root cause is Turbopack's OWN workspace-root auto-detection getting
confused by multiple lockfiles, not the preview tool's config resolution. `next build && next start -p
<port>` on a manually chosen port proved reliable for worktree preview verification; `next dev` invoked
generically from a worktree is not trustworthy for this purpose.

**Apply next time:** when verifying a worktree's changes via a locally running server, prefer
`next build && next start -p <port>` (explicit port, production build) over `next dev` — it sidesteps
Turbopack's workspace-root ambiguity entirely rather than trying to work around it.
