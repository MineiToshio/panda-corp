---
id: FRD-16
type: frd
title: FRD-16 — Orphan project detection (adopt?)
status: ACTIVE
implementation_status: BLOCKED
last_updated: '2026-06-16'
---
# FRD-16 — Orphan project detection (adopt?)

Catches the inverse of a registered project: a real project sitting in the projects folder that the factory doesn't know about — typically one built **outside** the handoff (brownfield). Mission Control spots these unregistered sibling repos and offers to **adopt** them. Read-only (reads files + local git; does not call Claude). Sibling of FRD-15 (plugin drift): same "detect a gap, show the command, don't act" shape.

## How it's detected (all local)

- **Projects folder**: `projects_path` from `factory/profile.md`; if empty, the parent directory of the factory root.
- **On-disk candidates**: immediate subfolders of the projects folder that are git repos (`.git` present). Exclude the factory itself and `mission-control/` (internal).
- **Registered set**: the paths listed in `factory/portfolio.md`.
- **Pandacorp marker**: a folder is already a factory project if it has `.pandacorp/status.yaml` (the canonical marker — `Origin — Pandacorp` now lives in `.pandacorp/guide.md`, not `CLAUDE.md`).
- **Orphan** = an on-disk git repo in the projects folder that is **not in the portfolio** and has **no Pandacorp marker**.

## Acceptance criteria (EARS)

- IF there is an **orphan** project in the projects folder, Mission Control SHALL show a dismissible banner: "Unregistered project: `<name>` — adopt it into the factory?".
- The banner SHALL show the **path** and the steps to adopt: open a session in the folder and run `/pandacorp:adopt` (shown as copyable text).
- WHERE a folder has the **Pandacorp marker but is missing from the portfolio** (registered-but-unlisted, e.g. the portfolio row was lost), it SHALL instead suggest running `/pandacorp:sync-portfolio` — NOT adopt (it's already a factory project).
- The banner SHALL **disappear on its own** once the project is adopted (marker + portfolio row appear) or explicitly dismissed by the owner.
- The detection SHALL be **read-only**: it never runs `adopt`, `git`, or writes the portfolio for the owner.
- The scan SHALL be **bounded** to the projects folder (immediate children only) — it does not crawl the whole disk.

## Non-goals
- It does not adopt anything, nor create the portfolio row. It only surfaces the candidate and the command.
- It does not deep-scan nested folders or unrelated directories.

## Implementation note
In the real app (Next.js), a server-side endpoint does the directory listing + git/file reads and returns the orphan list; the prototype simulates it with a flag (`ORPHANS`). The adoption itself is the `/pandacorp:adopt` skill (DR-045), run by the owner inside the project.
