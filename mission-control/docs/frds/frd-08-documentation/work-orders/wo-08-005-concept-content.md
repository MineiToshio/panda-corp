# WO-08-005 — Tutorial/Guides/Concepts content (+ DR-049 structure page)

Source-of-truth: `FRD > FDD > design-tokens > blueprint > work order`.
Blueprint: [`CMP-08-concept-pages`](../blueprint.md#5-components--interfaces) + [§3 pages](../blueprint.md#3-where-the-hand-authored-pages-live-diátaxis).

## Goal
Author the hand-written Manual pages (Tutorial / Guides / Concepts) as `content/manual/**`
MDX/markdown, sufficient for a no-context reader (including a handoff to another person) to
understand and operate the factory. Includes the page describing the **feature-centric (DR-049)**
project documentation structure.

## Acceptance criteria (EARS, from FRD-08)
- **AC-08-005.1** — The authored pages SHALL cover, at minimum: what Pandacorp is, the flow, the stages in detail, the commands, the implementation modes, the standards, and how to operate / hand off to another person.
- **AC-08-005.2** — The content SHALL be sufficient for someone with no prior context to understand how the factory works and how to operate it (Diátaxis: a Tutorial entry point + How-to guides + Concepts).
- **AC-08-005.3** — WHERE a Concept/Guide page describes a project's documentation structure, it SHALL reflect the **feature-centric** DR-049 layout (`docs/product/`, per-feature `docs/frds/frd-NN-<slug>/` with on-demand `fdd.md`/`blueprint.md`/`mocks/`/`work-orders/`, global `docs/{adr,analytics,reviews,decision-log.md}`), the ID spine (`REQ-NN-MMM → AC-NN-MMM.K → CMP/IF-NN → WO-NN-MMM`) and the hierarchy `FRD > FDD > design-tokens > blueprint > work order` — NOT the old by-type layout (flat `docs/frds/`, global `docs/blueprint.md`, global `docs/work-orders/`).
- **AC-08-005.4** — These pages SHALL be hand-authored content (not derived), kept in sync by the documentation discipline (DR-046); they SHALL render via the reader (WO-08-002) and may embed `CopyButton` command chips.

## Dependencies
- WO-08-001 (`readManualPages()`), WO-08-002 (reader). Intra-feature.
- FRD-02 `CopyButton` for inline commands. Cross-feature.

## TDD plan
1. RED: a content-completeness test asserting each required page slug exists and is indexed; a structure-page test asserting it mentions the feature-centric tokens (`docs/frds/frd-NN-<slug>/`, `REQ-NN-MMM`, the hierarchy) and does NOT describe a global `docs/blueprint.md`/`docs/work-orders/`.
2. GREEN: author the pages.
3. Refactor / copy-edit pass.

## Definition of done
- Content-completeness + structure-page tests green; renders via the reader; tsc + biome clean.
- Spanish copy (i18n / authored). `.pandacorp/verify.sh` passes.
</content>
