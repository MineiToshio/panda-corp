# Shared Architecture mockup — round 1 verification

Date: 2026-10-16. Scope: standalone design preview only.

Artifact: `docs/design/prototype/data-model-viewer/index.html`

SHA-256: `d9666e7febc8d0633b8334218f1d102925fc78f4674d6a68706d9cb31370af35`.

| Script | Observed result |
|---|---|
| Factory `preflight-round.mjs` with installed Playwright | Complete, CLEAN; no fail/warn findings |
| `check-round.mjs` | 16 cases: board/portfolio × dark/light × 320/375/768/1280px; zero axe violations, document overflow, runtime errors, missing asset responses, undersized visible controls or demo leaks |
| `check-interactions.mjs` | 10 flows: both contexts, table/neighbors, optional relation, attribute search, list filtering/clear, zoom, expanded-dialog axe and Escape/focus, navigation without DEMO, and four unavailable states per context; zero runtime errors |
| Independent `reviewer/probe.cjs` | Final stable-hash regression green; actual rendered text ≥12px, all ten relationship endpoints align with mapped field rows, neighbors/links highlighted, unavailable states exclude ready-only facts |

The initial rendered review found unreadable auto-fit, incorrect field-row endpoints, missing neighbor highlighting and contradictory ready-state facts. These were corrected and independently rechecked. The first matrix also found a narrow clear-search button and an inappropriate nested complementary landmark; both were fixed. Phone inspection found split technology names in the stack matrix, corrected with a non-wrapping technology column.

Evidence: [matrix.json](matrix.json), [interactions.json](interactions.json), [preflight.json](preflight.json), [independent review](reviewer/review.md), and [screenshots](screenshots/). Full-page phone captures cover both contexts at 320 and 375px in each theme; the phone contact sheets and focused viewport capture accompany them. Desktop full-page and expanded-model captures are included. The live application's portfolio reference was captured before authoring and retained in the gitignored communication layer, to anchor the shell to the actual app rather than the historical prototype's old behavior.

The reviewer report records its own bounded scope. This does not certify real project artifact ingestion, dense-model performance, live schema verification or production accessibility. Optional manual fit-to-view intentionally permits an overview below reading scale; the initial diagram and mobile textual view remain readable. No project phase, work-order state or app source was changed. Owner visual approval remains pending.
