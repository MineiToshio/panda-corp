# WO-01-005 — `readStatus` (yaml, partial-tolerant) — Review

**Reviewer:** Opus 4.8 (1M) — a different model from the implementer (DR-015).
**Date:** 2026-06-16
**Module:** `lib/status.ts` · **Tests:** `lib/status.test.ts` (implementer) + `lib/status.adversarial.test.ts` (reviewer)
**IDs:** CMP-01-status, IF-01-readStatus; REQ-01-005, REQ-01-006, REQ-01-010, REQ-01-011; AC-01-005.1, AC-01-006.1.

## Verdict: APPROVED

The implementation meets the FRD acceptance criteria, is fully fail-soft, and the tests verify
real behaviour (not decorative — proven by mutation testing). No blocking or important findings.

## Evidence (re-run from clean, not trusting the self-report)

- `pnpm vitest run lib/status.test.ts` → **76 passed**.
- `pnpm vitest run lib/status.adversarial.test.ts` → **32 passed** (new reviewer tests).
- `pnpm tsc --noEmit` → **exit 0** (clean project-wide, including the new test file).
- `pnpm biome check lib/status.ts lib/status.test.ts lib/status.adversarial.test.ts` → **clean**.

Read-only invariant verified: `status.yaml` mtime unchanged after read; no file created for absent
projects; fixtures untracked-clean after the run.

## Adversarial tests (DR-015) — edge cases the implementer did NOT cover

Added `lib/status.adversarial.test.ts` (32 tests). All pass against the current code — the reader is
genuinely robust. Areas probed:

1. **`progress` field** — explicitly named in AC-01-005.1 but never tested by the implementer.
   Verified mapping of finite int/float and rejection of `.NaN`, `.inf`, and strings.
2. **Top-level non-map shapes** — proj-b is only one flavour of broken. Bare scalar / sequence /
   number / `false` → `malformed:true,{}`; the legitimate empty doc `null` → `malformed:false,{}`.
3. **Duplicate map keys** — the `yaml` lib throws; classified malformed, never bubbles.
4. **Phase literal hardening** — `Implementation` (wrong case), `" design "` (whitespace), `build`
   (legacy column word), `null`, nested object → all rejected. Critical because phase is the single
   source of truth for the in-pipeline column (AC-01-006.1); a wrongly-accepted phase mis-places a card.
5. **Boolean/number coercion** — `"true"`, `"yes"`, empty-object `{}` for counts → never coerced.
6. **SECURITY — prototype pollution** — `__proto__:` and `constructor.prototype` payloads do NOT
   pollute `Object.prototype` and do NOT leak; the allow-list mapping (only known camelCase fields
   copied into a fresh object) defeats this and also blocks unknown-key scope-creep.
7. **ABUSE — YAML alias bomb** ("billion laughs") — returns in <2s, no throw.
8. **fs edge cases** — `status.yaml` as a directory (EISDIR) → present+malformed, no throw; NUL-byte
   path → present:false; whitespace path → present:false.
9. **RSC serialization safety** — result is JSON-serializable (no `Date` from unquoted YAML dates),
   safe across the Server→Client boundary used downstream (FRD-03).

## Mutation testing (DR-016) — tests are not decorative

- Drop `Number.isFinite` on `workOrdersTotal` → **caught** (NaN regression test fails). [B1']
- Accept any string as `phase` (drop `VALID_PHASES`) → **caught** (3 adversarial tests fail). [AC-01-006.1]
- Top-level scalar/array → `malformed:false` instead of `true` → **caught** (4 adversarial tests fail).

## Findings

None blocking. None important. None minor for WO-01-005.

## Out-of-scope note (not a finding against this WO)

The full `verify.sh` gate is currently RED, but **exclusively** due to untracked files from a
different, in-flight work order under `app/projects/[slug]/_party/` (FRD-06 Party): a missing
`./PartyTab` module import and an `EventFeed` timestamp assertion, plus 5 biome `organizeImports`
/ unused-import errors — all inside that directory. None touch `lib/status.ts` or WO-01-005.
WO-01-005's own surface (`lib/status.ts` + its two test files) is fully green. Flagging for the
owner/orchestrator so the Party WO is not declared done with a red tree, but it does not block this WO.
