# Work orders — FRD-17 Proposals inbox

> Source-of-truth hierarchy: `FRD > FDD > design-tokens > blueprint > work order`.
> Design: [`blueprint.md`](../blueprint.md). Platform: [`docs/product/architecture.md`](../../../product/architecture.md).

TDD per WO (RED → GREEN → refactor). Gate: `.pandacorp/verify.sh` (biome → tsc → vitest).

## List & order

The `lib/memory` + `lib/self-suggest` readers (WO-17-001/002/003) are **VERIFIED**. Phase 2 collapsed
the four UI WOs (page + streams/card, memory-health panel, promotions queue, badge/chip/dismiss) into
**one coarse UI work order** (WO-17-004) re-anchoring the Proposals surface to the prototype's canonical
`propuestasView()` — see the [blueprint Build Plan (Phase 2)](../blueprint.md#build-plan-phase-2).

| WO | Title | Layer | Status | Depends on |
|---|---|---|---|---|
| WO-17-001 | `lib/memory` lesson reader (parse + status/promotion/evalGate) | `lib/` | VERIFIED | — |
| WO-17-002 | `lib/memory` views: candidates / promotionQueue / prunable / memoryHealth | `lib/` | VERIFIED | WO-17-001 |
| WO-17-003 | `lib/self-suggest` derivations (6 kinds) | `lib/` | VERIFIED | WO-17-001 |
| WO-17-005 | Loop v2 fields & signals: trigger/applied_in in the reader; lastSweepAt + harvestOrphans in memory-health; detail rows + threshold 20 | `lib/`, `components/`, `app/` | VERIFIED (gate green 2026-07-02, direct implementation DR-097 — drains change mc-frd17-propuestas-memory-health-loop-v2) | WO-17-001, WO-17-002, WO-17-004 |
| WO-17-004 | Proposals surface: stream/card + promotions queue + memory health + badge/chip | `app/`, `components/` | VERIFIED (gate PASS 2026-06-21, reopen_count reset 0: the DR-057/062 reuse defect is resolved & mutation-locked — MemoryHealth reuses shared Banner+SectionHead, PromotionsQueue reuses SectionHead+Panel+Chip, ProposalsBadge reuses CountBadge; /proposals blessed) | WO-17-002, WO-17-003, WO-13-006, WO-13-007 |

## Parallelization

- The three `lib/` readers are VERIFIED. WO-17-004 is the single coarse UI WO; it consumes both data
  layers (WO-17-002 + WO-17-003) and the FRD-13 foundation. No intra-FRD UI peer to parallelize.

## Cross-feature dependencies

- **FRD-01** `lib/config`, `lib/status`, `lib/portfolio` — shipped.
- **FRD-02** `lib/board`, `CopyButton` — board derivation + copy button.
- **FRD-06/12** `lib/events` — the capped event tail (velocity, unused-capability, last-run proxy).
- **FRD-07/08** `lib/registry`, `lib/reference` — policy-friction + unused-capability capability list.
- **FRD-14** the pending-decisions/bugs chips that this feature extends with the proposals stream.
- **FRD-09** the honest/White-Hat framing for dismissibility.
- **FRD-18** surfaces the proposals/memory-health stream on the dashboard (composes this feature's badge + nudge).

> If a cross-feature reader (`lib/board`, `lib/events`, `lib/registry`, `lib/reference`) is not yet
> shipped when WO-17-003 starts, stub the corresponding derivation behind its reader and light it up
> when the reader lands — each of the 6 derivations is independently testable.
