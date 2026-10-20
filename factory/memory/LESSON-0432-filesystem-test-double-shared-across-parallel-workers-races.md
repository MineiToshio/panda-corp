---
id: LESSON-0432
type: gotcha
domain: testing
tags: [vitest, parallel-workers, test-double, mail-outbox, flaky-test]
context: two or more test files use the SAME on-disk directory as a file-based test double (a mail outbox, a fixture scratch dir) and the suite runs with parallel workers
trigger: use this when a vitest/jest suite is intermittently flaky in the FULL run but passes reliably when the failing file is run alone
source: "funko-tracker .pandacorp/run/lessons.md 2026-10-18 (agent-inferred)"
provenance: agent-inferred
created: 2026-10-19
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0099]
---

**Situation:** `src/lib/auth/_tests/auth.test.ts` and `src/app/(auth)/_tests/actions.test.ts` both read
and write the SAME `MAIL_OUTBOX_DIR` on disk (a file-based double standing in for a real mail provider).
Run in isolation, each test file passed every time. Run as part of the full suite with parallel workers,
one file's teardown deleted/overwrote the outbox while the other was mid-assertion, producing
intermittent, hard-to-reproduce failures.

**Lesson:** a file-based test double is implicitly a SHARED GLOBAL RESOURCE the moment more than one
test file touches the same path — parallel test workers give no ordering guarantee between them, so two
files racing on the same outbox directory behave exactly like two threads racing on a shared mutable
variable with no lock. This is invisible when running either file alone, which is why it reads as
"intermittent" rather than deterministically broken.

**Apply next time:** when a file-based test double (mail outbox, fixture dir, written-to-disk queue) is
shared by more than one test file, isolate it per worker/per-file — a path keyed by `process.env.VITEST_
WORKER_ID` or by the test file's own name, or an in-memory double instead of a filesystem one — rather
than pointing every consumer at the same static directory.
