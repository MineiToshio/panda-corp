# Work orders — FRD-17 Proposals inbox

> Source-of-truth hierarchy: `FRD > FDD > design-tokens > blueprint > work order`.
> Design: [`blueprint.md`](../blueprint.md). Platform: [`docs/product/architecture.md`](../../../product/architecture.md).

TDD per WO (RED → GREEN → refactor). Gate: `.pandacorp/verify.sh` (biome → tsc → vitest).

## List & order

| WO | Title | Layer | Depends on |
|---|---|---|---|
| WO-17-001 | `lib/memory` lesson reader (parse + status/promotion/evalGate) | `lib/` | `lib/config.ts` (FRD-01) |
| WO-17-002 | `lib/memory` views: candidates / promotionQueue / prunable / memoryHealth | `lib/` | WO-17-001 |
| WO-17-003 | `lib/self-suggest` derivations (6 kinds) | `lib/` | `lib/events`, `lib/status`, `lib/board`, `lib/registry`, `lib/reference`, `lib/portfolio` (FRD-01/02/06/07) |
| WO-17-004 | `app/proposals` page + 4 streams + proposal card | `app/` | WO-17-002, WO-17-003 |
| WO-17-005 | Memory-health panel | `components/` | WO-17-002 |
| WO-17-006 | Promotions queue | `components/` | WO-17-002 |
| WO-17-007 | Guild badge + portfolio-rail chip + dismissal | `components/` | WO-17-002, WO-17-003 |

## Parallelization

- WO-17-001 starts immediately (only `lib/config.ts`). WO-17-003 can be authored in parallel with
  WO-17-001/002 (it depends on other shipped readers, not on `lib/memory`).
- WO-17-002 → unblocks WO-17-004/005/006/007 (which can then run in parallel).
- WO-17-004 needs both data layers (WO-17-002 + WO-17-003).

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
