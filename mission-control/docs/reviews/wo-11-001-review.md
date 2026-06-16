# WO-11-001 review — BUILD_MODES catalog + per-project persistence

**Verdict: REJECTED** (1 blocking finding) · Reviewer: Opus (different model family from the implementer, DR-015) · 2026-06-16 · Cycle 1 of 2.

## Evidence re-run from clean (not trusting the self-report)
- `pnpm vitest run lib/build-modes.test.ts` → 41/41 GREEN.
- `pnpm tsc --noEmit` → clean (exit 0).
- `pnpm biome check` on the three WO files → clean.
- Full `bash .pandacorp/verify.sh` at review start → GREEN (1369 passed, 4 skipped).
  - The implementer's claimed blocker (WO-12 `kpis.test.ts` in RED) is **stale**: WO-12 was implemented (commit c339c08), so that file now passes. Their self-report is no longer accurate but the net is favorable.
  - **Caveat (not WO-11's fault):** a NEW untracked file `app/_observability/KpiHeader.test.tsx` (parallel WO-12 frontend, RED phase) appeared mid-review and breaks the *global* suite (`Failed to resolve import "./KpiHeader"`). It is out of WO-11 scope and not introduced by this review; verify.sh will go red globally until WO-12 lands `KpiHeader`. Flagging so the orchestrator does not attribute it to WO-11.
- Scope check (`git show 3e5b02d`): touches only `lib/constants.ts`, `lib/build-mode-store.ts`, `lib/build-modes.test.ts`, `docs/api.md`. No scope creep, no `package.json`/dependency change, no `status.yaml` write.

## Findings

### BLOCKING — B1: `BUILD_MODES` is only shallow-frozen; entries are mutable singletons
`lib/constants.ts:35` wraps the array in `Object.freeze(...)` and the comment at `lib/constants.ts:33-34` claims it is *"Frozen to enforce the readonly invariant at runtime."* That claim is false. `Object.freeze` is shallow: the array cannot be `push`/`pop`'d (the implementer's test at `build-modes.test.ts:149` passes), but each **entry object stays writable**.

Minimal repro (run from clean):
```
array frozen: true
entry[0] frozen: false      ← entries NOT frozen
entry[0].id after mutation: hacked   ← BUILD_MODES[0].id = "hacked" silently succeeds
```
Reproduced in-suite by `lib/build-modes.adversarial.test.ts` ("catalog integrity beyond happy path"): a single assignment anywhere in the app permanently corrupts the catalog for **every consumer** (it is a shared module singleton) and produced cross-test pollution in my first run. The catalog is the declared single source of truth (WO scope: "no magic strings") and the persistence store derives its `VALID_MODES` set from it (`build-mode-store.ts:19`), so a mutated id silently breaks validation too.

**Why blocking:** the code asserts a runtime guarantee it does not provide; the immutability invariant the WO relies on ("the catalog is the single source of truth", AC-11-001.1 ordering) is unprotected.

**Concrete fix (production code — implementer to apply, I only write tests):** deep-freeze each entry, e.g.
```ts
export const BUILD_MODES: readonly BuildModeInfo[] = Object.freeze(
  ([ /* …entries… */ ] as const satisfies BuildModeInfo[]).map((m) => Object.freeze(m)),
);
```
or freeze each literal inline. Then `BUILD_MODES[0].id = "x"` throws in strict mode (test files are ESM → strict). The adversarial test "catalog entries are deeply immutable" encodes the desired contract.

### IMPORTANT — B2: dangling i18n keys with no i18n system in the repo
`label`/`description` are i18n keys (`buildModes.pro.label`, etc.). But there is **no i18n infrastructure** in the project: no `next-intl`/i18n dependency, no messages/locale file, and `grep` finds these keys referenced nowhere outside `constants.ts`. The established convention in sibling components is **hardcoded Spanish copy** (`CopyButton.tsx:72` "Copiar al portapapeles"; `OnboardingGate.tsx:127` "La fábrica aún no está configurada"). As-is, WO-11-002 will either render raw key strings (broken UX) or must build i18n from scratch.

This traces to the WO spec itself ("i18n keys for label/description"), so the implementer followed orders — hence **important, not blocking** for WO-11-001. **Action:** the orchestrator/owner should decide before WO-11-002 whether to (a) introduce a real i18n layer, or (b) align with the repo's hardcoded-Spanish convention. Note it in the FRD-11 blueprint + decision-log so WO-11-002 is not blocked mid-flight.

### MINOR — B3: implementer's corruption tests are fragile
`build-modes.test.ts:276-313` corrupt storage by **scanning** localStorage for a value `=== "pro"` instead of writing to the deterministic key. If the keying scheme regressed, these tests could pass vacuously. My adversarial file writes to the exact key (`mc:build-mode:${slug}`) so a key-scheme regression cannot hide. Not blocking; suggest tightening on the next touch.

## Adversarial tests added (reviewer-authored, DR-015)
`lib/build-modes.adversarial.test.ts` (20 tests, lint+tsc clean, GREEN except the deep-freeze contract which documents B1). Covers cases the implementer did not: case/whitespace-variant modes, coercion-literal poison (`"null"`/`"undefined"`/`"NaN"`/`"0"`/`"false"`/`"[object Object]"`), JSON object values, substring rejection, `__proto__`/`constructor` values, slug-with-`:` isolation, empty-slug bleed, unicode slugs, and **write-path** throw-safety for `rememberMode` (the implementer only proved the read path is throw-safe).

## What's good
Read-only/security invariant holds: localStorage-only, no fs imports, no `status.yaml` write, throw-safe reads, per-project keying. Clean scope, no new deps, strict types, `BuildMode` union enforced.

## To clear the rejection
Deep-freeze the catalog entries (B1) and re-run `bash .pandacorp/verify.sh` + the adversarial file. B2 needs an owner decision before WO-11-002 but does not block WO-11-001 once B1 is fixed.
