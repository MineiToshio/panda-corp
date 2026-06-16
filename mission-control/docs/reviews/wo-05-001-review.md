# WO-05-001 — Review verdict: REJECTED

**Reviewer:** Opus (different model from the implementer, DR-015) · **Date:** 2026-06-16
**Scope reviewed:** `lib/work-orders.ts` (+ `lib/work-orders.test.ts`) — IF-05-work-orders (`listWorkOrders`, `aggregateProgress`).

## Evidence I re-ran myself (not the self-report)
- `pnpm biome check lib/work-orders.ts lib/work-orders.test.ts` → clean.
- `pnpm tsc --noEmit` → exit 0.
- `pnpm vitest run lib/work-orders.test.ts` → 56/56 green (matches the DoD claim).
- Adversarial suite I added (`lib/work-orders.adversarial.test.ts`, 13 tests) → **2 RED** that pin a real defect.
- Probe of the reader against the **real committed WO files** → 2 production files misparsed.

## Findings

### BLOCKING — B1: greedy first-`Status:` match shadows the canonical marker (`lib/work-orders.ts:48`, used at `:109`)
`STATUS_RE` matches the **first** "Status:"-like token anywhere in the raw file, with no
anchoring to a heading or line start. Real WO files routinely contain the word "Status" in
prose **before** the canonical `## Status: <state>` marker (which the producer writes near the
bottom, after the Definition-of-done checklist). The first prose hit wins and shadows the marker.

Confirmed against **real committed files**, not hypotheticals:
- `docs/frds/frd-01-data-reading/work-orders/wo-01-003-read-ideas.md`: real state `## Status: DONE`,
  but the line `slug: string; title: string; status: IdeaStatus;` is matched first →
  captured token `"IdeaStatus;"` → normalises to **`todo`**. Reader reports `todo`.
- `docs/frds/frd-01-data-reading/work-orders/wo-01-005-read-status.md`: real state `## Status: done`,
  reader reports **`todo`** for the same reason.

Impact: the kanban shows finished work orders as not-started — a direct violation of
**AC-05-005.1** ("the kanban SHALL reflect the live state written by the agents") and of
**REQ-05-005**. The very feature this WO exists to provide is wrong on real data.

Regression anchors (RED in `lib/work-orders.adversarial.test.ts`):
- `real-repo shape: 'type IdeaStatus = ...' prose before '## Status: DONE' must resolve to done` → got `todo`.
- `body prose mentioning 'Status: blocked' BEFORE the real '## Status: done' must NOT shadow it` → got `fail`.

**Suggested fix (production code — implementer, not the reviewer):** anchor the marker to a
heading/line, e.g. match `^\s{0,3}#{0,6}\s*\*{0,2}Status\*{0,2}:\s*\*{0,2}([a-z_]+)` with the
`m` flag, and prefer the **last** such match (the canonical status block is written at the end).
Do not match `Status` when it is part of a larger identifier (`IdeaStatus`) — require a word
boundary / start-of-token before `Status`. Add a fixture mirroring the two real files above.

### IMPORTANT — I1: `aggregateProgress` shipped with ZERO tests
`aggregateProgress` is exported from `lib/work-orders.ts:229` (in scope of this deploy unit and
asserted in the §Evidence as "pure") yet `lib/work-orders.test.ts` has **no test for it at all**.
The DoD claims `pct` is "rounded to 1 decimal" — entirely unverified. A mutation to the rounding
or the `done` filter would not break any test (DR-016: decorative coverage). I added 5 passing
tests covering empty-list/division-by-zero, the `state==="done"`-only count, and 1-decimal
rounding; fold equivalent coverage into the colocated suite when fixing B1.

### MINOR — M1: evidence over-claims test count vs. the deploy unit
The WO §Evidence and DoD state "56 vitest tests green" as the gate. True for the file in
isolation, but `aggregateProgress` (part of the same file) is untested, so "green" overstates the
coverage of the unit. Tighten the claim once I1 is addressed.

## Lenses
- **Correctness:** FAIL — B1 breaks AC-05-005.1 on real data; I1 leaves a shipped function unverified.
- **Security:** PASS — read-only, no `fs.write*`, no network, no untrusted-input injection surface; `any`/`@ts-ignore` absent.
- **Quality:** PASS with note — scope stayed inside `lib/work-orders.ts`; no token/standard violations; `aggregateProgress` arguably belongs to WO-05-002 but is harmless to colocate. M1 is a wording nit.

## Verdict: REJECTED (1 blocking)
Fix B1 (anchor the status marker + word boundary, prefer the last match) and I1 (test
`aggregateProgress`). Re-run `bash .pandacorp/verify.sh` and the reviewer adversarial suite —
all must be green. This is rejection cycle 1 of 2.

Note: `lib/memory.adversarial.test.ts` is also red in the full suite, but that belongs to
WO-17-001 (already BLOCKED, DR-015 cap exhausted) — out of scope here.
