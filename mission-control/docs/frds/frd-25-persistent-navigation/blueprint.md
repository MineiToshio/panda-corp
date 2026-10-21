# FRD-25 implementation blueprint

## Boundaries

`src/lib/navigation/urls.ts` is the single pure path/query codec. `useUrlState.ts` subscribes to browser history/popstate using `useSyncExternalStore`; the URL owns selection, with an SSR route seed provider for deep-link hydration. Client-owned selections use atomic native history transitions. Workspace/server-owned changes use Next navigation through the same href codec so data is re-resolved on the server.

Dynamic catch-all page adapters reuse existing page/component trees. They bound path/query sizes, reject repeated values and validate tab/tail grammar. Identity resolution remains server-only. Explicit unknown project/idea paths never fall back. Valid unpublished artifacts stay addressable with existing pending states. No filesystem access is moved into client bundles.

## Identity

See [ADR-0010](../../adr/ADR-0010-persistent-navigation-identity.md). `factory/navigation-identities.json` is an owner-private schemaVersion1 catalog, with separate idea/project resources: immutable ID, public slug, aliases, legacy names, locator and optional idea→project ID. The only writer is `scripts/navigation/identities.mjs` with `--dry-run`/`--apply`, a lock and atomic file replacement. Card `navigation_id` and project `.pandacorp/navigation-identity.json` are references. Missing-catalog legacy fallback is read-only for unregistered fixtures/initial migration; an existing malformed catalog or unregistered entity fails loudly. The unit-test harness (`vitest.setup.ts`, `src/test/ownerPrivateState.ts`) reads the running checkout's own factory root as catalog-absent, so the owner's private catalog never decides a test outcome; fixture roots still use the real reader. Producers register at lifecycle safe points; vault backs up the catalog. Public names are never recomputed after registration.

## State keys

Board: `idea`, `boardTab`, `doc`, `phase`, board search/category/discarded. Workspace: `project`, `tab`, `wo`, `wotab`, `doc`, WO FRD/state filters, changes detail/groups, observability view. Shared readers: `specFrd`, `architectureFrd`, `adr`. Model: `model`, `modelQuery`, `entity`, `relationship`, `expanded`, `schemaTable`. Global: `proposalsTab`, `backlogItem`, `stream`, `lesson`, expanded/status stream keys; `hallTab`, `trophyCategory`; `manualGroup`, `manualPage`, `reference`, `referenceItem`; `configSection`, `configItem`, `standardView`. Unknown optional query keys are retained for compatibility; unsupported selection values render bounded fallback/unavailable content. Each component validates against its actual source collection.

## Delivery slices and verification

[Work-order scope](work-orders.md) captures the manually authorized slices without modifying executor machine state. Tests cover codec round trips, identity allocation/collisions/move/aliases, history state and selection restoration, legacy context, and production-browser direct/reload/back/forward flows. The canonical verify gate and an independent adversarial review precede main push/internal deployment. No new dependency or external telemetry service is needed.
