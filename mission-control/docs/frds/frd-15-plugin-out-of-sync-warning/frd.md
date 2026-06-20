---
id: FRD-15
type: frd
title: FRD-15 — Plugin out-of-sync warning
status: ACTIVE
implementation_status: VERIFIED
ui: true
visual_source: docs/design/prototype/index.html
last_updated: '2026-06-19'
---
# FRD-15 — Plugin out-of-sync warning

Catches the most common slip: editing the factory plugin and forgetting to commit / run `claude plugin update`. Mission Control detects the gap between the **installed** plugin and the repo's **source code**, and warns. Read-only (reads files + local git; does not call Claude).

## How it's detected (all local)

- **Installed SHA**: read `~/.claude/plugins/installed_plugins.json` → the `gitCommitSha` of `pandacorp@panda-corp` (user scope). NOTE: the `version` field is the semver label (e.g. `4.0.0`), NOT a commit — the drift check compares `gitCommitSha`, never `version`. (`claude plugin list` shows the version.)
- **Source code state** in the factory repo:
  - last commit that touched the plugin: `git log -1 --format=%H -- plugin/`
  - are there uncommitted changes?: `git status --porcelain -- plugin/`

## The three drift reason variants

The drift banner has **three reason variants**, each with its **own heading and recall steps** — it is not a single generic message:

1. **Uncommitted changes** ("Sin commitear") — there are uncommitted changes under `plugin/`. Steps: commit the changes → run the command → restart the Claude Code session.
2. **Installed SHA behind** ("Instalado atrasado / behind") — the committed plugin advanced but the installed `gitCommitSha` is behind the latest commit that touched `plugin/`. Steps: run the command to reinstall the latest version → restart the Claude Code session.
3. **Both** ("Ambos") — there are uncommitted changes AND the installed SHA is behind. Steps: commit the changes → run the command → restart the Claude Code session.

## Acceptance criteria (EARS)

### REQ-15-001 — Three drift reason variants
- **AC-15-001.1** — IF there are **uncommitted changes** under `plugin/` (and the installed SHA is current), Mission Control SHALL show the **"uncommitted changes"** variant — its own heading + its own recall steps (commit → run command → restart session).
- **AC-15-001.2** — IF the **installed SHA ≠ the last commit that touched `plugin/`** with no uncommitted changes (committed but not reinstalled), Mission Control SHALL show the **"installed plugin is behind"** variant — its own heading + its own recall steps (run command to reinstall → restart session).
- **AC-15-001.3** — IF there are uncommitted changes **AND** the installed SHA is behind, Mission Control SHALL show the **"both"** variant — its own heading + its own recall steps (commit → run command → restart session).
- **AC-15-001.4** — Each variant SHALL show the **command to copy** `claude plugin update pandacorp@panda-corp`.

### REQ-15-002 — Lifecycle & read-only
- **AC-15-002.1** — The warning SHALL **disappear on its own** when the plugin is back in sync (no uncommitted changes and installed SHA == the plugin's last commit).
- **AC-15-002.2** — The warning SHALL NOT execute anything (read-only): it shows the command, the owner runs it.

## Non-goals
- It does not run `git` or `plugin update` for the owner. It does not install anything.

## Implementation note
In the real app (Next.js), a server-side endpoint does the file/git reads and returns the state; the prototype simulates it with a flag (`PLUGIN_SYNC`). See the plugin maintenance rule in the factory's `CLAUDE.md`.
