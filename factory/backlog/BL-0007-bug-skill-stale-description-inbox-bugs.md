---
id: BL-0007
type: bug
area: plugin-skill
title: /pandacorp:bug frontmatter description still says .pandacorp/inbox/bugs/ (body uses inbox/changes/)
status: open
severity: p2
opened: 2026-06-30
closed:
source: docs/proposals/19-factory-flow-audit-2026-06-30.md (P1 — /change front door; /bug stale description)
closes:
links: [DR-069]
---

**Problem:** `/pandacorp:bug`'s frontmatter description mentions the old `.pandacorp/inbox/bugs/` path while
its body (and the unified DR-069 model) uses `.pandacorp/inbox/changes/`. The description is stale vs the
unified change queue.

**Fix plan:** Update the `description:` in `plugin/skills/bug/SKILL.md` to reference the unified change queue
(`.pandacorp/inbox/changes/`, type bug), consistent with `/pandacorp:change` (DR-069). Verify no other
skill/docs reference `.pandacorp/inbox/bugs/` as the current path.

**Done when:** the `/bug` description matches the unified change queue; `grep -r "inbox/bugs"` finds no
current-state references (historical decision-log mentions preserved); plugin PATCH bump.
