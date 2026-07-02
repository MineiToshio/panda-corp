# Factory backlog — the factory's actionable work queue

This is the factory's **actionable, closeable work queue** for its *own* tooling: defects in the
plugin, the build engine, the templates, the standards machinery, the hooks — and changes/adjustments
to them. An item here is **opened, worked, and closed**. It is the opposite of `factory/memory/`, which
is durable knowledge that is retrieved forever and never "closed".

Policy: **DR-103** (`factory/decisions/registry.yaml`). History: `factory/decision-log.md`.

## Why this exists — the three planes (separated by durability)

The factory accumulates three structurally different kinds of thing. They were blurring together
(actionable defects were landing in the learning memory and inside audit proposals). Keep them apart:

| Plane | What it is | Lifecycle | Home |
|---|---|---|---|
| **1 · Durable knowledge** | A retrievable lesson/verdict/pattern/gotcha — read again before building something similar, forever | retrieved · re-weighted · deprecated (never "closed") | `factory/memory/` (+ standards, `registry.yaml`, ADRs) |
| **2 · Narrative proposal** | A research/audit/strategy document (options, executive summary, findings) that informs ONE decision | read once → decided → archived | `docs/proposals/` (factory-level RFCs) |
| **3 · Actionable item** | A defect to fix or a change to make in the factory's own tooling | **opened → doing → done → closed** | **`factory/backlog/` (here)** |

This is the same split mature practice draws — Google SRE separates the durable *lesson learned* from the
trackable *action item* ("each lesson maps to ≥1 action item"; action items are closed out, not kept
forever); ITIL separates the durable Known-Error Database from the per-issue Problem Record; the RFC/ADR
world separates the *scaffolding that is archived once a change ships* from the *load-bearing artifacts
future changes design against*. Conflating them is a documented failure mode: a store that accumulates
one-off/resolved items degrades retrieval and re-surfaces stale actions ("temporal memory contamination").

## The routing rule (one question decides)

At the point of capture — a lesson candidate, an audit finding, an owner remark — ask:

- **Would a future agent RETRIEVE this before building something similar?** → `factory/memory/` (plane 1)
- **Does someone have to DO something and then CLOSE it?** → **`factory/backlog/` (plane 3, here)**
- **Is it a research/strategy document decided once?** → `docs/proposals/` (plane 2)
- **Is it BOTH a durable lesson AND a required fix?** → **split it**: the actionable defect → the backlog;
  the *generalizable* lesson (the durable "why", stripped of the file-by-file plan) → `factory/memory/`,
  linked to the backlog id. The lesson survives after the fix ships; the backlog item closes.

This mirrors what a Pandacorp **project** already does: durable notes → `.pandacorp/run/lessons.md`,
actionable changes → `.pandacorp/inbox/changes/` (via `/pandacorp:change`). The factory never had the
plane-3 home for its *own* tooling — this is that home. (Note: the factory backlog is NOT an "inbox":
`.pandacorp/inbox/` is a project→factory channel; this is the factory's own work queue.)

## Scope — what belongs here vs elsewhere

- **Here (factory tooling):** a defect or change in `plugin/` (skills, agents, hooks, templates), the
  build engine (`pandacorp-build.js`), `factory/standards/` machinery, the overlay templates.
- **NOT here (a product project):** a defect or change in Mission Control or any sibling project goes to
  THAT project's own change queue (`.pandacorp/inbox/changes/`, via `/pandacorp:change`) — not the
  factory backlog. The factory backlog is for the factory's own know-how/tooling only.

## Item schema

One item per file: `BL-NNNN-<short-kebab-slug>.md` (`BL` = backlog item; monotonic, zero-padded). Copy
`_item-template.md`. Committed English (like standards/proposals — company know-how, not owner data).

**Id allocation (MANDATORY — the 2026-07-01 collision rule).** Before filing, run
`bash plugin/scripts/validate-backlog.sh` — it validates the store AND prints the **next free id**; use
that id. Never infer the next number from memory or from the last item you happen to know: two parallel
sessions doing that is exactly how BL-0010/BL-0011 collided (the same class BL-0013 fixed for LESSONs).
The validator also fail-closes on duplicate ids, filename↔id mismatches and bad enums, so run it again
after filing. Mission Control's backlog reader is fail-loud on duplicates — a collision breaks the owner's
surface, not just the store.

```yaml
---
id: BL-NNNN
type: bug            # bug (defect in existing tooling) | change (new/adjusted capability)
area: build-engine   # build-engine | plugin-skill | plugin-agent | templates | standards | hooks
title: <one imperative line>
status: open         # open | doing | done
severity: p1         # p0 | p1 | p2  (for bugs; optional for changes)
opened: YYYY-MM-DD
closed:              # YYYY-MM-DD when done (empty while open)
source: LESSON-NNNN  # the lesson / proposal finding / conversation that spawned it
closes:              # what shipping this resolves (a DR, a standard, the doc updated) — filled on close
links: [LESSON-NNNN, DR-NNN]
---
**Problem:** what is wrong / what is needed (concrete, anchored to evidence).
**Fix plan:** the steps + the exact files to touch.
**Done when:** the closeable, objective criteria (a gate passes, a doc updated, a version bumped).
```

## Lifecycle

1. **Open.** Filed by the routing rule (a split lesson, an audit finding, an owner ask). `status: open`.
2. **Doing.** Someone is working it → `status: doing`.
3. **Done → closed.** The fix ships and the "Done when" criteria are objectively met → `status: done`,
   `closed:` set, `closes:` names what it produced (a DR/standard/version bump), and the source lesson (if
   any) is back-linked. A done item stays as a record (git history); it is not deleted.

Unlike memory, the backlog **does** close and clear items — an obsolete or infeasible item is closed with
a reason (Google SRE: "an obsolete or infeasible action item just distracts you"), never kept open forever.

## Relationship to the other planes

- A `factory/memory/` lesson that was really a defect is **split**: its actionable half becomes a `BL-*`
  item here; the lesson keeps only the durable takeaway and links to the item.
- A `docs/proposals/` audit's actionable findings (P0/P1/P2) are **extracted** here as `BL-*` items
  (linked back to the proposal); the proposal keeps the narrative/why and is archived.
- When a `BL-*` item's fix creates a durable rule, that graduates to a standard / `DR` / skill via the
  normal path — and, if there's a durable lesson behind it, it lives in `factory/memory/`.
