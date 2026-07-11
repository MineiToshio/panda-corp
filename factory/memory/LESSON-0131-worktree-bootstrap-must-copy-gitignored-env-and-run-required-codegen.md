---
id: LESSON-0131
type: gotcha
domain: build-orchestration
tags: [worktree, dr-096, env-local, codegen, content-collections, verify-sh, false-red, worktree-setup-hook]
context: a project onboarded onto the shared `worktree-bootstrap.sh` template (DR-096), which reserves a per-project extension point (`.pandacorp/worktree-setup.sh`) for exactly this kind of project-specific "day-zero" setup
trigger: use this when a fresh git worktree's verify.sh/build fails right after bootstrap with a missing-env-var error or a missing-generated-content error, before suspecting a real code regression — and when onboarding ANY project onto worktree isolation that reads its own `.env.local` or needs a codegen step before building
source: "personal-page-v2 .pandacorp/run/lessons.md 2026-07-10 (agent-inferred) — a fresh worktree needed .env.local copied AND `npx @content-collections/cli build` run before verify.sh could pass; the project had never created its `.pandacorp/worktree-setup.sh` hook (the shared worktree-bootstrap.sh template's own designated extension point, step 4 — 'a project with its own state adds the heavy bit here'), so nothing filled that gap, and a freshly bootstrapped worktree looked broken even though the checked-out code was correct and the shared template itself was working exactly as designed"
provenance: agent-inferred
created: 2026-07-10
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0090, LESSON-0093, LESSON-0102, LESSON-0125]
---

**Situation:** a git worktree (DR-096 isolation) only ever carries tracked content — by construction it
never receives the project's OWN `.env.local` (gitignored) nor any generated-content directory that a
codegen step (here, `@content-collections/cli build`, which compiles MDX content into typed modules the
app imports) produces into a gitignored output folder. The shared `worktree-bootstrap.sh` template already
anticipates this class of gap and reserves a per-project hook for it (`.pandacorp/worktree-setup.sh`,
run automatically at step 4 if present and executable) — but the project had never created that hook file,
so nothing copied `.env.local` or ran the codegen build, and `verify.sh` in the fresh worktree failed on
missing env vars and missing generated content: a false red that looks exactly like a broken build, when
the checked-out code and the shared bootstrap mechanism were both fine.

**Lesson:** this is the SAME class LESSON-0090/0093/0102/0125 already track (a worktree carries only
tracked files, so anything gitignored — data, machinery, absolute-path configs — is invisible from inside
it) with an important twist: the shared factory template ALREADY solves this class generically via an
extension point, so the actual gap here is a project never having exercised that extension point — not a
missing capability in the shared tooling. The generalizable lesson is therefore about AWARENESS of the
mechanism, not a call to change the shared script: any project whose own `.env.local` or a codegen/build
step (content compiler, generated types, seed data) is a prerequisite for `verify.sh` needs a
`.pandacorp/worktree-setup.sh` that does that work, and silently having none is indistinguishable, from the
symptom side, from the shared bootstrap being broken.

**Apply next time:** when onboarding a project that reads its own gitignored env file(s) or needs a
one-time codegen/build step before the app can run, create its `.pandacorp/worktree-setup.sh` (executable)
to copy the env file(s) and run that codegen step — do this BEFORE the first worktree-isolated build, not
after a false red. If a fresh worktree's `verify.sh` fails immediately with a missing-env or
missing-generated-artifact error, check first whether the project has a `.pandacorp/worktree-setup.sh` at
all before suspecting either the checked-out code or the shared `worktree-bootstrap.sh` template.
