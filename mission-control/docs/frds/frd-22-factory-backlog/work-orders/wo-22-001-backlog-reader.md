---
id: WO-22-001
type: work-order
slug: backlog-reader
title: Backlog reader, area helpers and the reason-aware discard write
status: ACTIVE
parent: FRD-22
foundation: false
implementation_status: PLANNED
difficulty: low
reopen_count: 0
artifacts: ["src/lib/backlog/**"]
source_requirements: [REQ-22-001, REQ-22-004, REQ-22-007, REQ-22-008]
dependsOn: []
last_updated: '2026-10-22'
---

# WO-22-001 Backlog reader, area helpers and the reason-aware discard write

> Blueprint: [`../blueprint.md`](../blueprint.md) (`IF-22-backlog`, `IF-22-areas`, `IF-22-discard`).
> Source-of-truth hierarchy: `FRD > FDD > design-tokens > blueprint > work order`.

## Summary

Re-verify the existing backlog data layer (`readBacklog`, `discardBacklogItem`) against the amended FRD with
citing tests, add the pure area helpers the Backlog tab filters by (plain-name keys, merged areas counted
together), and extend the single bounded write so a typed "Motivo" is recorded as `discard_reason`. No UI. This
is the first work order of FRD-22: the code predates it (built under FRD-17's v1 work orders), so most of the
work is proving it, not writing it.

## In Scope

- `src/lib/backlog/backlog.ts` (exists): keep the typed model, the severity-then-id order, the fail-loud
  `errors[]` (malformed YAML, missing required field, out-of-range enum, empty or unreadable file) and the
  first-wins duplicate-id rule; add the missing citing tests (see Tests). Behaviour change only if a test shows
  a gap against the ACs below.
- `src/lib/backlog/areas.ts` (new): `backlogAreaKey(area: string)` returns a catalogue key leaf
  (`buildEngine`, `pluginSkill`, `templates`, `hooks`, `standards`, `missionControl`, `pluginAgent`, `plugin`,
  `other`); both `hooks` and `plugin-hooks` map to `hooks`; any unknown code maps to `other` (never dropped).
  `countByArea(items)` returns the counts per key with merged areas counted together, ordered by count
  descending then key. It returns keys, not Spanish text: the UI resolves them with the copy accessor, so this
  W0 module needs nothing from WO-13-010.
- `src/lib/backlog/discard-backlog.ts` (exists): `discardBacklogItem(id, reason?)`. The second parameter is
  optional so every current caller keeps compiling. When `reason` is non-blank after trimming it is written as
  `discard_reason` (bounded to 500 characters); a blank or absent reason writes no field.
- Tests under `src/lib/backlog/_tests/`, using real-shaped fixtures and one malformed fixture per failure that
  must fail loud (DR-078); fixtures built by a builder in `src/test/` only if one already exists, otherwise
  inline builders in the test files.

## Out of Scope

- Any UI, the Server Action (`src/app/proposals/_actions/discard-backlog.ts`, WO-22-002) and the copy of the
  area names (the catalogue keys exist: `propuestas.backlog.areas.*`).
- Creating, closing or editing the content of a backlog item (FRD-22 non-goal).
- Changing the `factory/backlog/` format or the item template (factory-owned).

## Requirements & Acceptance Criteria

REQ-22-001, REQ-22-004, REQ-22-007 (write half), REQ-22-008. The acceptance criteria this work order owns,
copied from `frd.md`:

- **AC-22-001.1** — Mission Control SHALL read every `factory/backlog/BL-*.md` item (skipping `README.md` and `_item-template.md`) into a typed model (`id`, `type` bug|change, `area`, `title`, `status` open|doing|done|discarded, `severity`, `source`, `closes`, `links`, `opened`, `closed`).
- **AC-22-004.1** — The backlog reader SHALL distinguish "the backlog is empty" from "an item could not be interpreted": a malformed `BL-*.md` (unparseable YAML, missing a required field, or an out-of-range enum) SHALL be surfaced in an `errors` collection, never silently dropped. A missing `factory/backlog/` directory is a legitimately-empty backlog, not an error.
- **AC-22-004.3** — **Duplicate ids are a data-integrity defect, surfaced fail-loud (BL-0013).** WHEN two different `BL-*.md` files declare the same `id`, the reader SHALL keep only the first occurrence in `items` (so the panel never renders duplicate React keys or a misleading second copy) and surface each subsequent collision in `errors[]` (`duplicate id <ID> (already defined in <first-file>)`). The invariant "the rendered backlog has unique ids" is enforced at the read boundary, not assumed. Added 2026-07-01 after a real collision (two files reusing BL-0010/BL-0011) intermittently red-locked the /proposals smoke gate with a duplicate-key console error.
- **AC-22-007.2** — Confirming SHALL call the `discardBacklogItem` write, which rewrites `status: discarded` and records `status_before_discard` (the prior value) and, when a Motivo was typed, `discard_reason` [ASSUMPTION: the same field the idea-card discard uses (FRD-02 REQ-02-008); the prototype dialog only draws the optional field — source: reconciliation C-20], preserving the body and every other frontmatter field verbatim (the same bounded-write pattern as `discardIdea`/`discardChange`) — never touching any sibling file.
- **AC-22-008.1** — (amended 2026-10-22, v2 reconciliation) WITHIN each actionable status group (En curso, Abiertos), items SHALL be ordered by `severity` first (P0 before P1 before P2), then by `id` ascending; an item with no `severity` SHALL sort after all severities. The history ("Hechos y descartados", done and discarded items) SHALL be ordered by `closed` date, newest first; items without a `closed` date (for example those discarded from Mission Control) SHALL follow in reader order. This is an invariant of the reader (`readBacklog`), not a per-view sort — every consumer of the read result sees the same order.

Not owned here, delivered by WO-22-002: the group rendering, cards, the dialog and the Motivo field that feeds
the `reason` argument.

## Interfaces

- `readBacklog(): BacklogReadResult` (unchanged shape: `items`, `errors`; `body` stays exposed for the dialog).
- `backlogAreaKey(area)`, `countByArea(items)` (new, pure).
- `discardBacklogItem(id, reason?)` returns the unchanged `DiscardBacklogResult` union (`not-found`,
  `parse-error`, `not-discardable`); the optional parameter is the only signature change.

## Reuse

None of components.md (no UI). Reuse the existing `resolveFactoryRoot` and the `gray-matter` read pattern
(`matter(raw, { excerpt: false })`, never the bare call); the write mirrors `lib/discard/discard.ts`
(`discard_reason`) and `lib/changes/discard-change.ts`.

## Installs

None.

## Tests

- Reader: a real-shaped fixture directory (items of every status and severity, one with no severity, README and
  template present) asserts order, model fields and that README/template are skipped; a missing directory
  returns `{ items: [], errors: [] }`; unparseable YAML, a missing `area`, an out-of-range `status` and an empty
  file each appear in `errors[]` with the file name; two files with one id keep the first and report the second
  with the exact `duplicate id <ID> (already defined in <first-file>)` reason; a table-driven test over shuffled
  inputs shows the order invariant (no new test dependency).
- Areas: every code in the prototype map, the merged `hooks` pair counted once, an unknown code to `other`.
- Write: discarding an `open` and a `doing` item rewrites exactly the three fields and leaves body and other
  frontmatter byte-identical; a typed reason is stored, a blank one is not; `done`, `discarded` and unknown
  statuses are refused with `not-discardable` and the file is untouched; an id that cannot match a filename
  (path traversal) is `not-found`; a sibling file is never modified.

## Derogated tests (BL-0051)

None: the reader and the write keep their behaviour; the only signature change is additive.

## Visual reference

N/A (no UI).

## Dependencies

None (a W0 lane). Consumers: WO-22-002 (panel, action, dialog), WO-17-008 (Resumen counts, via the reader).

## Definition of done

The five ACs above have at least one citing test each; the completeness items are present: error path per
failure mode (above), input validation beyond the type (id shape, reason bound), the empty case (missing
directory), no secret and no personal data touched, and no outbound call. `.pandacorp/verify.sh` is green;
the reviewer confirms `docs/product/data-model.json` needs no change (a markdown-frontmatter queue, not part of
the logical model: record "unchanged").

## Status Note

