---
id: LESSON-0188
type: gotcha
domain: tooling
tags: [shell, bash, test, pnpm, alias, file-existence-check, enoent, shell-profile]
context: "running a plain POSIX file-existence check (`test -f <path>` / `[ -f <path> ]`) from an agent's Bash tool inside ANY directory (project-local or the factory root) whose shell profile, project config, or a global alias shadows the `test` command — including directories with no package.json at all"
trigger: "use this when you need to check whether a file exists from the Bash tool, especially chained with && / || (e.g. test -f X && ... || echo not-found) — prefer a non-shadowable check over the bare test/[ builtin; a nonzero exit from a shadowed test reads as a clean false in that chain, not as an error"
source: "factory/memory/_inbox.md agent-inferred note (personal-page-v2 session) — `test -f <path>` run from the Bash tool inside `personal-page-v2/` silently invoked `pnpm test <path>` (a real `vitest run` filtered to that path) instead of the POSIX file-test builtin, printing \"No test files found, exiting with code 1\" instead of a true/false existence check. Corroborating instance (2026-09-18, panda-corp itself, scheduled pandacorp-memory-review PASO 0 run): at the repo root (`panda-corp/`, NO package.json present) `test` was shadowed by a GLOBAL shell-profile alias (`alias test='npm test'`, confirmed via `type test`/`alias | grep test`) — it fired even with no package.json in the directory. This instance's failure mode was also NOT the prior clean test-runner-shaped output: `npm test` hit `npm error code ENOENT ... Could not read package.json`, a nonzero exit that a `test -f X && ... || echo \"no existe\"` chain silently swallowed and misread as \"file does not exist\" for a file that demonstrably existed (`factory/memory/_inbox.md`, 868 lines). Nearly produced a wrong \"0 pending notes, file missing\" read in that same PASO 0 sweep before catching it."
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

**Second instance (2026-09-18, panda-corp root, no package.json):** the same shadowing recurred one level
up the stack — a GLOBAL shell-profile alias (`alias test='npm test'`, paired with `build`/`dev`/`lint`/
`start` → `npm run *`) shadowed `test` even in a directory with no `package.json` at all, so there was no
project-local shim to blame. This time the failure mode was NOT test-runner-shaped output: `npm test` hit
`npm error code ENOENT ... Could not read package.json`, a plain nonzero exit. A `test -f X && ... ||
echo "no existe"` chain treats ANY nonzero exit as "false", so it silently reported the target file as
missing — for a file that demonstrably existed. This is a quieter, more dangerous failure than the first
instance: no plausible-but-wrong test output to notice, just a wrong boolean swallowed by the `&&`/`||`
chain's own error handling.

**Lesson:** `test`/`[` is not guaranteed to be the shell builtin in ANY directory an agent operates in —
not just inside a JS/TS project with a `test` script, but also at a plain directory with no package.json,
because the shadow can live at the shell-PROFILE level (a global alias), not just a project-local shim.
The failure mode varies with what the shadowing command does when it can't do its normal job: a package
manager's test runner tends to print test-runner-shaped output (instance 1); a bare `npm test` outside any
package tends to exit nonzero with an ENOENT-style error (instance 2) — and that nonzero exit is exactly
what a `test -f X && ... || echo "not found"` idiom is designed to interpret as "false", so it launders a
tooling error into a wrong, confident negative with no visible sign anything went wrong.

**Apply next time:** never rely on bare `test -f`/`[ -f ... ]` (or other POSIX test operators) from the
Bash tool to check file existence — not even at the factory root, not even with no package.json in sight —
use `ls <path> 2>/dev/null`, `[[ -f <path> ]]` (bash's own keyword form, less commonly shadowed), or the
`Read`/`Glob` tools instead. Two tells that `test` has been shadowed, not misused: (1) test-runner-shaped
output (e.g. "No test files found") instead of a clean pass/fail; (2) inside a `&&`/`||` chain, an
unexpectedly confident "file does not exist" for a path you have independent reason to believe exists —
re-verify with `[[ -f ]]` or the Read tool before trusting the chain's branch, since a shadowed `test`'s
nonzero exit is indistinguishable from a real "false" to the shell. Run `type test` or `alias | grep test`
once per unfamiliar environment (new machine, new shell session, or a directory outside the usual project
set) if file-existence checks start behaving oddly.
