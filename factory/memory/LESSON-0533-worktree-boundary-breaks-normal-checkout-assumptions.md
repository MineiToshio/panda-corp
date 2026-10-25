---
id: LESSON-0533
type: pattern
domain: build-orchestration
tags: [worktree, dr-096, git-common-dir, symlink, reflection, false-red]
context: any tool, script, or security check that runs inside (or against) a git worktree and silently assumes it is a normal, self-contained single checkout
trigger: use this when designing, auditing, or debugging anything that runs inside a git worktree and makes ANY of these three assumptions — the gitignored state it needs is physically present, a bootstrapped file behaves like a real (non-symlink) file, or a git-internal operation (lock, hook, ref) happens inside the worktree's own path
source: "reflection pass, librarian review 2026-10-25, synthesizing LESSON-0111 (panda-corp, 2026-07-07), LESSON-0478 (funko-tracker, 2026-10-21), LESSON-0523 (funko-tracker, 2026-10-24), LESSON-0524 (funko-tracker, 2026-10-24) — 2 distinct projects, 4 independent incidents"
provenance: agent-inferred
created: 2026-10-25
status: active   # cross-corroborated: panda-corp (LESSON-0111) + funko-tracker (LESSON-0478/0523/0524), 2 distinct projects
promotion: none
confidence: high
times_applied: 0
applied_in: []
links: [LESSON-0090, LESSON-0102, LESSON-0111, LESSON-0131, LESSON-0478, LESSON-0523, LESSON-0524]
---

**Situation:** four independent incidents across two projects (panda-corp, funko-tracker) each broke a
different tool by assuming a git worktree (DR-096 isolation) is interchangeable with a normal,
self-contained single checkout: (1) `readPortfolio()`-style code resolved empty/false-"git unavailable"
because gitignored owner state simply isn't there (LESSON-0111); (2) a hardened env loader using
`O_RDONLY | O_NOFOLLOW` refused to open `.env.local` because the worktree only ever has a *symlink* to
it, never a real file (LESSON-0523); (3) a sandboxed `codex exec -s workspace-write` agent could edit
files but silently could not `git commit`, because `.git/index.lock` for a worktree lives inside the
COMMON `.git` directory of the main checkout — physically OUTSIDE the worktree's own path that the
sandbox's write-scope covers (LESSON-0524); (4) an isolated gate's env-injection attempt collided with a
bootstrap's own narrow symlink/skip-worktree contract for `.env.local`, because that mechanism was never
general-purpose (LESSON-0478).

**Lesson:** these are not four unrelated bugs — they are the same root cause wearing different costumes,
one level more general than any single lesson above: a git worktree is NOT a normal, self-contained
checkout along at least THREE independent axes, and code/tooling written against the "normal checkout"
mental model breaks on whichever axis it happens to touch, with a symptom that looks exactly like a real
regression (false-red, silent no-op, mysterious permission failure) rather than an environment gap.
- **Axis 1 — gitignored state is physically absent** (not just "maybe stale"): anything a worktree needs
  that is gitignored by design (owner data, `.env.local`, generated codegen output) must be actively
  provisioned into it; nothing reconstitutes it automatically (LESSON-0090, LESSON-0111, LESSON-0131).
- **Axis 2 — a bootstrapped file is a symlink, not a real file**: any consumer that opens that path
  defensively (`O_NOFOLLOW`, a stricter security loader) or that treats the symlink/pointer mechanism as
  a general-purpose env-injection point will reject or misuse it; a symlink is cosmetically a file but not
  behaviorally one to every caller (LESSON-0523, LESSON-0478).
- **Axis 3 — git-internal state lives in the COMMON `.git` dir, not the worktree path**: `index.lock`,
  hooks, and other git-internal operations resolve via `git rev-parse --git-common-dir`/`--git-dir` to a
  location OUTSIDE the worktree's own directory tree; any write-scope, sandbox, or permission model that
  is limited to "the worktree directory itself" cannot see or touch that location (LESSON-0524, and the
  inverse direction of LESSON-0111's resolver technique).

**Apply next time:** when onboarding ANY new tool, script, sandbox policy, or security check to run
inside (or be exercised by something running inside) a git worktree, explicitly audit all three axes
above rather than waiting for a false-red to reveal which one it hit: (1) does it need gitignored state —
if so, is that state actively provisioned via `.pandacorp/worktree-setup.sh` (LESSON-0131), or resolved
via `git rev-parse --git-common-dir`'s parent (LESSON-0111) when the REAL root is what's needed? (2) does
it open a bootstrapped/symlinked file defensively, or try to reuse a narrow bootstrap symlink contract for
a different purpose — if so, route around the symlink instead of fighting it (LESSON-0478, LESSON-0523)?
(3) does it perform a git-internal operation (commit, lock, hook) — if so, does its write-scope/sandbox
cover the COMMON `.git` dir, not just the worktree path (LESSON-0524)? Before diagnosing a "worktree-only"
failure as a real code regression, check whether it is actually one of these three axes.
