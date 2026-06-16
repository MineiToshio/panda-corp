# WO-01-000 — Test fixtures + `PANDACORP_FACTORY_ROOT` harness

**Module:** `tests/fixtures/factory/**` (+ a small `tests/fixtures/index.ts` helper)
**IDs touched:** enables all of FRD-01 (`CMP-01-*`, `IF-01-*`); REQ-01-002..010
**Dependencies:** none (this is the root WO of the batch)

## Goal

Build a deterministic **fixture factory tree** that mirrors architecture §4, so every reader can be
tested in isolation by setting `PANDACORP_FACTORY_ROOT` to a fixture path. No reader is testable
without this; it lands first.

## What to create

A fixture tree (under `tests/fixtures/`) covering the happy path AND the tolerance cases:

```
tests/fixtures/
  factory-full/                  # personalized factory, with projects
    factory/profile.md           # name, goals, interests, assets, projects_path
    factory/ideas/
      idea-discovered.md         # status: discovered, full frontmatter + body
      idea-recommended.md        # status: recommended
      idea-in-pipeline.md        # status: in-pipeline, project: "../proj-a"
      idea-shipped.md            # status: shipped
      idea-discarded.md          # status: discarded
      idea-malformed.md          # broken frontmatter (must be skipped, not fatal)
      _idea-template.md          # MUST be ignored
      decision-log.md            # MUST be ignored
    factory/portfolio.md         # table: full row + a row with missing repo + a broken-path row
    projects/proj-a/.pandacorp/status.yaml   # complete status
    projects/proj-a/docs/product/prd.md
    projects/proj-a/docs/product/architecture.md
    projects/proj-a/docs/frds/frd-01-x/frd.md (+ blueprint.md, work-orders/)
    projects/proj-a/docs/adr/ADR-0001-x.md
    projects/proj-a/docs/decision-log.md
    projects/proj-a/.pandacorp/comms/progress.md
    projects/proj-a/.pandacorp/inbox/decisions.md
    projects/proj-a/.pandacorp/inbox/bugs/bug-1.md
    projects/proj-b/.pandacorp/status.yaml   # MALFORMED yaml (tolerance)
  factory-fresh/                 # NO profile.md, empty ideas folder (onboarding-gate case)
    factory/ideas/               # empty
  events/
    dashboard-events.ndjson      # ~10 valid lines (with + without `project`) + 1 malformed line
    dashboard-events-empty.ndjson
```

A helper `tests/fixtures/index.ts` exposing absolute paths to each tree (e.g.
`FIXTURE_FULL`, `FIXTURE_FRESH`) and a `withFactoryRoot(path, fn)` that sets/restores
`PANDACORP_FACTORY_ROOT` around a test.

## Acceptance criteria (drives downstream WOs)

- **AC-01-000.1** — The fixture trees exist and are committed as static files (deterministic; no
  generation at test time beyond env swap).
- **AC-01-000.2** — `withFactoryRoot(FIXTURE_FULL, fn)` makes `resolveFactoryRoot()` (from
  `lib/config.ts`) resolve to the fixture, restoring the prior env afterward.
- **AC-01-000.3** — The fixtures include each tolerance case named above (malformed card, malformed
  yaml, missing repo, broken path, missing profile, empty ideas, malformed event line).

## Definition of done

- A `tests/fixtures/index.test.ts` proves AC-01-000.2 and that all fixture root paths exist.
- `.pandacorp/verify.sh` green (biome + tsc + vitest).
- No production code touched; fixtures only.
