---
id: LESSON-0258
type: gotcha
domain: build-engine
tags: [nested-project, git-toplevel, project-root, repo-root, monorepo-like, worktree-bootstrap, classify-change]
context: tooling (a bootstrap script, a classifier, any script resolving "the project's own node_modules/src") written and tested against ordinary sibling-repo projects, run against a project that lives NESTED inside a parent repo and shares the PARENT's .git (no .git of its own)
trigger: use this when writing or debugging any script that resolves a project's dependency/source root via `git rev-parse --show-toplevel` (or an equivalent git-toplevel call), for a codebase where at least one real project does not own its own `.git` — before trusting that git-toplevel IS the project root
source: "panda-corp — Mission Control lives at panda-corp/mission-control/, sharing the factory's own .git (documented in its own CLAUDE.md), the one project topology every earlier canary/fixture happened not to exercise. Two INDEPENDENT scripts hit the identical root cause on their first real run against it: BL-0155 (worktree-bootstrap.sh step 1 checked `[ -f package.json ]` at the worktree ROOT — silently installed nothing for the nested project, exit 0, no error) and BL-0161 (classify-change.mjs's madge signal resolved its bin/cwd from `ctx.repoRoot`, i.e. the FACTORY root, which has no node_modules/.bin/madge of its own — silently skipped, permanently flooring the project's rigor)."
provenance: agent-inferred
created: 2026-09-25
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [BL-0155, BL-0161, LESSON-0111]
---

**Situation:** two unrelated scripts — a worktree dependency-install bootstrap and a change-classifier's
madge/reverse-dependency signal — each conflated "the git top-level" with "the project's own package/source
root." Both worked correctly for every OTHER Pandacorp project (a sibling repo, so its git top-level IS its
package root) and both silently degraded to a no-op (install nothing, skip the signal) for the ONE project
that shares its parent's `.git` and lives one level down — with no error, no exception, just quietly wrong
behavior that only surfaced once someone read the actual on-disk result (`ls node_modules/.bin/madge`
existing one level down from where the script looked).

**Lesson:** `git rev-parse --show-toplevel` (or `-C <repo> rev-parse --show-toplevel`) answers "where is the
`.git` directory," not "where is this project's package root" — the two coincide for a normal sibling-repo
project but diverge for any project nested inside a parent repo that owns the `.git` (a documented,
deliberate topology, not a misconfiguration: Mission Control's own `CLAUDE.md` states it lives inside the
factory repo by design). A script that resolves `node_modules`, `src/`, or any project-local path purely
from the git top-level will work for every fixture built from flat, sibling-repo test repos and then
silently misbehave the FIRST time it meets a real nested project — because the failure mode (an empty
install, a "unavailable" skip) usually has no error output, it just doesn't do anything, which is easy to
mistake for "this project genuinely has nothing to do here" rather than "this script looked in the wrong
directory." The bug recurred TWICE, independently, in the same window, on the same underlying conflation —
a strong signal this is a structural gap in how a whole class of tooling gets written and tested, not a
one-off.

**Apply next time:** any script that needs "this project's own node_modules/src/package root" must resolve
it from the CALLER-SUPPLIED project path (`--repo`, `$WORKTREE/mission-control` vs `$WORKTREE`, or
equivalent) — computed ONCE and reused by every consumer in the script — never purely from a git-toplevel
call, which only answers where `.git` lives. Keep the two concerns explicitly distinct: (a) where diffs/
paths are ANCHORED (git-toplevel is correct here — `git diff` reports paths relative to it regardless of
which subdirectory `-C` points at) versus (b) where the PROJECT's own dependencies/source actually live
(needs the project's own directory, resolved independently of git-toplevel). Before trusting a new script
against any codebase where a project might be nested inside a parent repo, add a nested-project fixture (no
`.git` of its own, `package.json`/`node_modules` one level below the git top-level) to its test suite — a
flat, sibling-repo-only fixture set will never catch this class, exactly as happened twice here.
