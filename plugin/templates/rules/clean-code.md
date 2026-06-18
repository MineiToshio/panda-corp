---
description: Clean-code & maintainability — file/function size, complexity, SRP/SoC, DRY, dead code, purity, module boundaries, AI-legibility.
applies_when: always
globs: ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx", "**/*.py"]
source: Pandacorp standard — quality + conventions
---

# Clean code & maintainability

Optimized for code that is **readable, scalable, and easy for both humans and AI agents to work in**. Small, single-purpose, predictable units that fit in one mental (or context) window.

## Size limits
- **File ≤ ~300 lines** (soft warning); never exceed **~500** — split it. A file an agent can load whole is a file it can change safely. (Biome has no file-size rule → `verify.sh` guard / reviewer)
- **Function ≤ ~50 lines** (target); extract beyond. Most functions are 10–40 lines. (reviewer; backed by the complexity rule below)
- **Change sets do one thing**: keep a diff small and single-purpose; ship **refactors in a separate change from behavior changes** (never mix a rename/move with a feature).

## Complexity & nesting
- **Nesting depth ≤ 4.** Prefer **guard clauses / early returns** over deep `if/else` pyramids. (reviewer + the complexity rule)
- **Cognitive complexity capped** per function (warning); refactor above it. (Biome: `noExcessiveCognitiveComplexity`)

## Single responsibility & separation of concerns
- **One reason to change** per module/function/component. If you can't name what it does without "and", split it.
- Keep concerns separated: UI ≠ business logic ≠ data access (the data layer is already isolated — see `project-structure`).

## DRY — with the rule of three
- Reuse logic, types and utilities, not just components. But **don't abstract before the third occurrence** (rule of three): tolerate the second copy. **Duplication is cheaper than the wrong abstraction** — don't pre-abstract on speculation.

## Function signatures
- **≤ 3 parameters**; beyond that pass a single named **options object**. (Biome: `useMaxParams`)
- **No boolean-trap parameters** (`doThing(x, true)`): split the function or pass a named option/enum so the call site is self-documenting.

## Dead code & purity
- **No commented-out code, no unused exports/files/deps** — delete it; git is the history. (tool: `knip` in CI; Biome `noUnusedVariables`/`noUnusedImports`)
- **Default to pure functions and immutable data**; isolate side effects (I/O, network, mutation) at the edges; **never mutate inputs**. Mark intent-immutable data `readonly`. (Biome: `noParameterAssign`)

## Module boundaries
- **No circular dependencies**; dependencies point one way (UI → domain → data, never back). (Biome: `noImportCycles`)
- **No barrel files** (`index.ts` re-export hubs) for app code — import from the concrete module path (consistent with the "main file named after its folder, never `index.tsx`" rule in `project-structure`). Library public entry points are the only exception.

## Made for AI agents (and humans)
- **Document the public surface**: every exported function/module/type carries a short JSDoc (purpose · params · return). Internal helpers may omit it. (This complements "comments explain why" in `code-conventions` — that's the *why* inline; this is the *contract* on the boundary.)
- **Be consistent and explicit**: follow the established pattern for a given task across the codebase; prefer explicit over clever/implicit, so the same intent always looks the same and an agent can pattern-match and extend safely.
