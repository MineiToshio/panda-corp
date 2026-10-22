---
name: implement-backlog
description: Implements factory/backlog/BL-* items — the factory's own
  actionable defects/changes (plugin, build engine, templates, standards
  machinery, hooks; DR-103). Two modes — give it one id (e.g. "implementa
  BL-0007" / `/pandacorp:implement-backlog BL-0007`) and it fixes just that
  item, directly, in this conversation; call it with no argument and it drains
  the WHOLE open/doing backlog, dispatching one subagent per item (model tier
  sized to each item's complexity, CONV-12/DR-111), each isolated in its own git
  worktree, merged back one at a time. Runs IN the factory (panda-corp). Never
  touches a product project's own defects (those go through /pandacorp:change).
---

# /pandacorp:implement-backlog

The mechanism referenced by the backlog's own read-only note ("pídeselo a un agente, p. ej. «implementa BL-0007»") and by Mission Control's Backlog tab. Unlike a product project's `/pandacorp:change`, there is no separate *filing* skill on this side — a `BL-*.md` item already exists (filed by the librarian's routing, an audit, or hand-authored per `factory/backlog/_item-template.md`); this skill only **works and closes** it. Read `factory/backlog/README.md` first if you haven't — it owns the plane-3 model (DR-103) and the item schema.

Runs in the factory.

## Team

- librarian
- implementer
