---
id: LESSON-0684
type: gotcha
domain: tooling
tags: [macos, tmpdir, symlink, path-comparison, nodejs, testing]
context: writing or running Node.js tooling/tests on macOS that compares filesystem paths literally (worktree registration, cleanup-safety checks, fixture teardown)
trigger: use this when a Node script or test suite on macOS compares a path it computed itself (via os.tmpdir()/TMPDIR) against a path reported back by an external tool (git, a child process) and the comparison unexpectedly fails or a cleanup/safety check rejects a path that should be valid
source: "panda-corp factory harvest, 2026-11-16 — verifying BL-0326's fix, the combined build-v2 suite run initially showed 39/40 passing with one unrelated cleanup-safety rejection; forcing TMPDIR=/private/tmp resolved it. Same root-cause family already filed as BL-0324 (worktree-sweep.mjs's plain path.resolve() vs git's realpath'd worktree paths)."
provenance: agent-inferred
created: 2026-11-18
status: candidate
promotion: none
confidence: medium
times_applied: 1
applied_in: [panda-corp]
links: [BL-0324, BL-0326]
---

**Situation:** macOS's default `TMPDIR` (`/var/folders/.../T/`) sits behind the stock `/var -> /private/var`
symlink. A Node script that builds a path from `os.tmpdir()`/`TMPDIR` and later compares it — literally,
with `path.resolve()` or `===` — against a path reported by an external tool that already realpath'd it
(e.g. `git worktree list`, or a cleanup-safety check walking the real filesystem) will see two textually
different strings for the same directory (`/var/...` vs `/private/var/...`) and treat them as different
paths. This surfaced twice in the same session: as the already-filed BL-0324 (`worktree-sweep.mjs`'s three
plain `path.resolve()` comparisons mismatching git's realpath'd worktree paths) and again as an unrelated
one-test cleanup-safety rejection while verifying a different fix, resolved only by overriding `TMPDIR`.

**Lesson:** this is not a one-off bug in one script — it is a standing property of macOS (`/var` is a
symlink on every unmodified install) that bites any tool doing literal path-string comparison instead of
realpath-based comparison, and it recurs wherever a NEW piece of tooling adds its own literal
comparison instead of reusing the existing symlink-safe comparator.

**Apply next time:** when writing or debugging Node tooling/tests on macOS that compare, hash-key, or
safety-check filesystem paths: (a) prefer the codebase's existing symlink-safe comparator (here,
`realOrResolved` in `plugin/runtime/build/integrate/git.mjs`) over a fresh `path.resolve()`/string
comparison; (b) if a suite fails with a path-mismatch/rejected-cleanup symptom under the default `TMPDIR`
and passes once `TMPDIR` is set to its own realpath (or `/private/tmp`), that is a strong signal of this
exact class, not a flaky test — fix the comparator rather than permanently pinning `TMPDIR` as a workaround
in CI/dev docs.
