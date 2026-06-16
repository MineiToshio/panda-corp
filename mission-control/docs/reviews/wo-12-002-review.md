# WO-12-002 review — KPI selector (`deriveKpis`, IF-12-kpis)

**Reviewer:** Opus 4.8 (DR-015, different model from the implementer) · **Date:** 2026-06-16
**Scope reviewed:** `app/_observability/selectors/kpis.ts` (+ `kpis.test.ts`). Traces REQ-12-001, REQ-12-007; AC-12-001.1, AC-12-007.1.

## Verdict: APPROVED

No blocking findings. Two important (non-blocking) hardening gaps are documented below and pinned by reviewer adversarial tests.

## Evidence (re-run from clean, not trusting the self-report)

- `bash .pandacorp/verify.sh` → **exit 0**. Biome clean (0 errors), `tsc --noEmit` clean, vitest **52 files / 1449 passed + 2 expected-fail + 5 skipped**.
- The implementer's progress note (progress.md:172) warned `freshness.adversarial.test.ts` was failing (UTC-vs-lexicographic ordering, WO-12-001 scope). **Re-verified: it now passes.** That cross-WO regression is resolved; it is not a WO-12-002 blocker.
- The progress entry at line 164 labels "WO-12-002 DONE" as the *KpiHeader UI* — that is a mislabel; the WO-12-002 spec is the **pure `deriveKpis` selector**, which is what was reviewed. The selector exists, is committed (ea5795a), and is correct.

## Correctness (AC-12-001.1, AC-12-007.1)

- Returns exactly 5 canonical KPIs in spec order; ≤5 satisfied. `active-projects`, `agents-working`, `xp-today`, `builds-queued`, `failed-work-orders` all derived from the event tail + projects list, no extra instrumentation (AC-12-007.1). Pure, deterministic, env-independent — verified.
- `failed-work-orders` is first-class, counts `status === "fail"` with strict equality, surfaces work-order ids in `detail`. Correct.
- Empty inputs → zeroed values, never throws (I2). NaN/Infinity impossible via integer increments + `safeCount` guard (B1').

## Mutation testing (DR-016) — tests are NOT decorative

Three mutants injected and all killed:
1. `status === "fail"` → truthy cast: **12 failures**.
2. Drop `typeof ev.agent === "string"` guard: **2 failures** — caught only by the reviewer's adversarial tests (array/number agent); the implementer's suite alone would have survived this mutant since it only tests `agent: undefined`.
3. Drop the `failed-work-orders` KPI: **34 failures**.

## Findings

### Important (non-blocking) — defense-in-depth gap
- **`deriveKpis` throws on null/non-object array entries.** `kpis.ts:85` (`project.stage`) and `kpis.ts:96` (`ev.event`) dereference entries without an `entry && typeof entry === "object"` guard. The docstring (`kpis.ts:20,27`) promises "Never throws"; a sparse/garbage tail would violate that.
  - **Why non-blocking:** the real producers (`lib/events.readEvents` pushes only validated `Event` objects; `lib/portfolio.activeProjects` builds typed items) never emit null entries, and the `Event[]`/`ProjectInput[]` types forbid them at compile time. Not reachable in the current wiring.
  - **Fix suggestion:** add `if (!project || typeof project !== "object") continue;` and `if (!ev || typeof ev !== "object") continue;` at the top of each loop. Pinned by `kpis.adversarial.test.ts` (the two `it.fails` cases — flip to passing assertions once guarded).

### Minor
- `kpis.test.ts:550,563,…` use non-null assertions (`!`) inside the property table — biome flags `noNonNullAssertion` as info/warning (not an error; gate stays green). Cosmetic; prefer `?.` to match the rest of the suite.

## Reviewer artifacts added (test-only, DR-015)
- `app/_observability/selectors/kpis.adversarial.test.ts` — 20 passing + 2 documented expected-fail. Covers: array/object/number/case-variant `status`; non-string `agent`; malformed/whitespace `stage`; `__proto__` workOrder (no prototype pollution); per-metric isolation (BuildQueued+fail counts in both; event-name casing); exact canonical key/order/label contract; clean zero-state detail absence.
