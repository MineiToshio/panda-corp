---
id: LESSON-0665
type: gotcha
domain: bash
tags: [pipefail, sigpipe, pipe-buffer, bash-gotcha, gate-script]
context: a bash script under `set -o pipefail` pipes a potentially large/variable-size string into a reader such as grep -q via `printf "$var" | grep -q pattern`
trigger: use this when writing or reviewing a bash script under `set -o pipefail` that pipes a string into grep/another short-circuiting reader via `printf "$var" | cmd`
source: "funko-tracker-triggered panda-corp fix, 2026-11-10 (agent-inferred) — BL-0306, overlay 8.119.1: canary.sh, verify.sh and doc-lint.sh all used `printf \"$big\" | grep -q ...`; once the piped payload exceeded the kernel pipe buffer, `grep -q` found its match and closed its read end early, the still-writing `printf` received SIGPIPE, and under `pipefail` the pipeline's exit status became the WRITER's signal-exit rather than grep's real match result — producing a false verdict. Fixed by switching to a here-string (`grep -q pattern <<<\"$big\"`), which removes the pipe entirely."
provenance: ci-verified
created: 2026-11-11
status: active
promotion: none
confidence: high
times_applied: 0
applied_in: [panda-corp, funko-tracker]
links: [LESSON-0078]
---

**Situation:** three of the factory's own gate scripts (`canary.sh`, `verify.sh`, `doc-lint.sh`) wrote a
large/variable-size string through `printf "$var" | grep -q pattern` under `set -o pipefail`. On a
sufficiently large payload, this intermittently produced the WRONG verdict — not because grep's own
match logic was wrong, but because of how pipes, early-exit readers, and `pipefail` interact.

**Lesson:** `grep -q` returns as soon as it finds a match and closes its read end — it does not need to
read the rest of its input. If the writer side of the pipe (`printf`) still has unwritten data larger
than the kernel's pipe buffer at that moment, writing to a closed pipe raises SIGPIPE, and the writer
exits via that signal. Under `pipefail`, the pipeline's reported exit status is a function of EVERY
stage, and a writer's signal-exit can surface as the pipeline's own failure status even though the
reader (grep) actually found what it was looking for — the verdict becomes dependent on payload size
relative to the pipe buffer, not on the actual grep result. This is distinct from LESSON-0078's
`$?`-after-a-bare-pipe trap (which is about reading the wrong command's exit code); here even
`PIPESTATUS`-aware code can be fooled because the writer's own exit code is genuinely a SIGPIPE, not a
normal success.

**Apply next time:** avoid piping a string you built in-process into a short-circuiting reader at all —
use a here-string (`grep -q pattern <<<"$var"`) or a here-doc instead of `printf "$var" | grep`. This
removes the pipe (and the SIGPIPE race) entirely, rather than trying to catch or ignore the writer's
signal after the fact. Treat any `printf "$x" | <reader-that-can-exit-early>` pattern in a gate script as
a latent, payload-size-dependent false-verdict risk, especially where `$x` can grow large (a full
transcript, a large diff, a long file list).
