---
# Factory backlog item (DR-103) — one actionable, closeable unit of work on the factory's OWN
# tooling (plugin, build engine, templates, standards machinery, hooks). Self-contained: it must
# carry ENOUGH context, a concrete plan, and its proof (tests) that an agent with ZERO prior
# knowledge of this conversation can implement it well and know when it is truly done.
#
# YAML rule (fail-loud reader, DR-078): quote every free-text scalar — `title`, `source`, `closes`.
# A bare `: ` (colon-space) or a leading special char inside an unquoted value breaks the
# frontmatter and the whole item fails to load. When in doubt, wrap it in double quotes.
id: BL-NNNN
type: bug                 # bug (defect in existing tooling) | change (new/adjusted capability)
area: build-engine        # build-engine | plugin-skill | plugin-agent | templates | standards | hooks
title: "<one imperative line — QUOTED>"
status: open              # open | doing | done
severity: p1              # p0 | p1 | p2 (for bugs; optional for a change)
opened: YYYY-MM-DD
closed:                   # YYYY-MM-DD when done (empty while open)
source: "<LESSON-NNNN | docs/proposals/NN-*.md finding | owner/conversation — QUOTED>"
closes:                   # "<the DR / standard / doc this shipping resolves>" — QUOTED, filled on close
links: []                 # [LESSON-NNNN, DR-NNN] — related lessons, decisions, proposals
---

## Problem
What is wrong (bug) or needed (change), with **concrete evidence**: the symptom, the exact file(s) and
line(s), and the run/commit/version where it showed up. Write for a reader who was NOT in the
conversation — never assume prior context. State the impact (why it matters / what it costs).

## Root cause
_(bugs — omit for a plain change.)_ WHY it happens — the mechanism, not just the symptom. The fix must
target this, not paper over the surface.

## Fix plan
The concrete steps and the **exact files to touch**, specified at the altitude of contracts/behaviour
(a new function, a changed branch, a config key) — not line-by-line. Name the mechanism. If it splits
into ordered steps, number them. Call out any migration/back-compat concern.

## Tests (prove the fix — TDD, RED → GREEN)
The test case(s) that **fail before** the fix and **pass after**, and where they live. Cover the happy
path AND the failure/edge path the defect lived in (completeness, DR-100). A factory-tooling item may be
proven by: a unit test, a **gate canary** (`verify.sh --canary`, DR-079) that asserts the gate still goes
RED on a broken fixture, a script/CLI assertion, or — when automation is genuinely infeasible — a
documented manual repro (say which, and why automation doesn't fit).

## Done when
The **objective, closeable** criteria — each one checkable by a script/gate, not by opinion: which gate
passes, which doc/standard is updated, which version is bumped (plugin semver + `OVERLAY_VERSION` if an
overlay/template changed), which lesson is back-linked (`promotion: approved`). When ALL are true →
`status: done`, set `closed:` + `closes:`.

## Out of scope
_(optional.)_ What this item deliberately does NOT touch — the boundary that prevents scope creep.
