# AI implementation discipline

> Domain: Programming · Severity: **MUST** · Enforcement: knip/Biome (dead code, wired) + DR-102 grounding gate + `reviewer` quality lens + doc-lint (advisory). Operative form: `rules/ai-implementation.md` (DR-051).

How AI agents write code in this factory — the failure modes specific to LLM-generated code that the general conventions don't name.

## Rule — comments never narrate
- Comments explain **why / invariants** ([conventions.md](conventions.md) owns the base rule). Additionally forbidden, because agents produce them by default: **diff narration** (`// changed X to Y`, `// added per review`), references to **the conversation, ticket or work order** in code, and **tutorial comments** that restate what the line obviously does. If a comment restates the code, delete it.

## Rule — in-code documentation stays in its lane
- **No doc files inside `src/`** and **no parallel doc trees** (`NOTES.md`, `IMPLEMENTATION.md`, `ARCHITECTURE.md`, `CHANGES.md` sprinkled next to code). Product/technical docs live in `docs/` per the FRD skeleton ([structure.md](structure.md)) — a second tree WILL drift and clash with the FRD/PRD/DESIGN canon ([documentation.md](documentation.md)).
- A package **README only when setup is non-obvious**; JSDoc per the clean-code rule (short, on the exported surface, never narrating the obvious).

## Rule — no dead code, no speculation
- **No dead or commented-out code, ever** — git is the archive (wired: knip + Biome, QUAL-2). No speculative abstractions or "future-proofing" params — **rule of three** (`rules/clean-code.md` owns both; restated here because agents default to leaving the old path "just in case").

## Rule — ground against the INSTALLED version
- **Verify framework APIs/conventions against the installed version, not training memory**: check `package.json` and the version-matched docs (the `AGENTS.md` pointer, DR-102) before citing an API, config key or file convention. A remembered API is a hypothesis, not a fact.

## Rule — cite the memory you apply
- When a factory memory lesson shapes an implementation choice, **cite its `LESSON-NNNN` id** in the commit message or the work order's Status-Note — citations are how retrieval is measured (DR-047, `applied_in` tracking).

## How it is verified
- **Dead/commented-out code**: knip + Biome in `verify.sh` (wired, QUAL-2).
- **Comment/doc-tree discipline, speculative abstractions**: `reviewer` quality lens (review-only); stray doc files in `src/` also surface via the structure review (STRUCT-1).
- **Installed-version fidelity**: the DR-102 repo-grounding gate (architecture step 9b + `/implement` preflight — named fresh-reviewer step).
- **Lesson citations**: counted by the memory status script (`/pandacorp:memory` status — named step).

## Why
These are the systematic defects of LLM-written code: narrated diffs, parallel doc trees, kept-just-in-case dead paths, and confidently-remembered outdated APIs. Naming them as rules turns the reviewer's vague "AI smell" into concrete, blockable findings.
