# FLAKY — test isolation investigation

## Reproduction and attribution

The four reported failures reproduce with only their four test files and shuffled test
order. Seed 1 fails navigation; seed 3 fails SSE cleanup, sidebar projects and board
read authorization; seed 7 fails navigation; seed 8 fails navigation and sidebar projects.
Seeds 2, 4, 5 and 6 pass before the fix. Each failure is explained by state retained
between tests within its file; another process is unnecessary to reproduce it.
The upgraded verification script enables shuffled order, whereas `pnpm test` uses
Vitest's default order. This difference explains the original gate/standalone discrepancy.

| Test | Confirmed cause | Correction |
| --- | --- | --- |
| `api/live/_tests/security.test.ts`, simultaneous streams | The privacy test assigns a module-level `file` and deletes it in teardown without clearing the variable. If the stream-limit test follows it, teardown unlinks the already deleted file and throws ENOENT. | Create a unique directory and empty events file before **each** test, override the events path for both tests, abort all connections, reset stores, restore the environment, then strictly remove that test's file and empty directory. |
| `app/_tests/layout.sidebar.test.tsx`, deferred projects | The partial-errors test queues a `projects.mockImplementationOnce` exception, but never renders the deferred slot. `clearAllMocks` clears call history while retaining that unconsumed implementation, which takes precedence over the next test's resolved rows. | Reset all reader mocks before installing each test's defaults; restore console spies even if an assertion fails. |
| `board/actions/_tests/read-doc.security.test.ts`, refused roots | The valid-project test records a call on the shared `readDoc` mock. The refused-root test asserts zero calls without clearing that history. | Clear the boundary mock before each test, retaining its deterministic implementation and all authorization assertions. |
| `navigation/_tests/navigationTransition.test.tsx`, suspended navigation | The shared router retains refresh calls and implementations installed by earlier tests. The unmounted-source test alone has no local reset; other tests only clear selected methods. | Reset every router method before each test, removing both prior calls and closures over prior mounted components. |

## Other suspects checked

- The SSE fixture already used `mkdtempSync`, so its path was unique across processes;
  the ENOENT is a repeated unlink within one process, not a colliding temp filename.
  The stream-limit test previously used the real default events path; it now uses its
  own empty fixture, avoiding owner data and external watcher activity.
- Reader/router mocks and live-event stores are module-local. The tests do not write
  shared repository fixtures. No shared cache or cross-process singleton is needed
  to explain any of the four observed failures.
- These four tests contain no wall-clock assertions or hard waits. Suspended navigation
  is controlled by explicitly resolved promises and React `act`; SSE reads the initial
  frame. The corrections retain those synchronization boundaries and all assertions.
- No global mock-reset setting, worker-count reduction, retry, timeout increase,
  sleep, product-code change or managed-overlay edit is used to obtain green results.

## Validation

Final command outcomes are recorded in the FLAKY delivery report. All verification
processes use `TMPDIR=/private/tmp/pandacorp-e2/FLAKY`; concurrent suites share that
same temporary root and checkout. CPU load is provided by two independent arithmetic
workers, terminated and reaped by their owning validation script.

### Final outcomes (2026-11-12)

| Verification | Result |
| --- | --- |
| Four affected files, `vitest run <files> --sequence.shuffle --sequence.seed=<1..10> --reporter=dot` | 10/10 runs green, 13 tests per run (130 passed). The loop stopped on any failure. |
| Two simultaneous `pnpm test` processes, three consecutive rounds, with two CPU arithmetic workers | 6/6 runs green; each reports 536 files and 5521 passed, 2 existing todo. |
| `pnpm exec vitest run --sequence.shuffle --sequence.seed=<3,8,1> --reporter=dot` | 3/3 full runs green; each reports 536 files and 5521 passed, 2 existing todo. |
| `pnpm lint` | Green; existing Biome schema-version informational message only. |
| `pnpm typecheck` | Green. |
| `pnpm exec knip` | Green; existing configuration hints only. |

The nine full acceptance runs cover 49,689 passing test executions. No test source
changed during those runs. The existing two todo cases were also present in the
initial full diagnostic runs. Raw command output is retained under the requested
TMPDIR in `acceptance-concurrent-*.log`, `acceptance-shuffle-*.log` and `fixed-four-*.log`.
Both validation drivers exited successfully; the CPU workers were terminated and
reaped before close-out. No Git mutation, build, full verify, overlay update, or
product-code change was performed by this task.
