---
name: sync-portfolio
description: Syncs the Pandacorp portfolio - detects cards moved on the ideas
  kanban (status changes in frontmatter) and refreshes each project's state by
  reading its status.yaml. Use in panda-corp, on demand or as a periodic job.
---

# /pandacorp:sync-portfolio

1. Run the status scanner:
   ```bash
   bash "${CLAUDE_PLUGIN_ROOT}/scripts/scan-ideas.sh"
   ```
   It compares each card's current `status:` against the previous snapshot (`.pandacorp-cache/ideas-snapshot.txt`) and lists the changes.
2. For each detected change, act according to the NEW status:
   - `recommended` → tell the owner it is ready for `/pandacorp:spec <idea>` (the visible handoff command — it runs the internal `scaffold` step; or run it if the owner asked for automatic mode)
   - `discarded` → verify that the card has the rationale noted (DR-011)
   - other changes → just record them in the report

Runs in the factory.
