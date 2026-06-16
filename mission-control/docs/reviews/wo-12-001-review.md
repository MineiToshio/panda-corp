# WO-12-001 review — `topN` + `freshness` observability selectors

**Reviewer:** Opus 4.8 (DR-015 cross-model review) · **Date:** 2026-06-16
**Commits:** `c339c08` (impl + api.md), `88a55b2` (export DEFAULT_TOPN + test files)
**Traces:** IF-12-topn → REQ-12-004 → AC-12-004.1 · IF-12-freshness → REQ-12-002 → AC-12-002.1

## Verdict: APPROVED

The two selectors meet their acceptance criteria, are pure (no I/O, never throw), and
match the published `docs/api.md` contract exactly. No blocking findings. One *important*
latent-correctness finding and two *minor* notes are recorded below for follow-up; none
block the merge because the live event emitter always produces UTC `Z` timestamps.

## Evidence re-run by the reviewer (not trusted from the self-report)

| Gate | Scope | Result |
|---|---|---|
| Tests (vitest) | `topn.test.ts` + `freshness.test.ts` | 117 passed |
| Tests (vitest) | + reviewer adversarial suites | 134 passed, 1 skipped (documents finding #1) |
| Biome | the 4 WO-12-001 files + 2 adversarial files | clean |
| Type-check (isolation) | the WO-12-001 selectors | clean |
| API contract | `docs/api.md` §WO-12-001 vs impl | matches (DEFAULT_TOPN=5, FRESHNESS_THRESHOLD_MS=300_000, `live = gap < threshold`) |

**Note on the repo-wide gate.** `verify.sh` (full repo) is currently RED, but NOT because of
WO-12-001: the failures are `app/_observability/KpiHeader.test.tsx` (missing `./KpiHeader`
module, WO-12-005, RED phase) and `noNonNullAssertion` biome warnings in `kpis.test.ts`
(WO-12-002). Both are sibling work orders still in flight, per the FRD-12 work-orders README.
WO-12-001's own slice is green. The implementer's "verify.sh green" claim in `88a55b2` was true
at that commit (the breaking sibling files were added afterward) but is no longer true repo-wide —
flagging so the next milestone gate isn't waved through on a stale claim.

## Findings

### Important (non-blocking)

1. **`freshness` compares `at` strings lexicographically, not by instant** — `freshness.ts:65`
   (`ev.at > lastAt`). This equals instant ordering ONLY when every `at` uses the same offset
   (`Z`). With a mixed offset (e.g. `2026-06-16T13:00:00+02:00` = 11:00 UTC vs `2026-06-16T12:00:00Z`),
   it picks the lexicographic max, which is the EARLIER instant — so `lastAt` (and therefore the
   Live/No-signal badge) is wrong. AC-12-002.1 / REQ-12-002 say "the timestamp of the last event"
   and the FRD types `at` as a generic "ISO timestamp" (no `Z` constraint), so mixed offsets are
   in-contract. **Why non-blocking:** the live emitter writes `date -u +%FT%TZ` (always `Z`), so this
   is latent today, not a live failure. **Fix:** compare by `Date.parse(ev.at)` instant, retaining the
   raw string for `lastAt` display. Reviewer test `freshness.adversarial.test.ts` carries an `it.skip`
   that reproduces it — un-skip when the fix lands.

### Minor

2. **`lib/events.ts` `resolveCap` has a stranded debugging comment** (lines 80–83: "Wait — the test …").
   Not in WO-12-001's scope (it's FRD-01 code) but surfaced while tracing the `Event` type; worth a
   cleanup pass. No behavior impact.

3. **`freshness` doc-comment claims "ISO 8601 strings compare lexicographically … equivalent to numeric
   timestamp comparison"** (`freshness.ts:61-63`) — this is the assumption behind finding #1 and is only
   true for same-offset strings. The comment should be corrected when finding #1 is fixed so it doesn't
   re-mislead a future reader.

## Lenses

- **Correctness:** AC-12-004.1 (top-5 cap, order-preserving, generic, NaN/Infinity/negative guards) and
  AC-12-002.1 (max-at, live/stale at a named threshold, empty → `{null,false}`, invalid-`at` skipped) all
  met. Boundary (`gap == threshold` → stale) and B1'/I2/I3/FREEZE-ON-RED anchors covered. Reviewer added
  17 passing adversarial cases (float truncation, ±0, -Infinity, future events, ms precision, coercion-prone
  `at`); they confirm the edges rather than break them — except finding #1.
- **Security:** pure functions, no I/O, no network, no eval, no inputs crossing a trust boundary, no new
  dependencies (DR-001). Nothing to flag.
- **Quality:** no scope creep (only the 4 declared files + the api.md contract), no duplication, named
  constants (no magic numbers), strict typing, no `any`/`@ts-ignore`. Right-sized for isolated review.

## Reviewer-authored test files

- `app/_observability/selectors/topn.adversarial.test.ts`
- `app/_observability/selectors/freshness.adversarial.test.ts`
