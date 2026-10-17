# Órbita round 3 — real project journeys

Date: 2026-10-17. Status: **reviewable design iteration**, not a final design freeze or production implementation.

## Owner request and resulting composition

The owner likes the visual direction and asks to see the final-looking project content: complete Spec, Architecture, documents and work orders from both Board detail and Portfolio, with an improved project selector. The same review URL is retained: `http://127.0.0.1:1988/preview.html`.

The updated prototype:

- Opens PandaSaga Architecture by default for this review round.
- Uses one shared implementation of Spec, Architecture and project documents in Board and Portfolio.
- Replaces the illustrative native project select with a searchable, labelled project dialog. Each choice shows phase, document/FRD counts and actual work-order progress. Selection changes all project content while retaining the current section.
- Shows full structured PRD/research blocks and all FRD contracts/design/blueprint links.
- Shows the real architecture stack/rationale, operational integrations, actual model, environment variable names, ADRs and per-FRD implementation plans/documents.
- Provides all captured document bodies, searchable index, full work-order documents and FRD/state filters. Relative Markdown document links stay within the corresponding project.
- Shows real change queues, activity, decisions, command catalog and structural timeline information in the remaining workspace sections. Party artwork remains an illustrative scene with the captured active/paused status, not a live feed.
- Uses 38 real Manual pages. Ancillary configuration/guild/proposals examples remain the previous illustrative composition; this iteration does not claim a complete production state oracle for those separate surfaces.
- Keeps schema entities collapsed with at most one open; the diagram contains every captured entity/attribute/relationship and supports selection, zoom/reset and expansion. Its geometry is prototype-native, not a replacement for the production graph engine.

## Private source snapshot

Generated with the existing Mission Control readers by `scripts/export-snapshot.mjs`, with no source-project writes. Exported data is ignored under `data/`. Counts at the recorded capture time:

| Project | Full documents | Work orders | FRDs |
|---|---:|---:|---:|
| Mission Control | 331 | 110 | 25 |
| PandaSaga | 165 | 35 | 7 |
| Funko Tracker | 54 | 0 | 8 |
| PandaCast | 58 | 0 | 4 |
| PersonalPage v2 | 110 | 25 | 8 |
| Total | 718 | 170 | 52 |

Additional captured surfaces: 22 ideas, 23 ADRs, 43 changes, 2 decisions, 81 activity entries and 38 Manual pages. PandaSaga's approved logical artifact provides **39 entities and 95 relationships**. The capture explicitly records absent digests/models; the interface never fabricates those sources. Data is a timestamped snapshot, not a claim of current live state.

Markdown uses the installed React Markdown/GFM renderer with raw HTML disabled. YAML frontmatter remains intact in the raw text and is rendered in escaped, collapsed metadata details. Only environment variable names are exported; no environment values. The ~28.8 MB private snapshot is for local design review, not a production data delivery recommendation.

## Deterministic verification

Local evidence is under ignored `evidence/` because it contains real owner project content.

- **Canonical round preflight: CLEAN**, browser ran. Evidence: `round3-preflight.json`. Covers font/token/literal/hover/motion/demo and default-page browser checks. Dynamic project states are covered by the dedicated matrix below; this default-page preflight is not misrepresented as that whole matrix.
- **90 responsive/accessibility states:** `round3-matrix.json`. The three primary projects' Spec/Architecture/Work orders/Documents at 375/768/1280 px in both themes, plus all nine sections for PandaCast and PersonalPage at desktop. Zero document overflow, zero axe WCAG-tag violations, exactly one H1 and no captured JavaScript errors.
- **14 direct flow assertions:** `round3-flows.json`. Board → actual PandaSaga architecture/Spec/contract; shared architecture equality with Portfolio; searchable project switch; all 35 PandaSaga WOs/detail/full document; each project's complete document-tree count and full PRD text match; all 39 schema entities with one expanded at a time; relationship selection clearing; phone document-index search. Zero captured errors; final audited phone state has zero axe violations.
- **Eight targeted final rechecks:** `round3-final.json`. Real Architecture/Documents at 320/375/768/1280 px after metadata/model refinements. Zero overflow or axe violations. All measured model-node rectangles are nonoverlapping. Also checks review-frame device switch, filtered project selection and theme propagation.
- JavaScript syntax and local source links/assets checked. The HTML is built deterministically from `prototype.template.html`, `base.css`, `prototype.css` and `prototype.js` using `scripts/build-prototype.mjs`.

The browser preflight uses the installed explicit `playwright-core/index.mjs` module path. Initial directory/default resolution was unavailable, so that incomplete run was not accepted as a pass. Genuine token/font findings were fixed in this round; no check was modified or bypassed.

## Independent review

A fresh STANDARD-or-higher reviewer, separate from the author/exporter, independently exercised:

- All five project choices and the filtered phone dialog.
- Board → PandaSaga → Spec/Architecture → Portfolio.
- **All 718 documents**, comparing exact selected paths and full rendered text against the exported source.
- **All 170 work orders**, opening full document text and comparing it to the exported source.
- **All 38 existing FRD → work-order filtered routes.**
- Relative document links, unsupported local-file messages and external-link handling.
- 375/768/1280 px smoke, without page overflow or runtime errors.

Verdict: **no actionable blockers within the requested project-journey scope**. The report is `evidence/round3-review.md`. This is a scoped mockup review, not production qualification or final fidelity certification.

## Boundaries retained

No actual application source, reader, action, public routing contract, production token or build state was edited. The app at port 1987 is independent. Existing production PRD/FRDs and DESIGN contract remain binding until a later approved re-anchor. No phase advance, executor run, production release or external publication occurs. The owner can continue iterating this direction.
