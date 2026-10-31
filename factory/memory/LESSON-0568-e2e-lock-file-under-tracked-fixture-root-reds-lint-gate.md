---
id: LESSON-0568
type: gotcha
domain: testing
tags: [e2e, lock-file, fixture-root, biome, dead-pid]
context: an e2e test server writes a PID-keyed lock file/directory for an in-process ledger or similar resource, and that lock path lives under a git-tracked fixture root the test suite shares
trigger: "use this when an e2e test server crashes or is killed mid-run and verify.sh's lint/format gate reds afterward with no apparent product-code change"
source: "mission-control .pandacorp/run/lessons.md 2026-10-31 (agent-inferred) — the e2e server left a dead-pid gamification-ledger lock directory under the shared, git-tracked fixture root; the lock dir's leftover file then made biome red on the next verify run, with no relation to the actual code under test"
provenance: agent-inferred
created: 2026-10-31
status: candidate
promotion: none
confidence: low
times_applied: 0
applied_in: []
links: []
---

**Situation:** mission-control's e2e tests run against a server process that maintains a gamification
ledger with a PID-keyed lock directory. When that server process died (crashed or was killed) without
cleaning up, the lock directory was left behind — and because the ledger's lock path lived under the
test suite's shared, git-tracked fixture root (not a gitignored scratch location), the stray file showed
up to `verify.sh`'s lint/format gate (biome) on the next run as an unexpected file, reding the gate for a
reason that has nothing to do with the code under test.

**Lesson:** a resource lock file tied to a process's lifetime (PID-keyed, meant to be transient) is only
safe to place under a directory the test harness controls and cleans — a git-TRACKED fixture root is the
wrong place for it, because any leftover from an abnormal exit becomes a permanent artifact the lint gate
then has to react to, and because it pollutes a directory meant to hold deliberate, reviewed fixture
content with incidental runtime debris.

**Apply next time:** when an e2e test server/dependency writes a PID-keyed or otherwise process-lifetime
lock file, give it a path OUTSIDE any git-tracked fixture tree (a dedicated gitignored run/tmp directory),
or explicitly gitignore that specific lock path if it must live near the fixtures — never let a
process-lifetime artifact share a tracked directory with the fixtures themselves. If a crash can still
leave a stale lock behind, also have the test teardown (or the next run's setup) sweep dead-pid lock
files before asserting the fixture tree is clean.
