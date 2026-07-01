---
id: BL-0013
type: bug
area: plugin-skill
title: validate-memory.sh must reject duplicate LESSON ids (and the harvest/learn flows must pick the next free number)
status: done
severity: p2
opened: 2026-07-01
closed: 2026-07-01
source: owner/conversation (2026-07-01)
closes: validate-memory.sh now fails on a duplicate LESSON id (and on a filename-number ↔ id mismatch); proven with a dup fixture
links: [LESSON-0021, LESSON-0022, DR-047, DR-103]
---

**Problem:** `plugin/scripts/validate-memory.sh` validates each lesson file's frontmatter in isolation but
does **not** check that `id:` is UNIQUE across the store. So two files can share an id and the validator
still reports "OK". Hit this session: a mis-numbered pair of new lessons (`LESSON-0005`/`LESSON-0006`) was
created without first listing the store — which a parallel librarian harvest had already grown to
`LESSON-0020` — colliding ids with the existing `gray-matter`/`js-immutability` lessons. `validate-memory.sh`
passed ("Checked 22 lesson(s) … OK") right over the collision; the owner caught it, not the tooling. No data
was lost (different slugs), but two records shared an id — a silent integrity break in a keyed store.

**Fix plan:**
1. **Add an id-uniqueness gate to `plugin/scripts/validate-memory.sh`:** collect every `id:` value across
   `factory/memory/LESSON-*.md`, and FAIL (non-zero exit + a clear message listing the colliding files) if
   any id appears more than once. Same guard for `factory/backlog/BL-*.md` ids (either extend this script or
   a sibling `validate-backlog.sh`).
2. **Prevent the collision at creation time:** the `/pandacorp:memory` harvest and `/pandacorp:learn` flows
   must compute the next free id by SCANNING existing ids (max + 1), never assume continuity from what a
   single session last created. Note this in `plugin/skills/{memory,learn}/SKILL.md` and/or the
   `librarian` agent so an agent lists the store before writing a new numbered record.
3. **Optional hardening:** a filename-number vs `id:`-field consistency check (the number in the filename
   must equal the frontmatter id), so a rename can't silently desync them.

**Done when:** `validate-memory.sh` exits non-zero with a clear message on a deliberate duplicate-id fixture
(and passes on the clean store); the memory/learn flows document "scan for the next free number"; verified on
a repro. No factory version bump needed (tooling script only), but note it in `factory/decision-log.md`.
