---
id: LESSON-0544
type: gotcha
domain: build-orchestration
tags: [worktree, port, env-config, auth, data-identity, merge-queue, server-env]
context: a project's per-worktree PORT allocation also drives more than one derived environment URL (an auth callback origin AND a URL baked into already-seeded data in a shared gate database)
trigger: use this when a worktree-derived PORT feeds more than one environment URL and the instinct is to rewrite/preserve all of them the same way
source: "funko-tracker .pandacorp/run/lessons.md 2026-10-29 (owner-stated Pareto decision + agent-inferred diagnosis); BL-0288 (closed 2026-10-29, plugin 9.145.2 / overlay 8.114.1 — worktree-bootstrap.sh PORT-only + merge-queue.sh gates on the committed e2e/server-env.json)"
provenance: owner-stated
created: 2026-10-30
status: active
promotion: none
confidence: high
times_applied: 0
applied_in: []
links: [BL-0288, LESSON-0478, LESSON-0533, LESSON-0102]
---

**Situation:** funko-tracker's per-worktree e2e needed its own `PORT`, and two environment URLs derive
from it with opposite correctness requirements. `BETTER_AUTH_URL` must track wherever the server
actually listens now (moving it with the port is correct — stale it and auth callbacks 403 on an
Origin mismatch). `ORACLE_MEDIA_BASE_URL` is itself **data**: 400 media rows were seeded in the shared
gate DB with that exact origin baked into their stored URLs — move it to the worktree's port and 0/400
images resolve, because the data wasn't re-seeded, only the pointer was. Rewriting both URLs together to
match the new port broke media; preserving both unmoved broke auth. The fixture needs both to share one
origin, which neither "always rewrite" nor "never rewrite" can satisfy alone.

**Lesson:** not every URL a port feeds is the same kind of "derived" value. Some are **origin-identity**
(describe where the server listens — correct to follow the port wherever it moves) and some are
**data-identity** (describe where data was actually seeded/baked — correct only at the one origin the
data was written against, regardless of where the server happens to run this time). Treating a bundle
of "port-derived URLs" as one class to rewrite or preserve uniformly is the trap — in the same fixture
they can require opposite handling, and the usual "move everything with the port" or "pin everything to
one canonical port" instincts both fail on whichever URL is the wrong kind.

**Apply next time:** before writing a worktree bootstrap or port-isolation script, classify every
environment URL the derived port feeds: does it describe WHERE THE SERVER LISTENS NOW, or an ADDRESS
BAKED INTO ALREADY-SEEDED DATA? Only rewrite the former with the worktree's port; never rewrite the
latter. When a data-identity URL is also required by a shared-DB integration gate, the Pareto fix is not
to make every worktree internally self-consistent — keep the bootstrap PORT-only (don't synthesize a
per-worktree origin for the data-identity URL at all) and instead **serialize the integration gate
itself on the ONE committed config** (lock the merge queue on the committed env file, exit non-zero if
that fixed port is already busy, restore the worktree's own PORT on exit). Also check whether any file
the bootstrap rewrites is itself TRACKED with `skip-worktree` (e.g. a committed `launch.json`) — a
serializing queue that lands other branches must clear only its OWN bootstrap-owned `skip-worktree`
entries before rebasing, or the rebase blocks on files it never meant to touch.

**Corroborating facet (2026-11-06, agent-inferred, funko-tracker):** a partial manual fix — hand-editing
only the origin-identity URL (`BETTER_AUTH_URL`) to the worktree's lane port, leaving the data-identity
URL (`ORACLE_MEDIA_BASE_URL`) on its original port — broke a SEPARATE fixture-validation check that
asserts the two origins must equal each other (22 vitest reds), even though each URL was individually
"correct" for its own kind. Apply next time: when a lane/worktree launcher needs to derive a port-fed
origin, derive every origin that a fixture-validation step expects to match TOGETHER, from the same
source (e.g. a single `FIDELITY_PORT`-style value the launcher computes once) — patching one origin in
isolation to "fix" it can break a consistency check that was relying on both staying aligned, even when
neither individual value is wrong on its own.
