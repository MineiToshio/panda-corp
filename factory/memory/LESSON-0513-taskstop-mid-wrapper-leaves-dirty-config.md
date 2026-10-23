---
id: LESSON-0513
type: gotcha
domain: tooling
tags: [taskstop, playwright, cleanup, finally, git-add, shared-checkout]
context: stopping/interrupting (TaskStop) a process mid-way through a wrapper script that writes a temporary config override and restores it in a finally/cleanup block
trigger: use this when a long-running wrapped command (e.g. a Playwright run with an env-override wrapper) is stopped mid-execution, before trusting that the wrapper's config file is back to its committed state, and before running any broad git-staging command afterward
source: "funko-tracker .pandacorp/run/lessons.md 2026-10-21/22 (agent-inferred) — stopping a gate mid-Playwright left e2e/server-env.json with the wrapper's temporary overrides because its finally/cleanup block never got to run; those dirty overrides were almost swept into a commit via a blind `git add -u`, caught and fixed with amend before pushing"
provenance: agent-inferred
created: 2026-10-23
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0043]
---

**Situation:** a Playwright-running wrapper temporarily rewrote a shared config file (`server-env.json`)
and restored it in a `finally` block. Killing the process via TaskStop mid-run skipped that `finally`,
leaving the config file holding the wrapper's temporary overrides on disk — indistinguishable at a glance
from an intentional edit. Those leftover overrides were nearly committed via a blind `git add -u`.

**Lesson:** a `finally`/cleanup block is not a guarantee against an external kill signal — SIGTERM/SIGKILL
from a stop control can abort the process before its own cleanup runs, so "it restores itself in finally"
is only true for a clean exit. Any later broad staging command then has a real chance of picking up that
leftover dirty state as if it were genuine work, with nothing flagging it as wrapper residue.

**Apply next time:** after stopping ANY long-running wrapped process mid-task, check `git status` in full
for the wrapper's known scratch/override files before doing anything else with the checkout; never run
`git add -u` (or any broad staging command) without first reading `git status` — a wrapper's own
interrupted cleanup is exactly the kind of silent drift that slips into a commit otherwise (see
LESSON-0043 on evaluating provenance of stray files before staging). If a wrapper's restore step is
safety-critical, consider a trap/signal handler instead of a plain `finally`, or `git checkout` the file
back to its last-committed state as a belt-and-suspenders recovery after any abnormal stop.
