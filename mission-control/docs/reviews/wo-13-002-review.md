# Review — WO-13-002 (globals.css wiring: themes, elevation, motion, reduced-motion, focus)

**Verdict: APPROVED** · Reviewer: reviewer (Opus 4.8, 1M) · Date: 2026-06-16
**Files reviewed:** `app/globals.css`, `app/globals.css.test.ts`, `biome.json`, `docs/api.md` (+ reviewer-authored `app/globals.css.adversarial.test.ts`, `app/globals.css.adversarial2.test.ts`)
**Traces:** REQ-13-001/002/004/005/006 · AC-13-001.1, AC-13-002.1, AC-13-004.1, AC-13-005.1, AC-13-006.1, AC-13-008.1
**Cycle: 2nd review (re-review after the cycle-1 REJECTED).**

## Gate (re-run from clean — NOT trusting the self-report)

| Gate | Re-run result |
|---|---|
| `tsc --noEmit` | **exit 0** ✓ |
| `biome check .` | **exit 0** (148 files) ✓ |
| `vitest run app/globals.css.test.ts` + adversarial | **58 passed** (52 acceptance + 6 reviewer adversarial) ✓ |
| `vitest run` (full suite) | **2666 passed, 2 expected-fail, 5 skipped** ✓ |
| reviewer adversarial round 2 (`globals.css.adversarial2.test.ts`) | **4 passed** ✓ |

## B1 (cycle-1 BLOCKING) — RESOLVED ✓

Fixed in commit `911e370`. `app/globals.css:61` now declares `--space-base: 1rem` (with an explanatory comment at lines 58–60) instead of overriding Tailwind v4's reserved `--spacing` multiplier. **Compiled-CSS proven**, not assumed: the reviewer adversarial test axis A (`globals.css.adversarial.test.ts`) builds `globals.css` with `@tailwindcss/cli@4.1.13` and asserts the resolved `--spacing` is `0.25rem` (Tailwind default) — so `p-4` = 1rem and `p-8` = 2rem as intended, no factory-wide 4x inflation. Canonical doc updated (`docs/api.md:78,166` document the rename and the why). Green.

## New adversarial coverage this cycle (DR-015, axes the implementer and cycle-1 did NOT see)

Round 2 (`app/globals.css.adversarial2.test.ts`) — all 4 green, none passed too easily:
- **(E) cubic-bezier validity**: every `--easing-*` is a well-formed `cubic-bezier(x1,y1,x2,y2)` with X control points in `[0,1]` (an out-of-range X is silently-invalid CSS that falls back to the UA default). Both easings pass.
- **(F) only transform/opacity animated**: globals.css authors no `transition`/`transition-property` on a layout/paint property (width/height/top/left/margin/padding/color/background/box-shadow/border/`all`) — AC-13-005.1 holds. (The reduced-motion `transition-duration: 0` reset is a zeroing, not an animation, and is exempt.)
- **(G) compiled-cascade survival**: after Tailwind compiles, the `@media (prefers-reduced-motion: reduce)` block and its `--duration-*: 0` reset still reach the output — the defense-in-depth for the Party RAF loop (WO-06-011) is not a build-time casualty.
- **(H) high-contrast is a true inversion**: HC surface/text OKLCH lightness sit at the poles (L gap = 1.00, pure black canvas / pure white text), not a re-skinned dark theme — AC-13-001.1 "contrast ≥4.5:1 without a redesign" holds by construction.

## IMPORTANT (non-blocking — carried from cycle 1, NOT resolved)

### I1 — `noImportantStyles` is disabled project-wide rather than scoped to `globals.css`
**`biome.json:40`** — `complexity.noImportantStyles: "off"` is still set at the top-level linter rules, not via an `overrides` entry scoped to `app/globals.css`. The `!important` is only legitimately needed inside the `prefers-reduced-motion` block; disabling the rule globally removes the guard for every future CSS file (FRD-02..10 components), so a stray `!important` elsewhere will no longer be flagged. **This is IMPORTANT, not blocking** — it does not affect WO-13-002's behavior or correctness; it weakens the lint posture beyond this WO's scope. Recommended follow-up (can be a separate housekeeping WO):
```json
"overrides": [
  { "includes": ["app/globals.css"],
    "linter": { "rules": { "complexity": { "noImportantStyles": "off" } } } }
]
```
and remove the top-level `complexity.noImportantStyles` override.

## What is genuinely correct (verified, not assumed)

- **B1 fix compiled-proven** (above): `--spacing` resolves to `0.25rem`; spacing scale intact.
- **High-contrast re-points accent + base + contrast + surface + text** (`globals.css:135-142`), a real inversion (L gap 1.0) → AC-13-001.1.
- **Duration tokens** are concrete finite `<n>ms` literals (150/200/280ms), each `0 < n < 300`, no var()/calc()/NaN/Infinity → AC-13-005.1.
- **Easing tokens** are 2 valid in-range cubic-beziers → AC-13-005.1 (no per-component curves).
- **reduced-motion zeroes all three `--duration-*` vars** plus `animation-duration`/`transition-duration` with `*` wildcard (`globals.css:164-176`); survives compilation → AC-13-006.1.
- **Focus ring** tokenized (`var(--focus-ring)`), `:focus-visible` + `outline-offset: 2px` + `--radius` → AC-13-008.1.
- **tabular-nums** on `html` globally (`globals.css:94-96`) → REQ-13-003.
- **10/10 agent color vars** match the `AGENT_COLOR` kebab-case keys in `app/_design/tokens.ts` → IF-13-agent-colors intact.
- **Scope clean**: `globals.css` + `biome.json` + `docs/api.md` + the WO file only. Balanced braces, no hex/rgb/hsl in `@theme`.

## Verdict
**APPROVED.** The sole cycle-1 blocker (B1) is genuinely fixed and proven against compiled Tailwind output; all gates are green from clean; 10 reviewer adversarial probes across 8 axes (A–H) pass without passing vacuously. **I1 remains open as a non-blocking IMPORTANT** — track it as a follow-up biome-scoping chore; it does not gate WO-13-002.
