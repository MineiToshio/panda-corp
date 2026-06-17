---
id: WO-10-008
type: work-order
slug: secrets
title: WO-10-008 — Secret achievements
status: DRAFT
parent: FRD-10
implementation_status: IN_REVIEW
source_requirements: []
last_updated: '2026-06-16'
---
# WO-10-008 — Secret achievements

Source-of-truth: `FRD > FDD > design-tokens > blueprint > work order`.
Blueprint: [`CMP-10-secrets`](../blueprint.md#4-components--interfaces).

## Goal
Render the secret achievements: a silhouette + cryptic hint while locked; on unlock, **reveal the
criterion** (what triggered it) plus date+project. Never a permanent, loot-box-style obscurity.

## Acceptance criteria (EARS, from FRD-10)
- **AC-10-008.1** — A locked secret SHALL render as a silhouette + its cryptic hint (from `computeSecrets()`), with no criterion shown.
- **AC-10-008.2** — WHEN unlocked, the secret SHALL **reveal its criterion** (what triggered it) and show date + project — it SHALL NOT remain obscure (negative AC, FRD-10 anti-loot-box).
- **AC-10-008.3** — The reveal SHALL be honest (the actual triggering result), never fabricated.
- **AC-10-008.4** — Styling SHALL use FRD-13 tokens only; locked/unlocked distinction not by color alone (silhouette/icon/label).

## Dependencies
- WO-10-001 (`computeSecrets`), WO-10-005 (page shell). Intra-feature.
- FRD-13 tokens. Cross-feature.

## TDD plan
1. RED: tests for locked silhouette+hint (no criterion), unlocked reveal (criterion+date+project), not-color-alone, tokens.
2. GREEN: implement.
3. Refactor.

## Definition of done
- Component tests green incl. negative ACs; tsc + biome clean; tokens only. `.pandacorp/verify.sh` passes.

## Status Note

**What was built:** `app/achievements/SecretsPanel.tsx` (`SecretsPanel` + `SecretItem` components).

**SecretsPanel** (`data-testid="secrets-panel"`, `aria-label="Logros secretos"`) accepts `Secret[]` from `computeSecrets()` and renders each entry as a `SecretItem`:
- **Locked** (`data-locked="true"`): silhouette `?` icon (`data-testid="secret-silhouette"`, `role="img"`) + cryptic hint only — criterion, date, project absent (AC-10-008.1).
- **Unlocked** (`data-locked="false"`): `!` badge (`data-testid="secret-unlocked-badge"`, `role="img"`) + hint + criterion (`data-testid="secret-criterion"`) + date (`data-testid="secret-date"`, `tabular-nums` class) + project (`data-testid="secret-project"`) — never permanent obscurity (AC-10-008.2).
- Reveals the exact `Secret.criterion` string from the data object — not fabricated (AC-10-008.3).
- Non-color locked/unlocked distinction: silhouette icon vs unlocked badge, `data-locked` attribute, `aria-label` per item (AC-10-008.4). Zero hardcoded hex/rgb/hsl — all `var(--)` tokens.

**Interfaces/contracts exposed:**
```tsx
// app/achievements/SecretsPanel.tsx
export type SecretsPanelProps = { secrets: readonly Secret[] };
export function SecretsPanel({ secrets }: SecretsPanelProps): React.JSX.Element
// data-testid: secrets-panel
//   > secret-item[data-locked="true"|"false"][aria-label]
//     > secret-silhouette (locked only, role="img")
//     > secret-unlocked-badge (unlocked only, role="img")
//     > secret-hint
//     > secret-criterion (unlocked only)
//     > secret-date (unlocked + date present, tabular-nums)
//     > secret-project (unlocked + project present)
```

**Integration seams:**
- Consumes `Secret` type and `computeSecrets()` from `lib/achievements.ts` (WO-10-001 / IF-10-secrets).
- Integrates directly into `app/achievements/page.tsx` (WO-10-005 page shell) — caller passes `computeSecrets(readerData)` output.
- All design tokens via CSS custom properties — FRD-13.

**Test file:** `app/achievements/SecretsPanel.test.tsx` — 32 tests RED→GREEN covering AC-10-008.1 through AC-10-008.4 (including all negative ACs: criterion hidden when locked, no fabricated text, no hardcoded colors, non-color distinction, empty-factory honest empty state, integration with `computeSecrets()` output).

**Gate:** 177 test files, 4904 tests GREEN + 2 expected-fail + 5 skipped. `biome check SecretsPanel.tsx SecretsPanel.test.tsx` clean. tsc introduces zero new errors (2 pre-existing errors in `UniquesSection.test.tsx` from WO-10-007, outside scope). Pre-existing biome errors in WO-10-006/007 files outside scope. Commit: `94276d9`.
</content>
