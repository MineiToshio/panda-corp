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

> **Phase 2 re-plan (2026-06-19).** The `lib/**` read/write layer stays **VERIFIED** and untouched.
> The UI WOs are collapsed into **two coarse presentational WOs** (`PLANNED`) that re-paint the
> surfaces onto the FRD-13 foundation primitives to match the prototype. The old fine-grained UI WOs
> (CopyButton, IntakeModal, filter/legend, discard-action, CampaignPipeline, go-party) were removed —
> their scope folds into the two coarse WOs. See the **Build Plan (Phase 2)** in `../blueprint.md`.

| WO | Status | Title | Artifact | Depends on |
|---|---|---|---|---|
| WO-02-001 | VERIFIED (lib) | `deriveColumn` two-axis logic | `lib/board.ts` | FRD-01 (`ideas`, `status`) |
| WO-02-003 | VERIFIED (lib) | `nextStep` command map | `lib/next-step.ts` | FRD-01 types |
| WO-02-004 | VERIFIED (lib) | `discardIdea` single write + Server Action | `lib/discard.ts`, `app/board/actions.ts` | FRD-01 (`config`, gray-matter) |
| WO-02-011 | VERIFIED (lib) | `phaseFromStatus` derivation (status → active phase 0–5) | `lib/campaign.ts` | FRD-01 (`ideas`, `status` types) |
| WO-02-005 | PLANNED (UI) | **Board surface** — columns + cards + filter + legend + intake + discard | `app/board/**`, `components/modules/{IdeaCard,CategoryFilter,BoardLegend}/**` | FRD-13, WO-02-001/004 (lib) |
| WO-02-007 | PLANNED (UI) | **La Campaña card detail** — 3 tabs + 6-phase pipeline | `app/board/_components/CardDetail/**`, `components/modules/CampaignPipeline/**` | FRD-13, WO-02-011/003 (lib), FRD-06 |

## Ordering & parallelism (Phase 2)

- **Foundation first:** both coarse UI WOs depend on **FRD-13** (the shared primitives) being VERIFIED.
- **The two coarse WOs write disjoint artifacts** (board page/modules vs card-detail `_components/` +
  `CampaignPipeline` module) and parallelize once FRD-13 lands; a soft preference is WO-02-005 first.
- The `lib/**` layer (WO-02-001/003/004/011) is consumed as-is — never re-planned.

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
