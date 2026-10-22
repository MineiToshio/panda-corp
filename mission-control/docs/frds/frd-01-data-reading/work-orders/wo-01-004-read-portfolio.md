---
id: WO-01-004
type: work-order
slug: read-portfolio
title: WO-01-004 — `readPortfolio` (markdown table parse)
status: ACTIVE
parent: FRD-01
implementation_status: VERIFIED
artifacts:
  - 'src/lib/portfolio/portfolio.ts'
  - 'src/lib/portfolio/_tests/portfolio.test.ts'
  - 'src/lib/portfolio/_tests/portfolio.adversarial.test.ts'
source_requirements: [REQ-01-004]
dependsOn: [WO-01-000]
last_updated: '2026-10-22'
---
# WO-01-004 — `readPortfolio` (markdown table parse)

**Module:** `lib/portfolio.ts`
**IDs touched:** `CMP-01-portfolio`, `IF-01-readPortfolio`; REQ-01-004
**Dependencies:** WO-01-000 (fixtures)

## v1 delivery record

FRD-01 is REQ-only (no `AC-01-*` bullets), so this v1 criterion is history and owns nothing. The module
lives at `src/lib/portfolio/portfolio.ts` (the `lib/portfolio.ts` path above is the v1 plan). v2 note:
WO-03-007 (W4) later adds the last-commit-ordered overview resolver in the same folder and removes the
rail-only helpers; this reader (`readPortfolio`) is untouched.

- v1 AC-01-004.1: The system SHALL read `factory/portfolio.md` to obtain the list of projects and
  their paths.
- v1 note (FRD-03): the row also yields `repo`, business snapshot columns (users / return / verdict) and the
  phase cell, consumed by FRD-03.

## Contract

```ts
type PortfolioEntry = {
  name: string; path: string; repo?: string; originIdea?: string;
  phase?: string; users?: string; returnMetric?: string; verdict?: string; lastSync?: string;
};

export function readPortfolio(portfolioPath?: string): PortfolioEntry[];  // defaults config.PORTFOLIO
```

- Parse the GitHub-flavored markdown table (columns per `portfolio.example.md`: Project, Path, Repo,
  Origin idea, Phase, Users, Return, Verdict, Last sync). Map header → field by position/name.
- Skip the header + separator rows and any non-table prose.
- Normalize placeholder cells (`—`, empty, `-`) to `undefined`.
- Missing/empty file → `[]`; a row with missing cells degrades fields to `undefined`, never throws.

## Definition of done

- [x] `lib/portfolio.test.ts` (RED first):
  - `factory-full` portfolio → full row parsed with `path` + `repo`; the missing-repo row →
    `repo: undefined`; the broken-path row still yields a `path` string.
  - Missing file → `[]`.
- [x] No write; fail-soft per blueprint §3.
- [x] `.pandacorp/verify.sh` green.

## Status: DONE

**Evidence:** `bash .pandacorp/verify.sh` — 669 tests passed (24 test files), biome+tsc clean (2026-06-16).
Implementer commits: `dd6604e` (readPortfolio lib), `1a7bff2` (PortfolioTable UI).
Safe-point sha: `476738a` (HEAD at time of safe-point verification).
