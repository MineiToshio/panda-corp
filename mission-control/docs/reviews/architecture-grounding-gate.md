# Architecture repo-grounding gate (step 9b, DR-102) — Mission Control v2 «Órbita»

- Plan commit: `e46f3a70`
- Scope: `docs/product/architecture.md`, every `docs/frds/*/blueprint.md`, every live work order (38 v2 `PLANNED`
  plus 50 kept-live legacy WOs; 61 `SUPERSEDED` excluded).
- Method: read-only. Installed versions came from `node_modules/*/package.json`. The `src/` tree was walked,
  every artifact glob and every backticked path in the scope was checked for existence, and removal lists,
  cited exports, server actions, env seams and fixtures were compared with the code. No `pnpm build` was run.
- Reviewer: fresh opus gate. I did not write this plan.

**Verdict: FAIL (1 blocker)**

## Blockers

| # | File | Claim | Reality | Fix |
|---|---|---|---|---|
| B1 | `docs/frds/frd-01-data-reading/work-orders/wo-01-011-adopt-seams.md` (In Scope, `gitBoundary.test.ts`) vs `docs/frds/frd-21-pending-merge/work-orders/wo-21-003-worktrees-by-repo.md` (In Scope) | WO-01-011 (W5) adds a repo scan asserting that `node:child_process` is imported only under `src/lib/git/` among the non-test sources of `src/`. Its Out of Scope says `pendingMerge` adopts the seam in WO-21-003. WO-21-003 (W3) is "additive; `getPendingMerge()`/`readPending()` stay byte-compatible" and routes only its NEW files through `runGit`. | `src/lib/pendingMerge/pendingMerge.ts:17` imports `execFileSync` from `node:child_process`, and its private runner sits at `:47`. No WO migrates that file. It lives until WO-13-013 (W7) deletes it. It is outside WO-01-011's artifacts. So at W5 the boundary test is red, and the WO-01-011 builder cannot fix it without leaving its fence. | Pick one. (a) WO-21-003 In Scope: "swap `pendingMerge.ts`'s private runner (`execFileSync("git", …)`, line 47) for `runGit`, results unchanged". (b) WO-01-011's boundary test allow-lists `src/lib/pendingMerge/pendingMerge.ts`, and WO-13-013 removes the allow-list entry when it deletes the file. Every other current `child_process` importer is inside WO-01-011's artifacts: `api/plugin-sync/route.ts`, `achievements/read-model/{seal,factorySeal}.ts`, `achievements/report/{flowSeries,scalars,phaseTransitions}.ts` and `build-track/build-track.ts`. |

## Advisories (non-blocking)

1. **Icon count.** `architecture.md` §2, `components.md` and `fidelity-checklist.md` say "64 exported SVGs".
   `docs/design/prototype/icons/` and `freeze/exports.json` both hold **65** (including `sun`, `moon`, `menu`).
   WO-13-010's test compares against the file set, so nothing breaks. Correct the number.
2. **Tailwind v4 namespace collision.** The raw colour tokens `--text-2` and `--text-3` sit in Tailwind 4's
   `--text-*` (font-size) namespace. WO-13-010 item 2 says "where a raw name already sits in a Tailwind namespace,
   the raw declaration is the registry entry". Applied literally, that turns `text-2` into a font-size utility with
   a colour value. Name `--text-2` and `--text-3` as explicit exceptions: they stay out of `@theme`, and colour
   registry entries alias them. The `--shadow-*` and `--font-*` entries are correct as written.
3. **Inline boot script vs the canonical Biome config.** `biome.json` has `security.noDangerouslySetInnerHtml: "error"`
   and the `next` domain (`noImgElement`), and nobody may edit it. WO-13-010 should name the mechanism:
   - a `biome-ignore` with a reason (precedent: `TimelineView.tsx:677`), or string children, or a static blocking
     `public/` script. `next/script` `beforeInteractive` is not paint-blocking in the App Router.
   - The brand PNG `<img>` needs the same suppression (precedent: `FraguaScene.tsx:1045`).

   The React 19.2 "Encountered a script tag" console error fires only on client creation
   (`react-dom-client.development.js:12962`). A Server Component root-layout script is hydrated, not created, so the
   smoke gate stays clean.
4. **Font URLs under Turbopack.** `@font-face … url('/fonts/<file>')` in `globals.css` should pass through to
   `public/` (root-relative). This was not proven here. Add a `pnpm build` and a `document.fonts.check` run to
   WO-13-010's DoD (its e2e already checks the fonts).
5. **Clock in client bundles.** `now()` reads `process.env.MC_CLOCK`. Next inlines only `NEXT_PUBLIC_*` into client
   code, so a `now()` call inside a Client Component returns the real clock in oracle mode. State the rule in
   WO-01-010 ("Client Components receive `now` from the server"). AchievementToast freshness is already server-side
   (`lastAchievement()`).
6. **Git fixture coverage.** `fixtures/git-state.json` has no `repos["mission-control"]`, yet `portfolio.md` lists
   `../projects/mission-control/` and `lastActivity["mission-control"]` exists. WO-01-010's dispatcher should answer
   `log -1 --format=%cI` from `lastActivity[<id>]` without requiring `repos[<id>]`. Otherwise the Mission Control
   card falls to `no-fixture-answer`.
7. **Codex events file.** `fixtures/home/.codex/dashboard-events.ndjson` does not exist. That is harmless: the reader
   skips missing transports (`src/lib/events/events.ts:448`). `oracleEnv` must not assert that it exists.
8. **Stale config path.** `.env.example` comments cite `src/lib/config.ts`, and the project `CLAUDE.md` says
   `lib/config.ts`. The real file is `src/lib/config/config.ts`. WO-01-010 rewrites `.env.example`, so it should
   correct the path. The three undocumented variables are `PANDACORP_CODEX_EVENTS_FILE`,
   `PANDACORP_CODEX_PLUGIN_ROOT` and `PANDACORP_STALE_HOURS`. They are confirmed in code and correctly listed in
   WO-01-010 and §12.
9. **WoDetail seam wording.** The map's §0.3 calls the `WoDetail` export "existing". Today
   `wo-detail/wo-detail.tsx` exports `WorkOrderDetail`. WO-04-010 and the FRD-04/05 blueprints correctly create
   `wo-detail/WoDetail.tsx` as a new file, so only the wording is off. Note the mixed file casing in that folder.
10. **ESLint vs Biome.** `architecture.md` §2 says Biome "replaces ESLint+Prettier", but `eslint`,
    `eslint.config.mjs` and `lint:eslint` are installed. This predates v2 and is cosmetic.
11. **Catalogue size in client bundles.** `t()` imports `docs/design/microcopy.es.json` (78 KB, 1,426 leaves) into
    every client bundle that calls it. That is acceptable for a local tool. Server-side resolution, with strings
    passed as props, keeps client bundles lean.

## Verified (evidence)

- **Versions.** Installed versions equal the pinned table: next 16.2.9, react/react-dom 19.2.7, tailwindcss and
  `@tailwindcss/postcss` 4.3.1, typescript 5.9.3, vitest 4.1.9, biome 2.5.2, playwright 1.61.0, elkjs 0.12.0,
  `@dagrejs/dagre` 3.0.0. There is no prerelease and no dependency named only in prose. v2 installs nothing.
- **Dagre removal.** The only importer of Dagre is `src/app/_observability/dag/WorkOrderDag/WorkOrderDag.tsx`.
  WO-13-013 deletes `src/app/_observability/**` in the same WO as `pnpm remove`. The only importer of
  `_observability/dag/dag/dag.ts` is `projects/[slug]/_observability/WoDag/**`, which WO-05-008 deletes in W6.
  Nothing that stays needs Dagre.
- **Framework conventions (Next 16).** `src/proxy.ts` exists (no `middleware.ts`), and its matcher covers every v2
  route family. Every catch-all route directory exists (`board`, `portfolio`, `projects/[slug]`, `proposals`,
  `achievements`, `manual`, `configuration`). `params` and `searchParams` are Promises (correct for 16).
  `global-error.tsx`, `error.tsx` and `not-found.tsx` exist. Tailwind v4 `@theme inline`, `--text-*: initial` and
  the hover-gated `hover:` variant are current. Playwright `colorScheme`, a nested `testDir` and `gotoHydrated`
  are all present. No removed Vitest 4 keys are cited.
- **Fonts and assets.** `docs/design/prototype/base.css` lines 2-8 hold exactly the seven `@font-face` rules. The
  files `SpaceGrotesk.ttf`, `inter-400…800.ttf`, `JetBrainsMono.ttf` and the three licences exist. So do the
  `reference/css/00-…04-*.css` files, `computed-styles.json`, `oracle-states.json`, `pandacorp.png`, the sprites,
  `zones/` and `ranks/`.
- **Theme without flash.** It is achievable. The root layout is a Server Component, already uses `<head>`, and
  there is no CSP (`headers.spec` is soft for internal deploys).
- **Server/client boundary.** `ProjectWorkspace.tsx` and `projects/[slug]/page.tsx` are Server Components, so the
  async Server Component panels of WO-04-010 are valid.
- **Fixture seams.** `PANDACORP_FACTORY_ROOT` (`config.ts`, resolved at import), `PANDACORP_EVENTS_FILE`,
  `PANDACORP_CODEX_EVENTS_FILE`, `HOME`/`USERPROFILE` (events, plugin-sync) and `PANDACORP_ACCOUNTS_FILE` exist.
  `MC_CLOCK` and `MC_GIT_FIXTURE` are absent today and are added by WO-01-010. `fixtures/{factory-root,home/.claude,
  pandacorp-vault/services/accounts.yaml,git-state.json}` exist, and `git-state.json` has the keys `repos`,
  `lastActivity`, `phaseHistory` and `verifiedAt` that WO-01-010 and WO-01-011 rely on.
- **Script modules.** `scripts/**` import only `node:*`, `gray-matter` and `src/lib` modules that use `react` `cache`
  at most (already run under Node 24 through `scripts/read-model/ts-loader.mjs`, which resolves `@/` and
  extensionless imports). The planned `clock.ts`, `git.ts` and `oracleEnv.ts` are framework-free. No planned
  script-reachable module adds `server-only`, `next/*` or request APIs.
- **Artifact paths.** Every artifact path of the 50 kept-live WOs exists. Every v2 artifact path either exists
  (edits: for example `src/lib/docs/activity.ts`, `src/lib/changes/changes.ts`, `src/lib/portfolio/portfolio.ts`
  and the manual `*Detail.tsx` files) or is a creatable new file under the conventions.
- **Cited exports.** These exist: `parseDecisionBlocks`, `readChangeQueue`, `readArchitectureArtifacts`,
  `readSpecDigest`, `readWorkOrderDoc`, `buildSnapshot`, `getPluginSyncState`, `getGuildState`, `readBacklog`,
  `toggleFavoriteAction`, `discardChangeAction`, `discardBacklogAction`, `activeProjects`, `IMPLEMENT_MODES`,
  `FRESHNESS_THRESHOLD_MS`, `STALENESS_THRESHOLD_DAYS`, `goToSkill`/`goToAgent`, `classifyCelebration`,
  `AGENT_COLOR`, `ProjectListItem.snapshot`/`.lastSync` and `target_platforms: desktop`.
- **Removal lists.** Every existing target named for removal exists: v1 `core/*` primitives, `_party/**`,
  `modules/party/**`, `_observability/{TimelineView,ObservabilidadTab,WoDag}`, `tab-work-orders.tsx`,
  `wo-frd-filtered-board`, `core/ThemeToggle`, `FlowGraph`, `skill-flows.ts`, `workflow-flows.ts`,
  `railProjects`/`formatLastSync` and their importers (all inside WO-03-007's artifacts), and the reviewer test
  hotspots.
- **Logical data model.** v2 changes no logical shape (DATA-7: `data-model.json` unchanged). That is not
  re-verified here; it is the reviewer's evidence at each gate.

## Resolution addendum (2026-10-22)

Every blocker above was fixed in one pass (commit d0c65539) and re-verified by the lead: `waves.mjs` exit 0, `ac-matrix.mjs` exit 0 (AC MATRIX OK), `plan-consistency.mjs` exit 0, `check-fdd-coverage.mjs --plan` COVERED, `doc-lint.sh` exit 0, `verify.sh --only=residual-ambiguity` exit 0, `data-model.json` parses, no `# OBSOLETE:` tombstone. Targeted check for B1: `wo-21-003-worktrees-by-repo.md` now swaps the `node:child_process` runner of `src/lib/pendingMerge/pendingMerge.ts` for the `runGit` seam (6 mentions of `runGit`), the file is in its artifacts, it depends on WO-01-010, and WO-01-011 (which adds `gitBoundary.test.ts`) now depends on WO-21-003, so the boundary holds when the test lands. Advisories fixed in the same pass: Tailwind `--text-*` collision, `biome-ignore` for the boot script, `pnpm build` in WO-13-010's done, client clock from the server, `.env.example` config path, 65 icons (architecture.md, ADR-0012, blueprints, components.md, design-decisions.md), mission-control's fixture last-commit date. Verdict after resolution: PASS.
