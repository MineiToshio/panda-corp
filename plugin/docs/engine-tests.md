# Factory engine test corpus

Run `bash plugin/scripts/run-engine-tests.sh` from the factory checkout. The runner
executes every `test-*.mjs` plus the explicitly listed shell suites, aggregates all
failures and returns nonzero if any suite fails. It never substitutes skipped tests
for missing dependencies.

## Dependencies

The Ubuntu job in `.github/workflows/factory-engine-tests.yml` uses Node 24,
Git, Bash, jq and zsh. zsh is required by the adversarial alias and guarded restore
regressions; replacing those tests with Bash would lose the owner's shell coverage.
It installs the real Codex CLI 0.144.1 for strict config parsing and execpolicy.
The strict config test starts an EOF-only app server in a temporary Codex home,
checks the exact generated config and proves an unknown field is rejected. It
needs neither credentials nor provider reachability; `doctor` checks both and is
therefore unsuitable as an offline config oracle.

The AST and production smoke suites use Mission Control's installed dependencies:
`pnpm --dir mission-control install --frozen-lockfile` (pnpm 10.12.1), then
`pnpm --dir mission-control exec playwright install --with-deps chromium`.
Acorn remains a real independent parser and the CSP fixture still runs Chromium.
Dependency installation needs network access on CI; the test corpus itself uses
local fixtures and must not request a model or contact the provider.

## Fixture isolation

Launcher argument tests provide their own Codex executable; offline preflight tests
use the version-capable worker fixture. The real CLI parser tests remain real CLI
tests. Git fixtures configure a local author and disable signing, including for
subsequent commits. Nothing writes the owner's global Git configuration.

The terminal-revocation regression simulates both OS sleep inhibitors (caffeinate
and systemd-inhibit), keeping Linux CI independent of a system D-Bus session. Its
supervisor waits for the launch receipt, with a bounded deadline, instead of racing
a fixed 1.5-second lifetime against the launcher's startup work. The invariant is
unchanged: first revocation fails, launcher exits 3, EXIT retries, receipt is revoked.

## Whole-FRD documentation oracle

`test-whole-frd-gate-contract.mjs` reads the current bespoke Manual renderer,
`mission-control/src/app/manual/manualPages.tsx`. The old `workflow-flows.ts` was
deleted in `519570d1`; the whole-contract, traceability and no-waiver assertions
remain intact. The explanation lost in that deletion is restored in the renderer
(REQ-08-013, original decision 2026-07-13).

## Restricted local verification

A sandbox may forbid process inspection (`ps`), loopback listeners, Chromium, or
writes to `.codex`. Report those failures separately from CI defects. Do not mock
those checks away or declare the complete runner green. The projection regeneration
checks can additionally be run in a disposable copy with writable `.codex`, using
the same committed inputs and real CLI. Ubuntu execution remains required to prove
the job's dependency installation; macOS results alone cannot certify it.
