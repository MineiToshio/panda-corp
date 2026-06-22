---
id: FRD-15
type: frd
title: FRD-15 — Plugin out-of-sync warning
status: ACTIVE
implementation_status: VERIFIED
ui: true
visual_source: docs/design/prototype/index.html
last_updated: '2026-06-22'
---
# FRD-15 — Plugin out-of-sync warning

Catches the most common slip: the factory plugin advanced but the **installed** copy is an older version, so newly added/edited skills don't take effect until `claude plugin update`. Mission Control detects that gap and warns. Read-only (reads two JSON files; does not call Claude, run git, or write).

> **Amended 2026-06-22 (version-based) — see the [decision log](../../decision-log.md).**
> This FRD previously compared git **commit SHAs** (installed `gitCommitSha` vs `git log -1 -- plugin/`) plus an uncommitted-changes check. That produced a **permanent false alarm**: `installed_plugins.json.gitCommitSha` is frozen at install time and does **not** advance when `claude plugin update` runs, while the compared HEAD advanced on every `plugin/` commit — so the banner was always on even when the owner was fully up to date. The check is now **semver-version-based**, matching exactly what `claude plugin update` reports.

## How it's detected (all local, two file reads)

- **Installed version**: read `~/.claude/plugins/installed_plugins.json` → the `version` of the `pandacorp@panda-corp` entry (user scope) — the version `claude plugin update` maintains.
- **Source version**: read `plugin/.claude-plugin/plugin.json` → its `version` (the authoritative "latest published" version, bumped on every plugin change per DR-034).
- **Verdict**: compare the two as semver. The banner shows **only** when the installed version is **strictly behind** the source version. Equal or newer → no banner. The git `gitCommitSha` and any uncommitted-changes / dirty check are **no longer used** (they were the source of the false positive).

## The single drift case

The banner has one reason that renders: **the installed version is behind the source version** ("El plugin instalado está atrás"). Recovery steps: run the command → restart the Claude Code session. (Uncommitted-in-`plugin/` is deliberately NOT a trigger — in the factory the owner edits `plugin/` constantly; only a genuinely older *installed version* warrants the "needs update" banner — owner decision 2026-06-22.)

## Acceptance criteria (EARS)

### REQ-15-002 — Version drift verdict
- **AC-15-002.1** — IF the installed `version` is **strictly behind** the source `version` (semver), Mission Control SHALL show the banner — heading "El plugin instalado está atrás", the detail naming both versions, and the recall steps (run command → restart session).
- **AC-15-002.2** — IF the installed `version` **equals or is newer than** the source `version`, Mission Control SHALL show **nothing** (reason `in-sync`, no banner) — this is the up-to-date state `claude plugin update` reports.
- **AC-15-002.3** — IF either version is missing or unparseable, Mission Control SHALL treat the state as `unknown` and show **nothing** (no false alarm).
- **AC-15-004.1** — The banner SHALL show the **command to copy** `claude plugin update pandacorp@panda-corp`.

### REQ-15-004 — Lifecycle
- The banner SHALL **disappear on its own** (self-clear on the next poll) once the installed version catches up to the source version.

### REQ-15-005 — Read-only
- The check SHALL **not execute anything**: it only reads the two JSON files and shows the command; the owner runs it. Any unreadable/unparseable input yields `unknown` (never a false alarm), and the readers never throw.

## Non-goals
- It does not run `claude plugin update`, `git`, or install anything. It does not warn on uncommitted `plugin/` edits.

## Implementation note
In the real app (Next.js), `GET /api/plugin-sync` does the two file reads and returns the `PluginSyncState` (`installedVersion`, `sourceVersion`, `drift`, `reason`, `detail`); the client banner polls it and self-clears. The prototype simulates it with a flag.
