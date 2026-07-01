---
id: BL-0007
type: bug
area: plugin-skill
title: "/pandacorp:bug frontmatter description still says .pandacorp/inbox/bugs/ (body uses inbox/changes/)"
status: open
severity: p2
opened: 2026-06-30
closed:
source: "docs/proposals/19-factory-flow-audit-2026-06-30.md (P1 — /change front door; /bug stale description)"
closes:
links: [DR-069]
---

## Problem
`plugin/skills/bug/SKILL.md`'s frontmatter `description:` mentions the old `.pandacorp/inbox/bugs/` path while
its body (and the unified DR-069 model) files to `.pandacorp/inbox/changes/` (type bug). The description is
stale versus the unified change queue. Found in the 2026-06-30 factory-flow audit. Impact: the description is
the surface the agent/owner reads to understand where a bug lands; a stale path misleads and can drift into
docs/Manual that derive from skill frontmatter.

## Root cause
DR-069 unified the bug queue into `.pandacorp/inbox/changes/` and the skill body was updated, but the
frontmatter `description:` was not swept along with it — a doc-sync miss, not a behavior bug.

## Fix plan
Update the `description:` in `plugin/skills/bug/SKILL.md` to reference the unified change queue
(`.pandacorp/inbox/changes/`, type bug), consistent with `/pandacorp:change` (DR-069). Then verify no other
skill/doc references `.pandacorp/inbox/bugs/` as a current-state path (historical decision-log mentions are
preserved as history).

## Tests (prove the fix — TDD, RED → GREEN)
- **Repo-wide grep assertion (canary):** `grep -rn "inbox/bugs" plugin/ factory/standards/` must return no
  current-state hit (historical decision-log entries excluded). Today it matches the `/bug` description; after
  the fix it is clean. This is the closeable proof.
- **Frontmatter parse check:** the edited `SKILL.md` frontmatter still loads (valid YAML, `description:`
  quoted/well-formed) — the skill catalog derives from it, so it must not break.

## Done when
The `/bug` `description:` matches the unified change queue; `grep -rn "inbox/bugs"` finds no current-state
references (historical mentions preserved); plugin PATCH bump.

## Out of scope
The `/change` / `/bug` routing behavior itself (already unified under DR-069) — this is a description-text
correction only.
