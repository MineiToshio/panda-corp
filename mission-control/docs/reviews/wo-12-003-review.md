# WO-12-003 review (cycle 2) — Events-per-minute selector (`eventsPerMinute`, IF-12-rate)

**Reviewer:** Opus 4.8 (DR-015, different model from the implementer) · **Date:** 2026-06-16
**Scope reviewed:** `app/_observability/selectors/rate.ts`. Traces REQ-12-007; AC-12-007.1.
**Prior verdict:** REJECTED (cycle 1 — blocking B1 prototype-pollution in `byAgent`).

## Verdict: APPROVED

The cycle-1 BLOCKING defect (B1) is fixed correctly and the fix is pinned by
mutation-killing tests. Re-verified from clean (not trusting the self-report):
full gate green, full test suite green, four targeted mutants all killed. No new
blocking, important or minor-blocking findings. One non-blocking minor note (M1).

## Evidence (re-run from clean)

- `pnpm vitest run rate.test.ts rate.adversarial.test.ts rate.review.test.ts` → **103/103 passed**.
- Full suite `pnpm vitest run` → **1856 passed / 2 expected-fail / 5 skipped / 0 unexpected failures**.
  The cycle-1 reds (2 adversarial failures + the timeline noise) are gone.
- `pnpm biome check .` → clean (108 files, 0 errors, 0 warnings).
- `pnpm tsc --noEmit` → clean (exit 0).
- Scope is clean: WO-12-003 production code is `rate.ts` ONLY (B1 fix commit `0809823`,
  on top of `07024e8`). No scope creep. Pure function: no I/O, no env reads, no eval/fetch.

## B1 fix — verified correct

`rate.ts` now builds every `byAgent` map with `Object.create(null)` (lines 105, 160)
and reads existing counts via `Object.hasOwn` (line 139). Untrusted `agent` values
that collide with `Object.prototype` members are stored as own data properties:

- `agent="__proto__"` → own numeric key (was: silently lost).
- `agent="constructor"`/`"toString"`/`"valueOf"` → own numeric key (was: string corruption).
- The returned bucket is also null-proto (Object.assign target), so the corruption
  cannot reappear downstream in FRD-06 ActivityPulse / FRD-18.

The implementer also added dangerous-key coverage to `rate.test.ts` (27 references),
so the regression is anchored in the implementer's own suite too.

## Adversarial tests added (reviewer, DR-015 — cycle 2)

`app/_observability/selectors/rate.review.test.ts` — 10 tests, NONE overlapping
`rate.test.ts` or the cycle-1 `rate.adversarial.test.ts`. All 10 PASS:

- **R1** `__proto__` repeated counts never pollute the global `Object.prototype` (the real DR-001/OWASP path, beyond "is it an own key").
- **R2** `byAgent` survives a JSON round-trip with dangerous keys intact (consumers serialize the snapshot).
- **R3** `sum(byAgent)` is STRICTLY `< total` with mixed agent/no-agent/empty-agent, and `=== total` when all events have an agent (kills "byAgent always equals total").
- **R4** the same agent across distinct minutes lands in distinct buckets (kills a shared-map mutant); empty in-between minutes are zeroed buckets.
- **R5** window oldest-edge off-by-one: event in the oldest in-window minute is counted; one minute older is dropped.
- **R6** returned buckets are deep-independent across calls (consumer isolation under hostile mutation).
- **R7** non-string agent shapes (number/array/object/null) increment `total`, never become a key, never throw.
- **R8** minute keys are strictly monotonic with an exact 60_000 ms stride, newest = last completed minute.

## Mutation testing (DR-016 — FRD milestone gate)

Four mutants injected into `rate.ts`, all KILLED by the test suite (tests are not decorative):

1. Revert null-proto `byAgent` to `{}` → **3 tests fail** (B1 regression caught).
2. Remove the `-60_000` step-back (include the in-progress minute) → **14 tests fail**.
3. Change the bucket stride `i * 60_000` → `i * 120_000` → **3 tests fail**.
4. Force the agent branch always-true (count no-agent events in `byAgent`) → **3 tests fail**.

`rate.ts` was restored byte-identical after each mutant (verified by `diff`).

## Security / Quality lenses

- **Security:** the cycle-1 prototype-pollution surface is closed and verified against
  the actual global-pollution abuse path (R1). No secrets, no injection, no I/O, no env
  reads, no egress. Untrusted `agent` values from the NDJSON stream are now safe.
- **Quality:** single source of the rate metric (no duplication, per the WO). Pure,
  well-documented, deterministic given an injected `now`. Consumer-isolation deep-copy
  pattern is correct and pinned (R6). Scope limited to `rate.ts`.

## Minor (non-blocking)

- **M1 (minor):** `window` has no upper clamp — `eventsPerMinute([], 1e7, now)` would
  allocate ~10M buckets (a latent perf/DoS surface if a caller ever forwards an
  untrusted window). Not in the WO contract (the docstring documents `window` as a
  caller-supplied positive integer; the documented bound is 1440), and there is no
  untrusted caller today. Suggest a defensive upper clamp (e.g. cap at 1440) when a
  real caller wiring lands in FRD-06/FRD-18. Does not block this WO.

## What to do

Nothing required to merge WO-12-003. Keep `rate.review.test.ts`. Track M1 as a
follow-up when the chart/pulse caller is wired.
