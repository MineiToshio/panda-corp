---
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
   - `recommended` → tell the owner it is ready for `/pandacorp:scaffold <idea>` (or run it if the owner asked for automatic mode)
   - `discarded` → verify that the card has the rationale noted (DR-011)
   - other changes → just record them in the report

## Part 2 — Refresh the portfolio (projects → factory)

3. For each row of `factory/portfolio.md`: read the project's `docs/status.yaml` following its path and update phase/summary/sync date. Do NOT compute business metrics here — the **Users/Return/Verdict** columns are written by `/pandacorp:review-launch` (DR-043); `sync` only refreshes phase/summary/sync date and leaves the business columns intact.
4. **Broken path** (folder moved or deleted): do NOT delete the row — mark it `⚠️ path not found` and ask the owner.
5. Consistency: if a project is `shipped` but its idea card is not, fix the card (and vice versa, report the discrepancy).

## Part 3 — Report

6. Short summary: cards moved and action taken, state of each active project, discrepancies found.

## Rules
- This skill is designed to run without interaction (a future daily job): when no human is present, it only reports and records — it does not run automatic scaffolds unless there is explicit prior instruction.
