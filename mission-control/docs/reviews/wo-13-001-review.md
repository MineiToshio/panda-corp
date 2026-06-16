# Review — WO-13-001 (Token schema validation + agent-color/state-vocab key maps)

**Verdict: REJECTED** (1 blocking finding) · Reviewer: Opus 4.8 (different model from implementer, DR-015) · Date: 2026-06-16
**Files reviewed:** `app/_design/tokens.ts`, `app/_design/tokens.test.ts`
**Traces:** REQ-13-001, REQ-13-002, REQ-13-004, REQ-13-005, REQ-13-007 · AC-13-001.1, AC-13-004.1, AC-13-005.1, AC-13-007.1

## Gate (re-run from clean, not trusting the self-report)

| Gate | Result |
|---|---|
| `vitest run` (WO-13-001 file) | 39 passed |
| `vitest run` (full suite) | 114 passed |
| `tsc --noEmit` | clean |
| `biome check .` | exit 0 (19 infos, non-blocking; pre-existing `useLiteralKeys`) |

The implementer's own suite is green and honest. The defects below are NOT caught by it — they were found with adversarial tests the implementer did not write (DR-015), and they survive mutation of the code the existing tests claim to cover (DR-016).

## Findings

### BLOCKING — B1: `motion.duration` validation is fail-open on non-number values (AC-13-005.1)
`validateTokenSchema` is `(tokens: unknown)` and exists precisely to guard the untrusted boundary
(`JSON.parse(design-tokens.json)`). At `app/_design/tokens.ts:245-251` the duration gate is:

```ts
if (typeof value === "number" && value >= 300) { errors.push(...) }
```

Any non-number duration silently passes. A JSON file carrying `"duration": { "base": "5000" }`
(string), `"350"`, or `null` validates as **valid** — a 5000ms animation slips through the
`<300ms` constraint. The WO scope explicitly asked for "Zod (or equivalent) … assert all <300ms";
a `z.number()` schema would have rejected this. The hand-rolled validator regressed that guarantee
at exactly the boundary it was built to protect.

Reproduction (adversarial tests, all currently fail-open):
- duration `"5000"` (string) → `result.valid === true` (should be false)
- duration `"350"` (string) → `result.valid === true` (should be false)
- duration `null` → `result.valid === true` (should be false)

Mutation signal (DR-016): the existing tests only feed numeric durations, so the validator could be
weakened to `if (Number(value) >= 300)` or deleted for non-numbers and the suite would stay green —
the tests don't reach this mutant.

**Fix:** require each duration to be a finite number AND `<300`. e.g.
```ts
if (typeof value !== "number" || !Number.isFinite(value)) {
  errors.push(`motion.duration.${key}: must be a finite number of milliseconds`);
} else if (value >= 300) {
  errors.push(`motion.duration.${key}: duration ${value}ms violates the <300ms constraint (AC-13-005.1)`);
}
```
Add tests for string/null/NaN durations.

### IMPORTANT — I1: `elevation` entries are never validated, only counted (AC-13-004.1)
At `app/_design/tokens.ts:214-222` the validator checks `Array.isArray` and `length === 3` but never
inspects each entry. AC-13-004.1 requires a "tokenized shadow/spacing scale" across the 3 levels, yet:
- `elevation: [{}, {}, {}]` → valid (3 empty objects are not a scale)
- a level missing its `shadow` → valid

**Fix:** validate each of the 3 entries has non-empty `shadow` and `spacing` (mirroring the
`ElevationLevel` interface), with a path-specific message (`elevation[1].shadow: …`). Add the two
failing fixtures above as tests.

### MINOR — M1: `useLiteralKeys` info in the test file
`app/_design/tokens.test.ts:389` uses `STATE_BADGE["reviewing"]`; biome flags `useLiteralKeys`
(info, non-blocking). Several similar accesses throughout. Cosmetic; switch to dot access if you
want the info count clean, or leave it — it does not fail the gate.

## Lenses

- **Correctness:** core maps (`AGENT_COLOR`, `STATE_BADGE`, role/state enums) are complete, distinct
  and well-tested. The validator covers presence/count of keys well, but two value-level constraints
  (duration type, elevation entry shape) are unenforced → B1, I1.
- **Security:** no secrets, no injection surface, no new dependencies, pure module. The only concern
  is the fail-open boundary in B1 (untrusted JSON validated too loosely).
- **Quality:** scope respected — only `app/_design/tokens.ts` + its test were touched, matching the
  WO Location. No scope creep, no duplication (`lib/theme` correctly NOT introduced per blueprint §2).
  Reasonable size for isolated review. Note: `docs/design/design-tokens.json` does not exist yet —
  expected and correct per blueprint §7 (schema built against the agreed shape; values land when the
  design phase freezes the tokens). Not a finding.

## Required to flip to APPROVED
Fix B1 (blocking) and I1 (important), add the corresponding tests, keep the gate green. M1 optional.
