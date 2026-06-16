# WO-08-002 — Manual page shell: side menu (Diátaxis) + reader

Source-of-truth: `FRD > FDD > design-tokens > blueprint > work order`.
Blueprint: [`CMP-08-manual-page`, `CMP-08-doc-nav`, `CMP-08-doc-reader`](../blueprint.md#5-components--interfaces).

## Goal
Build `app/manual/page.tsx` (Server Component): a side menu of pages grouped by Diátaxis quadrant
(Empezar aquí · Guías · Referencia · Conceptos) and a reading area that renders the selected page.
Architecture §11 surface `app/manual`.

## Acceptance criteria (EARS, from FRD-08)
- **AC-08-002.1** — The Manual SHALL offer a side menu with pages and a reading area that renders each page.
- **AC-08-002.2** — The side menu SHALL group pages by the four Diátaxis quadrants (Empezar aquí / Guías / Referencia / Conceptos), built from `readManualPages()` plus the four Reference catalog entries.
- **AC-08-002.3** — Selecting a page SHALL render it in the reading area (authored markdown via `react-markdown`, or a Reference catalog view).
- **AC-08-002.4** — The shell SHALL use FRD-13 tokens (rationed accent on the active page), Spanish labels/`aria-label`s, keyboard navigation and a visible focus ring (FRD-13 a11y).

## Dependencies
- WO-08-001 (`readManualPages()`). Intra-feature.
- FRD-13 tokens, `react-markdown` (architecture §2). Cross-feature.

## TDD plan
1. RED: `app/manual/page.test.tsx` — side menu with 4 groups, select→render, a11y (roles/labels), tokens.
2. GREEN: implement shell + nav + reader.
3. Refactor: share a `SideMenu` primitive if it overlaps with FRD-04/07.

## Definition of done
- Component tests green; tsc + biome clean; tokens only; Spanish labels. `.pandacorp/verify.sh` passes.
</content>
