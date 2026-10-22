# Single source of truth — one writer per fact

> Domain: Engineering/Data · Severity: **MUST** · Enforcement: reviewer FRD gate (quality lens, DR-092/DR-115) + enforcement-by-construction (remove the readable stale path) + doc-lint (advisory schema-drift check). Operative form for products: `rules/clean-code.md` §Single source for derived state. Policy: DR-115 (general), DR-092 (UI resolver instance).

Every FACT the system knows — a count, a status, a level, a rollup, a config value — has exactly **one authoritative home and one writer**. Everyone else **derives**; nobody duplicates. Applies to code, database schemas, JSON/YAML artifacts, markdown documents and UI surfaces alike. A second independent derivation of the same fact is a **defect**, the same class as a duplicated component (DR-057): it compiles, it demos well, and it drifts.

## Rule

For any fact consumed by more than one surface, choose ONE of exactly two shapes:

1. **Derive-on-read (the default).** Readers compute the value from the atomic source at read time — through **one shared resolver** (a request-scoped `React.cache()` function, one query module, one script), never a private re-implementation per call site. If a resolver for the concept exists, calling it is the only permitted access; re-deriving is rejected at review.

2. **Honest cache (the exception, performance/ergonomics-justified).** A stored derived value is legitimate ONLY if ALL of:
   - it has **one named writer** (a specific engine step, gate, or skill — never "whoever remembers");
   - the writer **re-derives from the atomic source at defined safe points** — never maintains the value by scattered increments/decrements (`+1` on create, `-1` on archive: one missed path and the number lies forever);
   - the storage is **documented as a replica** at the field/file itself ("maintained by X, re-derived at Y");
   - **no display/UI surface reads it while a live resolver exists** — the replica serves humans glancing at a file and cross-runtime tooling, not rendering.

**Forbidden patterns** (each one found and removed in the 2026-07-05 audit, `docs/proposals/29-single-source-of-truth.md`):
- A second independent derivation of a value an existing resolver already provides (two "ideas alive" filters; a badge counting digest prose while the same card's DAG counts real files).
- A counter maintained by scattered increments instead of re-derivation (`pending_changes`).
- A reader mapping a stored field that **has no writer** — a dead field displayed as truth (`pending_bugs`, `progress`).
- Documentation claiming a different source than the code uses (a docstring saying "from status.yaml" over a live-derived prop).
- A silent fallback from the live source to a stale stored copy (fail loud instead — DR-078).

## The strongest enforcement is by construction

Before adding a lint or a review rule against a stale read, **remove the readable path**: delete the field from the reader's type/mapping so the compiler makes regression impossible. A rule needs a reviewer to catch violations; a type that no longer exists catches them itself. (There is no reliable generic linter for "a second semantic derivation" — do not pretend one; the layers that exist are the reviewer gate, the type system, and targeted schema checks.)

## Federated instances (this standard is the umbrella)

- **DR-092** — UI derived state lives in one cached resolver; second derivation rejected at review.
- **DR-050 §1** — work-order frontmatter is the atomic build state; FRD status is a derived rollup the engine re-derives at safe points (an honest cache, shape 2).
- **DR-087** — the dependency DAG reads `dependsOn` frontmatter verbatim; fabricated chains are forbidden.
- **DR-066** — liveness is derived by crossing `running` with heartbeat recency; the flag alone is never the fact.
- **DR-078** — a reader distinguishes "empty" from "unparseable"; fail-loud protects the derivation chain from silently consuming garbage.

## How it is verified

- **Reviewer FRD gate (MUST):** any new count/aggregate/status shown to a user must call the existing resolver for that concept, or create THE resolver and migrate all surfaces in the same change. Any stored derived value must name its writer and its re-derivation point, or it is rejected.
- **By construction:** when a stale stored copy is retired, the change that retires it also removes the field from reader types/mappings.
- **doc-lint (advisory):** `status.yaml` keys not present in the canonical template schema are flagged (catches "written but never declared" drift, the `last_harvest` class).

## Why

Mission Control showed three different work-order counts for the same project (live files vs a yaml replica vs an event-log reconstruction), an XP level fed by a stale cache, and a "pending bugs" badge wired to a field nothing had written for weeks. None of it failed a test — every surface was internally consistent with *its* source. The defect class is invisible to per-surface verification (constitution §24: green that only proves self-consistency); the only durable defenses are one resolver per fact and deleting the second path.
