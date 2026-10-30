---
id: LESSON-0551
type: gotcha
domain: factory-engineering
tags: [pkill, denylist, block-dangerous, verify.sh, host-wide-kill, concurrent-sessions]
context: a dangerous-command denylist (e.g. `plugin/scripts/block-dangerous.sh`'s `SERVER_KILL_TARGETS`) scoped to dev-server/test-runner BINARY names, invoked from a session that wants to stop its OWN long-running gate/verification script by name
trigger: use this when an agent is about to run `pkill -f`/`killall` against the name of a project gate/verification SCRIPT (e.g. `verify.sh`) rather than a dev-server binary, on a machine that may be running other concurrent sessions' gates
source: "funko-tracker .pandacorp/run/lessons.md (undated, agent-inferred) — an agent nearly ran `pkill -f verify.sh` to stop a hung local gate; `verify.sh` is not covered by `block-dangerous.sh`'s `SERVER_KILL_TARGETS` regex (scoped to next/node/vite/playwright/pnpm/npm/npx/tsx), so the command would have been ALLOWED and would have killed every `verify.sh` process on the host, including other sessions' in-flight gates, not just the caller's own"
provenance: agent-inferred
created: 2026-10-30
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [BL-0223, LESSON-0530, BL-0282]
---

**Situation:** the factory's dangerous-command denylist (shipped after BL-0223, LESSON-0530) blocks
`pkill -f`/`killall` patterns matching a fixed list of dev-server/test-runner BINARY names so an agent
cannot accidentally kill another session's `next`/`node`/`vite` process host-wide. That protection does
NOT extend to the factory's and projects' own named gate/verification SCRIPTS (`verify.sh`, a project's
`merge-queue.sh`, etc.) — `pkill -f verify.sh` matches none of the listed tokens, so it is currently
ALLOWED, even though it is exactly the same host-wide hazard: on a machine running several concurrent
agent sessions, each possibly running its OWN `verify.sh`, a single session's `pkill -f verify.sh` kills
every session's gate by command-line substring match, not just the caller's own.

**Lesson:** the existing denylist's protection is scoped to "binaries a dev server/test runner process
would be named" — but the SAME host-wide-pattern-kill hazard applies equally to any recurring,
predictably-named SCRIPT an agent runs as a long-lived foreground/background process (a gate script, a
build script, a queue script), which is a distinct and currently-uncovered category from "binaries."
Enumerating only binary names left this sibling category open, the same shape of gap LESSON-0530
documents for sibling BINARY names (`vite`/`vitest`) — but here the missing coverage is a whole class of
process (named scripts), not a single sibling token.

**Apply next time:** when stopping your own long-running gate/verification process, never use `pkill -f
<script-name>` — record its PID (`$!`) when you start it and stop only that PID (or its process group:
`kill -- -$PGID`), the same discipline BL-0223's `serve-once.sh` already enforces for dev servers. When
auditing or extending a host-wide-kill denylist, treat "project/factory gate and orchestration script
names" as their own enumerated category alongside dev-server binaries — don't assume binary-name
coverage generalizes to script names.
