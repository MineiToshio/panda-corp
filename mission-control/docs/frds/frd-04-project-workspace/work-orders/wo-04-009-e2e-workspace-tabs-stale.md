---
id: WO-04-009
type: work-order
slug: e2e-workspace-tabs-stale
title: 'WO-04-009 — Stale workspace e2e specs: ten tabs (Cuentas) and FRD-25 portfolio URLs'
status: SUPERSEDED
superseded_by: [WO-04-010]
parent: FRD-04
implementation_status: VERIFIED
difficulty: low
reopen_count: 0
artifacts:
  - 'e2e/_workspaceTabs.ts'
  - 'e2e/logical-data-model.spec.ts'
  - 'e2e/portfolio-spec.spec.ts'
source_requirements: [REQ-04-012, REQ-04-013]
dependsOn: [WO-04-004]
last_updated: '2026-10-22'
change_ref: e2e-workspace-tabs-stale.md
---
# WO-04-009 — Stale workspace e2e specs: ten tabs (Cuentas) and FRD-25 portfolio URLs

**Change:** `.pandacorp/inbox/changes/e2e-workspace-tabs-stale.md` (type `bug`, rigor `critical`, S9 oracle surface).
**IDs touched:** REQ-04-012 / AC-04-012.1 (tab order), REQ-04-013 (Spec mount, project-scoped links); FRD-25 URL families.

## Problem

`e2e/logical-data-model.spec.ts:4` and `e2e/portfolio-spec.spec.ts:4` (desktop and mobile) asserted nine
workspace tabs. Commit d76e3a51 (FRD-26 service account directory) added the tenth tab, **Cuentas**, to the
shipped shell (`tabbar.tsx` `WORKSPACE_TABS`, pinned by `workspace-shell.test.tsx`) but not to these specs,
which predate it. Reproduced RED: 4 failures, received list ends in `"Cuentas"`.

Fixing the tab list unmasked a second, deterministic staleness in `portfolio-spec.spec.ts` (6/6 RED on
`--repeat-each=3`): the spec predates FRD-25 (fcd3b9cb, persistent navigation URLs).
- It still read `?tab=` / `?project=` / `?doc=` from the URL, while FRD-25 moves workspace state into the
  path (`/portfolio/:project/:tab`, document key encoded as one segment).
- It entered through the legacy alias `/portfolio?project=Mission%20Control&tab=spec` and interacted at
  once. `NavigationCanonical` then lands a client `router.replace` to `/portfolio/mission-control/spec`.
  That moves from `portfolio/page.tsx` to the `[...segments]` route and remounts the workspace. Focus had
  correctly returned to the FRD card after Escape (observed: `BUTTON spec-frd`). The remount then dropped
  it to `<body>` (observed 300 ms later, same probe, button re-rendered).

## Scope

- New `e2e/_workspaceTabs.ts`: `WORKSPACE_TAB_LABELS`, the one e2e copy of the shipped tab order. Both
  specs assert `toHaveText([...WORKSPACE_TAB_LABELS])`, so the next tab change edits one e2e file, not two.
- `portfolio-spec.spec.ts`: after `gotoHydrated`, wait for the canonical URL
  (`/portfolio/mission-control/spec`, 15 s bound for the dev compile) before interacting. The document-link
  check asserts the FRD-25 path `/portfolio/mission-control/documents/docs%2Fproduct%2Fprd` (same project,
  Documentos tab, the PRD key) instead of the retired query parameters. The focus-return assertion is kept
  unchanged.
- No production code changed. The reviewer acceptance suites (`*.reviewer.test.*`) and visual baselines
  were not touched (DR-080).

## Acceptance criteria

- AC-04-012.1 (shipped shell) — both specs assert the full ordered tab list including **Cuentas**, on
  desktop and mobile.
- AC-04-013 (project-scoped links) — the Spec digest's "Documento del producto" link opens the same
  project's Documentos tab on the PRD, expressed in FRD-25's canonical path.
- The FRD dialog still returns focus to its trigger on Escape (assertion unchanged, now not raced by the
  alias canonicalization).

## Tests (RED first)

RED observed before the fix: `npx playwright test e2e/logical-data-model.spec.ts e2e/portfolio-spec.spec.ts`
gave 4 failed (tab list), then 6/6 failed on the URL/focus staleness. The regression evidence is these two
specs themselves.

## Status Note

**What was built:** see Scope. Files: `e2e/_workspaceTabs.ts` (new), `e2e/logical-data-model.spec.ts`,
`e2e/portfolio-spec.spec.ts`.

**Interfaces/contracts exposed:** `export const WORKSPACE_TAB_LABELS: readonly ["Resumen", "Spec",
"Work orders", "Arquitectura", "Cambios", "Party", "Observabilidad", "Documentos", "Comandos", "Cuentas"]`
in `e2e/_workspaceTabs.ts`. Any e2e spec that asserts the workspace tab bar should import it.

**Implicit decisions and assumptions (the consumer inherits these):**
- **FRD conflict, declared rather than resolved.** The change (filed 2026-10-20) asks for the ten-tab list
  that FRD-04 stated at the time. Today's Órbita design-freeze amendment (cb34865f) rewrote REQ-04-002 /
  AC-04-012.1 to the v2 target of **eight** tabs (Resumen · Spec · Observabilidad · Arquitectura · Cuentas ·
  Cambios · Documentos · Comandos). No v2 work order rebuilds the shell yet: WO-04-004 is still the
  shipped ten-tab shell, and its unit test pins `tab-accounts`. These specs therefore assert what is
  **shipped** (ten tabs). Asserting the eight-tab target now would leave `verify.sh` RED until v2 lands.
  **The v2 work order that rebuilds the tab bar must update `e2e/_workspaceTabs.ts`** (and
  `workspace-shell.test.tsx`) as part of its RED.
- The legacy-alias entry was kept on purpose, so the spec still exercises alias canonicalization. It now
  waits for that canonicalization rather than switching to the canonical URL.
- Residual product observation, not fixed here (out of scope): a user who interacts with the workspace
  inside the alias-canonicalization window loses focus or local state on the remount. In production
  the window is short; on the dev server it lasts seconds because of the first compile of `[...segments]`.
  Candidate for its own change if it matters.

**Test files covering this WO:** `e2e/logical-data-model.spec.ts`, `e2e/portfolio-spec.spec.ts`.

**Self-test run:** both specs, desktop + mobile, `--repeat-each=3` gave 30/30 passed. `tsc --noEmit` clean,
`biome check` on the three files clean, `knip` clean (configuration hints only, all pre-existing).
