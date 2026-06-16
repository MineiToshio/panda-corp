---
description: Upgrades a Pandacorp project's overlay (the .pandacorp/ integration layer, CLAUDE.md/AGENTS.md imports and the build machinery) to the factory's current version. Runs INSIDE a project. Detects the version gap, migrates the structure if needed, regenerates the managed layer non-destructively, bumps overlay_version and commits on its own. Compatible bumps apply silently; a breaking (MAJOR) jump is announced first. Usually triggered automatically by a skill's preflight (DR-048).
---

# /pandacorp:upgrade

Brings this project's Pandacorp overlay up to the factory's current version. The `/pandacorp:*` skills always run against the **latest** plugin, so a project born on an older overlay can drift; this closes the gap. Runs IN the project. It touches only the overlay/integration layer — never product code or `docs/`.

## How it decides

- **Project version**: `overlay_version` in `.pandacorp/status.yaml`. A pre-6.0.0 project has no `.pandacorp/` and no `overlay_version` → treat it as the oldest (it needs the structural migration).
- **Target version**: `${CLAUDE_PLUGIN_ROOT}/templates/OVERLAY_VERSION`.
- **In sync** (`overlay_version` == target) → say so and do nothing (idempotent).
- **Behind** → upgrade. **Compatible** bumps (same MAJOR) apply **silently** (DR-048) and you only see the commit; a **MAJOR** jump (breaking — a moved/renamed field or path) is **announced first** with the diff, never applied blind.

## Steps

1. **Detect the gap.** Read the project's `overlay_version` (absent = pre-6.0.0 layout) and the plugin's `OVERLAY_VERSION`. If in sync, stop ("already on overlay X").

2. **Structural migration (pre-6.0.0 → 6.0.0+).** If the project still has the OLD layout, move the integration layer into `.pandacorp/` (use `git mv` where tracked to preserve history):
   - `docs/status.yaml` → `.pandacorp/status.yaml`
   - `docs/iteration.md` → `.pandacorp/comms/iteration.md`; `docs/summary.md` → `.pandacorp/comms/summary.md`; `docs/progress.md` → `.pandacorp/comms/progress.md`; `docs/activity.md` → `.pandacorp/comms/activity.md`
   - `docs/decisions.md` → `.pandacorp/inbox/decisions.md`; `docs/bugs/` → `.pandacorp/inbox/bugs/`
   - `docs/idea-origin.md` → `.pandacorp/idea-origin.md`
   - **STAY in `docs/` (product)**: `decision-log.md`, `prd.md`, `frds/`, `blueprint.md`, `adr/`, `work-orders/`, `design/`, `reviews/`, `product-research.md`.
   - Update the project's `.gitignore`: add `.pandacorp/comms/`, `.pandacorp/inbox/`, `.pandacorp/run/`; drop the old `docs/{summary,progress,decisions,iteration,activity}.md` ignores.

3. **Regenerate the managed layer (non-destructive).**
   - **`.pandacorp/guide.md` and `.pandacorp/README.md`**: regenerate ENTIRELY from the current template (fully managed — no merge), substituting the template vars from `.pandacorp/status.yaml` + factory paths.
   - **Machinery** (`.claude/workflows/pandacorp-build.js` and any factory script the overlay ships): regenerate from the template.
   - **`CLAUDE.md`**: ensure it imports `@AGENTS.md` and `@.pandacorp/guide.md`. If the project still has the old fat `CLAUDE.md`, replace the managed sections with the thin import header but **keep everything the owner wrote below the managed line**. Never touch the owner's notes.
   - **`AGENTS.md`**: reconcile the durable-conventions block (write-gate, paths) with the template; keep project-specific additions.
   - **`status.yaml`**: set `overlay_version` to the target. For `created_with` (immutable — the version the project was BORN on): keep it if present; for a project migrated from a pre-6.0.0 layout, set it to `pre-6.0.0` (it was not born on the current overlay).

4. **Bump + record.** Set `overlay_version` to the target in `.pandacorp/status.yaml`. Add a `docs/decision-log.md` entry: "Pandacorp overlay upgraded `<old>` → `<new>`".

5. **Commit on its own**: `chore: upgrade pandacorp overlay <old> → <new>` (moved files + machinery + managed layer). Do NOT mix product changes into this commit.

6. **Report** (in Spanish): what moved, what was regenerated, and the new version. If a MAJOR jump required a manual decision, surface it explicitly.

## Rules
- **Compatible (same MAJOR) = silent** (DR-048): apply and commit without interrupting; the owner sees it via the commit. **MAJOR = announce** the breaking parts + diff before applying.
- **Never clobber the owner's content**: managed files (`guide.md`, `README.md`, machinery) regenerate whole; `CLAUDE.md`/`AGENTS.md` merge by managed-section, the owner's notes stay.
- Touch only the overlay/integration layer — never product code or product docs (`docs/`).
- Idempotent: re-running when already in sync is a no-op.
