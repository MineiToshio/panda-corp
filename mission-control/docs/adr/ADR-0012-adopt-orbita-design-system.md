---
id: ADR-0012
status: ACCEPTED
last_updated: 2026-10-22
---

# ADR-0012 — Adopt the Órbita design system as the frozen design contract

- Date: 2026-10-22
- Status: Accepted
- Agent: Claude (new-version engine, Mission Control v2), on the owner's recorded decisions (M1 and M2, 2026-10-22)

## Context

Mission Control v1 was built against the Atelier / pixel-RPG design contract frozen on 2026-06-18 (warm-dark canvas, one teal accent, Pixelify Sans numerals, embossed panels, a Party tab with a sprite canvas). That contract lives in `DESIGN.md`, `docs/design/design-tokens.json` and the `@theme` block of `src/app/globals.css`, and the visual and e2e gates were baselined against it.

The owner then asked for a redesign and approved a new direction, **Órbita**, after 28 review iterations with real data at desktop, tablet and phone widths in both themes (round 5, iteration 28, approved 2026-10-21). Every Mission Control function was kept as a condition of the redesign. The prototype is the owner-approved visual, so under DR-054 the job of the design phase was fidelity, not novelty.

The design was frozen on 2026-10-22 (commit `cb34865f`). Design tokens and public schemas are frozen contracts. The new-version engine's rule is that they are not touched without an ADR that justifies it. This ADR is that justification: the freeze replaces the token set wholesale (the old Atelier token names are gone), so the replacement must be recorded as a deliberate platform-level decision rather than discovered in a diff.

## Decision

**Órbita replaces Atelier as the frozen design contract of Mission Control.** The following artefacts are the contract from now on:

- `DESIGN.md` (rewritten, frozen 2026-10-22) and `docs/design/design-tokens.json`, **regenerated from the prototype's final CSS** (history in `design-tokens-history.json`). The JSON wins over any table in prose.
- `docs/design/components.md` (the component inventory and the `AppShell` navigation contract) and `docs/design/microcopy.es.json` (the Spanish key-value catalogue; the owner-confirmed corrections are in `docs/design/freeze/copy/frd-NN.md`).
- The measured references under `docs/design/prototype/reference/` (computed styles, oracle states and recipes, portable CSS) and the per-FRD mocks and FDDs under `docs/frds/frd-NN-*/mocks/`. The live prototype `docs/design/prototype/index.html` is the visual oracle (DR-080): the implementer never edits it, the references, the fixtures or the tolerances.

Product-level decisions that come with the contract (all owner-confirmed at M1 or M2, `docs/design/freeze/m1-decisions.md`):

1. **Target platforms: desktop, tablet and phone** (persistent sidebar with a collapsible rail, 76px tablet rail, phone drawer with top bar and bottom nav).
2. **The interface is Spanish; shown content keeps its original language.** Everything Mission Control says goes through i18n in Spanish. Project documents, work-order and FRD text, skill and agent descriptions, lessons and backlog items stay as written (English today). Artifact names stay English inside Spanish sentences (FRD, PRD, ADR, work order, spec, backlog). «Documentación» is the surface name.
3. **Status colours are reserved for status.** Green, amber and red mean status or severity only; categories use violet, blue, teal, pink, slate and gold. A project's phase counts as status, which is the deliberate exception. There are no coloured edge stripes and colour never appears without text or an icon.
4. **A privacy-safe fixture factory is the fidelity-gate seed.** The repository is public, so the prototype and the gate render fictional data only, from `docs/design/prototype/fixtures/` (factory root, five fictional projects, vault accounts, home, `git-state.json`). The gate never reads the owner's real factory.
5. **Graphs are mixed.** The dependency map (by FRD and by build step) adopts the prototype's layouts and is pixel-compared. The data-model canvas keeps the app's existing layout engine (owner-approved 2026-10-16, ADR-0007) and is compared by computed styles only (L1/L2), excluded from L3 pixels.
6. **The brand mark stays a raster exception.** `docs/design/prototype/assets/pandacorp.png` is served as original bytes, a recorded exception to the vector-logo rule (internal tool, the emblem is the guild crest).
7. **A theme button** (sun/moon) sits in the sidebar footer and in the phone drawer. It starts from the system preference and remembers the owner's choice. Light and dark are both first-class; scene and map surfaces stay dark in both.

Features the prototype does not draw stay out of v2 (the 35 Group B items in `design-decisions.md`). The 79 features it draws that the FRDs lacked are written into the FRDs.

## Consequences

- **The v2 build re-skins every surface.** The shell (`AppShell`) is a foundation component and lands first; surfaces follow.
- **`src/app/globals.css` is regenerated.** The Tailwind v4 `@theme` block becomes the mirror of the new `design-tokens.json` (both themes via `[data-theme]` with a `prefers-color-scheme` default). The three self-hosted font families (Space Grotesk, Inter, JetBrains Mono) are served with the prototype's exact `@font-face` rules, and the staged art and the 65 exported SVG icons go to `public/` and one `Icon` component as original bytes. The Atelier fonts, rpgSkin and Party token groups are retired.
- **The fidelity gate L1 to L4 blocks by default** (DR-129): computed typography and colour exact, geometry within 1px, per-slice pixel diff at most 0.5% against the live prototype, and 100% of listed states by widths 375 / 768 / 1280 and both themes, with axe at 0 serious or critical. A missing prototype, font, fixture or browser is RED, never a skip.
- **The app needs a fixture-driven build mode.** The oracle's 159 states (`docs/design/prototype/reference/oracle-recipes.md`) reproduce only if the app runs against an injectable factory root, home directory, events file, accounts file, a **git seam** (an injectable git runner answered from `git-state.json`) and a **clock seam** (frozen at `2026-10-21T00:20:00.000Z`). A grep found no clock override in `src` and the readers resolve paths at import time (`src/lib/config/config.ts`), so this is a foundation work order that every fidelity state depends on (`docs/design/technical-assumptions.md` §4). The seams are present in every build, including production, and are inert unless their variable is set (`MC_CLOCK`, `MC_GIT_FIXTURE` and the path overrides); `pnpm dev`, `pnpm start` and production never set them, only `pnpm dev:oracle` and the test and e2e harnesses do (amended 2026-10-22 to match `docs/product/architecture.md` §7 and WO-01-010; the earlier wording "absent from production" described a build-time exclusion that the plan does not use). Read errors are produced by pointing a reader at a malformed fixture, never by mocking the reader.
- **E2E specs and blessed visual baselines are re-baselined** against the new oracle. The old Atelier baselines and the stale 9/10-tab e2e specs do not carry over. A self-baseline may exist only as a regression guard after the oracle check has passed.
- **Component and copy cost.** Recorded selectors must resolve in the build, so ids, class names and `data-*` / `aria-*` hooks are kept even when styling is done with utilities. Copy is loaded verbatim from the catalogue. The drawn departures from the prototype's own rules (mono dialog eyebrows, table-head tracking, hues outside their meaning, sub-44px controls) bind as drawn and are not corrected in the build; changing them is a later prototype round.
- **History is preserved.** The Atelier prototype and artefacts stay in git history and in `docs/design/archive/prototype-v1/`. The Atelier entries in `design-decisions.md` are marked superseded, not deleted.
- **Accepted trade-offs.** The oversized brand PNG ships unoptimised. Dependency-map layout must be ported from the prototype rather than re-derived, to stay inside the pixel budget. The gate is heavier and slower than a self-baseline check, in exchange for fidelity to an independent oracle rather than to the build's own earlier output.

## Alternatives considered

- **Restyle Atelier incrementally.** Map the new look onto the existing tokens and components screen by screen. Rejected: the two systems differ in identity, not in a few values (neutral chrome with meaning-only hue instead of a warm-dark canvas with one accent; Space Grotesk, Inter and JetBrains Mono instead of Pixelify Sans; a persistent sidebar instead of top navigation; no Party tab). An incremental path leaves two token vocabularies and two visual dialects in one app for the whole transition, which is the cohesion defect DR-062 forbids, and it could not meet an exact-value fidelity target.
- **Keep the old visual gate.** Continue comparing the build with its own blessed baselines. Rejected: that gate proves consistency with itself, not fidelity to the approved design, which is the failure mode recorded in the 2026-06-22 fidelity pass and in factory memory ("Fallo de fidelidad de diseño en MC"). With an owner-approved prototype available, DR-054 and DR-129 call for the live prototype as the reference.
- **Run the gate against the owner's real factory data.** Rejected: the repository is public and the owner's data is private. A fictional fixture is reproducible, byte-stable under a frozen clock and safe to commit.
- **Redraw the brand mark as a vector.** Rejected by the owner at M2 (decision 4) in favour of the existing emblem.

Canonical contracts: [DESIGN.md](../../DESIGN.md), [design decisions](../design/design-decisions.md), [fidelity checklist](../design/fidelity-checklist.md), [technical assumptions](../design/technical-assumptions.md), [M1/M2 owner decisions](../design/freeze/m1-decisions.md), [platform architecture](../product/architecture.md).
