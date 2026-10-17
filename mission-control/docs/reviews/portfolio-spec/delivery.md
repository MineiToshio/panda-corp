# Shared Portfolio Spec delivery

Date: 2026-10-16. Owner-authorized scoped manual implementation; no build executor or project/WO machine-state transition.

## Behavior and documentation

The shared workspace has nine tabs: **Resumen · Spec · Work orders · Arquitectura · Cambios · Party · Observabilidad · Documentos · Comandos**. Portfolio and standalone pages reuse the existing board SpecDigest, project-local published digest and live FRD-folder count. A thin client adapter supplies the existing document resolver: allowed document links preserve the selected project, unknown relative links become plain text, external links open separately. Missing digests remain pending; project changes discard modal state. Summary remains default.

Browser testing exposed an existing core Modal defect: closing the FRD dialog lost keyboard focus. The shared primitive now restores a connected opener on close/unmount. Removed openers after project switches are never focused. This is covered by an independently authored RED→GREEN regression and the actual browser flow.

The canonical cascade is reconciled: PRD, platform architecture, FRD-02/04 requirements/blueprints/FDDs/work orders, FRD-13 accessibility/blueprint/FDD/work-order scope, API, component inventory, proposal and decision log. Historical WO status is not used as evidence for these additions.

## Current evidence

| Check | Observed result | Evidence |
| --- | --- | --- |
| Canonical `verify.sh --since e555a1d8102be8fe9c4b64dd075a8e4f98a9f923 --report-all` | Exit 0, all 11 subgates; 49 files / 588 tests; 42 desktop/mobile smoke/shell cases | [report](canonical-gate-report.json), [log](canonical-gate.log) |
| Feature Playwright | 8/8 desktop/mobile cases; Spec placement/content, populated FRD dialog, Escape return-focus, same-project document navigation, direct-page Spec, Architecture drag/default diagram/schema | [log](feature-e2e.log), `e2e/portfolio-spec.spec.ts`, `e2e/logical-data-model.spec.ts` |
| Independent review | Spec combined 84/84; broader existing regression 149/149; final modal/Spec/Intake/Discarded/doc-links regression 144/144; TypeScript clean | [review](independent-review.md), [focus regression](independent-focus-regression.log) |
| Documentation lint | Exit 0; no unresolved requirement references | [log](doc-lint.log) |
| PandaSaga publication | Real strict reader returns ready: 39 entities, 395 attributes, 95 relationships, 31 composite groups; all mapped against approved sources independently | [review](pandasaga-model-review.md) |

Verification ran in a detached worktree with separate dependencies/Next output, over base `e555a1d8102be8fe9c4b64dd075a8e4f98a9f923`. Its gate SHA identifies the base of the uncommitted candidate, not the later close-out commit. [Source hashes](candidate-source-sha256.json) match the verified source/test/fixture bytes. Subsequent evidence/docs additions do not change product code. Existing doc-lint machine-field/template advisories remain outside this frozen-state product scope; no gate was weakened.

The actual-diff classifier remains **critical** ([output](rigor.json)): size, auth vocabulary in documentation and the existing test-oracle extension. The owner's explicit instruction authorizes completing this bounded manual change, with independent review and full applicable verification; no automatic `change --now`/build launch or rigor downgrade is claimed.

## PandaSaga boundary

The owner-referenced existing architecture belongs to **PandaSaga**. Its own `docs/product/data-model.json`, platform architecture, WO-01-006 artifact/maintenance scope and decision log were updated together in sibling commit `371feed`. The model is the approved **design**; no Prisma schema has been implemented and no live database is certified. Stable historical catalog identifiers remain scalar values where the approved design deliberately excludes FK constraints. Partial unique predicates and checks stay in canonical prose because the V1 projection cannot encode them.

A live Mission Control browser probe rendered PandaSaga's real Architecture model, selected UserProgress through search and observed no JavaScript errors or horizontal page overflow. Runtime screenshots/probes containing owner project data stay in the private communication layer. The internal redeploy and final live smoke are recorded there after this commit.
