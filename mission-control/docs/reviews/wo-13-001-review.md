# Review — WO-13-001 (Token schema validation + agent-color/state-vocab key maps)

**Verdict: APPROVED** · Reviewer: reviewer (Opus 4.8, 1M) · Date: 2026-06-16
**Cycle:** 3rd review (history: REJECTED → APPROVED → REJECTED → **APPROVED**). The three blocking/important holes from the 2nd review (B1', I2, I3) are genuinely fixed and pinned with regression tests.
**Files reviewed:** `app/_design/tokens.ts`, `app/_design/tokens.test.ts` (+ reviewer-authored `app/_design/tokens.adversarial.review.test.ts`)
**Traces:** REQ-13-001, REQ-13-002, REQ-13-004, REQ-13-005, REQ-13-007 · AC-13-001.1, AC-13-004.1, AC-13-005.1, AC-13-007.1

## Gate (re-run from clean, NOT trusting the self-report or the prior verdicts)

| Gate | Result |
|---|---|
| `vitest run app/_design/tokens.test.ts` | 68 passed |
| `vitest run` (full suite, at review start) | 1105 passed (38 files) |
| `tsc --noEmit` | clean (exit 0) |
| `biome check` (WO-13-001 files only) | exit 0, no errors |
| `vitest run` (WO file + reviewer adversarial file) | 75 passed, 4 skipped |

### Note on `verify.sh` (full-repo gate)
A full-repo `verify.sh` run during this review went **red on biome**, but **not because of WO-13-001**. While reviewing, other in-flight work orders' files drifted into the working tree (`lib/discard.test.ts`, `components/DiscardButton.*`, `app/board/actions.*`, modified `package.json`/`pnpm-lock.yaml`). The biome errors are all in `lib/discard.test.ts` (`useLiteralKeys`) and `components/DiscardButton.test.tsx` (`noUnusedImports`) — the discard/board feature, a different WO. WO-13-001's own files are unchanged since their commit (0-line diff vs HEAD) and pass biome/tsc/tests in isolation. This is an orchestration hygiene note for the owner, not a WO-13-001 finding. The WO-13-001 commit `755c6e0` itself documents the suite green at `fe21195`.

## Verification of the 2nd-review fixes (B1', I2, I3) — all genuinely closed

Confirmed in `app/_design/tokens.ts:257-305` and anchored by the implementer's regression suite
(`tokens.test.ts:708-859`, all passing):

- **B1' (was BLOCKING):** `Number.isFinite(value)` guard added (`tokens.ts:274`). `NaN`, `+Infinity`,
  `-Infinity` durations now all reject. Re-verified by independent probes — all rejected.
- **I2 (was IMPORTANT):** `motion.duration` must be a non-array plain object with ≥1 entry
  (`tokens.ts:261-271`). Empty `{}`, `[]`, and non-empty arrays all reject.
- **I3 (was IMPORTANT):** `typeof easingRaw !== "object" || Array.isArray(easingRaw)` guard before
  the 2–3 count (`tokens.ts:292`). Positional easing arrays (length 0/2/3) all reject.

## New adversarial probes (DR-015) — reviewer-authored, holes the implementer did not see
File: `app/_design/tokens.adversarial.review.test.ts`. 7 active + 4 skipped (documented follow-up).

Caught correctly by the current validator (active, green):
- boundary `duration === 300` → rejected (strict `<300`).
- `oklch` as a positional array → rejected.
- `themes` as a positional array → rejected.
- `AGENT_COLOR` values all unique (10/10); `STATE_BADGE` icons and labels all unique (6/6);
  every state has a non-empty icon AND label (AC-13-007.1, no color-only signalling).

Holes that DO exist but are **out of the WO's enumerated scope** → logged as non-blocking follow-up
(kept as `it.skip` regression anchors in the reviewer test file; un-skip when the fast-follow lands):
- `motion.duration = -50` (negative) validates. AC-13-005.1 only constrains `<300`, and `-50 < 300`.
- `oklch.base = 123` (number, not an OKLCH string) validates — presence-only check.
- `themes.light = "..."` (string, not a variant object) validates — presence-only check.
- `motion.easing.standard = 5` (number, not a curve string) validates — count-only check.

## Findings

### FOLLOW-UP (non-blocking) — F1: value-type/sign hardening at the untrusted boundary
`app/_design/tokens.ts` validates **presence/count/array-shape** but not the **value type or sign** of
leaf tokens (`oklch.*`, `themes.*.{surface,text}`, `agents.*`, `radius/spacing/hairline`,
`motion.easing.*` values, `motion.duration.*` sign). A wrong-typed or negative leaf slips through as
`valid`. This is the same fail-open *family* the 2nd review raised, but for leaves — and the 2nd
review itself classed this extension as an "ideally"/defense-in-depth suggestion, **not** a blocking
item; it is absent from WO-13-001's enumerated DoD and from the FRD acceptance criteria (which
constrain only `<300ms` and `2–3 easings`). Not grounds to re-reject on cycle 3.

**Suggested fix (fast-follow WO):** when `docs/design/design-tokens.json` lands real values, tighten
the validator (or adopt the WO's suggested `z.string()` / `z.number().finite().nonnegative().lt(300)`
schema) so leaf values are type- and range-checked, then un-skip the 4 follow-up anchors in
`app/_design/tokens.adversarial.review.test.ts`.

### MINOR — M2: biome config-migration info (non-blocking, carried over)
`biome check` still emits config-migration infos. Exit 0; cosmetic.

## Lenses
- **Correctness:** core maps (`AGENT_COLOR`, `STATE_BADGE`, role/state enums) complete, distinct, and
  well-tested. Presence/count/array-shape validation is now solid — the three previously-blocking
  fail-open holes (NaN duration, array/empty duration, array easing) are genuinely closed and pinned.
  Remaining gaps are leaf value-typing only (F1), outside the stated DoD/AC.
- **Security:** no secrets, no injection, no new dependencies, pure module. The untrusted boundary is
  now airtight against the structural fail-open classes that were flagged; the residual leaf-typing
  gap (F1) is not exploitable on its own and is out of scope for this WO.
- **Quality:** scope respected — only `app/_design/tokens.ts` + its test touched (0-line diff since
  commit). No scope creep, no duplication. `docs/design/design-tokens.json` correctly still absent
  (blueprint §7: schema built against the agreed shape; values land when design freezes tokens).
  Size reviewable in isolation. The biome redness in the working tree is from other in-flight WOs, not
  this one (see gate note).

## Why APPROVED (and not a 3rd rejection)
All blocking + important findings from the prior cycles are fixed and regression-pinned; WO-13-001's
files pass biome + tsc + the full 1105-test suite in isolation; the deliverables match the WO Location
with no scope creep. The remaining value-typing gaps (F1) are outside the enumerated DoD/AC and were
already framed as a non-blocking suggestion by the 2nd review — escalating them to blocking on the 3rd
cycle would be moving the goalposts. They are recorded as a fast-follow with ready, skipped regression
anchors. M2 optional.
