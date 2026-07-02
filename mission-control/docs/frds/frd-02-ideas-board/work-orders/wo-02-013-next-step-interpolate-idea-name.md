---
id: WO-02-013
type: work-order
slug: next-step-interpolate-idea-name
title: WO-02-013 — "Siguiente paso" interpolates the real idea name (no literal `<idea>`)
status: DRAFT
parent: FRD-02
implementation_status: VERIFIED
source_requirements: [REQ-02-004, REQ-02-010]
dependsOn: [WO-02-003, WO-02-007, WO-02-011]
reopen_count: 0
last_updated: '2026-07-02'
change_ref: mc-nextstep-real-idea-name.md
---
# WO-02-013 — "Siguiente paso" interpolates the real idea name

**Module:** `components/modules/CampaignPipeline/CampaignPipeline.tsx` (the `ficha-next-step`
"Qué puedes correr" panel), fed by `components/modules/CampaignPipeline/phases.ts`.
**IDs touched:** `CMP-02-next-step`, `CMP-02-campaign-pipeline`; REQ-02-004 / REQ-02-010.
**Change:** `.pandacorp/inbox/changes/mc-nextstep-real-idea-name.md` (type `bug`).

## Problem (from the change)

The "Siguiente paso" panel of a proposal (Campaña tab of the board) rendered the **literal
placeholder** `<idea>` in every next-step command (e.g. `/pandacorp:spec <idea>`), identical for
every card, so the owner could not copy/paste a runnable command. Expected: the command interpolates
the **real identifier of the card in context** (the slug), e.g. `/pandacorp:spec panda-script`. It
applies to **every** command the panel renders that carries the token, not only `spec`.

## Acceptance criteria (regression)

- AC-02-013.1 — WHEN the "Siguiente paso" panel (`ficha-next-step`) renders for a card, EVERY command
  that contains the `<idea>` token SHALL be shown with the token replaced by the card's real slug, and
  the literal string `<idea>` SHALL NOT appear anywhere in the panel.
- AC-02-013.2 — This holds across phases (research → release), for the advance command and for every
  other option in the phase (`spec`, `explore`, …), not only the first one.

## Contract

No new public interface. The fix lives in the presentational consumer: `CampaignPipeline` substitutes
its `slug` prop into each command string before handing it to `CmdRow` —
`command={cmd.command.replace(/<idea>/g, slug)}` — so the pure `nextStep()` / `phases.ts` map keeps
the canonical `<idea>` token and the UI resolves it to the real name for copy-paste. The slug is the
canonical card identifier already threaded from `CardDetail` (WO-02-007).

## Definition of done

- [x] RED-first regression test asserting `/pandacorp:spec <slug>` is rendered and the literal
  `<idea>` never appears in the panel.
- [x] Minimum production fix in the presentational consumer (no change to the pure `phases.ts` /
  `next-step` map — the token stays canonical there).
- [x] `.pandacorp/verify.sh` green (biome + tsc + vitest).

## Evidence

- Implementation: `components/modules/CampaignPipeline/CampaignPipeline.tsx` — the `ficha-next-step`
  panel replaces the `<idea>` token with the `slug` prop for every command
  (`cmd.command.replace(/<idea>/g, slug)`).
- Tests (regression, RED without the substitution, GREEN with it):
  - `components/modules/CampaignPipeline/_tests/CampaignPipeline.test.tsx` — "substitutes the project
    slug into the `<idea>` token for copy-paste": asserts `"/pandacorp:spec my-idea"` and
    `not.toHaveTextContent("<idea>")`.
  - `app/board/_tests/frd-02.integration.reviewer.test.tsx` — "a discovered card's detail offers
    spec": renders `CardDetail slug="n"` and asserts the panel shows `/pandacorp:spec n`.
- verify run: `pnpm vitest run` over the two files above — 2 files, 87 tests passed.

## Status Note

**Built:** the "Siguiente paso" (`ficha-next-step`) panel of `CampaignPipeline` now interpolates the
card's real slug into every next-step command, replacing the literal `<idea>` placeholder.

**What it does:** for each command in the active phase, the panel does
`cmd.command.replace(/<idea>/g, slug)` before rendering the copyable `CmdRow`. The literal `<idea>`
token is never shown for a real card; it is only ever a placeholder in the empty-portfolio
first-action card (`Cartera.tsx` `FIRST_ACTION_COMMAND`), where there is genuinely no idea to name.

**Decisions & assumptions inherited by the consumer:**
- The **slug** is the canonical identifier used for interpolation (matches the owner's example
  `/pandacorp:spec panda-script`). Title is not used — the slug is the copy-pasteable name.
- The `<idea>` token stays **canonical** in the pure layer (`phases.ts`, `lib/next-step`); only the
  presentational consumer resolves it. This keeps the map testable and reusable and confines the
  UI concern to the UI.
- Applies to **all** commands via a global regex (`/g`), not only the first/advance command.
- Companion change `mc-nextstep-offer-explore.md` (offer `/pandacorp:explore <idea>` in the research
  phase) is built in the same panel: `phases.ts` research phase already lists
  `/pandacorp:explore <idea>`, which this same substitution resolves to the real slug.

**Test files covering this WO:**
- `components/modules/CampaignPipeline/_tests/CampaignPipeline.test.tsx`
- `app/board/_tests/frd-02.integration.reviewer.test.tsx`
