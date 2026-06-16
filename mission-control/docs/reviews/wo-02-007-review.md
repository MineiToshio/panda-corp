# WO-02-007 — Card detail + docs navigator + next-step — Review

**Reviewer:** reviewer (Opus, distinct model family from the sonnet/haiku implementer — DR-015)
**Date:** 2026-06-16
**Verdict:** APPROVED

## Scope reviewed

- `components/CardDetail.tsx` (CMP-02-card-detail) — REQ-02-004, REQ-02-008
- `components/CardDetail.test.tsx` (implementer suite, 56 tests)
- Dependencies inspected: `lib/next-step.ts` (nextStep), `lib/docs.ts` (ProjectDocsIndex), `components/CopyButton.tsx`

## Evidence re-run from clean (not trusted from the self-report)

- `pnpm vitest run components/CardDetail.test.tsx` → **56 passed**.
- `pnpm vitest run components/CardDetail.adversarial.test.tsx` (reviewer-authored) → **11 passed** (67 total green together).
- `pnpm biome check components/CardDetail.tsx components/CardDetail.test.tsx components/CardDetail.adversarial.test.tsx` → **clean**.
- `pnpm tsc --noEmit` → 1 error, but in `components/IntakeModal.adversarial.test.tsx:221` (FRD-03, untracked, OUT OF SCOPE for this WO). See "Gate observation" below.

## Correctness lens

- AC-02-004.1 met: title, markdown summary/key points, docs navigator, next-step command + CopyButton all render with the value from `nextStep`. nextStep is called once per render with the exact `{cardStatus, phase, advancePending}` triple.
- AC-02-008.1 (no-docs edge) met: `docsIndex == null` AND empty-index (all flags false, `frds: []`) both correctly suppress the navigator while keeping summary + next-step. Verified by both suites.
- Body heading remapping (h1–h6 → `<strong>`) keeps a single accessible heading; sensible and tested.

## Security lens

- Markdown body is project-derived content. CardDetail uses `react-markdown` with **no `rehype-raw` and no `dangerouslySetInnerHTML`** (grep-confirmed repo-wide). Reviewer adversarial tests confirm: raw `<script>` is not injected as a live node, `<img onerror>` carries no handler, and `[x](javascript:…)` links are neutralised (href does not start with `javascript:`). No XSS surface.
- Read-only invariant holds: no fs/network/write calls; render triggers only `nextStep`. Verified by the implementer's read-only tests.

## Quality lens

- No scope creep: only the two WO-02-007 files touched; reuses `CopyButton`, `nextStep`, `ProjectDocsIndex` as the WO dependencies require.
- Design tokens only — no hardcoded color values (CSS custom properties throughout); test asserts it on the root.
- Spanish UI copy + aria-labels, per convention.

## Findings

### Minor (non-blocking)

1. `components/CardDetail.tsx:159` — `buildNavEntries` uses `frd.slug` directly as the React `key`. Two FRD modules with the same slug emit a React "duplicate key" warning (reproduced in the adversarial suite). It does **not** crash and **cannot occur from the real `readProjectDocs`** (slugs are filesystem directory names, unique by construction), so this is robustness-only. Suggested fix if touched later: index the key (e.g. `key={`${frd.slug}-${i}`}`).
2. `components/CardDetail.tsx:182-185` — a `comms.bugs` path ending in `/` yields `""` from `.split("/").at(-1)`, producing a bare `Bug: ` label. Cosmetic only; does not crash. The fallback `?? bugPath` already prevents an empty key.

Neither finding blocks: no blocking and no important findings.

## Gate observation (not a WO-02-007 finding)

`pnpm tsc --noEmit` (and therefore the full `.pandacorp/verify.sh`) is currently RED repo-wide due to `components/IntakeModal.adversarial.test.tsx:221` (`'lastCopy' is possibly 'undefined'`, `noUncheckedIndexedAccess`). That file is an untracked FRD-03 artifact, unrelated to WO-02-007. WO-02-007's own surface type-checks and lints clean. The owner / FRD-03 owner must fix that test before `verify.sh` can pass end-to-end; it is not attributable to this work order.

## Adversarial tests added (reviewer)

`components/CardDetail.adversarial.test.tsx` (11 tests): comms.bugs navigator entries + filename derivation (incl. trailing-slash path), comms.decisions / hasAdr / hasAnalytics entries (set in fixtures but never asserted by the implementer), markdown XSS sanitisation (script / img onerror / javascript: link), duplicate-FRD-slug key collision, and special-character slug binding.
