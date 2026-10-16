# Independent mockup UX review

Date: 2026-10-16. Scope: navigable mockup only; no production code, build state, dependency selection, or implementation approval.

**Result: the four material findings from the first rendered pass are resolved in the targeted regression pass. No remaining blocker in this bounded review.** Owner visual approval remains pending.

Reviewed artifact SHA-256: `d9666e7febc8d0633b8334218f1d102925fc78f4674d6a68706d9cb31370af35` (`docs/design/prototype/data-model-viewer/index.html`). The probe requires the hash to remain unchanged during its run. The final targeted regression was repeated after the complete shared Architecture inventory and the bounded mobile stack nowrap adjustment; all existing assertions passed. Captured evidence was refreshed beside this report. No new audit scope was added.

## Independent evidence

Executed `node docs/design/verification/data-model-viewer/reviewer/probe.cjs` from `mission-control/` using installed Playwright Chromium. Inspected browser-rendered screenshots against the live portfolio reference captured locally before authoring (owner data, retained outside committed artifacts), read the approved concept proposal, and applied the owner's later steering: the portfolio has an **Arquitectura** tab and shares the Architecture content with the board; the model is one section inside that content. The probe's `database` query exercises the retained compatibility alias for the portfolio context; the unavailable-state probes use the current `portfolio` query.

| Initial observed issue | Targeted regression evidence | Result |
|---|---|---|
| Initial auto-fit reduced field text to 9.11px on the board and 6.72px in the portfolio | Both open at 100%; computed 12px field type × scale 1 = 12px rendered text. Canvas scrolls locally. `architecture-dark.png`, `database-dark.png` | Resolved |
| Declared mappings landed on the wrong attribute rows | All ten source/target endpoints lie within 1px of their corresponding rendered field row center. Probe assertions cover every declared mapping | Resolved |
| Selecting `users` emphasized no neighboring tables | Selection now marks exactly two neighbors, `collections` and `profiles`, and the related links; browser DOM result recorded | Resolved |
| `none` retained “6 tablas · 5 relaciones” and designed-model provenance | Missing, none, and error states expose zero visible ready-only count/provenance elements and retain distinct headings. `none-light.png` | Resolved |

The bounded interaction pass also observed search `avatar_url` selecting `profiles`, six complete list entities, modal focus opening on close, Tab entering the canvas, and Escape restoring focus to the expand button. At 390px the default is the textual list with 12px cells and no document horizontal overflow. No page errors occurred in the two desktop context passes. Light list and mobile screenshots are retained beside the report.

## Limits

This review covers the six-entity illustrative model and its mock interactions. It does not certify dense-model layout, real artifact parsing, live project switching, source reconciliation, package integration, or production accessibility. Those belong to implementation and its acceptance gates. Unrelated shell tabs/project rows remain static context in this focused mockup. Explicit fit-to-view may reduce the diagram text; it is an optional overview action rather than the initial reading scale.
