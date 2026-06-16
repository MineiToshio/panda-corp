# FRD-15 — Plugin out-of-sync warning

Catches the most common slip: editing the factory plugin and forgetting to commit / run `claude plugin update`. Mission Control detects the gap between the **installed** plugin and the repo's **source code**, and warns. Read-only (reads files + local git; does not call Claude).

## How it's detected (all local)

- **Installed SHA**: read `~/.claude/plugins/installed_plugins.json` → the `gitCommitSha` of `pandacorp@panda-corp` (user scope). NOTE: the `version` field is the semver label (e.g. `4.0.0`), NOT a commit — the drift check compares `gitCommitSha`, never `version`. (`claude plugin list` shows the version.)
- **Source code state** in the factory repo:
  - last commit that touched the plugin: `git log -1 --format=%H -- plugin/`
  - are there uncommitted changes?: `git status --porcelain -- plugin/`

## Acceptance criteria (EARS)

- IF there are **uncommitted changes** under `plugin/`, Mission Control SHALL show a **persistent warning** at the top: "Plugin out of sync — there are uncommitted changes".
- IF the **installed SHA ≠ last commit that touched `plugin/`** (committed but not reinstalled), it SHALL show the warning: "The installed plugin is behind".
- The warning SHALL show the **command to copy** `claude plugin update pandacorp@panda-corp` and recall the sequence (commit if needed → run the command → restart the Claude Code session).
- The warning SHALL **disappear on its own** when the plugin is back in sync (no uncommitted changes and installed SHA == the plugin's last commit).
- The warning SHALL NOT execute anything (read-only): it shows the command, the owner runs it.

## Non-goals
- It does not run `git` or `plugin update` for the owner. It does not install anything.

## Implementation note
In the real app (Next.js), a server-side endpoint does the file/git reads and returns the state; the prototype simulates it with a flag (`PLUGIN_SYNC`). See the plugin maintenance rule in the factory's `CLAUDE.md`.
