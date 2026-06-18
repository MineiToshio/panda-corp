---
id: WO-08-005
type: work-order
slug: concept-content
title: WO-08-005 — Tutorial/Guides/Concepts content (+ DR-049 structure page)
status: DRAFT
parent: FRD-08
implementation_status: VERIFIED
source_requirements: []
last_updated: '2026-06-16'
---
# WO-08-005 — Tutorial/Guides/Concepts content (+ DR-049 structure page)

Source-of-truth: `FRD > FDD > design-tokens > blueprint > work order`.
Blueprint: [`CMP-08-concept-pages`](../blueprint.md#5-components--interfaces) + [§3 pages](../blueprint.md#3-where-the-hand-authored-pages-live-diátaxis).

## Goal
Author the hand-written Manual pages (Tutorial / Guides / Concepts) as `content/manual/**`
MDX/markdown, sufficient for a no-context reader (including a handoff to another person) to
understand and operate the factory. Includes the page describing the **feature-centric (DR-049)**
project documentation structure.

## Acceptance criteria (EARS, from FRD-08)
- **AC-08-005.1** — The authored pages SHALL cover, at minimum: what Pandacorp is, the flow, the stages in detail, the commands, the implementation modes, the standards, and how to operate / hand off to another person.
- **AC-08-005.2** — The content SHALL be sufficient for someone with no prior context to understand how the factory works and how to operate it (Diátaxis: a Tutorial entry point + How-to guides + Concepts).
- **AC-08-005.3** — WHERE a Concept/Guide page describes a project's documentation structure, it SHALL reflect the **feature-centric** DR-049 layout (`docs/product/`, per-feature `docs/frds/frd-NN-<slug>/` with on-demand `fdd.md`/`blueprint.md`/`mocks/`/`work-orders/`, global `docs/{adr,analytics,reviews,decision-log.md}`), the ID spine (`REQ-NN-MMM → AC-NN-MMM.K → CMP/IF-NN → WO-NN-MMM`) and the hierarchy `FRD > FDD > design-tokens > blueprint > work order` — NOT the old by-type layout (flat `docs/frds/`, global `docs/blueprint.md`, global `docs/work-orders/`).
- **AC-08-005.4** — These pages SHALL be hand-authored content (not derived), kept in sync by the documentation discipline (DR-046); they SHALL render via the reader (WO-08-002) and may embed `CopyButton` command chips.

## Dependencies
- WO-08-001 (`readManualPages()`), WO-08-002 (reader). Intra-feature.
- FRD-02 `CopyButton` for inline commands. Cross-feature.

## TDD plan
1. RED: a content-completeness test asserting each required page slug exists and is indexed; a structure-page test asserting it mentions the feature-centric tokens (`docs/frds/frd-NN-<slug>/`, `REQ-NN-MMM`, the hierarchy) and does NOT describe a global `docs/blueprint.md`/`docs/work-orders/`.
2. GREEN: author the pages.
3. Refactor / copy-edit pass.

## Definition of done
- Content-completeness + structure-page tests green; renders via the reader; tsc + biome clean.
- Spanish copy (i18n / authored). `.pandacorp/verify.sh` passes.

## Status Note

**Built:** 16 hand-authored Manual pages across three Diátaxis quadrants, plus the content-completeness test suite.

**Files delivered:**

Tutorial (1 page):
- `content/manual/tutorial/como-empezar.md` — first-run guide: prerequisites, plugin install, onboarding, first idea, first build.

Guides (3 pages):
- `content/manual/guides/operacion-diaria.md` — daily operation: Mission Control, inbox channels, daily iterate/bug/decide cycle, verify.sh, resumability.
- `content/manual/guides/como-se-construye.md` — build pipeline: Dynamic Workflow, WO division by role, RED→GREEN→refactor, safe points, freeze-on-red, FRD gate, Mission Control monitoring.
- `content/manual/guides/handoff.md` — handoff to another person: 5-step setup, what they find in MC, operating from day 1, secrets transfer.

Concepts (12 pages):
- `content/manual/concepts/que-es-pandacorp.md` — what the factory is, mission, mental model, what it does vs what the owner does, human gates.
- `content/manual/concepts/el-pipeline.md` — 6 phases (product → operation), habilidades por fase, advance protocol DR-032, iterate without regressing.
- `content/manual/concepts/el-equipo.md` — all 14 agent roles with responsibilities, orchestration model, Party panel.
- `content/manual/concepts/estandares-y-reglas.md` — standards in `factory/standards/`, decision registry DR-NNNs, how they apply, promotion flow.
- `content/manual/concepts/arquitectura-del-sistema.md` — **DR-049 structure page**: factory layout, feature-centric docs structure with `docs/frds/frd-NN-<slug>/` modules, ID spine (`REQ-08-001 → AC-08-001.1 → CMP/IF → WO`), source-of-truth hierarchy `FRD > FDD > design-tokens > blueprint > work order`, two architecture layers, MC internals.
- `content/manual/concepts/mission-control-por-dentro.md` — MC sections, lib/ readers, Party panel animation states, Manual structure, invariants.
- `content/manual/concepts/estado-y-archivos.md` — language rule (committed/gitignored), status.yaml, WO frontmatter, inbox channels, events NDJSON, factory/memory/, secrets.
- `content/manual/concepts/hooks-gates-seguridad.md` — 7 human gates, verify.sh gate, FRD gate DR-050, freeze-on-red DR-015, OWASP agentic risks, secrets.
- `content/manual/concepts/stacks-golden-paths.md` — golden path table, stack selection flow, MC specifics, DR-001 dependency rules.
- `content/manual/concepts/construccion-desatendida.md` — safe points, freeze-on-red, async inbox channels, parallelism model, MC monitoring, restart after block.
- `content/manual/concepts/el-plugin.md` — plugin structure, all skills table, semver policy, install/update, drift detection, portability caveat.
- `content/manual/concepts/autoaprendizaje.md` — DR-047 flow (capture → cosecha → gate → apply → promote), what it is NOT (LESSON-0001 anti-pattern cited), MC sync via DR-046.

**Test file:** `content/manual/wo-08-005.content.test.ts` — 39 tests covering:
- AC-08-005.1+.2: all required slugs present and indexed per group; content-body checks for key topics (factory, pipeline phases, commands, handoff).
- AC-08-005.3 (DR-049): structure page mentions `docs/frds/frd-NN-<slug>/` pattern, `REQ-08-001`/`AC-08-001.1` concrete IDs, `FRD > blueprint` hierarchy, `docs/product/`, `blueprint.md` inside feature modules; does NOT contain global `docs/blueprint.md` or global `docs/work-orders/` paths.
- AC-08-005.4: every required `.md` file exists on disk; all indexed by `readManualPages()`; no empty titles.

**Integration seams:**
- Pages are discovered automatically by `readManualPages()` (WO-08-001 `IF-08-manual-index`) — no registration needed beyond placing the `.md` files.
- Rendered by `DocReader` (WO-08-002 `CMP-08-doc-reader`) via `react-markdown` when an authored page is selected in `DocNav`.
- The `arquitectura-del-sistema` concept page satisfies the DR-049 currency requirement (AC-08-005.3) and is the canonical explanation of the feature-centric docs structure.

**Gate:** 39/39 WO-08-005 tests GREEN. 172 test files, 4723 tests total GREEN (2 expected-fail, 5 skipped). tsc clean. biome clean. Commit `14ecf47`.
</content>
