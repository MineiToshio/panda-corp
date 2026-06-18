---
id: WO-02-011
type: work-order
slug: phase-from-status
title: WO-02-011 — `phaseFromStatus` derivation
status: ACTIVE
parent: FRD-02
implementation_status: PLANNED
source_requirements: [REQ-02-010]
last_updated: '2026-06-18'
---
# WO-02-011 — `phaseFromStatus` derivation

**Module:** `lib/campaign.ts`
**IDs touched:** `CMP-02-phase-from-status`, `IF-02-phaseFromStatus`; REQ-02-010
**Dependencies:** WO-01-003 (`readIdeas` / `IdeaStatus` types), WO-01-005 (`readStatus` / `Phase`
types) — FRD-01

## EARS criteria (from FRD-02)

- AC-02-010.2 — THE system SHALL **derive the ACTIVE phase from the project's real status** with the
  mapping `discovered→research`, `documented→product`, `design→design`, `architecture→architecture`,
  `building→build`, `shipped→release`; IF the status is absent or unrecognized THEN the active phase
  SHALL default to **research** (index 0) without breaking.

## Contract

```ts
type CampaignPhase = 0 | 1 | 2 | 3 | 4 | 5;
// 0 research · 1 product · 2 design · 3 architecture · 4 build · 5 release
export function phaseFromStatus(input: { cardStatus?: IdeaStatus; phase?: Phase }): CampaignPhase;
```

Pure function (no fs). Reads the **same two axes** as `deriveColumn` (WO-02-001) but collapses to the
6-phase index. Mapping table is blueprint §4b:

| Card `status` | Project `phase` | → |
|---|---|---|
| `discovered` / `recommended` | — | `0` |
| `in-pipeline` | `product` | `1` |
| `in-pipeline` | `design` | `2` |
| `in-pipeline` | `architecture` | `3` |
| `in-pipeline` | `implementation` / `release` | `4` |
| `in-pipeline` | `operation` | `5` |
| `shipped` | — | `5` |
| absent / unrecognized | — | `0` (fallback) |

## Definition of done

- [ ] `lib/campaign.test.ts` (RED first): one case per row above, plus the absent/unrecognized
  fallback to `0`, plus a malformed/undefined input → `0` without throwing.
- [ ] Pure; no fs, no network, no write.
- [ ] `.pandacorp/verify.sh` green (biome + tsc + vitest).
