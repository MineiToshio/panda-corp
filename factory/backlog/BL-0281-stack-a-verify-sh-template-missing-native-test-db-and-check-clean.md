---
id: BL-0281
type: bug
area: templates
title: "stack-a-nextjs verify.sh template has zero native-test-DB/INFRA-9/10 wiring (no db:test:up, no TEST_DATABASE_URL injection, no db:test:check-clean call)"
status: open
severity: p1
opened: 2026-10-25
closed:
source: "funko-tracker .pandacorp/run/lessons.md 2026-10 (agent-inferred): 'la regla DR-140 pide db:test:check-clean en verify.sh pero la plantilla de verify.sh de la fábrica no lo llama'; confirmed live: `grep -n 'db:test\\|DATABASE_URL\\|TEST_DATABASE_URL' plugin/templates/stack-a-nextjs/verify.sh` returns zero matches"
closes:
links: [DR-140, "factory/standards/infra.md"]
---

## Problem
`factory/standards/infra.md` INFRA-9/INFRA-10 (DR-140, shipped 2026-10-24, commit `9b431c32`) mandates
that every project's `verify.sh` gate: (a) stands up/tears down a native local Postgres via
`pnpm db:test:up`/`db:test:down`, (b) injects `TEST_DATABASE_URL` (mapped to `DATABASE_URL` only inside
the test command) for every DB-backed suite, and (c) runs `pnpm db:test:check-clean` AFTER the DB-backed
suites and **fails the gate** if it finds leftover non-template test databases or non-empty template
tables. The canonical `verify.sh` template for stack A
(`plugin/templates/stack-a-nextjs/verify.sh`) has NONE of this — a repo-wide grep for
`db:test`/`DATABASE_URL`/`TEST_DATABASE_URL` in that file returns zero matches. Every project scaffolded
or upgraded onto stack A after DR-140 shipped still has to hand-roll this wiring itself (as funko-tracker
did, ad hoc, the same day DR-140 landed) instead of receiving it from the template — the standard and the
template it is supposed to govern have drifted apart on day one.

## Root cause
DR-140 (commit `9b431c32`) updated `factory/standards/infra.md`, the architecture skill's
`environment-delivery.md` reference, and several `STACK.md` files, but did not touch
`plugin/templates/stack-a-nextjs/verify.sh` itself — the MUST-level gate behavior the standard describes
was never propagated into the actual generated gate script.

## Fix plan
1. Add to `plugin/templates/stack-a-nextjs/verify.sh`: before the DB-backed suites, ensure the native test
   Postgres is up (`pnpm db:test:up`, idempotent) and export `TEST_DATABASE_URL`/`DATABASE_URL` scoped to
   the test command only (per INFRA-9's "fails loud before connecting if the URL resolves to a
   non-loopback host" requirement).
2. After the DB-backed suites (vitest, any e2e/Playwright suite that touches the DB) run
   `pnpm db:test:check-clean` and treat a non-zero exit as a gate failure (INFRA-10), same severity as any
   other sub-gate.
3. Check whether `architecture`'s generated `package.json` script stubs (`db:test:up`, `db:test:down`,
   `db:test:check-clean`) are already wired for new projects (per the DR-140 diff touching
   `environment-delivery.md`/`stack-install.md`) — if so, just call them from `verify.sh`; if the
   per-project scripts are themselves missing a canonical implementation, that is `architecture`'s own gap
   and may need its own linked item.
4. Bump plugin PATCH + `OVERLAY_VERSION`; regenerate manifests; note in `plugin/docs/decision-log.md`
   (small drift-fix entry, not a new DR).

## Tests (prove the fix — TDD, RED → GREEN)
- A template-conformance/doc-lint style check (or a new one) that asserts `plugin/templates/stack-a-nextjs/verify.sh`
  contains calls to `db:test:up`/`db:test:down`/`db:test:check-clean` — RED on the current file, GREEN
  after the fix.
- `/pandacorp:upgrade` dry-run against a stack-A project without this wiring should flag the drift once
  the template is fixed (conformance diff).

## Done when
- [ ] `plugin/templates/stack-a-nextjs/verify.sh` stands up the native test DB, injects
      `TEST_DATABASE_URL`/`DATABASE_URL` scoped to the test command, and calls `db:test:check-clean` after
      DB-backed suites, failing the gate on any residue.
- [ ] A conformance/doc-lint test asserts this wiring is present; it is RED before the fix and GREEN after.
- [ ] Plugin version bumped and manifests regenerated; decision log entry recorded.

## Out of scope
Stack B/C templates (Hono/FastAPI) — file a sibling item if/when they are audited against DR-140
separately. Retrofitting already-scaffolded projects (that is `/pandacorp:upgrade`'s normal conformance
flow once the template is fixed, not this item).
