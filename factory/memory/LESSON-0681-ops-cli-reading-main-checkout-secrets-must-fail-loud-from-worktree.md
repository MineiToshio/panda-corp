---
id: LESSON-0681
type: gotcha
domain: build-orchestration
tags: [worktree, env-production, secrets, fail-loud, ops-tooling]
context: a project's own ops/admin CLI command reads a root dotenv file (`.env.production`) that is deliberately NOT copied into git worktrees (DR-037 secret hygiene — production secrets live only in the three root dotenv files, not duplicated per worktree), and the command is invoked from inside a worktree instead of the main checkout
trigger: use this when a project's own production-ops CLI command returns an empty/missing value for a variable that should be defined in `.env.production`, right after the command was run from a worktree rather than the main checkout
source: "funko-tracker `.pandacorp/run/lessons.md` 2026-11-12 (agent-inferred): `pnpm env:run ops production -- ...`-style commands read `.env.production` from the MAIN checkout by design (it is never copied into worktrees — DR-037); run from inside a worktree instead, `DATABASE_URL_UNPOOLED` came back empty rather than the command refusing to run."
provenance: agent-inferred
created: 2026-11-13
status: candidate
promotion: none
confidence: low
times_applied: 0
applied_in: []
links: [DR-037, LESSON-0102, LESSON-0131]
---

**Situation:** a project's own production-ops command loaded `.env.production` from the main checkout's
root — correct behavior, since production secrets are deliberately NOT copied into every disposable
worktree (DR-037: secrets live only in the three root dotenv files, never duplicated per worktree). When
that same ops command was invoked from inside a worktree (where `.env.production` genuinely doesn't
exist), a required variable (`DATABASE_URL_UNPOOLED`) silently resolved to an empty string instead of the
command refusing to run — no error pointed at "you're not in the main checkout" or "this required secret
is missing."

**Lesson:** this is NOT the same failure as LESSON-0102's family (a worktree-bootstrap script copying a
config and failing to retarget its embedded absolute paths) — here, deliberately NOT copying the
production secret file is the CORRECT security posture (copying `.env.production` into every ephemeral
worktree would be worse). The defect is that the ops command has no guard for its own precondition: it
assumes a required production secret will be present and silently degrades to an empty value when it
isn't, rather than asserting the precondition and failing loud. An empty secret used downstream (e.g. as
part of a connection string) can produce a confusing, unrelated-looking failure far from the actual cause.

**Apply next time:** when a project's own ops/admin CLI command intentionally reads secrets ONLY from the
main checkout (never duplicating them into worktrees, per DR-037), have the command itself assert that
every required variable from that file is present and non-empty before proceeding — fail loud with a
message naming the missing variable and suggesting "run from the main checkout," rather than letting an
empty string propagate silently into the operation. Don't treat "deliberately not copied into worktrees"
as license to skip the precondition check; it's the opposite — the more deliberate the exclusion, the more
important the guard that catches the one caller who forgot it.
