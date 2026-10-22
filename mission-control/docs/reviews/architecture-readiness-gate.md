# Architecture readiness gate (step 9, DR-100): Mission Control v2 «Órbita»

Plan commit `e46f3a70`. Reviewer: fresh readiness gate (did not author the plan). Method: `gates.md` §0 and §1. The
lead's mechanical outputs are the evidence for the scripted half; I re-ran `waves.mjs`, `plan-consistency.mjs`,
`ac-matrix.mjs` and `check-fdd-coverage.mjs --plan` and all four exit 0 (`.pandacorp/run/architecture/fdd-coverage-plan.txt`
is a stale earlier output, 17 failing at 15:57; the 16:24 `gate-input-fdd.txt` and my re-run say COVERED).

Verdict: FAIL (3 blockers)

## Blockers

All three are the same defect class (DR-087a: a real coupling that is not a `dependsOn` edge). The build's fast lane decides
readiness per work order from `dependsOn` only (build-orchestration §5d, DR-132), so wave labels are NOT an ordering
guarantee. Two work orders that write the same declared artifact with no path between them may run in either order or
concurrently. I computed, for every pair of non-VERIFIED live work orders, whether declared artifacts overlap (brace and glob
aware) and whether one reaches the other through `dependsOn`; exactly four pairs overlap with no path.

1. `docs/frds/frd-18-dashboard/work-orders/wo-18-002-inicio-orbita.md` (W5) and
   `docs/frds/frd-19-app-shell/work-orders/wo-19-002-appshell-frame-navigation.md` (W3) both declare
   `src/lib/constants.ts` (19-002 adds `NAV_DESTINATIONS`/route constants; 18-002 removes the memory-nudge constants).
   `frd-18-dashboard/blueprint.md` ("Disjointness") relies on "an earlier wave", which is not an edge.
   Fix: add `WO-19-002` to WO-18-002 `dependsOn` (frontmatter, Build Plan row in `frd-18-dashboard/blueprint.md`, README row).
   The wave stays W5.
2. `docs/frds/frd-04-project-workspace/work-orders/wo-04-010-workspace-frame.md` (W5) rewrites the tab-list steps of
   `e2e/logical-data-model.spec.ts`; `wo-02-018-data-model-viewer-orbita.md` (W3) rewrites its viewer steps and
   `wo-02-019-data-model-layout-flake.md` (W0) stabilizes it (map §0.1 serializes 02-019 then 04-010). WO-04-010 has no
   edge to either (its deps include WO-02-017 and WO-02-020, neither reaches 02-018/02-019).
   Fix: add `WO-02-018` to WO-04-010 `dependsOn` (02-018 already depends on 02-019, so both are covered). The wave stays W5.
3. `docs/frds/frd-01-data-reading/work-orders/wo-01-011-adopt-seams.md` (W5) declares `src/lib/snapshot/**` to route the
   clock/git seams; `wo-14-005-snapshot-panel-orbita.md` (W3) creates `src/lib/snapshot/gap.ts` and
   `_tests/gap.test.ts` inside that glob. 01-011 depends on WO-14-001 but not WO-14-005.
   Fix: add `WO-14-005` to WO-01-011 `dependsOn` (frontmatter, Build Plan row in `frd-01-data-reading/blueprint.md`, README
   row). The wave stays W5.

After the three edits re-run `plan-consistency.mjs` (frontmatter == Build Plan == README) and `waves.mjs`.

## Traceability (what I verified, pass unless stated)

- **REQ -> CMP/IF:** for every FRD, each REQ id defined in `frd.md` (or numbered in the blueprint where the FRD leaves
  bullets unnumbered) appears on a line of the FRD blueprint that also names a `CMP-`/`IF-`; every REQ also appears in at least
  one work order's `source_requirements`. FRD-01 is REQ-only: its REQ-01-001..019 are numbered in
  `frd-01-data-reading/blueprint.md` §Requirement -> component traceability (lines 196-224), each mapped to CMP/IF and WOs;
  REQ-01-009 is explicitly "out of v2, none". FRD-25 and FRD-26 define ACs only (no REQ ids), covered by `ac-matrix`.
  FRD-16: `status: REMOVED`, blueprint SUPERSEDED, all four WOs `SUPERSEDED` with `superseded_by: []`.
- **ACs:** 299 live ACs, each owned by exactly one WO, copied verbatim (`gate-input-ac-matrix.txt`, re-run).
- **Acyclic and unknown ids:** `waves.mjs` OK. No live WO depends on a SUPERSEDED or missing id (script check).
- **Removal/cleanup last:** all 38 non-VERIFIED live WOs are ancestors of WO-13-013 (only W7 WO); the 12 non-ancestors are
  VERIFIED legacy WOs. Its `dependsOn` lists the 19 surface WOs.
- **Foundation:** WO-13-010 (W0) -> 13-011 (W1) -> 13-012 (W2) -> 19-002 (W3) is a chain; every UI WO reaches WO-13-012 (and so
  13-010/13-011). Non-UI WOs without that chain are readers/codecs/seams (01-010, 01-011, 04-013, 22-001, 25-001, 02-019)
  and none of them uses `t()`, `Icon` or a primitive. Of the 102 canonical names in `docs/design/components.md`, 98 are named
  in a live WO and the other four (`AgentCard`, `ConfigTile`, `Rarity chip`, `RuleRow`) are folded/restyle aliases built inside
  WO-07-006 and WO-13-011 (Configuración cards, Chip tone). DR-075: WO-19-002 owns `e2e/shell.ts` and `e2e/routes.ts`
  (artifacts lines 20-21), `SHELL_EXEMPT = []`, `NAV_TOGGLE = "#menu"`.
- **API contracts (DR-060):** v2 adds or changes no route handler (`/api/live`, `/api/plugin-sync` keep their contracts; WO-01-011
  only swaps the clock), so no `docs/api/<wo-id>.md` is owed; stated in the map §0.3 and the FRD-05/18/22 blueprints.
  Resolver contracts (`ownerTurnItems`, `ownerActions`, `getWorktreesByRepo`, `pendingPillSummary`, `buildSignal`,
  `listProjectFrds`, `countOpenChanges`, `projectServiceRows`, `now()`/`runGit()`) are published as blueprint `IF-` entries
  and WO Status Notes; I scanned every symbol the map assigns to an owner: every WO that consumes one (not merely mentions
  it as an optional prop or an out-of-scope line) reaches its owner.
- **DATA-7:** `docs/product/data-model.json` (6 lines: `schemaVersion: 1`, `persistence: "none"`, `entities: []`,
  `relationships: []`) agrees with `docs/product/architecture.md` §4 (line 147 section, lines 151-154 "v2 changes no logical
  shape", §4.9 lines 226-230 "MC itself has no database ... unchanged in v2", §12 line 562). No v2 work order adds persistence
  (writes remain the existing discard/favourite/change/backlog Server Actions plus browser-local preferences). Unchanged logical
  model; no JSON churn needed; no `TBD` or `[NEEDS CLARIFICATION]` survives (`gate-input-ra.txt` empty, my grep confirms).
- **BL-0051:** map §3.3 and R2/R3 hold. Reviewer-authored suites are either `git rm`'d by the WO that deletes their whole subject
  (19-002, 04-010, 13-013) or listed as derogated for the owning FRD gate reviewer to re-bless; no WO that re-blesses
  `dependsOn` its derogator because no WO re-blesses (the gate-test reviewer does, which the engine's `deadlocked-contract`
  rung supports when the derogation is declared in a WO of the gated FRD or its `dependsOn` graph).
- **Folded queue cards:** `data-model-viewer-layout-flaky-tests.md` -> WO-02-019; `persistent-navigation-history-flaky.md` ->
  WO-25-001; `e2e-workspace-tabs-stale.md` -> WO-04-010 (absorbs superseded WO-04-009);
  `design-phase-copy-claude-design-sunset.md` -> WO-02-020 and WO-08-004; all carry `change_ref`. The readDecisions fix is
  WO-04-013 (`change_ref: none`, owner-bundled, PRD v2 "Bundled fixes" 2).
- **DR-074 flip:** `target_platforms` appears as an owned change in exactly one live WO, WO-13-013 (artifact
  `.pandacorp/status.yaml`, W7, depends on every surface WO); `.pandacorp/status.yaml` line 9 is still `desktop`.
- **DR-130:** `check-fdd-coverage.mjs --plan` COVERED (re-run).

## Advisories (never blocking)

- A1. R2 (WO-04-010, W5, `git rm`s `frd13-wo06-09*`/`frd13-wo07-09*` reviewer suites) and the text of WO-13-011/WO-13-012
  ("derogated here and re-blessed by the FRD-13 gate reviewer", FRD-13's gate runs at W7, after the suites are gone) describe two
  different endings for the same files. Those suites mostly pin behaviour and `data-testid`s (`banner-icon`, `progress-bar`)
  that a restyle in place should keep; if a W1-W2 restyle does turn one red, other FRDs' whole-project gates in W3-W4 see it.
  Suggest WO-13-011/012 state that the suites must stay green until WO-04-010 removes them (stop and report otherwise).
- A2. Surface WOs (02-015..02-020, 06-013, 08-003/004, 12-007, 14-005, 21-003, 22-002, 26-001 and the W4 ones) do not depend on
  WO-19-002. I found no source coupling (they render into `{children}`; R19 keeps `<main>` out of them), so I did not block;
  the shell lands in W3 and the Shell-Presence gate at each FRD gate sees v1 contract plus v1 shell until then, or v2 plus v2.
- A3. `docs/design/...` doc-lint (47 advisories): dangling REQ citations in live and legacy WOs (WO-09-006 `REQ-09-006`,
  WO-19-003 `REQ-09-008`, FRD-01 WOs `REQ-01-0xx`) because FRD-01 and FRD-09 bullets are unnumbered in `frd.md`; FRD-01's
  numbering lives only in its blueprint. Either number the bullets in `frd.md` or keep the blueprint table as the spine.
- A4. `target_platforms: responsive` flips only in W7, so the first responsive-gate run on every v2 route is WO-13-013's own gate;
  a responsive defect found there is late. Consider an earlier non-gating run of the responsive spec at 320/375/768/1280.
- A5. The expedite card `e2e-workspace-tabs-stale` is only fixed at W5 (WO-04-010), so the stale workspace-tab e2e stays red-prone
  through W0-W4.
- A6. `.pandacorp/status.yaml` carries 13 keys unknown to the template (doc-lint DR-115 drift); engine-owned, unrelated to the plan.

## Resolution addendum (2026-10-22)

Every blocker above was fixed in one pass (commit d0c65539) and re-verified by the lead: `waves.mjs` exit 0, `ac-matrix.mjs` exit 0 (AC MATRIX OK), `plan-consistency.mjs` exit 0, `check-fdd-coverage.mjs --plan` COVERED, `doc-lint.sh` exit 0, `verify.sh --only=residual-ambiguity` exit 0, `data-model.json` parses, no `# OBSOLETE:` tombstone. Targeted checks: WO-18-002 `dependsOn` contains WO-19-002; WO-04-010 `dependsOn` contains WO-02-018; WO-01-011 `dependsOn` contains WO-14-005 (and WO-21-003); each edge matches its blueprint Build Plan row and README row (`plan-consistency.mjs` green); no wave label changed (`waves.mjs` green). Advisory A1 (frd13 reviewer suites) aligned in WO-13-011/012 and the FRD-13 blueprint. Verdict after resolution: PASS.
