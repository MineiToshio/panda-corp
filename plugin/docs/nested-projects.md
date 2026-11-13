# Projects nested in a shared Git repository

Mission Control is a product at `<factory>/mission-control`, sharing the factory repository's Git
metadata. A project root and a Git worktree root are distinct. Its overlay source must survive a
clone; its private runtime state must stay outside the index.

## Shared pre-push guard (BUILD-13 / DR-153)

`install-pre-push.mjs --project <project-root>` installs the POSIX-sh v2 guard in Git's resolved
untracked hooks directory. The configured copy embeds a sorted list of repository-relative project
roots (`# pandacorp-projects`), not absolute checkout paths. Reinstalling or installing another project
preserves registered roots and the foreign chained hook. `--check` requires both current machinery
and registration of the requested project. An in-worktree `core.hooksPath` is refused as before.

For each default-branch update in a multi-ref push, each registered nested project's guard applies
only when its subtree is affected. Non-default refs do not cause another ref to be guarded:

- Updates inspect both the old/new tree difference and every incoming commit's parent differences
  (including merge parents). A product change followed by a revert still touches the project.
- New refs inspect all reachable incoming history, since there is no remote base.
- Ref deletion is guarded when the deleted tree contains the project subtree.
- Force rewinds also inspect the tree difference, so removing a project change is guarded.
- Unavailable objects or failed history inspection fail closed for default-branch updates.

For an affected project, state comes from `<default-branch-worktree>/<project>/.pandacorp/status.yaml`,
falling back to the pushing worktree if that directory is absent. Missing/unreadable relevant status
fails closed. A launched external project blocks the update unless the owner has explicitly ordered
release and `PANDACORP_OWNER_RELEASE_OK=1` is set. Standalone projects retain their repository-wide guard.
A factory-only push with no nested subtree changes does not read nested state or require a
factory-root `.pandacorp/status.yaml`, even if factory runtime `.pandacorp/run/` exists.

Install after integrating this change, from any directory (the installer writes shared hook metadata):

```bash
node /Users/Shared/Proyectos/panda-corp/plugin/scripts/install-pre-push.mjs --project /Users/Shared/Proyectos/panda-corp/mission-control
node /Users/Shared/Proyectos/panda-corp/plugin/scripts/install-pre-push.mjs --project /Users/Shared/Proyectos/panda-corp/mission-control --check
```

## Overlay inventory (BL-0311)

The factory `.gitignore` opens **only** `mission-control/.pandacorp/`, ignores every child by default,
and explicitly reopens the following regular source files. Other nested projects and factory-root
runtime state retain the original `.pandacorp/` ignore behavior.

| Managed and tracked path inside `.pandacorp/` | Classification |
|---|---|
| `README.md`, `guide.md` | Regenerated integration documentation |
| `status.yaml` | Committed machine-state projection, written by the skills/CLI |
| `idea-origin.md` | Frozen project provenance |
| `track.jsonl`, `build-journal.jsonl` | Existing durable append-only project history; retained in Git |
| `verify.sh`, `canary.sh` | Managed verification machinery |
| `merge-queue.sh`, `green-stamp.sh`, `change-reconcile.mjs` | Managed landing/certification machinery |
| `session-cleanup.sh`, `worktree-bootstrap.sh`, `pending-work.sh`, `serve-once.sh` | Managed session/worktree helpers |
| `doc-lint.sh`, `check-project-skills.mjs` | Managed documentation/skill checks |
| `risk-paths` | Versioned per-project risk configuration; preserve owner choices on upgrade |

All other paths remain ignored, including `run/`, `comms/`, `inbox/`, `accounts/` (including service
configuration/secrets), `navigation-identity.json`, `stats.json`, `stats-aggregate.json`, installed
`hooks/`, credentials, caches and unknown future additions. Secrets never belong in an allowlisted
file. The two legacy tracked inbox files (`inbox/decisions.md` and
`inbox/changes/done/canario-d-paralelismo-portfolio-board-changes-wo.md`) are outside the source inventory;
ignore rules cannot remove existing index entries. This fix does not delete or untrack owner state.

At the observed base checkout (2026-11-12), exactly four existing untracked/ignored files become
eligible for tracking: `mission-control/.pandacorp/green-stamp.sh`,
`mission-control/.pandacorp/change-reconcile.mjs`, `mission-control/.pandacorp/session-cleanup.sh`, and
`mission-control/.pandacorp/risk-paths`. They are absent in the NEST worktree because they were never
committed; the integrator stages their existing main-checkout copies after applying the ignore fix.

## Upgrade staging

After regeneration and successful project verification, the upgrade skill runs
`stage-managed-overlay.mjs --project <project-root>` before its isolated upgrade commit. `--dry-run`
reports the resolved project/repository roots, nested flag and exact existing managed paths without
changing the index. The helper stages only the regular files in `MANAGED_OVERLAY_FILES`, using exact
literal paths and `git add -f` to handle inherited ignores in arbitrary nested projects. No directory,
glob, private runtime file or unknown addition is staged. Symlink machinery is refused before any
staging. The helper changes no ignore policy in standalone repositories.

## Verification

- `node --test plugin/scripts/test-install-pre-push.mjs`: standalone/nested guards, independent scopes,
  shared default-worktree state, multi-ref pushes, creation/deletion/rewinds/reverts, chaining and
  tracked hooksPath refusal.
- `bash plugin/scripts/test-pre-push.sh`: existing standalone contract and real local-remote pushes.
- `node --test plugin/scripts/test-nested-overlay.mjs`: explicit ignore split, exact upgrade staging,
  inherited ignores, clone/worktree persistence, standalone policy and symlink refusal.
