# WO-01-007 review — `readEvents` (capped tail + state diffs)

**Verdict: APPROVED**

**Reviewer:** Opus 4.8 (DR-015 cross-model: implementer was Sonnet 4.6, commit `6b9496e`).
**Date:** 2026-06-16
**Scope reviewed:** `lib/events.ts`, `lib/events.test.ts` (commit `6b9496e`); contract in `docs/frds/frd-01-data-reading/work-orders/wo-01-007-read-events.md`.

## Evidence (re-run from clean, not self-reported)

- `bash .pandacorp/verify.sh` → green: biome (0 errors), `tsc --noEmit` (0 errors), vitest 669/669 (before my tests).
- Full suite with my adversarial file: **686/686 pass** (25 files).
- My adversarial file `lib/events.adversarial.test.ts` (17 tests): all green, biome-clean, tsc-clean.

## Correctness lens

Meets AC-01-008.1 and the WO contract:
- NDJSON tail capped (default 200), last-N semantics by file order — `lib/events.ts:200-202`.
- Per-line resilience: malformed lines skipped, valid lines kept, never throws — `lib/events.ts:189-198`.
- `work_order`→`workOrder` mapping — `lib/events.ts:152`.
- `lastEventAt` = max `at` (lexicographic ISO compare, correct) — `lib/events.ts:206-211`.
- `byProject` with `__global__` bucket for project-less events — `lib/events.ts:213-222`.
- Missing/empty file → empty snapshot — `lib/events.ts:178-187`.
- B1' regression honored: `Number.isFinite` guard on `cap` (NaN/Infinity → default 200) — `lib/events.ts:91-96`.

## Adversarial tests written (edges the implementer did not cover)

`lib/events.adversarial.test.ts` — CRLF endings; `status` enum fencing (out-of-enum/non-string dropped); wrong-typed required fields not coerced (numeric `at`/`event` skipped); wrong-typed `project` → `__global__`; float cap truncation; **cap applied before `byProject`/`lastEventAt` derivation** (dropped project absent, out-of-order timestamps); `__global__` literal collision; tied timestamps; interleaved blank lines; byte-level read-only invariant; independent empty-snapshot objects (no shared mutable state); unknown keys not leaked.

## Mutation testing (DR-016 — tests must bite)

5 mutations on load-bearing branches; 4 killed by my suite:
- status enum guard removed → killed.
- `Math.trunc`→`Math.round` (cap) → killed.
- `byProject` over `validEvents` instead of `retained` → killed.
- numeric `at` coercion → killed.
- `line.trim()`→`line` survived, but this is NOT a defect: `JSON.parse` natively tolerates leading/trailing whitespace (incl. `\r`) and throws on `""` (caught). The `trim()`/empty-string early-return is a micro-optimization, not a unique behavior branch. The CRLF/blank-line tests still verify correct end-to-end behavior.

## Security lens

Read-only (`fs.existsSync`/`fs.readFileSync` only), no writes, no egress, no Claude calls — matches the platform golden rule. No untrusted-input injection surface (pure parse → typed data). Path comes from caller/`~/.claude` default; no traversal risk introduced.

## Quality lens

Commit tightly scoped to the two WO files; no production code outside the work order, no new dependencies, fixtures untouched (pre-created in WO-01-000). One cosmetic nit (non-blocking): `resolveCapFromOpts` (`lib/events.ts:231-233`) is a trivial pass-through wrapper around `resolveCap` adding no value — could be inlined. Stale planning prose in the `resolveCap` doc comment (`lib/events.ts:78-82`, "Wait — the test…") reads like a left-in scratch note; suggest trimming. Neither affects behavior.

## Findings

- Blocking: none.
- Important: none.
- Minor: inline `resolveCapFromOpts`; trim the scratch-note comment at `lib/events.ts:78-82`.
