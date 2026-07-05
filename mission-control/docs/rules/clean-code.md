---
description: Clean-code & maintainability — file/function size, complexity, SRP/SoC, DRY, dead code, purity, module boundaries, AI-legibility.
applies_when: always
globs: ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx", "**/*.py"]
source: Pandacorp standard — quality + conventions
---

# Clean code & maintainability

Small, single-purpose, predictable units that fit in one mental (or context) window — readable by humans and agents. Mechanical rules (complexity caps, max params, parameter mutation, import cycles, barrel files, unused code…) are enforced by the canonical `biome.json` + `verify.sh` (knip, madge) — not repeated here; fix the gate's message, don't argue with it.

## Size & shape
- **File ≤ ~300 lines** (soft); never exceed **~500** — split. **Function ≤ ~50 lines** (most are 10–40).
- Nesting ≤ 4; prefer **guard clauses / early returns** over `if/else` pyramids.
- No boolean-trap params (`doThing(x, true)`) — split the function or pass a named option/enum.
- Change sets do one thing; ship refactors in a separate change from behavior changes.

## Single responsibility & DRY
- One reason to change per module/function/component — if you can't name what it does without "and", split it.
- UI ≠ business logic ≠ data access (the data layer is isolated — see `project-structure`).
- **Rule of three**: don't abstract before the third occurrence; tolerate the second copy. Duplication is cheaper than the wrong abstraction.

## Reuse before creating (DR-057)
- Check the component inventory `docs/design/components.md` before creating ANY UI component: **reuse** → **adapt/extend** (a small difference is a variant/prop, not a fork) → **create new only if none fits**, then append its row.
- A near-duplicate component is a defect, rejected at review — the shared inventory is how parallel agents stay coherent.

## Single source of truth — one writer per fact (DR-115; UI instance DR-092)
- Every fact (a count, a status, a level, a rollup, a config value) has ONE authoritative home and ONE writer; everyone else DERIVES. Applies to code, DB schemas, JSON/YAML artifacts, documents and UI alike.
- Compute a shared derived value ONCE — one cached resolver (`React.cache()`/request-scoped function or one query module) — and every surface reads THAT. A second independent derivation of the same value is a defect (the copies drift). Verified at review.
- A STORED derived value is legitimate only as an **honest cache**: single named writer, re-derived from the atomic source at defined safe points (never maintained by scattered `+1/-1` writes), documented as a replica at the field itself, and never read by a display surface while a live resolver exists.
- Forbidden: increment-maintained counters; reader mappings of fields nothing writes (dead fields rendered as truth); docs/docstrings claiming a different source than the code reads; silent fallback from the live source to a stale copy.
- When retiring a stale copy, also REMOVE the field from reader types/mappings — enforcement by construction beats a lint rule.

## Purity & boundaries
- No commented-out code — delete it; git is the history.
- Default to pure functions and immutable data; isolate side effects (I/O, network, mutation) at the edges; mark intent-immutable data `readonly`.
- Dependencies point one way: UI → domain → data, never back.

## Made for agents (and humans)
- Every exported function/module/type carries a short JSDoc (purpose · params · return); internal helpers may omit it.
- Follow the established pattern for a given task; explicit over clever — the same intent looks the same everywhere, so an agent can pattern-match and extend safely.
