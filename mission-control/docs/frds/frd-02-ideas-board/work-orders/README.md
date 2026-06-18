# FRD-02 — Work orders

The **ideas board**: read-only kanban + intake modal + card detail + the single discard write.
See the feature blueprint ([`../blueprint.md`](../blueprint.md)) and the platform architecture
([`../../../product/architecture.md`](../../../product/architecture.md)).

> **Compliance reorg (2026-06-18) — paths.** After the migration to `docs/rules/`, this feature's
> components are route-local: `IntakeModal` and `CardDetail` now live at
> `app/board/_components/<Name>/<Name>.tsx` (tests in `_tests/`); shared primitives moved to
> `components/core/` (`CopyButton`, `DiscardButton`, `StateBadge`) and `IdeaCard` to
> `components/modules/IdeaCard/IdeaCard.tsx`; `src/lib/` is grouped by domain (`lib/<name>/<name>.ts`,
> e.g. `lib/board/board.ts`). **Older WO prose may cite pre-reorg paths (e.g. `components/CardDetail.tsx`) —
> the canonical location is the current on-disk path; locate files by name and create NEW files
> (e.g. `CampaignPipeline`, `lib/campaign`) following these conventions.** `verify.sh` enforces a
> structure-guard (no loose tests), `max-lines` (≤500) and a circular-dependency gate.

## Work orders

| WO | Title | Artifact | Depends on |
|---|---|---|---|
| WO-02-001 | `deriveColumn` two-axis logic | `lib/board.ts` | FRD-01 (`ideas`, `status`) |
| WO-02-002 | `CopyButton` shared affordance | `components/CopyButton.tsx` | — |
| WO-02-003 | `nextStep` command map | `lib/next-step.ts` | FRD-01 types |
| WO-02-004 | `discardIdea` single write | `lib/discard.ts` | FRD-01 (`config`, gray-matter) |
| WO-02-005 | Board view + columns | `app/board/page.tsx`, `components/IdeaCard.tsx` | WO-02-001, WO-02-002 |
| WO-02-006 | Intake modal | `components/IntakeModal.tsx` | WO-02-002 |
| WO-02-007 | Card detail — **3-tab restructure** (Campaña · Documentos · Comandos) + docs navigator | `components/CardDetail.tsx` | WO-02-002, WO-02-003, WO-02-010, FRD-01 (`docs`) |
| WO-02-008 | Category filter + legend | `components/CategoryFilter.tsx`, `components/BoardLegend.tsx` | WO-02-005 |
| WO-02-009 | Discard action (Server Action + button) | `app/board/actions.ts`, `components/DiscardButton.tsx` | WO-02-004 |
| WO-02-010 | **La Campaña** pipeline component (6 phases + per-phase ficha w/ whole team) | `components/CampaignPipeline.tsx` | WO-02-011, WO-02-012 |
| WO-02-011 | `phaseFromStatus` derivation (status → active phase 0–5) | `lib/campaign.ts` | FRD-01 (`ideas`, `status` types) |
| WO-02-012 | Host-navigation Construcción → Party tab | host-navigation glue (`onEnterForge`) | WO-02-010, FRD-06 |

## Ordering & parallelism

- **Pure logic first, fully parallel:** WO-02-001 (`board`), WO-02-003 (`next-step`),
  WO-02-004 (`discard`), and WO-02-002 (`CopyButton`) have no inter-dependencies — do them together.
  They each depend only on the FRD-01 data layer (and `CopyButton` on nothing).
- **UI next:** WO-02-005 (board view) needs `deriveColumn` + `CopyButton`. WO-02-006/007/008 build on
  the board/CopyButton and parallelize among themselves. WO-02-009 (discard action) needs
  `lib/discard.ts` (WO-02-004) and can land in parallel with the other UI WOs.

## La Campaña extension (2026-06-18 — REQ-02-009 / REQ-02-010)

The card detail (WO-02-007) is **reopened** (`PLANNED`) and restructured into **3 tabs**
(Campaña · Documentos · Comandos); its prior single-pane content is preserved under Documentos /
Comandos. Three new WOs add the Campaña tab:

- **WO-02-011** (`phaseFromStatus`) is **pure logic** — do it first, in parallel with anything.
- **WO-02-010** (`CampaignPipeline`) consumes WO-02-011 (active phase) and WO-02-012 (the
  `onEnterForge` host-nav callback).
- **WO-02-012** (host-navigation Construcción → Party) wires the build phase to FRD-06's Party tab.
- **WO-02-007** (reopened) hosts `CampaignPipeline` as the default **Campaña** tab → depends on
  WO-02-010.

Ordering: WO-02-011 → WO-02-012 → WO-02-010 → WO-02-007. All read-only; the only app write remains
discard (WO-02-009).

## Cross-feature dependencies

- **Inbound (this feature needs):** FRD-01 `lib/ideas.ts`, `lib/status.ts`, `lib/docs.ts`,
  `lib/config.ts`. The board view cannot pass tests until those readers exist.
- **Outbound (others reuse what's created here):** `components/CopyButton.tsx`,
  `lib/next-step.ts` are reused by FRD-01 (onboarding gate copy), FRD-03 (portfolio recovery + next
  step) and FRD-04 (workspace).

## Definition of done (every WO)

- Acceptance-criteria tests first (RED → GREEN → refactor) with fixtures (`PANDACORP_FACTORY_ROOT`).
- `.pandacorp/verify.sh` green (biome + tsc + vitest).
- `data-testid` on interactive elements; UI copy in Spanish via i18n; design tokens only.
- **Only `lib/discard.ts` writes**; every other artifact is read-only and adds no AI dependency.
