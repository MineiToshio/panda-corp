---
name: sync-portfolio
description: Syncs the Pandacorp portfolio - detects cards moved on the ideas kanban (status changes in frontmatter) and refreshes each project's state by reading its status.yaml. Use in panda-corp, on demand or as a periodic job.
---

# /pandacorp:sync-portfolio

Factory ↔ projects synchronization. Runs IN panda-corp.

## Part 1 — Detect moved cards (kanban → actions)

1. Run the status scanner:
   ```bash
   bash "${CLAUDE_PLUGIN_ROOT}/scripts/scan-ideas.sh"
   ```
   It compares each card's current `status:` against the previous snapshot (`.pandacorp-cache/ideas-snapshot.txt`) and lists the changes.
2. For each detected change, act according to the NEW status:
   - `recommended` → tell the owner it is ready for `/pandacorp:spec <idea>` (the visible handoff command — it runs the internal `scaffold` step; or run it if the owner asked for automatic mode)
   - `discarded` → verify that the card has the rationale noted (DR-011)
   - other changes → just record them in the report

## Part 2 — Refresh the portfolio (projects → factory)

3. **Mechanical read**: run the scanner for the raw per-project facts —
   ```bash
   bash "${CLAUDE_PLUGIN_ROOT}/scripts/scan-portfolio.sh"
   ```
   It resolves every `factory/portfolio.md` row's path, reads that project's own `.pandacorp/status.yaml`, and prints one line per project: `path · phase=<phase> · WOs done/total · running=<bool> · overlay=<project> vs <factory current> · drift=<none|DRIFT|unknown>`. It is read-only (never writes `portfolio.md`) and degrades honestly: a missing `portfolio.md` exits non-zero with a clear message; a row whose path or `status.yaml` is missing/unreadable prints `BROKEN · <name> · <reason>` and the scan continues. Use its output to update phase/summary/sync date for each row. Do NOT compute business metrics here — the **Users/Return/Verdict** columns are written by `/pandacorp:review-launch` (DR-043); `sync` only refreshes phase/summary/sync date and leaves the business columns intact.
4. **Broken path** (folder moved or deleted — the scanner reported this row `BROKEN`): do NOT delete the row. Mark it `⚠️ path not found` and show the owner the exact recovery step:
   - If the portfolio row has a `repo:` URL → print: *"Re-clone with `git clone <repo> <path>` and then re-run `/pandacorp:sync-portfolio`."*
   - If there is **no `repo:`** → warn: *"The folder was deleted and there is no registered remote. Check a local backup or recreate the project with `/pandacorp:spec`."*
   Do NOT attempt to clone or write anything automatically.
5. Consistency: if a project is `shipped` but its idea card is not, fix the card (and vice versa, report the discrepancy). Any card auto-fixed this way is logged in the Part 3 report (which card, old status → new status) — never a silent write.
5b. **Overlay-drift watch (DR-048 companion)**: the scanner's `drift=` column (step 3) already flags a project whose `overlay_version` lags the factory's `plugin/templates/OVERLAY_VERSION`; act on a `DRIFT` row as a **drift finding in the report** ("`<project>` on 8.51.0, factory at 8.55.4 — will auto-upgrade on its next skill run; run `/pandacorp:upgrade` there to close it now"). This closes the quiet-project hole: upgrade only fires on skill invocation, so a project nobody touches drifts silently unless THIS periodic job surfaces it.
5c. **Materialized stats — regenerate the factory store, then join the aggregate index (FRD-23, AC-23-003.1)**: after the portfolio walk, first regenerate the factory-wide store and then join every project's materialized portada (`.pandacorp/stats.json`) into the O(1) aggregate index Mission Control reads (`<factory-root>/.pandacorp/stats-aggregate.json`). From the `mission-control/` repo root run:
   ```bash
   pnpm stats:factory          # → scripts/read-model/factory-store.mjs → stats-factory.json (factory-wide facts, its own seal)
   pnpm stats:sync-aggregate   # → scripts/read-model/sync-aggregate.mjs → stats-aggregate.json (join the N portadas)
   ```
   Run `stats:factory` **first**: it is the single writer (DR-115) of the factory-scoped store (`phaseTransitions`, `scalars.{projects,decisions}`, `lessons`), and `sync-portfolio` — which already walks the whole factory — is its only invoker until the universal per-commit trigger (`scripts/read-model/README.md`) is wired; without this step the factory store decays to stale after any commit. Both CLIs degrade honestly (DR-078): an un-derivable store / a missing or corrupt portada is reported and skipped — never a silent empty; MC's seal validation + live-git fallback covers a skipped scope. This is why the Informe's cost stays independent of the number of projects.

## Part 3 — Report

6. Short summary: cards moved and action taken, state of each active project, discrepancies found.

## Rules
- This skill is designed to run without interaction (a future daily job): when no human is present, it only reports and records — it does not run automatic scaffolds unless there is explicit prior instruction.
