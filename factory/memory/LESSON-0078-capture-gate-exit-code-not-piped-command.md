---
id: LESSON-0078
type: gotcha
domain: build-engine
tags: [verify-sh, exit-code, pipefail, playwright, preview-server]
context: running a project's green gate (verify.sh or any CI script) through a pipe (e.g. `| tail`, `| grep`) to shorten its output
trigger: use this when checking whether a gate/verify script passed and its output is piped through another command
source: "panda-corp — a piped `bash verify.sh | tail` reported the pipe's own exit code, masking a red gate as green"
provenance: agent-inferred
created: 2026-07-05
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** running the gate as `bash verify.sh | tail` and then checking `$?` reported `tail`'s exit
code (almost always 0), not `verify.sh`'s — a genuinely red gate looked green because the failure was
masked by the pipeline's last command succeeding at its own job (printing lines).

**Lesson:** in a POSIX shell, `$?` after a pipe reflects the LAST command in the pipeline by default,
not the one whose exit code actually matters. Any time a gate's output is piped for readability, the
exit-code check must target the gate itself (`set -o pipefail`, or capture `${PIPESTATUS[0]}`, or simply
run the gate un-piped and view its full output) — never trust `$?` after a bare pipe. Separately: a
preview dev server left running on a port a Playwright `webServer` config wants to bind (e.g. `:3000`)
makes the smoke suite fail to start the server, also reding the gate for a reason unrelated to the code
under test — stop any preview server before running `verify.sh`.

**Apply next time:** never pipe a gate script's invocation through another command without also
capturing the gate's own exit code explicitly; check for and stop stray preview servers before trusting
a red verify.sh is a real code failure.
