---
id: LESSON-0276
type: gotcha
domain: build-engine
tags: [exit-code, background-task, verify-sh, bash-tool, false-green]
context: running a gate/verify script in the background behind a shell wrapper (e.g. `bash verify.sh > log 2>&1; echo "EXIT=$?"`, or a `( cmd & ) &`-style backgrounding) and reading the task's own completion/exit status rather than the log or the actual background process
trigger: use this when a backgrounded gate/verify invocation reports a completion/exit status via a task notification or wrapper exit code, before trusting that code as the gate's own result
source: "personal-page-v2 .pandacorp/run/lessons.md 2026-09-xx, agent-inferred — a backgrounded `bash verify.sh > log 2>&1; echo \"EXIT=$?\"` reported the harness/echo's own exit code (0) twice while the gate itself was RED; a truncating `| tail -N` on the same output hid the real summary line that would have contradicted the false-green reading. CROSS-PROJECT corroboration (panda-corp, 2026-11-21, agent-inferred, pandacorp-memory-review harvest): a backgrounded `( queue ... ) &` form submitted inside a single Bash tool call made the tool's own task report 'complete' as soon as the FOREGROUND part of the call returned, not when the actual backgrounded queue invocation finished — a distinct mechanism (the harness's own task-completion signal, not a captured exit code) producing the same class of false 'it's done' reading. Fix: poll the actual completion marker (e.g. a `.exit` file the backgrounded process writes) with a Monitor/until-loop instead of trusting the Bash call's own return."
provenance: agent-inferred
created: 2026-10-01
status: active   # 2026-11-21 (pandacorp-memory-review harvest, eval-gate) — cross-corroborated across 2 distinct projects (personal-page-v2, panda-corp), schema-valid, no contradiction with a higher-confidence lesson; promotes per DR-047
promotion: none
confidence: medium
times_applied: 1
applied_in: [panda-corp]
links: [LESSON-0078]
---

**Situation:** a gate was launched backgrounded as `bash verify.sh > log 2>&1; echo "EXIT=$?"`. The
task-completion signal (the harness's own notification, or the wrapper command's own exit code) read as
success twice, even though the gate script itself had gone RED — the `EXIT=` line correctly captured the
gate's real code INSIDE the log, but nothing read that line before trusting the outer "it finished"
signal as "it passed."

**Lesson:** this is a sibling trap to LESSON-0078 (a bare pipe's `$?` is the last command's, not the
gate's) but with a different mechanism: here the exit-code capture itself was written correctly
(`echo "EXIT=$?"` immediately after the gate), yet the WRAPPER/backgrounding harness's own reported
completion status is a separate signal from that captured line, and defaults to looking like success
unless the log is actually opened and the `EXIT=` marker located. A truncating read (`| tail -N`) on that
log is a second way to miss the same line if it happens to scroll past the window kept.

**Apply next time:** for any backgrounded gate run, never conclude pass/fail from the task
notification/harness's own reported status alone — open (or grep) the captured log for the literal
`EXIT=` marker and read that value directly. Avoid a truncating `tail -N` on the same read until the
marker has been located; if scoping the output for length, grep for `EXIT=` explicitly rather than taking
the tail of the whole log.

**Second occurrence, a different mechanism with the same symptom (panda-corp, 2026-11-21):** a
backgrounded `( queue ... ) &` submitted inside one Bash tool call makes the TOOL's own "task complete"
notification fire once the call's FOREGROUND part returns, not when the actual backgrounded command
finishes — there is no wrapper exit code to misread here; the completion signal itself is simply
premature. Apply: poll the real completion marker the backgrounded process writes (e.g. a `.exit` file)
with a Monitor/until-loop, rather than treating the Bash tool call's own return as proof the backgrounded
work is done. (The harness blocks a long foreground `sleep N`, which is why this backgrounding pattern
gets reached for in the first place — the fix is polling the marker, not a longer foreground wait.)
