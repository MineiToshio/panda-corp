---
id: FRD-16
type: frd
title: FRD-16 — Orphan project detection (adopt?)
status: ACTIVE
implementation_status: VERIFIED
ui: true
visual_source: docs/design/prototype/index.html
last_updated: '2026-06-19'
---
# FRD-16 — Orphan project detection (adopt?)

Catches the inverse of a registered project: a real project sitting in the projects folder that the factory doesn't know about — typically one built **outside** the handoff (brownfield). Mission Control spots these unregistered sibling repos and offers to **adopt** them. Read-only (reads files + local git; does not call Claude). Sibling of FRD-15 (plugin drift): same "detect a gap, show the command, don't act" shape.

## How it's detected (all local) — the `.pandacorp/` marker is the gate

The banner lists **only Pandacorp projects** — folders that carry the `.pandacorp/` marker. The owner's projects folder mixes Pandacorp projects with **personal code and other-AI projects**; those foreign folders must **never** appear here. The `.pandacorp/` marker is the hard gate for **both** cases below.

- **Projects folder**: `projects_path` from `factory/profile.md`; if empty, the parent directory of the factory root.
- **On-disk candidates**: immediate subfolders of the projects folder that **contain a `.pandacorp/` marker** (canonically `.pandacorp/status.yaml`; `Origin — Pandacorp` lives in `.pandacorp/guide.md`, not `CLAUDE.md`). Exclude the factory itself and `mission-control/` (internal).
- **Registered set**: the paths listed in `factory/portfolio.md`.
- **Two cases, both requiring the `.pandacorp/` marker:**
  - **Orphan** = a folder with the `.pandacorp/` marker that is **missing from the portfolio** and **never went through the handoff** (built by hand / cloned) → adopt with `/pandacorp:adopt`.
  - **Unlisted** = a folder with the `.pandacorp/` marker that is already a factory project but whose **portfolio row was lost** → reconcile with `/pandacorp:sync-portfolio` (NOT adopt — it's already a factory project).

## Acceptance criteria (EARS)

### REQ-16-001 — Marker gate (never list foreign folders)
- **AC-16-001.1** — A folder SHALL be a candidate for the banner **only if** it contains the `.pandacorp/` marker (`.pandacorp/status.yaml`); a folder **without** the marker SHALL NEVER appear, regardless of whether it is a git repo or sits in the projects folder.
- **AC-16-001.2** — Personal code and other-AI projects that coexist in the projects folder (no `.pandacorp/` marker) SHALL be **excluded** from the banner.

### REQ-16-002 — Orphan vs unlisted (both have the marker)
- **AC-16-002.1** — IF a folder has the `.pandacorp/` marker, is **missing from the portfolio**, and was never adopted (true orphan), THEN Mission Control SHALL show a dismissible banner offering **`/pandacorp:adopt`** with the **path** and the step (open a session in the folder), as copyable text.
- **AC-16-002.2** — WHERE a folder has the `.pandacorp/` marker but is **missing from the portfolio** as a lost row (unlisted), Mission Control SHALL instead suggest **`/pandacorp:sync-portfolio`** — NOT adopt (it's already a factory project).
- **AC-16-002.3** — Each listed candidate SHALL be visually tagged by case (orphan → "sin adoptar"; unlisted → "falta en portfolio") so the two are not confused.

### REQ-16-003 — Banner lifecycle and bounds
- **AC-16-003.1** — The banner SHALL **disappear on its own** once the project is reconciled (marker + portfolio row both present) or is explicitly dismissed by the owner.
- **AC-16-003.2** — WHERE **more than two** candidates are present, the banner SHALL **collapse the overflow** — showing the first two and a toggle ("Ver N proyectos más sin registrar" / "Ver menos") — so several candidates do not dominate the dashboard (the wall-of-banners regression).
- **AC-16-003.3** — The detection SHALL be **read-only**: it never runs `adopt`, `git`, or writes the portfolio for the owner.
- **AC-16-003.4** — The scan SHALL be **bounded** to the projects folder (immediate children only) — it does not crawl the whole disk.

## Non-goals
- It does not adopt anything, nor create the portfolio row. It only surfaces the candidate and the command.
- It does not deep-scan nested folders or unrelated directories.

## Implementation note
In the real app (Next.js), a server-side endpoint does the directory listing + git/file reads and returns the orphan list; the prototype simulates it with a flag (`ORPHANS`). The adoption itself is the `/pandacorp:adopt` skill (DR-045), run by the owner inside the project.
