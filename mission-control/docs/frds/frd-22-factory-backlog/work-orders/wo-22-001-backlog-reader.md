---
id: WO-22-001
type: work-order
slug: backlog-reader
title: Backlog reader, area helpers and the reason-aware discard write
status: ACTIVE
parent: FRD-22
foundation: false
implementation_status: VERIFIED
difficulty: low
reopen_count: 0
artifacts: ["src/lib/backlog/**"]
source_requirements: [REQ-22-001, REQ-22-004, REQ-22-007, REQ-22-008]
dependsOn: []
last_updated: '2026-10-30'
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

- Recovered the previous parked implementation after reading its source and tests. Its recorded commit
  refusal involved ignored journal staging; the prescribed commit command will re-check that condition.
- `readBacklog(): BacklogReadResult` keeps the existing item/body/error interface and first-wins duplicate
  boundary, rejects supplied invalid severity and blank ids, and groups doing, open, then combined history.
  Actionable groups sort by severity then id. History sorts by parsed timestamps, retaining YAML-native
  timestamp precision, followed by undated items in reader order.
- `backlogAreaKey(area: string): BacklogAreaKey` provides nine catalogue leaves; hooks/plugin-hooks merge
  and unknown codes become other. `countByArea(items: readonly Pick<BacklogItem, "area">[]):
  { key: BacklogAreaKey; count: number }[]` returns present areas by descending count then key. Consumers
  resolve labels through `propuestas.backlog.areas.*`. LESSON-0077 informs the single shared resolver.
- `discardBacklogItem(id: string, reason?: string): DiscardBacklogResult` keeps its existing result union.
  It trims reasons and bounds them to 500 Unicode code points; blank/absent adds no field. YAML scalar source
  ranges allow the three permitted fields to change while preserving all other bytes, comments and body.
  Existing yaml dependency only. IDs must match BL-digits, identify a regular markdown file declaring that
  id, and have open/doing status. Terminal/unknown states refuse the write; no sibling is written.
- Tests: `src/lib/backlog/_tests/backlog.test.ts`, `areas.test.ts`, `discard-backlog.test.ts` cover every owned
  AC, Spanish real-shaped fixtures, malformed/unreadable data, duplicates, ordering, merged areas,
  reason bounds, write refusal and byte/sibling preservation.
- Logical data model: unchanged (existing frontmatter queue). No UI or shared component was created.
  Visual reference is N/A; the FRD-22 behaviour e2e spec is absent in this base and belongs to WO-22-002.
- Retry validation: all 32 unit cases, `tsc --noEmit` and scoped Biome passed together (EXIT=0).
- Current retry: the prescribed `commit-wo` ran its related tests but returned `ok:false`,
  `status:commit-failed` (exit 4), naming ignored `mission-control/.pandacorp` and the git hint to use `-f`.
  Source inspection confirms journal staging uses `git add -A`; the command restored the implementation
  stamp. This is an observed commit infrastructure blocker, not a test failure. No build machinery,
  package/dependency, ignore rule or main checkout was modified. Parked through the prescribed command;
  post-commit self-verify/browser gates were not run because no work order committed.

### 2026-10-30 restoration

- Restored the seven parked files in the assigned orch/w0 worktree. Existing target files matched the current main checkout before restoration; no newer target code needed reconciliation.
- Left changes uncommitted as instructed. No reviewer tests, visual baselines, decision log or build state were changed.
- `pnpm exec vitest run src/lib/backlog --reporter=dot`: exit 0, 3 files and 32 tests passed.
- `bash .pandacorp/verify.sh --only=biome,tsc,knip`: exit 0. Biome reported an informational schema/CLI version mismatch (2.5.1/2.5.2); Knip reported nine configuration hints. No failing gate.
- The first test invocation exposed an accidental nested copy path; those seven newly created files were relocated to the intended project paths and the empty nested directories removed before the successful rerun.
- Browser verification was not run (sandbox restriction). No port was supplied; neither acceptance command starts a server.

### 2026-10-30 reviewer repair

- Reproduced the independent review baseline: the requested acceptance suite had 14 failing tests.
- Empty scalar replacements now insert the required separator. Every proposed write is re-parsed with
  the reader's cache-bypassing parser and checked for the requested id, discarded status and prior status
  before touching disk. Layouts whose bounded additions produce invalid YAML (including flow mappings,
  indented roots and document-end markers) return `parse-error` with the original bytes intact.
- Reads use a Buffer and reject a non-identical UTF-8 round trip. Candidate discovery continues past a
  prefix-matching file declaring a different id, selecting the file declaring the requested id.
- Added JSDoc to `DiscardBacklogResult` and `BacklogAreaKey`; aligned this work order's README row.
- `pnpm exec vitest run src/lib/backlog src/lib/docs/_tests/activity src/lib/changes/_tests/openChanges --reporter=dot`: exit 0, 10 files / 194 tests passed, including the unchanged reviewer suites.
- `bash .pandacorp/verify.sh --only=biome,tsc,knip`: exit 0 after extracting the empty-scalar formatting helper to satisfy the complexity limit. Biome reports the existing schema/CLI mismatch; Knip reports nine configuration hints.
- Remains `IN_REVIEW`. No commits, reviewer-test edits, visual-baseline edits, decision-log edits or main-checkout writes. Browser verification was not attempted under the sandbox restriction; no port was supplied or inherited. The full verification suite was not run.

### 2026-10-30 — Independent gate: PASS

Reviewed at `6f5e908b`. The reviewer suites from `df40940e` are unchanged and green with the other owned
tests (322/322), and D1-D3 are closed. On a tmp copy of the real backlog, 113 open/doing discards
succeeded, 172 done items were refused, and line diffs touched only the three fields. Full `verify.sh`
at that SHA was NOT green: every sub-gate through vitest passed (8,328/8,328) and Playwright reported
179 passed, 12 skipped, 1 failed. The failure is `e2e/persistent-navigation.spec.ts:144` on mobile, which
this work order does not touch; the same class of failure reproduces at `f7a6573e` without this code
(LESSON-0185 family, cause unconfirmed). It is recorded as pre-existing, not waived as green. Data model:
unchanged (a markdown-frontmatter queue). `BL-0220` carries `severity: p3`, so the reader reports it in
`errors[]` until the factory file is corrected. Accepted residual: a frontmatter anchor on `status`, or a
final `|+` block, keeps its bytes but changes that other field's parsed value; no real item uses either.
