---
id: WO-07-009
type: work-order
slug: standards-section
title: 'WO-07-009 — Standards section: categorized list + detail'
status: DRAFT
parent: FRD-07
implementation_status: IN_REVIEW
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

## Status Note (retry 2026-06-18)

**Context:** This WO was reopened (PLANNED → IN_REVIEW retry) because:
1. `page.tsx` had a `"use server"` directive (wrong for a Page module, breaks Next.js build).
2. `page.tsx` dropped `readDecisionRules()` wiring, leaving the rules tab empty.
Both issues were confirmed fixed in commit `08e5763` (WO-07-007 retry agent, which coordinated).

**What this retry built/verified:**
- Confirmed `app/configuration/page.tsx` wires ALL FOUR data sources: `readSkills()`, `readAgents()+computeAgentLevel()`, `readDecisionRules()`, `readStandards()` — no `"use server"` directive (architecture §3).
- Added integration test `app/configuration/_tests/page.integration.test.tsx` — 13 tests that render the REAL `ConfigurationPage` default export (mocking the 4 lib modules with fixture data) and assert: rules tab has > 0 `rule-item-*` elements (regression AC-07-008.2), agents tab has > 0 `agent-card` elements (regression AC-07-007.1), standards tab has ≥ 1 `standard-item-*`, skills section has ≥ 1 `skill-card-*`, page component is a sync function (no `"use server"`).

**Interfaces/contracts exposed:**
```tsx
// app/configuration/StandardsSection/StandardsSection.tsx
export interface StandardsSectionProps {
  standards: Standard[];  // from readStandards() — passed from server
}
export function StandardsSection({ standards }: StandardsSectionProps): React.JSX.Element

// app/configuration/ConfigurationShell.tsx
export interface ConfigurationShellProps {
  skills?: SkillRef[];
  agentsData?: AgentsData;
  rules?: DecisionRule[];
  standards?: Standard[];  // WO-07-009
}

// app/configuration/page.tsx — Server Component wiring ALL FOUR sections
export default function ConfigurationPage(): React.JSX.Element
// No "use server" directive. Calls: readSkills(), readAgents(), computeAgentLevel(),
// readDecisionRules(), readStandards() — all on server before passing to ConfigurationShell.
```

**Integration seams:**
- `page.tsx` reads all 4 data sources server-side (architecture §3, filesystem stays on server).
- `ConfigurationShell` receives 4 props and routes to the matching section component.
- `StandardsSection` → domain-grouped list + severity/enforcement badges + Summary/Detail toggle.
- `NewStandardButton` copies `/pandacorp:learn` to clipboard (copy-only, no exec, architecture §1).
- Detail view uses `react-markdown` (already in `package.json`).

**Test files:**
- `app/configuration/StandardsSection/_tests/StandardsSection.test.tsx` — 50 tests covering all 5 ACs.
- `app/configuration/_tests/page.integration.test.tsx` — 13 integration tests (rules+agents+standards+skills wiring regression guards).

**Gate:** 240 tests GREEN (7 test files in src/app/configuration). tsc clean. biome clean on WO-07-009 files. Pre-existing unrelated failure in `agentColorTokens.integration.reviewer.test.ts` (FRD-13 ChainCard/StatsPanel still reference `--color-agent-guild` after WO-13-002 removal — outside WO-07-009 scope, exists in working tree before this WO).

## Reviewer finding (FRD-07 gate, 2026-06-17, Opus 4.8) — RESOLVED in retry

**Resolved:** `page.tsx` has been fixed with all 4 section wirings + no `"use server"` directive.
Integration test added that would have caught the original regression.
