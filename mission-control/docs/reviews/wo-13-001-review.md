# Review — WO-13-001 (Token schema validation + agent-color/state-vocab key maps)

**Verdict: REJECTED** · Reviewer: reviewer (Opus 4.8, 1M) · Date: 2026-06-16
**Cycle:** 2nd rejection (history: REJECTED → APPROVED → REJECTED). The next cycle is the 3rd → if not fixed, escalate to the owner.
**Files reviewed:** `app/_design/tokens.ts`, `app/_design/tokens.test.ts`
**Traces:** REQ-13-001, REQ-13-002, REQ-13-004, REQ-13-005, REQ-13-007 · AC-13-001.1, AC-13-004.1, AC-13-005.1, AC-13-007.1

## Gate (re-run from clean, NOT trusting the self-report or the prior APPROVED)

| Gate | Result |
|---|---|
| `vitest run` (WO-13-001 file, before adversarial tests) | 56 passed |
| `vitest run` (full suite) | 154 passed |
| `tsc --noEmit` | clean (exit 0) |
| `biome check .` | exit 0 (2 infos, biome config-migration notice, non-blocking) |
| `.pandacorp/verify.sh` | green (exit 0) |
| `vitest run` (WO-13-001 file, WITH the 5 new adversarial tests) | **4 failed, 57 passed** |

The implementer's own suite and verify.sh are honest and green. The previous review's B1
(non-number durations) and I1 (elevation entry shape) fixes are genuinely present in the code and
covered by tests. But the B1 fix was applied **only halfway**, and three further fail-open holes at
the same untrusted boundary were never exercised. They were found with adversarial tests the
implementer did not write (DR-015) and they fail against the current code.

## Findings

### BLOCKING — B1': `motion.duration = NaN` is fail-open (AC-13-005.1) — the B1 fix is incomplete
`app/_design/tokens.ts:262-272`. The accepted B1 fix added a `typeof value !== "number"` guard but
**did not** add the `Number.isFinite` check that the first review's own suggested patch contained:

```ts
for (const [key, value] of Object.entries(duration)) {
  if (typeof value !== "number") {
    errors.push(`motion.duration.${key}: must be a number (ms) ...`);
  } else if (value >= 300) {                 // ← NaN reaches here
    errors.push(`... violates the <300ms constraint ...`);
  }
}
```

`typeof NaN === "number"`, and `NaN >= 300` is `false`, so a `NaN` duration validates as **valid** —
the exact fail-open class B1 was raised to close, at the exact boundary the validator exists to
protect (`JSON.parse(design-tokens.json)`). A `NaN` arrives trivially upstream: `Number("12px")`, a
JSON authoring typo, a failed coercion. A `z.number().finite()` (the WO's requested "Zod or
equivalent") would have rejected it.

Reproduction (new adversarial test, currently fails): duration `NaN` → `result.valid === true`
(should be `false`).

**Fix:** complete the B1 patch as the first review specified —
```ts
if (typeof value !== "number" || !Number.isFinite(value)) {
  errors.push(`motion.duration.${key}: must be a finite number of milliseconds`);
} else if (value >= 300) {
  errors.push(`motion.duration.${key}: duration ${value}ms violates the <300ms constraint (AC-13-005.1)`);
}
```

### IMPORTANT — I2: `motion.duration` accepts an array / empty map (AC-13-005.1)
`app/_design/tokens.ts:257-273`. The duration branch only guards `undefined`/`null`, then iterates
`Object.entries(value)`. Two shapes slip through as **valid**:
- `motion.duration = {}` → the loop never runs; the schema validates with **zero** declared duration
  tokens, satisfying "all <300ms" vacuously. The theme/animation layer that consumes
  `motion.duration.fast|base|expressive` has nothing to read.
- `motion.duration = []` → an array passes the null guard and `Object.entries([])` is empty → valid.

**Fix:** require `motion.duration` to be a non-array plain object with at least one entry (and,
ideally, assert the duration keys the blueprint relies on are present). Add the two failing fixtures
as tests.

### IMPORTANT — I3: `motion.easing` accepts a positional array (AC-13-005.1)
`app/_design/tokens.ts:276-286`. The count check is `Object.keys(easingRaw).length`, which for an
array `["a","b"]` is `2` → passes the 2–3 rule. Easing tokens are referenced **by name** downstream
(`motion.easing.standard`), so a positional array masquerades as a named easing map and validates,
breaking the contract silently.

**Fix:** guard `typeof easingRaw === "object" && !Array.isArray(easingRaw)` before counting; same
treatment for the `oklch`/`themes`/`agents`/`motion` sub-objects, which are all cast with `as
Record<...>` without an array/typeof guard (defense-in-depth at the untrusted boundary).

### MINOR — M2: biome config-migration info (non-blocking)
`biome check .` emits 2 infos suggesting `biome migrate` for a deprecated config key. Exit code is 0;
does not fail the gate. Cosmetic; address when convenient.

## Adversarial tests added (DR-015)
Appended to `app/_design/tokens.test.ts` under `describe("frd-13 (adversarial): … fail-open guards")`:
- NaN duration → expect invalid (**fails today** → B1')
- Infinity duration → expect invalid (**passes today**; pinned as a regression guard so a
  `Number.isFinite` fix does not over-correct the happy comparison)
- empty duration map → expect invalid (**fails today** → I2)
- array duration map → expect invalid (**fails today** → I2)
- array easing of length 2 → expect invalid (**fails today** → I3)

4 of the 5 fail against the current code, proving the holes are real and not decorative.

## Lenses
- **Correctness:** core maps (`AGENT_COLOR`, `STATE_BADGE`, role/state enums) are complete, distinct,
  and well-tested — no issues there. Presence/count of keys is solid. The gaps are all value/shape
  validation at the untrusted boundary: NaN duration (B1'), array/empty duration map (I2), array
  easing (I3). Each lets an invalid `design-tokens.json` pass.
- **Security:** no secrets, no injection, no new dependencies, pure module. The single concern is the
  fail-open boundary — untrusted JSON validated too loosely (B1', I2, I3). Not exploitable on its own,
  but the validator's whole job is to be the trustworthy boundary, and it currently isn't airtight.
- **Quality:** scope respected — only `app/_design/tokens.ts` + its test touched, matching the WO
  Location. No scope creep, no duplication. `docs/design/design-tokens.json` still absent — correct
  per blueprint §7 (schema built against the agreed shape; values land when design freezes tokens).
  Not a finding. Size is reviewable in isolation.

## Required to flip to APPROVED
Fix B1' (blocking) by adding the `Number.isFinite` guard; fix I2 and I3 (shape guards on
`motion.duration` and `motion.easing`, ideally extended to the other sub-objects). Keep the 5
adversarial tests green and the full gate (verify.sh) green. M2 optional.
