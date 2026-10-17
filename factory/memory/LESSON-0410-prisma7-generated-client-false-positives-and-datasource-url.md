---
id: LESSON-0410
type: gotcha
domain: data-layer
tags: [prisma, prisma7, codegen, verify-sh, madge, import-cycles, dotenv]
context: adopting Prisma 7's `prisma-client` generator in a project whose verify.sh gate greps for data-layer violations and runs madge for import cycles
trigger: use this when wiring up Prisma 7 (prisma-client generator) in a new project, or when verify.sh's data-layer grep or madge import-cycle check turns RED right after a `prisma generate` with no app-code change
source: "pandasaga .pandacorp/run/lessons.md 2026-10-15 (agent-inferred): Prisma 7 prisma-client generated output contains the literal `new PrismaClient(` in JSDoc and ~40 import cycles; generating into src/ turns verify.sh's data-layer grep (which ignores .gitignore) and madge RED. Generate to repo-root generated/prisma/ with an @generated/* alias. Also 7.10.0 hard-errors on `url` in the schema datasource (URLs live in prisma.config.ts, which must load .env itself)."
provenance: agent-inferred
created: 2026-10-17
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** Prisma 7's `prisma-client` generator was pointed at an output directory inside `src/`.
Its generated output's own JSDoc comments literally contain the string `new PrismaClient(` (used as
documentation/example text), which trips a `verify.sh` data-layer grep rule designed to catch
hand-written direct-instantiation violations elsewhere in app code — the grep scans files regardless of
`.gitignore`, so generated output is not exempt just because it's typically ignored. The same generated
output also produces roughly 40 import cycles among its own internal modules, which `madge`'s
cycle-detection check flags as RED. Separately, Prisma 7.10.0 hard-errors if the schema's `datasource`
block still declares a `url` — in this version the connection URL must live in `prisma.config.ts`
instead, and that config file must load `.env` itself (no longer automatic).

**Lesson:** Prisma 7's generated client is not safe to generate directly into a project's own `src/`
tree if any gate (grep-based data-layer checks, madge cycle detection) scans source regardless of
`.gitignore` — the generated code's internal JSDoc examples and its own internal cyclic module structure
will both read as violations of rules meant for hand-written code. The schema-level `url` field is also no
longer valid at this version; it hard-errors rather than warns.

**Apply next time:** generate Prisma 7's client to a repo-root directory OUTSIDE `src/` (e.g.
`generated/prisma/`) and import it via a dedicated path alias (e.g. `@generated/*`) rather than a relative
path into `src/` — this keeps generated code out of grep/madge scans that are scoped to `src/` and avoids
re-litigating cyclic-import rules against code you don't maintain. Set the connection string in
`prisma.config.ts` (loading `.env` explicitly inside that file) rather than in the schema's `datasource`
block, for Prisma ≥7.10.0.
