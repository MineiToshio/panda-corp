# Architecture: Fixture

## Golden path & stack

Stack A.

### Pinned versions

| Package | Version |
|---|---|
| next | 16.0.0 |

## Route map

| Path | Access | FRD | Notes |
|---|---|---|---|
| `/` | public | 01 | home |
| `/lista` | private | 01, 02 | the list |
| `/oracle/*` | gate builds only | all | ADR-0001 |
| `/api/health` | public | platform | uptime |

## Cross-cutting concerns

Nothing here.
