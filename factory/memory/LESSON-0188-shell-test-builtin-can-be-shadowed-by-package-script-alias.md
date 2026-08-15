---
id: LESSON-0188
type: gotcha
domain: tooling
tags: [shell, bash, test, pnpm, alias, file-existence-check]
context: "running a plain POSIX file-existence check (`test -f <path>` / `[ -f <path> ]`) from an agent's Bash tool inside a JS/TS project directory whose shell profile or project config shadows the `test` command"
trigger: "use this when you need to check whether a file exists from the Bash tool inside a project directory, especially one with a `test` script in package.json — prefer a non-shadowable check over the bare `test`/`[` builtin"
source: "factory/memory/_inbox.md agent-inferred note (personal-page-v2 session) — `test -f <path>` run from the Bash tool inside `personal-page-v2/` silently invoked `pnpm test <path>` (a real `vitest run` filtered to that path) instead of the POSIX file-test builtin, printing \"No test files found, exiting with code 1\" instead of a true/false existence check"
provenance: agent-inferred
created: 2026-08-11
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** inside `personal-page-v2/`, running `test -f <path>` from the Bash tool did not run the
POSIX file-test builtin — something in that project/shell's profile shadowed `test` as an alias/function
for the package's `test` script (`pnpm test`), so the command silently launched a real `vitest run`
filtered to that path and reported "No test files found, exiting with code 1" instead of a true/false file
check.

**Lesson:** `test`/`[` is not guaranteed to be the shell builtin in every project directory an agent
operates in — a project-local shell profile, alias, or a package-manager shim can shadow it with an
unrelated command (here, a JS test runner), and the failure mode is silent: no error about a missing
command, just a plausible-looking but wrong result that can be misread as "file does not exist" or as an
unrelated test-suite failure.

**Apply next time:** never rely on bare `test -f`/`[ -f ... ]` (or other POSIX test operators) from the
Bash tool to check file existence inside an unfamiliar project directory — use `ls <path> 2>/dev/null`,
`[[ -f <path> ]]` (bash's own keyword form, less commonly shadowed), or the `Read`/`Glob` tools instead.
If a `test -f` invocation ever produces test-runner-shaped output (e.g. "No test files found") rather than
a clean pass/fail, that is the tell that `test` has been shadowed, not a real test failure — switch to a
different existence check rather than debugging the phantom test run.
