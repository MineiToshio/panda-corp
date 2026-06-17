# Build orchestration standard (DR-050)

How the factory plans, tracks and runs a build. The orchestration is **driven by the documents** —
state and plans live in structured data the build engine reads, not in the engine's runtime
inference, not in git, not in body prose. Recovered and systematized from PandaTrack; see
`docs/proposals/11-build-orchestration-v2.md`.

## 1. State lives in the frontmatter (two axes)

Every FRD, blueprint and work order carries two state fields in its YAML frontmatter. The PRD carries
only `status`.

- **`status`** — document lifecycle: `DRAFT → ACTIVE → BLOCKED → SUPERSEDED`. Answers "is this doc the
  current approved source of truth?" A shipped feature can still be `ACTIVE`.
- **`implementation_status`** — the build Kanban, and **the build engine's single source of truth**:

| Value | Meaning | Engine behavior |
|---|---|---|
| `PLANNED` | not built yet | available to build |
| `IN_PROGRESS` | build started | resume it, don't restart |
| `IN_REVIEW` | built, its own tests green, awaiting the FRD review/test gate | not rebuilt; waiting on its FRD |
| `VERIFIED` | FRD review + suite green | **never rebuilt** |
| `BLOCKED` | stuck; needs an owner decision | skipped; surfaced to the owner |

**Rules:** the engine builds only `PLANNED`/`IN_PROGRESS` and never rebuilds `VERIFIED`. Never
hand-set `VERIFIED` without the FRD gate passing. Changing this field **is** the instruction to the
build — `iterate`/`new-version` reopen a work order by setting it back to `PLANNED`. An FRD's/blueprint's
`implementation_status` **rolls up** from its work orders (the worst non-`VERIFIED` state; `VERIFIED`
only when all are). `.pandacorp/status.yaml` replicates the per-status counts for Mission Control.

## 2. Coarse work orders

A work order is **one cohesive view / page / capability** (e.g. "order detail view + payments panel +
action menu"), NOT one atomic component. Enough context for an agent to build the slice end-to-end;
small enough to review on its own. Typically a handful per FRD — not dozens of tiny ones. Atomic
work orders multiply the per-slice overhead and were a primary cause of slow, expensive builds.

## 3. The Build Plan lives in the blueprint (per FRD)

Each per-FRD `blueprint.md` MUST include a **Build Plan**: the DAG of that FRD's work orders — order,
dependencies (intra- and cross-FRD), what runs in parallel, and the integration order. Written once,
at architecture time. **The engine reads it; it does not re-infer dependencies at runtime.** This is
what makes the build fast (no repeated planning agent) and the integration correct (a consumer is
never built before its provider).

## 4. Hand-off (`## Status Note`)

When a work order closes it writes a hand-off in its `## Status Note`: what it built, the
interfaces/contracts it exposes (names + signatures), the integration seams, and which tests cover
it. The next agent reads the hand-off instead of re-reading all the prior code.

## 5. Test per FRD, not per work order

The build engine reviews and tests **per FRD**, not per work order:

- Building a work order runs only **its own fast self-test** (its tests + tsc) → marks it `IN_REVIEW`.
- When all of an FRD's work orders are `IN_REVIEW`, run **one review + test pass over the whole FRD**,
  which also exercises the work orders **together** (real integration). On pass → every work order +
  the FRD become `VERIFIED`.
- **Three test layers** at the FRD gate: (1) unit/component (per WO during build); (2) integration +
  adversarial review across the feature; (3) **functional/browser** (start the app and drive the real
  flows with the preview tools) — designed in, **opt-in per project** (default off; on for critical web
  flows). This moves review cost from O(work orders) to O(FRDs).

## 6. Templates

The standard is embodied in `${CLAUDE_PLUGIN_ROOT}/templates/docs/`: `prd-template.md`,
`frd-template.md`, `blueprint-template.md` (with the Build Plan), `work-order-template.md` (with the
Status Note). The product-phase skills (`spec`/`blueprint`/`work-orders`) generate from these; the
build engine (`implement`) consumes them; `iterate`/`new-version` reopen work orders through them.
