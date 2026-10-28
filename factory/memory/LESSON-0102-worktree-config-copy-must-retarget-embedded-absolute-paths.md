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
promotion: proposed   # 2026-10-19 (librarian review) — target: factory/standards/build-orchestration.md's DR-096 "Bootstrap on entry" section, add as a standing audit item: "any config/env value that embeds an absolute path, OR is derived from a field the bootstrap deliberately varies per worktree (a port, a slug), must be retargeted/re-derived dynamically after bootstrap — never trust a rename or a file-level copy to have done this automatically; verify by inspecting the actual copied config, not just that bootstrap ran without error." Corroborated across 4 distinct projects over 6 independent mechanisms (mission-control, personal-page-v2, Mission Control's APFS-clone node_modules, pandasaga, funko-tracker) with zero contradicting evidence — the richest, most-recurring class of worktree-isolation bug in the store after LESSON-0125 itself.
confidence: high
times_applied: 0
applied_in: []
links: [DR-096, LESSON-0034, LESSON-0039, LESSON-0125]
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

**Fourth mechanism (2026-10-17, Mission Control):** an APFS-CLONED `node_modules` directory (e.g. via a
copy-on-write clone for an isolated verification checkout) preserves the absolute `NODE_PATH` values baked
into pnpm's `.bin` shim scripts, which still point at the SOURCE checkout's own absolute path rather than
the clone's — the same "renaming is cosmetic, embedded absolute paths must be retargeted" failure, this
time inside a package manager's own generated binaries rather than a hand-maintained config file. Fix:
running `pnpm install --frozen-lockfile --offline` inside the isolated checkout regenerates the `.bin`
shims with paths correct for that checkout's own location, without touching the lockfile or re-fetching
packages.

**Apply next time (addendum):** when cloning/copying a directory tree for isolation (APFS clone, `cp -a`,
a disposable worktree) that includes a package manager's `node_modules`, assume its generated binary
shims/launchers carry embedded absolute paths from the SOURCE location too — re-run the package manager's
own install (offline, frozen lockfile) in the new location to regenerate them, rather than trusting a
file-level copy to have retargeted anything automatically.

**Fifth mechanism (2026-10-15, pandasaga):** inverted from the usual shape of this lesson — here
`worktree-bootstrap.sh` CORRECTLY derives a distinct, per-worktree port for a tracked `e2e/server-env.json`
(so parallel worktrees don't collide on Playwright's webServer port). The project's OWN auth config
(`BETTER_AUTH_URL`) was pinned as a static absolute URL baked with the MAIN checkout's port, read from
that same `server-env.json`/env layer. Once the bootstrap script did its job and rewrote the port for a
worktree, the pinned `BETTER_AUTH_URL` no longer matched the actual serving port, and auth's origin check
rejected requests — not because any path-retargeting step was skipped, but because a value DERIVED FROM a
field the bootstrap deliberately varies was itself pinned as a constant.

**Apply next time (addendum 2):** when a worktree-bootstrap step deliberately varies a field (a port, a
slug) per worktree for correctness (avoiding collisions), audit for any OTHER config value in the project
that was built by hand from that same field as a fixed string — those must be derived dynamically at
request/startup time from the live value, never pinned, or the deliberate per-worktree variation breaks
them the same way an un-retargeted absolute path would.

**Sixth mechanism (2026-10-18/19, funko-tracker — SECOND distinct project corroborating addendum 2):**
the same inverted shape recurred on a different project with TWO different pinned fields: `BETTER_AUTH_URL`
and `ORACLE_MEDIA_BASE_URL` were both baked as static absolute URLs on port `:4037` in `e2e/server-env.json`,
while `worktree-bootstrap.sh`'s port-derivation step (BL-0154) correctly varied `PORT` per worktree. Once a
worktree got a derived port, Better Auth's callback redirect and the harness's own media links kept pointing
at the OLD, now-dead `:4037` origin — surfacing as an auth-recovery e2e failure in one gate (FRD-03) and a
console-red image-hotlink failure in another (FRD-01), both only inside worktrees, never on the main
checkout. This is cross-project evidence (pandasaga + funko-tracker) that "a value derived from a
bootstrap-varied field must never be pinned as a constant" is a recurring class, not a one-off — the fix is
PROJECT-specific each time (retarget every embedded origin with the project's own derived port, typically
in that project's own `.pandacorp/worktree-setup.sh` or server-env template), not a shared-tooling change,
since the field names (`BETTER_AUTH_URL`, `ORACLE_MEDIA_BASE_URL`) are app-specific and the shared
`worktree-bootstrap.sh` cannot know about them.
