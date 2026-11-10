---
id: BL-0306
type: bug
area: templates
title: "Gate scripts under pipefail misreport when an early-exiting reader SIGPIPEs a large producer"
status: done
severity: p1
opened: 2026-11-10
closed: 2026-11-10
source: "funko-tracker upgrade to overlay 8.119.0: verify.sh --canary exit 1, reproduced 5/5 by the integrator"
closes: "DR-146 addendum (deterministic gate verdicts); overlay 8.119.1"
links: [DR-146, DR-079]
---

## Problem
Upgrading funko-tracker to 8.119.0, `verify.sh --canary` failed with `11/12 gate(s) proven still-RED …
✗ CANARY: gate 'playwright (specs NOT discovered: shell …)' stayed GREEN` and
`canary.sh: line 166: printf: write error: Broken pipe`. The project's `canary.sh` was byte-identical to
`plugin/templates/stack-a-nextjs/canary.sh`, so the defect predates 8.119.0. The verdict depended on the
size of a command's output and on scheduling: a nondeterministic gate result.

## Root cause
`canary.sh` runs under `set -o pipefail` and checked spec discovery with
`printf '%s' "$listing" | grep -q "<spec>.spec.ts"`. With a `playwright test --list` listing larger than
the 64 KB pipe buffer, `grep -q` exits on the first match, `printf` dies of SIGPIPE, and pipefail reports
the whole pipeline as failed, so a discovered spec reads as missing. The same shape (`producer | grep -q`)
appeared in sibling scripts where the producer is not byte-bounded.

## Fix plan
Replace every byte-unbounded `producer | grep -q` under pipefail with a here-string
(`grep -q … <<<"$value"`), which has no pipe and no SIGPIPE:
1. `plugin/templates/stack-a-nextjs/canary.sh`: spec discovery (the reported failure) and the DR-100 `head -n 25 | grep -Eq` check.
2. `plugin/templates/stack-a-nextjs/verify.sh`: the DR-100 residual-ambiguity `head -n 25 | grep -Eq` (a SIGPIPE there would read as "not ACTIVE", a false green).
3. `plugin/templates/shared/.pandacorp/doc-lint.sh`: `has_key` and the `ui: true` check (`frontmatter | grep -q`; an unterminated frontmatter prints the whole file) and the REQ lookup (`printf "$all_reqs" | grep -qx`).
4. `plugin/scripts/preflight-implement.sh`: `fm_has_active` / `fm_is_verified` (`head -n 25 | grep -Eq`).
Judged safe and left as is: `grep status.yaml | head -1` (check-build-liveness, preflight, doc-lint
`created_via`), `sort -V | head -1` over two lines, `grep -o … | head -1` over one engine constant,
`git worktree list | awk | head -1` (awk reads everything and prints one line), detect-gate-config-newer's
`| head -1` over a one-line `$schema` match, doc-lint `closing_frontmatter | grep | head -1 || true`
(grep does not exit early; status masked, captured value correct), and the `echo "$head_bp" | grep -Eq`
checks in preflight (a 25-line frontmatter captured first, far below the pipe buffer). Scripts without
pipefail (green-stamp.sh, verify-before-stop.sh) report the last command's status, so they are not affected.

## Tests (prove the fix — TDD, RED → GREEN)
`plugin/scripts/test-pipefail-readers.sh` (in `run-engine-tests.sh`): runs the REAL template `canary.sh`
against a stub `pnpm` whose `playwright --list` prints >64 KB with the specs first, 5 runs, and the REAL
`doc-lint.sh` on a work order with an unterminated >64 KB frontmatter, 5 runs. Against the previous
templates (`CANARY_UNDER_TEST` / `DOCLINT_UNDER_TEST`): 1 passed, 10 failed. After the fix: 11 passed.

## Done when
Both regression sections are green 5/5, `test-verify-gate-report.sh` stays green, and overlay 8.119.1
carries the fixed `canary.sh`, `verify.sh` and `doc-lint.sh` to projects through `/pandacorp:upgrade`.
