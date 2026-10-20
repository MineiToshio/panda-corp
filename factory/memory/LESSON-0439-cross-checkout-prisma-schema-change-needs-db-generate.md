---
id: LESSON-0439
type: gotcha
domain: tooling
tags: [prisma, db-generate, gitignored, stale-client, cherry-pick, worktree]
context: integrating a change that edits `prisma/schema.prisma` into a DIFFERENT checkout than the one it was authored in (e.g. cherry-picking from a Codex worktree into the main checkout)
trigger: use this when a cherry-picked or manually-applied commit touches `prisma/schema.prisma` and the receiving checkout starts throwing "Unknown field"/"Unknown argument" errors at RUNTIME while `tsc` stays green
source: "funko-tracker .pandacorp/run/lessons.md 2026-10-19 (agent-inferred)"
provenance: agent-inferred
created: 2026-10-19
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0410]
---

**Situation:** a Prisma schema change authored in a Codex worktree was integrated into another checkout
via cherry-pick. The generated Prisma client is gitignored (it is a build artifact, not committed), so
the receiving checkout kept its OWN, now-stale generated client. `tsc` stayed green because it type-checks
against that same stale client's own generated types — which still agree with each other — while the
running dev server threw "Unknown field" at runtime the moment code tried to use the new schema field.

**Lesson:** a gitignored, generated-from-schema client is a second, independent copy of "the schema" that
only a regeneration step keeps honest. Integrating the SOURCE change (the `.prisma` file) without
re-running the generator leaves two schemas silently disagreeing — the type checker cannot catch this,
because it checks the generated types against themselves, not against the `.prisma` source that produced
them.

**Apply next time:** whenever a change that touches `prisma/schema.prisma` lands in a checkout through
any path other than that checkout's own normal build pipeline (a cherry-pick, a manual patch, a merge
from another worktree), run `pnpm db:generate` (or the project's equivalent) immediately after — before
trusting a green `tsc` as proof the integration is complete.
