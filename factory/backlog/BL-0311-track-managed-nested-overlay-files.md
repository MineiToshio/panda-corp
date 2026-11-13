---
id: BL-0311
type: bug
area: templates
title: "Track managed Mission Control overlay files inside the factory repository"
status: done
severity: p1
opened: 2026-11-12
closed: 2026-11-12
source: "owner, 2026-11-12: engine v2 day-1 rollout (plugin 10.0.0 / overlay 9.0.0) — factory .gitignore ignores nested Mission Control managed overlay additions"
closes: "plugin/docs/nested-projects.md and stage-managed-overlay.mjs; explicit nested overlay source allowlist"
links: [DR-150, DR-155]
---

## Problem
The factory root `.gitignore` contains `.pandacorp/` (around line 14), which ignores `mission-control/.pandacorp/` as well as project-local runtime state. Consequently new managed overlay files added by Mission Control's overlay 9.0.0 upgrade are untracked and absent from fresh factory clones and worktrees. Affected examples include `mission-control/.pandacorp/green-stamp.sh`, `change-reconcile.mjs`, `session-cleanup.sh`, and `risk-paths`; older managed files in that directory are tracked, leaving the nested overlay incomplete and inconsistent across checkouts.

This was found during the engine v2 day-1 rollout on 2026-11-12 with plugin 10.0.0 / overlay 9.0.0. Mission Control is a nested product checkout sharing the factory Git repository, so its managed source files must survive factory clone and worktree creation.

## Root cause
The root `.gitignore` treats every directory named `.pandacorp/` as runtime/owner state without an exception for the nested Mission Control project. The upgrade skill also lacks a nested-project staging path that ensures newly generated managed files are added to the factory index. Previously tracked files remain visible despite the ignore rule, masking the omission for files added by later upgrades.

## Fix plan
1. Inventory `mission-control/.pandacorp/` and classify each file as managed-and-tracked source, generated/managed projection, or runtime/owner state; record the classification in the appropriate Mission Control/factory documentation.
2. Adjust the factory `.gitignore` with narrow negations for the nested Mission Control directory and only the managed files/directories that belong in Git. Preserve ignores for runtime and owner state; do not broadly expose the entire `.pandacorp/` tree.
3. Update the upgrade skill's nested-project path so overlay upgrades stage the classified managed files despite the shared repository and ignore rules, while leaving runtime state untracked.
4. Add a temporary clone/worktree regression fixture proving managed files are present and runtime files remain ignored after a nested upgrade.

## Tests
- Add a `plugin/scripts` test for the nested upgrade/ignore contract, using a fixture repository with a root `.pandacorp/`, nested managed files, and nested runtime state.
- Assert managed files such as `green-stamp.sh`, `change-reconcile.mjs`, `session-cleanup.sh`, and `risk-paths` are tracked/staged after upgrade and survive a fresh clone.
- Assert representative runtime/owner-state files remain ignored and are not staged.
- Verify an ordinary standalone project's `.pandacorp/` ignore behavior is unchanged.

## Done when
- [x] The nested overlay inventory distinguishes managed source from runtime/owner state.
- [x] Ignore rules expose only the intended managed Mission Control files, and nested upgrades stage those files.
- [x] The clone/worktree regression test passes for both tracked managed files and ignored runtime state.
- [x] Upgrade documentation describes the nested-project behavior; plugin/overlay version and log integration requirements are supplied in the NEST handoff, as explicitly reserved for the integrator.

## Resolution (2026-11-12, NEST)
The factory ignore policy reopens only the 18 managed Mission Control overlay source paths listed in
`plugin/docs/nested-projects.md`; all unknown/private additions remain ignored. The upgrade skill now
runs `stage-managed-overlay.mjs`, which stages exact regular managed files even under an inherited
ignore and refuses symlinks before staging. Clone/worktree and standalone regression fixtures pass.
The four previously ignored main-checkout source additions are listed in that inventory; the
integrator stages those existing files (they are absent from this worktree). Two already tracked
legacy inbox files remain tracked; this change neither deletes owner data nor edits the real index.
Plugin/overlay version bumps and decision-log entries are reserved for the integrator by the
explicit NEST handoff (no Git writes and no concurrent edits to metadata/logs).

## Out of scope
Changing how standalone product projects store or ignore their runtime `.pandacorp/` state.
