# Shared Architecture preview

Status: round 1, awaiting owner visual review. This is a standalone mockup; it does not modify Mission Control's application or build state.

The owner revised the initial proposal: reuse the complete **Arquitectura** tab in the board and portfolio. The existing **Modelo de datos** section now contains the proposed ER viewer; there is no separate database tab. One DOM and one set of fixture data supply both navigation contexts.

## Open and rebuild

Open `index.html` directly, or serve its parent directory using a local static server. With the current preview server:

- Board context: `http://127.0.0.1:8769/data-model-viewer/?view=architecture&theme=dark`
- Portfolio context: `http://127.0.0.1:8769/data-model-viewer/?view=portfolio&theme=dark`

`view=database` remains a compatibility alias for the portfolio context, not a visible database tab. `theme=light`, `demo=off`, and `state=loading|missing|none|error` are supported. DEMO controls are preview controls only. Unrelated app tabs/project rows are static context, not implemented navigation.

Build from `template.html` and keyed `copy.es.json`:

```sh
node mission-control/docs/design/prototype/data-model-viewer/build.mjs
```

Missing copy keys and product-copy em dashes fail the build. Self-hosted Space Grotesk, Pixelify Sans and JetBrains Mono include their OFL licenses under `fonts/`. The logo is copied from the existing approved Mission Control asset.

## Review interactions

Select a table to highlight its neighbors, select a relationship to read its cardinalities, search a table or attribute, switch diagram/list, zoom, or expand the diagram. Escape closes the expanded view and returns focus. The model opens at readable 100%; optional fit-to-view gives an overview. Mobile defaults to a complete textual list. The six-entity Colección schema is illustrative and does not represent a real project or verified implementation.

The shared architecture also includes its hero, stack matrix, services, environment-variable names, ADR disclosures, dependency-plan summary and per-FRD cards.

Verification and screenshots: [round evidence](../../verification/data-model-viewer/a11y-report.md). Visual approval, dense-model engineering, package integration, FRD/FDD freeze and actual app implementation remain subsequent work.
