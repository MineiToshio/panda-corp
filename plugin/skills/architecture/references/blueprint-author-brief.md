<!--
  The common brief for the parallel blueprint + work-order authors (architecture planning stage 3).
  The lead copies this text into each author's prompt, filling every <...>. It is self-contained: an author gets
  this brief, the files it owns and the paths it cites, not the conversation.
-->

# Brief: blueprint + work-order author for <FRD-NN, FRD-MM> (<product>)

Work ONLY in `<worktree path>` (every command from there). **Do not commit** (the lead commits). Other authors write
the other FRDs' folders in parallel. You write ONLY inside your FRD folders `docs/frds/<frd-folder>/`:
`blueprint.md` (or a `blueprints/` folder for a large feature: `blueprint.md` keeps the frontmatter and the Build
Plan, the parts hold the design), `work-orders/README.md` and `work-orders/wo-NN-MMM-<slug>.md`. Never edit FRDs,
FDDs, mocks, design docs, `architecture.md`, `data-model.json`, ADRs, the decision log, code or e2e.

You have no shell. To delete a file of yours, replace its content with one line `# OBSOLETE: <path> (<reason>)` and
list it in your report; the lead removes it. The lead runs every check script and sends you its output.

## The plan is decided: follow the map
`<path>/wo-map.md` fixes every WO id, title, AC assignment, artifacts, dependsOn, foundation flag, difficulty, wave,
mocks and install commands, plus the global rules (§0) and the lead's binding resolutions (§8, which override §2).
Do not re-decide coupling or move ACs. If the map is clearly wrong for your FRD (an artifact path that contradicts
the route/module map, a dependency an AC obviously needs), fix it minimally inside your files AND report it.

## Cross-FRD requests go to the ledger, not to other files
When you need something another FRD must provide, or find an FRD/architecture problem, append ONE line under your
heading in `<path>/cross-issues.md`: `- NEEDS <WO-id or doc>: <what>, because <AC/REQ>` or
`- PROBLEM <doc>: <what>`. One reconciler applies the ledger after every author is done.

## Read
- Your FRDs: `frd.md` (every REQ/AC), `fdd.md`, the `mocks/` files and their oracle state ids.
- Platform: `docs/product/architecture.md` (route map, module map, derivation rules, cross-cutting concerns),
  `docs/product/data-model.json`, `docs/adr/*.md` (the owner's locked decisions: never contradict them),
  `docs/analytics/events.md`, `DESIGN.md`, `docs/design/components.md`, `docs/design/design-tokens.json`,
  `docs/design/fidelity-checklist.md`, the oracle states for your FRDs, the microcopy file, `docs/rules/*.md`.
- The installed scaffold: `package.json`, `e2e/routes.ts`, `e2e/shell.ts`, `src/`, and the framework's
  version-matched docs the project `AGENTS.md` points at. Ground every framework API you cite there, not in memory.
- Versions and exact install commands: `<versions record path>`.
- Templates (follow exactly): `${CLAUDE_PLUGIN_ROOT}/templates/docs/{blueprint-template,work-order-template,work-orders-readme-template}.md`.
  Rules: `${CLAUDE_PLUGIN_ROOT}/skills/work-orders/SKILL.md` (Summary BL-0015, Visual reference DR-054/056,
  dependsOn coupling DR-087a, difficulty DR-073, artifacts DR-060, Status Note, reuse before create DR-057) and
  `${CLAUDE_PLUGIN_ROOT}/skills/architecture/SKILL.md` steps 2, 8 (visual spec) and 9 (BL-0051 test-side supersession).
- Lessons: `<factory>/factory/memory/INDEX.md`; cite a `LESSON-NNNN` in the blueprint/WO where one materially
  informs a choice.

## Blueprint (per FRD)
Frontmatter per template: `status: DRAFT`, `implementation_status: PLANNED`, empty `readiness_gate` /
`grounding_gate` / `consistency_gate`, `last_updated: <date>`. Restate the source-of-truth hierarchy; reference
architecture.md instead of restating the platform. Components `CMP-NN-<slug>` and interfaces `IF-NN-<slug>`, each
traced to a REQ. A contract (input · success · errors · invariants) for every Server Action / route handler / job /
query reader your FRD introduces, each owned by the WO that materializes `docs/api/<wo-id>.md` at build time (in
its artifacts). **The Build Plan DAG table is mandatory**, one row per WO matching its frontmatter exactly (WO ·
Depends on · Artifacts (globs) · Foundation · Parallel with, the wave written as `W<n>`), plus order and
parallelism, the integration order, cross-FRD dependencies by WO id, and the visual spec for every UI WO (the FDD +
exact mocks it reproduces, the assets to stage, the oracle states of this FRD's gate). Altitude (DR-100): contracts
and shapes, not code. No `TBD`, no `[NEEDS CLARIFICATION]`.

## Work orders
One file per WO of the map, template frontmatter exactly (`status: DRAFT`, `implementation_status: PLANNED`,
`foundation`, `difficulty`, `reopen_count: 0`, `artifacts`, `source_requirements`, `dependsOn`). Body: a FILLED
`## Summary`, In/Out scope, Requirements & ACs with every AC this WO owns **copied verbatim** from the FRD as its
`- **AC-NN-MMM.K:** ...` bullet (only those; mention other ACs in prose, never as a bullet), the CMP/IF it builds,
reused components (reuse → adapt → create), the install step with the exact commands the map assigns, a FILLED
`## Visual reference` for UI WOs, the tests it owns (acceptance tests first; one behaviour e2e spec per UI feature;
hydration-safe forms), the definition of done, and an empty `## Status Note`. `work-orders/README.md` per its
template: the work-orders table (Depends on = the frontmatter, no blank line inside the table) and the AC coverage
table.

## Self-check before reporting (the gates re-check fail-closed, and the lead runs the scripts)
Every REQ → a CMP/IF; every AC → exactly one WO, copied verbatim; `dependsOn` only names WOs of the map; frontmatter
== Build Plan row == README row; the `W<n>` labels match the map; wave-parallel WOs of your FRDs have disjoint
artifacts; every UI string you name is drawn in your FRD's captured states (or names the FRD that draws it, DR-130);
no `TBD` / `[NEEDS CLARIFICATION]`; every path consistent with architecture.md.

Final report (concise): files written, the WO list with difficulty, every deviation from the map (exact), every
tombstone, and the ledger lines you appended.
