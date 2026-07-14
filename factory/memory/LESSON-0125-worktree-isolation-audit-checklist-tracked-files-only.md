---
id: LESSON-0125
type: pattern
domain: build-orchestration
tags: [worktree, dr-096, isolation, checklist, synthesis]
context: adopting, extending, or debugging git-worktree isolation (DR-096) anywhere in the factory or a product project — dispatch, backup, deploy, gitignored-state reads, or test-runner config
trigger: use this when standing up a NEW use of git-worktree isolation (a new parallel-dispatch pattern, a new daemonized/deploy path, a new derive function, a new test-runner config) and deciding what to audit up front, or when debugging a symptom that only reproduces "inside a worktree" / "only when a parallel session is active"
source: "synthesis over 5 evidence-anchored candidates, all panda-corp, 2026-07-04..2026-07-09: LESSON-0073 (subagent dispatched into a worktree still edited the main checkout), LESSON-0090 (gitignored backup/machinery/cache swept with no external backstop), LESSON-0093 (launchd-served worktree deploy missing PATH/port/data-root), LESSON-0111 (a derive reading gitignored state silently empties inside a worktree, false-reds a 'real repo' test), LESSON-0124 (a test runner's glob swept a sibling worktree's WIP files and node_modules, cross-worktree dependency contamination) — librarian reflection pass, 2026-07-09"
provenance: agent-inferred
created: 2026-07-09
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0073, LESSON-0090, LESSON-0093, LESSON-0111, LESSON-0124, LESSON-0131, LESSON-0158, DR-096]
---

**Situation:** across five INDEPENDENT incidents over five days, DR-096 git-worktree isolation leaked in
five DIFFERENT ways, all tracing to the same one-sentence root cause: **a git worktree only ever carries
what git tracks — nothing gitignored, nothing another process/agent puts elsewhere, and nothing a
generic glob was told to skip.** Each incident was diagnosed and fixed independently before anyone
noticed they were the same class; by the fifth instance the pattern was explicit and worth compressing
into one checklist rather than re-discovering it a sixth time.

**Lesson:** "isolate work in a worktree" is not one guarantee, it is a bundle of FIVE separate guarantees
that each have to be individually engineered — the DR-096 mechanism (a second checkout with its own
working tree) does not automatically provide any of them:
1. **Dispatch fidelity** (LESSON-0073) — a sub-agent told to work in a worktree can still resolve paths
   itself and land edits in the main checkout; the instruction is not the enforcement.
2. **Durability of gitignored state** (LESSON-0090) — a worktree does not change whether gitignored data,
   machinery, or caches are backed up; that is an orthogonal, separately-owned mechanism.
3. **Environmental completeness for daemonized/deployed processes** (LESSON-0093) — PATH, port, and any
   pointer to gitignored live data must be wired explicitly; nothing is inherited "for free."
4. **Correctness of anything reading gitignored state** (LESSON-0111) — code that assumes "no portfolio ⇒
   not a real repo" misreads a worktree as broken; it needs to resolve the REAL root
   (`git rev-parse --git-common-dir` → parent), not trust its own `cwd`.
5. **Test/tooling glob hygiene** (LESSON-0124) — a test runner (or any other whole-tree glob: linter,
   formatter, doc-lint) has no innate reason to skip a worktree nested under a repo-relative path; it
   must be told to, explicitly, or it globs another session's in-flight files and can contaminate module
   resolution.
6. **Project use of the bootstrap extension point** (LESSON-0131, corroborated on personal-page-v2,
   2026-07-10) — the shared `worktree-bootstrap.sh` already reserves a per-project hook
   (`.pandacorp/worktree-setup.sh`) for one-time "new machine" setup (copying gitignored env files,
   running a codegen/content-compiler build); a project that never creates that hook gets a verify.sh
   false red indistinguishable, from the symptom side, from the shared tooling being broken.

**Apply next time:** when a new capability adopts or touches DR-096 worktree isolation, run this
six-point checklist BEFORE the first incident, not after: (1) verify every dispatched agent/process
actually resolves paths relative to the worktree it was handed — check `git status` in both trees after
a parallel wave; (2) if the worktree (or the main checkout) holds gitignored state that would be a real
loss, confirm it has an external backstop, independent of the worktree; (3) if a process is
daemonized/deployed from the worktree, audit PATH, port, and any gitignored-data root explicitly; (4) any
function reading gitignored owner state must resolve the real root via `git rev-parse --git-common-dir`,
never assume `cwd` is the real repo; (5) audit every whole-tree glob (test runner, linter, doc-lint) and
add the worktree-nesting path to its exclude list up front; (6) if the project reads its own gitignored env
file(s) or needs a one-time codegen/build step, confirm its `.pandacorp/worktree-setup.sh` hook exists and
does that work — don't assume the shared bootstrap script covers project-specific state just because it
ran without error. A symptom that reproduces "only inside a worktree" or "only when a parallel session is
active" is the tell to reach for this checklist before assuming a genuine logic regression.
