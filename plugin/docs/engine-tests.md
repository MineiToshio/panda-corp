# Factory engine test corpus

Run `bash plugin/scripts/run-engine-tests.sh` from the factory checkout. The runner
executes every `test-*.mjs` plus the explicitly listed shell suites, aggregates all
failures and returns nonzero if any suite fails. It never substitutes skipped tests
for missing dependencies.

## Dependencies

The Ubuntu job in `.github/workflows/factory-engine-tests.yml` uses Node 24,
Git, Bash, jq, lsof and zsh. zsh is required by the adversarial alias and guarded restore
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

Product-build suites exercise `plugin/runtime/build/` through fixture projects
and fake workers, including lease fencing, relay, admission and landing. They
do not certify real provider reachability or unattended process survival. The
separate factory backlog Workflow retains its own harness.

## Whole-FRD documentation oracle

The canonical whole-FRD gate policy is `plugin/agents/reviewer.md`. The build
engine reads that policy into unit briefs, and the Codex reviewer projection is
generated from the same source. Retired project-executor documentation and
deleted Manual renderers are not current verification oracles.

## Restricted local verification

A sandbox may forbid process inspection (`ps`), loopback listeners, Chromium, or
writes to `.codex`. Report those failures separately from CI defects. Do not mock
those checks away or declare the complete runner green. The projection regeneration
checks can additionally be run in a disposable copy with writable `.codex`, using
the same committed inputs and real CLI. Ubuntu execution remains required to prove
the job's dependency installation; macOS results alone cannot certify it.

## Stack A template conformance

`test-template-e2e-conformance.mjs` is auto-discovered by the same runner. It copies
Stack A's `biome.json` and complete `e2e/` into a disposable Git repository (with
an empty ignore file, so no factory ignore can hide template files), then runs
`biome check e2e --error-on-warnings`. It also checks named hydration imports,
including aliases, against the helper's exported functions. Missing-export and
formatting negative controls prove both checks fail on regressions.

The Biome binary comes from the existing Mission Control dependency installation;
`PANDACORP_TEMPLATE_DEPS_DIR` may point to another installed project's directory
for local verification. Missing Biome fails the test. No install or dependency
change is needed in CI.

## Queue measurement (proposal 43 phase 0)

The explicitly registered `test-queue-log-events.sh` covers exits 0/10/11/12/13/14/20/21,
landing SHA versus main's reflog, a killed gate's durable start, nested project paths
and non-blocking logging errors. `test-gate-report-archive-unique.sh` covers consecutive
red/green reports and an immutable UUID collision. Both use `queue-test-fixture.sh`
with synthetic repositories, local remotes and a temporary host slot directory.
`test-queue-metrics.mjs` is auto-discovered and supplies a test-owned event fixture
plus malformed lines; it checks standard median, nearest-rank p90, Q/R, reused and
interleaved branches, open episodes, rounds and exits.

Run `node plugin/scripts/queue-metrics.mjs <main-project>/.pandacorp/run/queue-log.jsonl`.
JSON goes to stdout and a human table to stderr. Latencies are seconds; only landed
episodes enter Q/R statistics. R uses the branch's first observed `ready` event for
that episode when it predates the first queue start, otherwise the first queue start.
Round statistics include open episodes;
only `start` events count as attempts. Each exit 0 closes an episode, so reusing a
branch starts a new one. A partial/malformed line fails loudly with its line number.
The log is measurement only and is not a certification or pre-push proof in phase 0.

The phase 0 review regressions add explicit TERM/INT/HUP outcomes under Bash 3.2
(`test-queue-log-events.sh --signals-only` runs those three checks without a listener).
Each signal must produce exactly one 128+signal end and zero landed metric episodes.
Archive tests hold the real verifier's kernel lock to prove exit 75 preserves the old
report without archiving it, and reject a non-contended run that never rewrites its report.
An archive requires a changed file generation or content written during this gate
(metadata-only changes are rejected), the gate's start commit, full scope and a current
report timestamp; bytes are read once and created with
exclusive-file semantics. Logging/provenance failures retain the queue's original verdict.
Overlapping attempts stay attached to their starting episode: only its first successful
end closes it; later ends still count as exits but cannot alter its landing or clear a
new active episode. `pending_attempts` exposes unfinished attempts, including on a closed
episode. Every known v1 event has required typed fields; unknown names, invalid status,
load or duration values and malformed timestamps fail with the source line number.
