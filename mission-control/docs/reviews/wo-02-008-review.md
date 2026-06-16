# WO-02-008 review — Category filter + legend + building indicator

**Verdict: APPROVED**

**Reviewer:** Opus 4.8 (1M) — distinct model from the implementer (DR-015).
**Date:** 2026-06-16
**Scope reviewed:** `components/CategoryFilter.tsx`, `components/BoardLegend.tsx`, `components/IdeaCard.tsx` (building badge); tests `CategoryFilter.test.tsx`, `BoardLegend.test.tsx`, `IdeaCard.wo02008.test.tsx`.

## Evidence re-run from clean (not trusting the self-report)

- Lint/format (`biome check`) on the WO files: **PASS** (exit 0).
- Type-check (`tsc --noEmit`, project-wide): **PASS** (exit 0).
- Tests — WO suite (`CategoryFilter` + `BoardLegend` + `IdeaCard.wo02008` + `IdeaCard`): **86/86 PASS**.
- With my adversarial tests added: **108/108 PASS** across 7 files.

## Adversarial tests written (DR-015 — edge cases the implementer did not see)

Added (reviewer-only, test files):
- `components/CategoryFilter.adversarial.test.tsx` — empty-string category vs `selected=null` collision; re-clicking the active chip still notifies; dedup preserves FIRST insertion order; hyphenated labels selectable verbatim; 50-category load invariant + exactly-one-active.
- `components/BoardLegend.adversarial.test.tsx` — no extra/duplicate category/return entries (exact count == FRD union); every entry is a known key (no leak); each entry carries prose beyond its bare label; score section states the 0–100 range; idempotent across mounts.
- `components/IdeaCard.wo02008.adversarial.test.tsx` — `score=0` (falsy) still renders with the indicator (`score !== undefined`, not truthiness); building vs recommended mutual exclusion both directions; full a11y bundle (visible text + aria-label + role=status) asserted together; no text leakage into title/category; in-pipeline + `isRunning=false` → no badge.

All 22 adversarial tests pass — the code covers these edges.

## Mutation testing (DR-016) — tests are not decorative

- Dropped the status guard (`status === "in-pipeline" &&`) on the building indicator → **5 tests killed**.
- Removed `Set` dedup in CategoryFilter → **2 tests killed**.
- Changed the legend score range `100`→`50` → **1 test killed**.

The tests have real discriminating power.

## Lenses

**Correctness** — Meets AC-02-006.1 (filter by `project_type`, "Todas" reset, dedup), AC-02-008.2 (building indicator gated by `status === "in-pipeline" && isRunning === true` — a stale `isRunning:true` on discovered/shipped/discarded does NOT show the badge), AC-02-008.3 (legend covers all 9 FRD categories + 4 return types + score). The empty-string/null collision in `unique.includes(selected ?? "")` was probed: it resolves correctly because `activeCategory` collapses to `null` and `allActive` stays true regardless — not a defect.

**Security** — Read-only presentational components; no inputs persisted, no injection surface, no secrets, no new dependencies. Compliant with the WO "read-only, no write" constraint.

**Quality** — Zero hardcoded colors (CSS custom properties with semantic fallbacks), Spanish UI copy via static i18n, `data-testid` on every significant element, a11y not color-only (icon/text + aria-label + role=status), semantic landmarks (`<fieldset>`/`<legend>`, `<section aria-label>`). No scope creep — only the three components named in the WO were touched. No duplication.

## Findings

None blocking. None important. None minor.
