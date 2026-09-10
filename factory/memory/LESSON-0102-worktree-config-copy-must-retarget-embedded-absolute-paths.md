---
id: LESSON-0102
type: gotcha
domain: build-orchestration
tags: [worktree, dr-096, launch-json, absolute-paths, silent-failure]
context: adapting a gitignored config file that carries ABSOLUTE paths (e.g. a `launch.json` with `runtimeArgs` pointing into the checkout) into a git worktree copy
trigger: use this when a script that bootstraps a git worktree copies/rewrites a gitignored config that embeds absolute filesystem paths (launch configs, local dev-server configs, anything with a hardcoded checkout path)
source: "mission-control .pandacorp/run/lessons.md 2026-07-07, owner-stated — worktree-bootstrap.sh (DR-096); fixed same day, commit 71d78830. NEW MECHANISM, same symptom class, personal-page-v2 .pandacorp/run/lessons.md 2026-09-09 (agent-inferred): worktree-bootstrap.sh writes launch.json cwd as the ${workspaceFolder} variable, which the desktop app resolves to the main repo root regardless of the worktree the config came from — a third distinct way this symptom recurs."
provenance: owner-stated
created: 2026-07-07
status: active
promotion: none
confidence: high
times_applied: 0
applied_in: []
links: [DR-096, LESSON-0034, LESSON-0039]
---

**Situation:** `worktree-bootstrap.sh` copied `.claude/launch.json` from the main checkout into a new
worktree, renaming each configuration's `name` field with a `-<slug>` suffix so the worktree's dev-server
entries look distinct. That renaming was NOT enough: `runtimeArgs` still carried ABSOLUTE paths pointing
into the MAIN checkout (the value after a `-C`/`--directory` flag). As a result, `next dev`/`http.server`
launched "from" the worktree's launch config silently served the MAIN checkout's code/content — not
whatever the worktree session had actually changed. No error, no warning: just stale content that looked
current, costing significant debugging time before the mismatch was found.

**Lesson:** renaming the identifiers in a copied config is a cosmetic fix; if the config embeds absolute
paths that resolve into a specific checkout, those paths must be RETARGETED to the new location too, or
every consumer of that config keeps operating on the OLD location under a NEW name. This is a distinct
failure mode from LESSON-0034 (the preview tool resolving `launch.json` from the wrong place) and
LESSON-0039 (Turbopack's own workspace-root auto-detection getting confused) — a third, independent way
the same symptom ("worktree preview shows stale/main content") can occur, this time from the bootstrap
script's OWN copy step.

**Apply next time:** when a worktree-bootstrap (or any environment-cloning) script copies a config that
embeds absolute paths, rewrite any token under the SOURCE checkout's root to the equivalent path under the
DESTINATION (the worktree lives nested inside the main checkout, so a straightforward prefix replacement —
"any path starting with `$MAIN_WT/` becomes `$WORKTREE/` + the remainder" — produces the correct nested
path), while leaving paths OUTSIDE the repo (a `/tmp` scratchpad, etc.) untouched. Verify by inspecting the
actual copied config after bootstrap, not just that the bootstrap script ran without error.

**New mechanism, same symptom (2026-09-09, personal-page-v2):** the same "worktree preview shows main's
stale content" symptom recurred through a THIRD distinct mechanism (after the absolute-path token above
and LESSON-0034's launch.json-resolved-from-main-checkout): `worktree-bootstrap.sh` writes launch.json
entries with `"cwd": "${workspaceFolder}"` rather than a literal path — the desktop app resolves that
variable to the MAIN repo root regardless of which worktree's launch.json it came from, so `next dev`
launched via `preview_start` from a worktree session serves the main tree's code while the worktree's own
gate (whose Playwright webServer sets its own cwd explicitly) correctly serves the new code — same symptom,
opposite files agreeing/disagreeing. Fix: write the ABSOLUTE worktree path, not a variable that resolves
relative to the app's own workspace concept. **Process guard for any of these three mechanisms:** before
handing a preview URL to the owner for review, curl-verify a distinctive string known to be new (from the
actual change under review) on the served port — don't trust that the URL "should" be pointed correctly
just because the bootstrap/config edits look right.
