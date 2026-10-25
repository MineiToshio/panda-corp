---
id: LESSON-0523
type: anti-pattern
domain: build-orchestration
tags: [worktree, dr-096, o-nofollow, symlink, env-loader, security-hardening]
context: a project's own env/config loader opens a security-sensitive file (`.env.local`, a secret file) with `O_NOFOLLOW` for defense-in-depth, in a project that also uses the standard worktree-isolation bootstrap pattern of symlinking that same file into each worktree
trigger: use this when a verify.sh/gate run is red ONLY inside a git worktree (passes on main) with an error from a hardened env/config loader, and the project's worktree bootstrap script links `.env.local` (or a similar file) by symlink
source: "funko-tracker .pandacorp/run/lessons.md 2026-10 (agent-inferred) — worktree-setup.sh links .env.local into each worktree via `ln -s`; a stricter test-environment loader (scripts/fidelity/runtimeEnv.mjs) opens that path with `O_RDONLY | O_NOFOLLOW`, which refuses to open ANY symlink by design — so every worktree (which only ever gets the symlinked file, never a real copy) reds on that check, while main (which has the real file) passes"
provenance: agent-inferred
created: 2026-10-25
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0111]
---

**Situation:** the standard worktree-isolation bootstrap pattern (DR-096: copy tracked files normally,
symlink select gitignored files like `.env.local` from the main checkout into each worktree so secrets
aren't duplicated) collided with a project's own hardened file loader that deliberately opens
security-sensitive config files with `O_NOFOLLOW` — a flag whose entire purpose is to refuse to open a
path if it resolves through a symlink. The result: every worktree reds on that loader's check, because
the only `.env.local` a worktree ever has IS a symlink by construction; main is unaffected because it
holds the real file.

**Lesson:** these two reasonable practices are structurally incompatible, not buggy in isolation: a
symlink-based secret-sharing bootstrap and an `O_NOFOLLOW` symlink-refusing loader cannot both be
satisfied for the same file. This is a THIRD distinct symptom of the "a worktree only ever carries
tracked content, plus whatever the bootstrap explicitly links" class (LESSON-0111's family) — but unlike
a silently-empty read, this one is a hard, by-design refusal that looks like a security control working
correctly (which it is) rather than a worktree-isolation gap.

**Apply next time:** if a project's env/config loader needs `O_NOFOLLOW` (or similar symlink-refusing)
hardening for production/security reasons, the worktree bootstrap must COPY that specific file into each
worktree instead of symlinking it (accepting the duplication), or the loader needs an explicit,
documented worktree-aware exception. Before debugging an "only red in worktrees" failure from a strict
file-open guard, check whether the file in question is a bootstrap-created symlink rather than a real
copy — the fix is a bootstrap/loader contract decision, not a code bug in either half.
