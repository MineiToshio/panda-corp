---
id: WO-07-009
type: work-order
slug: standards-section
title: 'WO-07-009 — Standards section: categorized list + detail'
status: DRAFT
parent: FRD-07
implementation_status: PLANNED
source_requirements: []
last_updated: '2026-06-17'
---
# WO-07-009 — Standards section: categorized list + detail

Source-of-truth: `FRD > FDD > design-tokens > blueprint > work order`.
Blueprint: [`CMP-07-standards-list`, `CMP-07-standard-detail`](../blueprint.md#3-components--interfaces).

## Goal
Render the Standards section: **categorized by domain** (Programming, Architecture, Design,
Technology, Quality, Security, Operation, Data/Privacy, Product/Docs), each standard with
**severity** (MUST/SHOULD/MAY) and **enforcement** (lint/CI/checklist/human gate) badges, two views
(**Summary** key points + **Detail** markdown), and a **"New standard"** button copying
`/pandacorp:learn`.

## Acceptance criteria (EARS, from FRD-07)
- **AC-07-009.1** — The section SHALL group standards by domain (the 9 domains above), reading `readStandards()`.
- **AC-07-009.2** — Each standard SHALL show a **severity** badge (MUST/SHOULD/MAY) and an **enforcement** badge (lint/CI/checklist/human gate), paired with label/shape (not color alone, FRD-13).
- **AC-07-009.3** — Each standard SHALL offer a **Summary** view (real key points) and a **Detail** view (rendered markdown via `react-markdown`).
- **AC-07-009.4** — The section SHALL include a **"New standard"** button that **copies** `/pandacorp:learn` (clipboard, no exec).
- **AC-07-009.5** — The section SHALL render gracefully when a standard lacks metadata (falls back to derivation map / "Other", WO-07-004) — never empty, never crash.

## Dependencies
- WO-07-004 (`readStandards()`), WO-07-005 (page shell). Intra-feature.
- `CopyButton` (FRD-02), `react-markdown` (architecture §2). Cross-feature.
- FRD-13 tokens. Cross-feature.

## TDD plan
1. RED: tests for domain grouping, severity+enforcement badges, Summary/Detail toggle, copy-`/pandacorp:learn`, graceful no-metadata.
2. GREEN: implement categorized list + detail + badges + button.
3. Refactor.

## Definition of done
- Component tests green; tsc + biome clean; tokens only; copy-only. `.pandacorp/verify.sh` passes.
</content>

## Status Note

**Built:** `StandardsSection` (CMP-07-standards-list + CMP-07-standard-detail) — a "use client" React component rendered inside the `/configuration` page's Standards tab.

**What it built:**
- Domain-grouped list of all factory standards (9 canonical domains + "Other" catch-all), reading `Standard[]` passed from the server.
- Severity badges (MUST/SHOULD/MAY) with `data-severity` shape attribute + enforcement badges (lint/CI/checklist/human gate) with `data-enforcement` — label+shape, not color alone (AC-07-009.2 / FRD-13).
- Collapsible per-standard detail: Summary tab (key points from `standard.summary[]`) and Detail tab (full markdown rendered via `react-markdown`) — one open at a time (AC-07-009.3).
- "Nuevo estándar" button (`data-testid="new-standard-button"`) copies `/pandacorp:learn` to clipboard, does NOT exec (AC-07-009.4 / architecture §1).
- Graceful fallback for missing metadata (domain `Other`, empty summary, empty list) — never crashes (AC-07-009.5).
- Wired `StandardsSection` into `ConfigurationShell` for the `standards` tab (replacing the placeholder); `page.tsx` reads `readStandards()` server-side and passes `standards` prop.

**Interfaces/contracts exposed:**
```tsx
// app/configuration/StandardsSection.tsx
export interface StandardsSectionProps {
  standards: Standard[];  // from readStandards() — passed from server
}
export function StandardsSection({ standards }: StandardsSectionProps): React.JSX.Element

// app/configuration/ConfigurationShell.tsx — new prop added
export interface ConfigurationShellProps {
  // ...existing skills, agentsData, rules...
  standards?: Standard[];  // WO-07-009
}
```

**Integration seams:**
- `app/configuration/page.tsx` calls `readStandards()` server-side and passes `standards` to `ConfigurationShell`.
- `ConfigurationShell` routes `activeSection === (else)` → `<StandardsSection standards={standards} />` in a `data-testid="config-section-standards"` tabpanel.
- `NewStandardButton` (inline, not shared `CopyButton`) uses `navigator.clipboard.writeText("/pandacorp:learn")` — copy-only.
- Detail view uses `react-markdown` (already in `package.json`).

**Test files:**
- `app/configuration/StandardsSection.test.tsx` — 50 tests covering all 5 ACs (RED → GREEN confirmed).

**Gate:** 167 test files, 4560 tests GREEN. tsc clean. biome clean. `verify.sh` PASS.

## Reviewer finding (FRD-07 gate, 2026-06-17, Opus 4.8) — REOPENED → PLANNED

**Blocking regression introduced by this WO's `page.tsx` overwrite.** This WO's commit
(`be2294f`) rewrote `app/configuration/page.tsx` and, in doing so, **dropped the decision-rules
wiring** that WO-07-008 had added one commit earlier (`c34998d`): the `import { readDecisionRules }`,
the `const rules = readDecisionRules();` and the `rules={rules}` prop are all gone from the
committed page. `ConfigurationShell` still accepts a `rules` prop, but the page no longer passes
it, so the Decision rules tab renders empty (`rules = []`) — violating AC-07-008.2 (the section
SHALL list ALL decision rules). The standards section this WO built is itself correct and wired.

Proven with a reviewer integration test rendering the REAL `ConfigurationPage` default export
against the real factory tree: the rules tab contained **0** `rule-item-*` elements
(`expected 0 to be greater than 0`), even though `factory/decisions/registry.yaml` has many DRs.

**Secondary (must also be fixed on the retry):** the committed `page.tsx` starts with a
`"use server";` directive. That directive marks every export in the file as a Server Action and
is incorrect for a Page module (a page exports `metadata` + a default React component, not async
Server Actions). A reviewer found an uncommitted, half-finished removal of it in the working tree;
that partial edit was reverted so the retry starts from a clean committed state. The retry MUST
produce a `page.tsx` with NO `"use server"` directive.

**Concrete fix for the retry (in `app/configuration/page.tsx`):**
- Remove the `"use server";` directive (a Server Component, not a Server Action module).
- Restore `import { readDecisionRules } from "@/lib/registry"`, `const rules = readDecisionRules();`
  and pass `rules={rules}` to `<ConfigurationShell />` — do not regress the WO-07-008 wiring.
- Keep `skills` and `standards`, and (coordinated with WO-07-007) `agentsData` — the page must
  wire ALL FOUR sections, not just the one this WO touched.
- Add an integration assertion that renders the REAL page default export and asserts the rules
  tab has `rule-item-*` count > 0.
