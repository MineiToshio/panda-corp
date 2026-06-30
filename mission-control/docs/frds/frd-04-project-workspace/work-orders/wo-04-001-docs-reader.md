---
id: WO-04-001
type: work-order
slug: docs-reader
title: 'WO-04-001 — `lib/docs.ts`: doc tree + raw read + comms readers'
status: DRAFT
parent: FRD-04
implementation_status: VERIFIED
source_requirements: []
dependsOn: [WO-01-000, WO-01-001]
last_updated: '2026-06-30'
---
# WO-04-001 — `lib/docs.ts`: doc tree + raw read + comms readers

**Feature:** FRD-04 · **Implements:** IF-04-docs (`listProjectDocs`, `readDoc`, `readActivityLog`, `readDecisions`) · **REQ-04-003, REQ-04-004, REQ-04-006**
**Deploy unit:** `lib/docs.ts` (+ `lib/docs.test.ts`). One library module, no UI.

> This is the **whole `lib/docs.ts` reader**: the document tree + raw read, plus the activity-log and
> decisions comms readers. They share the same module, so they are built together (one WO) to avoid
> same-file collisions. The UI halves are WO-04-005 (Summary tab) and WO-04-006 (Documents tab).

## Acceptance criteria (copied)
- **AC-04-006.1** The Documents tab SHALL render the feature-centric document tree (nav) from `lib/docs.ts`.
- **AC-04-006.2** WHEN a document is selected, the Documents tab SHALL render its markdown body; the first available document is selected by default.
- **AC-04-006.3** WHEN the project has no readable documents, the Documents tab SHALL show a graceful empty state.
- **AC-04-003.2** The Summary tab SHALL render the activity log read from `.pandacorp/comms/progress.md`; WHEN the file is absent it SHALL show a graceful "no activity yet" empty state.
- **AC-04-003.3** The Summary tab SHALL render the decision points read from `.pandacorp/inbox/decisions.md`, each highlighted, with a total count badge.

## Scope
- `listProjectDocs(projectPath): DocNode[]` — discover the feature-centric tree per
  [architecture §4.5](../../../product/architecture.md#45-per-project-docs-feature-centric-dr-049---projectpathdocs-and-pandacorp):
  - Product: `docs/product/prd.md`, `docs/product/architecture.md` → group `"Product"`.
  - Per feature: `docs/frds/frd-NN-<slug>/{frd.md, fdd.md, blueprint.md}` → group `"Feature: frd-NN-<slug>"`.
  - Global: `docs/adr/*.md`, `docs/decision-log.md` → group `"Global"`.
  - Stable `id` per node; `label` = filename; `relPath` relative to project root.
- `readDoc(projectPath, relPath): string | null` — return raw markdown only for a `relPath` that
  `listProjectDocs` surfaces (validate against the discovered set — **no arbitrary traversal**);
  `null` if not found.
- `readActivityLog(projectPath): ActivityLog` — parse `.pandacorp/comms/progress.md` into a list of
  high-level entries (bullet lines / log items). Absent file → `{ entries: [] }` (no throw).
- `readDecisions(projectPath): DecisionPoint[]` — parse `.pandacorp/inbox/decisions.md` into
  `{ title, recommendation?, resolved }`. Absent file → `[]`. A pending count is derived by the
  caller as `filter(!resolved).length` (and cross-checked against `status.pending_decisions`).
- The `.pandacorp/comms/progress.md` and `.pandacorp/inbox/decisions.md` files are **Spanish,
  gitignored** owner-facing comms (architecture §4.5) — read as-is.
- **Out of scope:** markdown rendering / highlighting / UI (Summary tab WO-04-005, Documents tab
  WO-04-006), the `pending_decisions` status field (FRD-01), per-FRD work-orders discovery (FRD-05's
  `lib/work-orders.ts`).

## Dependencies
- **Intra:** none.
- **Cross:** FRD-01 `lib/config.ts` (path constants / `resolveFactoryRoot`).

## TDD (RED → GREEN → refactor)
Write `lib/docs.test.ts` first against a **fixture project tree** (point a temp dir or use
`PANDACORP_FACTORY_ROOT`-style fixtures), covering:
1. Discovers product + per-feature + global docs into the right groups (AC-04-006.1).
2. `readDoc` returns the raw markdown of a surfaced node (AC-04-006.2 default-first ordering is stable).
3. `readDoc` returns `null` for a path not in the discovered set (no traversal) (security).
4. Empty/absent `docs/` → `[]`, never throws (AC-04-006.3).
5. `readActivityLog` parses entries from a sample `progress.md` (AC-04-003.2); absent `progress.md` → `{ entries: [] }`, no throw.
6. `readDecisions` parses pending vs resolved points, with optional recommendation (AC-04-003.3); absent `decisions.md` → `[]`, no throw.

## Definition of done
- [ ] `lib/docs.test.ts` written first and green for all cases above.
- [ ] No `any`, no `@ts-ignore`; pure read-only (no `fs.write*`).
- [ ] `bash .pandacorp/verify.sh` passes (biome + tsc + vitest).

## Status Note

**Built:** Full `lib/docs.ts` module — IF-04-docs contract complete (AC-04-006.1/2/3, AC-04-003.2/3, REQ-04-003/004/006).

**Interfaces/contracts exposed (`lib/docs.ts`):**
```ts
export interface DocNode { id: string; label: string; group: string; relPath: string; }
export function listProjectDocs(projectPath: string): DocNode[]
export function readDoc(projectPath: string, relPath: string): string | null
export interface ActivityLog { entries: string[]; }
export function readActivityLog(projectPath: string): ActivityLog
export interface DecisionPoint { title: string; recommendation?: string; resolved: boolean; }
export function readDecisions(projectPath: string): DecisionPoint[]
```

Also exports `readProjectDocs` (IF-01, FRD-01 origin) and `FrdModule`/`ProjectDocsIndex` types — full cohabitation with pre-existing WO-01-006 exports in the same file.

**Key design decisions:**
- `listProjectDocs` surfaces Product / Feature / Global groups only; `.pandacorp/` comms are NOT doc nodes (security boundary).
- `readDoc` validates relPath against the live discovered set — no arbitrary fs traversal. Uses `lstatSync` (not `statSync`) so symlinks are rejected before reading (symlink traversal guard — factory memory inbox gotcha noted 2026-06-16).
- `readActivityLog` collects `- ` bullet lines from `progress.md`, strips prefix, trims, skips blanks (I2); CRLF-safe via trim.
- `readDecisions` parses `## OPEN:|CLOSED:|RESOLVED:` H2 blocks only (H3 rejected); recommendation scoped per block, no bleed; empty/whitespace-only titles suppressed (I2); case-insensitive status word.
- All four functions are fail-soft: blank/missing path → empty result, never throws.

**Integration seams:**
- WO-04-005 (Summary tab) consumes `readActivityLog` + `readDecisions`.
- WO-04-006 (Documents tab) consumes `listProjectDocs` + `readDoc`.
- FRD-05 (`lib/work-orders.ts`) may consume `listProjectDocs` for FRD-module enumeration.
- FRD-08 (Manual) may consume `listProjectDocs` for doc-tree nav.

**Test files covering this WO:**
- `lib/docs.wo04001.test.ts` — 63 tests: listProjectDocs (Product/Feature/Global groups, DocNode shape, idempotency, I2/I3/B1' regressions, empty state, read-only) + readDoc (happy path, security/no-traversal, round-trip).
- `lib/docs.wo04001.reviewer.test.ts` — 12 tests: adversarial (symlink traversal, NUL/encoded relPath, backslash variants, ordering stability, name confusions, resolution guard, empty-file returns `""` not null, id uniqueness).
- `lib/docs.wo04002.test.ts` — 63 tests: readActivityLog + readDecisions (happy paths, absent files, edge cases, B1'/I2/I3, read-only, idempotency, orthogonality).
- `lib/docs.wo04002.reviewer.test.ts` — 24 tests: adversarial (CRLF line endings, non-dash bullets, empty/whitespace titles, recommendation bleed, heading robustness — H3/glued/lowercase, verbatim fidelity, symlinked comms read-only).

**verify.sh at commit:** GREEN — 3381 tests pass, 118 files, biome clean, tsc clean.

## Status Note — 2026-06-30 addendum: `readDecisions` real-world heading format (bug fix)

**Bug found by the owner:** the Summary tab's "Puntos de decisión" section (CMP-04-decisions) was
always empty, regardless of `.pandacorp/inbox/decisions.md`'s real content — `readDecisions` only
recognized `## OPEN:|CLOSED:|RESOLVED:` H2 blocks (a documented-but-never-actually-written format).
Every real `decisions.md` (including this very project's) uses the date-prefixed convention agents
write in practice: `## YYYY-MM-DD (<status phrase>) — <title>`.

**Fix:** `readDecisions` now supports BOTH conventions — the original legacy `OPEN/CLOSED/RESOLVED`
form (all 87 pre-existing tests still pass unchanged) AND the date-prefixed real-world form, with the
status phrase matched against resolved/pending Spanish+English keyword sets; an explicit body line
`- **Estado:** PENDIENTE/RESUELTO` (the `/pandacorp:decide` template's machine field) takes priority
when present. New export `countPendingDecisions(projectPath)` — the single derived resolver other
modules now call instead of re-deriving the `filter(!resolved).length` pattern themselves (DR-092).

**New tests:** 10 cases added in `docs.wo04002.test.ts` group "date-prefixed heading format" +
"countPendingDecisions" (mixed legacy/dated headings in one file, Estado-line override, Spanish
recommendation line without leading `- `, multi-entry real-MC-shape fixture, fail-loud default for
an ambiguous heading). `_pushDecision`'s per-line logic extracted into `_consumeLine` to stay under
Biome's cognitive-complexity cap after the new branching.

**verify.sh at this addendum:** GREEN — 7333 unit tests pass (2 expected-fail unrelated), 66/66 e2e
pass, tsc/biome/knip clean.

## Status Note — 2026-06-30 second addendum: `DecisionPoint.id` (owner request, scopes `/pandacorp:decide`)

**Owner request:** after the parser fix above, the owner asked how to make `/pandacorp:decide`
target ONE specific pending decision instead of walking every pending one — invoking it bare
($ARGUMENTS empty) lists all of them, per the skill's own contract.

**Fix:** `DecisionPoint` gained a new `id: string` field, derived (never invented, never reused)
purely from the heading already being parsed — no template/write-side change needed:
- Date-prefixed heading → `<YYYY-MM-DD>-<n>`, `n` = 1-based count of blocks sharing that EXACT
  date, file order, counting pending AND resolved blocks (so an id never shifts when a sibling's
  status changes).
- Legacy `OPEN:/CLOSED:/RESOLVED:` heading (no date) → `legacy-<n>`, its own counter.
New helpers `_nextId`/`IdCounters` thread a mutable per-call counter through `_consumeLine`.

**Counterpart (Mission Control UI, plugin):** WO-04-005 shows the id on every card and embeds it
in the copied command; `/pandacorp:decide`'s SKILL.md (plugin) was taught the identical derivation
+ a leading-id-token scoping rule, so an id copied from here always resolves to the same block.

**New tests:** 7 cases in `docs.wo04002.test.ts` group "DecisionPoint.id" — single dated heading,
same-date sequential numbering + file order, id stability across resolved/pending siblings,
independent per-date counters, legacy counter, global uniqueness across a mixed-format file.

**verify.sh at this addendum:** GREEN — 382 files, 7340 tests pass (2 expected-fail unrelated),
66/66 e2e, tsc/biome clean.

## Status Note — 2026-06-30 third addendum: `DecisionPoint.date` + 3-way `status` (owner request)

**Owner request:** old pending decisions might no longer reflect the current codebase; the owner
asked for a way to see a decision's age and for a path to drop one that's gone stale without
inventing a fake answer for it.

**Fix:** `DecisionPoint` gains `date: string | null` (the heading's `YYYY-MM-DD` prefix, `null` for
a legacy heading) — exposed purely for the owner-facing "hace N días" age display, never used in
parsing logic itself. `DecisionPoint.resolved: boolean` is now a derived convenience over a new
`status: "pending" | "resolved" | "obsolete"` field — `OBSOLETO`/`SUPERSEDIDO` resolve to their OWN
`"obsolete"` status (a new `OBSOLETE_KEYWORDS` regex split out from `RESOLVED_KEYWORDS`, which used
to fold `SUPERSEDID` into "resolved"), distinct from a genuinely answered `"resolved"` decision —
the history stays honest about which decisions were actually decided vs dropped. `_parseEstado` and
`ESTADO_LINE` recognize `OBSOLETO`/`OBSOLETA` in the template's `- **Estado:**` machine field too.
`countPendingDecisions` is unaffected (`resolved !== "pending"` already excludes obsolete).

**New tests:** 8 cases in `docs.wo04002.test.ts` — `date` exposed/null, `OBSOLETO`/`SUPERSEDIDO`
heading phrases resolve to `status: "obsolete"` (not `"resolved"`), the Estado-line override,
`RESUELTO` unaffected by the split, obsolete excluded from `countPendingDecisions`, plain pending.

**verify.sh at this addendum:** GREEN — 383 files, 7360 tests pass (2 expected-fail unrelated),
66/66 e2e, tsc/biome clean.
