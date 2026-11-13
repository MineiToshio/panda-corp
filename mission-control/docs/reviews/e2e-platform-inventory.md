# Mission Control e2e platform inventory — DR-158

Inventory of **discovered cases**, including explicitly skipped applicability cases;
these counts are not passed tests. Same worktree, before/after configuration, Playwright 1.61.0.

| Project | Before (dev applicability) | After (dev applicability) |
|---|---:|---:|
| Desktop (including safe parallel files) | 546 | 546 |
| Mobile | 517 | 316 |
| Total | 1063 | 862 |

**201 duplicate cases removed (18.9% of discovered total; 38.9% of the mobile project).**
Every desktop case identity remains. Every removed mobile case is in a reviewed whole-file
exclusion below; phone/tablet assertions inside those specs still execute on desktop with
explicit viewport settings. No expectation, route, baseline or token threshold was removed.
Mandatory mobile core: smoke, visual and responsive; project additions explicitly retain
critical navigation, dialogs, keyboard/focus, responsive geometry and mixed files. In particular,
all nine nested persistent-navigation specs remain on both platforms. Case identity audit uses
`(spec path, title, platform)` from the Playwright JSON discovery reports.

`e2e/mobile-specs.json` is project-owned. The reviewed JSON classifies `{include, desktopOnly, review}`. New/unclassified specs
retain mobile coverage; review viewport/focus/dialog/touch/navigation requirements before adding
a named desktop-only exclusion, and update this inventory in the same change. File-level selection intentionally retains some viewport-independent cases in mixed files.
The desktop column below means the **project**, not a promise of fixed desktop viewport.

## Execution and shared state

`verify.sh` runs one production build and one combined Playwright invocation/Next start.
Only hydration, headers and SSR shell are parallel-safe. All ordinary JS app-navigation specs
can invoke `GamificationLedgerSync` → `snapshotGamificationLedger` and therefore stay serial,
even when their own test code contains no fs write. This includes every `_ledger.ts` consumer,
resumen-fragua, fixture writers and visual. The two serial platform projects have dependencies:
safe projects → desktop → mobile, each serial project capped at one worker. Safe project names
have a `-parallel` suffix, so count them under their corresponding viewport platform.
No mobile safe files are selected in this initial partition; none needs inherited mobile width.

| Spec (under e2e/) | Desktop cases | Mobile before → after | Execution | Coverage rationale |
|---|---:|---:|---|---|
| `achievements-statistics.spec.ts` | 4 | 4 → 4 | serial | Inherited viewport / mixed interaction coverage retained on both platforms |
| `achievements.spec.ts` | 2 | 2 → 2 | serial | Inherited viewport / mixed interaction coverage retained on both platforms |
| `backlog.spec.ts` | 2 | 2 → 2 | serial | Inherited viewport / mixed interaction coverage retained on both platforms |
| `commands.spec.ts` | 1 | 1 → 1 | serial | Inherited viewport / mixed interaction coverage retained on both platforms |
| `configuration.spec.ts` | 1 | 1 → 1 | serial | Inherited viewport / mixed interaction coverage retained on both platforms |
| `cuentas.reviewer.spec.ts` | 7 | 7 → 7 | serial | Inherited viewport / mixed interaction coverage retained on both platforms |
| `cuentas.spec.ts` | 1 | 1 → 1 | serial | Inherited viewport / mixed interaction coverage retained on both platforms |
| `documentation.spec.ts` | 1 | 1 → 0 | serial | Own 1280/375 sequence, drawer, Escape/focus |
| `frd-02-idea-page.reviewer.spec.ts` | 11 | 11 → 11 | serial | Inherited viewport / mixed interaction coverage retained on both platforms |
| `frd-02-s2a.reviewer.spec.ts` | 4 | 4 → 4 | serial | Inherited viewport / mixed interaction coverage retained on both platforms |
| `frd-04-11-s5c-gate.reviewer.spec.ts` | 18 | 18 → 18 | serial | Inherited viewport / mixed interaction coverage retained on both platforms |
| `frd-05-gate.reviewer.spec.ts` | 4 | 4 → 4 | serial | Inherited viewport / mixed interaction coverage retained on both platforms |
| `frd-07-10-s4c.reviewer.spec.ts` | 4 | 4 → 4 | serial | Inherited viewport / mixed interaction coverage retained on both platforms |
| `frd-08-gate.reviewer.spec.ts` | 13 | 13 → 0 | serial | Explicit 1280/375 groups, phone index/touch targets |
| `frd-13-visual-gate.reviewer.spec.ts` | 71 | 71 → 71 | serial | Inherited viewport / mixed interaction coverage retained on both platforms |
| `frd-14-snapshot-and-feedback.behaviour.spec.ts` | 2 | 2 → 2 | serial | Inherited viewport / mixed interaction coverage retained on both platforms |
| `frd-17-22-proposals.reviewer.spec.ts` | 9 | 9 → 9 | serial | Inherited viewport / mixed interaction coverage retained on both platforms |
| `frd-18-gate.reviewer.spec.ts` | 6 | 6 → 0 | serial | Own 1280/1023 widths; remaining assertions are HTTP |
| `frd-19-app-shell.reviewer.spec.ts` | 64 | 64 → 0 | serial | Own 1280/768/390 matrix, rail boundaries and drawer |
| `frd-19-sidebar.gate.reviewer.spec.ts` | 6 | 6 → 0 | serial | Every interaction sets its own width via open/helper |
| `frd-21-pending-merge.behaviour.spec.ts` | 1 | 1 → 1 | serial | Inherited viewport / mixed interaction coverage retained on both platforms |
| `frd-21-pending-merge.reviewer.spec.ts` | 2 | 2 → 0 | serial | Own 375/768 matrix |
| `frd-25-persistent-navigation.behaviour.spec.ts` | 1 | 1 → 1 | serial | Inherited viewport / mixed interaction coverage retained on both platforms |
| `frd10-statistics-layout.reviewer.spec.ts` | 10 | 10 → 0 | serial | Own 320–1440 matrix and long-error 320/390 cases |
| `frd25-gate-regressions.reviewer.spec.ts` | 7 | 7 → 7 | serial | Inherited viewport / mixed interaction coverage retained on both platforms |
| `frd25-v2-aliases.reviewer.spec.ts` | 1 | 1 → 1 | serial | Inherited viewport / mixed interaction coverage retained on both platforms |
| `headers.spec.ts` | 1 | 0 → 0 | safe parallel | HTTP request only, no viewport |
| `hydration.spec.ts` | 5 | 0 → 0 | safe parallel | Synthetic intercepted fixture; no app viewport dependency |
| `ideas-board.spec.ts` | 11 | 11 → 11 | serial | Inherited viewport / mixed interaction coverage retained on both platforms |
| `inicio.spec.ts` | 2 | 2 → 2 | serial | Inherited viewport / mixed interaction coverage retained on both platforms |
| `integration-navigation-refresh.spec.ts` | 6 | 6 → 6 | serial | Inherited viewport / mixed interaction coverage retained on both platforms |
| `laneM-tablet.spec.ts` | 12 | 12 → 0 | serial | Every case sets 768 tablet width |
| `logical-data-model.spec.ts` | 3 | 3 → 3 | serial | Inherited viewport / mixed interaction coverage retained on both platforms |
| `model-s2b.reviewer.spec.ts` | 2 | 2 → 0 | serial | Own 1280/390 groups |
| `model-usability.spec.ts` | 3 | 3 → 3 | serial | Inherited viewport / mixed interaction coverage retained on both platforms |
| `nav-client-refresh.spec.ts` | 2 | 2 → 2 | serial | Inherited viewport / mixed interaction coverage retained on both platforms |
| `navigation-root.reviewer.spec.ts` | 5 | 5 → 5 | serial | Inherited viewport / mixed interaction coverage retained on both platforms |
| `observability.spec.ts` | 2 | 2 → 2 | serial | Inherited viewport / mixed interaction coverage retained on both platforms |
| `page-errors.spec.ts` | 1 | 1 → 1 | serial | Inherited viewport / mixed interaction coverage retained on both platforms |
| `persistent-navigation.spec.ts` | 4 | 4 → 4 | serial | Inherited viewport / mixed interaction coverage retained on both platforms |
| `persistent-navigation/achievements.spec.ts` | 1 | 1 → 1 | serial | Inherited viewport / mixed interaction coverage retained on both platforms |
| `persistent-navigation/board.spec.ts` | 3 | 3 → 3 | serial | Inherited viewport / mixed interaction coverage retained on both platforms |
| `persistent-navigation/configuration.spec.ts` | 2 | 2 → 2 | serial | Inherited viewport / mixed interaction coverage retained on both platforms |
| `persistent-navigation/destinations.spec.ts` | 1 | 1 → 1 | serial | Inherited viewport / mixed interaction coverage retained on both platforms |
| `persistent-navigation/history-race.spec.ts` | 7 | 7 → 7 | serial | Inherited viewport / mixed interaction coverage retained on both platforms |
| `persistent-navigation/manual.spec.ts` | 2 | 2 → 2 | serial | Inherited viewport / mixed interaction coverage retained on both platforms |
| `persistent-navigation/model.spec.ts` | 1 | 1 → 1 | serial | Inherited viewport / mixed interaction coverage retained on both platforms |
| `persistent-navigation/proposals.spec.ts` | 3 | 3 → 3 | serial | Inherited viewport / mixed interaction coverage retained on both platforms |
| `persistent-navigation/workspace.spec.ts` | 3 | 3 → 3 | serial | Inherited viewport / mixed interaction coverage retained on both platforms |
| `portafolio.spec.ts` | 4 | 4 → 4 | serial | Inherited viewport / mixed interaction coverage retained on both platforms |
| `portfolio-spec.spec.ts` | 6 | 6 → 6 | serial | Inherited viewport / mixed interaction coverage retained on both platforms |
| `prod-smoke.spec.ts` | 14 | 14 → 14 | serial | Inherited viewport / mixed interaction coverage retained on both platforms |
| `proposals.spec.ts` | 2 | 2 → 2 | serial | Inherited viewport / mixed interaction coverage retained on both platforms |
| `responsive-widths.reviewer.spec.ts` | 62 | 62 → 0 | serial | Helper sets widths explicitly, including phone and tablet |
| `responsive.spec.ts` | 9 | 9 → 9 | serial | Inherited viewport / mixed interaction coverage retained on both platforms |
| `resumen-fragua.reviewer.spec.ts` | 18 | 18 → 18 | serial | Inherited viewport / mixed interaction coverage retained on both platforms |
| `resumen.spec.ts` | 3 | 3 → 3 | serial | Inherited viewport / mixed interaction coverage retained on both platforms |
| `shell-hydration.spec.ts` | 4 | 4 → 0 | serial | Every case explicitly sets 1280 |
| `shell-sidebar.spec.ts` | 3 | 3 → 3 | serial | Inherited viewport / mixed interaction coverage retained on both platforms |
| `shell-ssr.spec.ts` | 3 | 3 → 0 | safe parallel | Own 390/1280 matrix, JS disabled |
| `shell-usability.spec.ts` | 10 | 10 → 0 | serial | Every case sets explicit width through helper |
| `shell.spec.ts` | 23 | 0 → 0 | serial | Own desktop/mobile shell checks; remaining cases only resolve declarations |
| `smoke.spec.ts` | 9 | 9 → 9 | serial | Inherited viewport / mixed interaction coverage retained on both platforms |
| `tabs-keyboard.reviewer.spec.ts` | 3 | 3 → 0 | serial | Own 390/1280 keyboard matrix |
| `tokens.spec.ts` | 9 | 9 → 9 | serial | Inherited viewport / mixed interaction coverage retained on both platforms |
| `visual-system.spec.ts` | 4 | 4 → 4 | serial | Inherited viewport / mixed interaction coverage retained on both platforms |
| `visual.spec.ts` | 6 | 6 → 6 | serial | Inherited viewport / mixed interaction coverage retained on both platforms |
| `w6-integration.reviewer.spec.ts` | 3 | 3 → 0 | serial | Every case sets 1280/900/1440 |
| `work-order-detail.spec.ts` | 2 | 2 → 2 | serial | Inherited viewport / mixed interaction coverage retained on both platforms |
| `workspace-frame.reviewer.spec.ts` | 13 | 13 → 13 | serial | Inherited viewport / mixed interaction coverage retained on both platforms |
| `worktrees.spec.ts` | 1 | 1 → 1 | serial | Inherited viewport / mixed interaction coverage retained on both platforms |

## Verification and measurement limits

Production certification discovery additionally enables the existing page-error sweep on 14
routes per platform: **560 desktop (551 serial + 9 safe parallel), 330 mobile, 890 total**.
Normal discovery is 862 because its page-error sentinel has no per-route production cases.
All 862 normal case identities remain in the combined production discovery, with 28 additions.
The existing 14 prod-smoke cases per platform are now active during full certification too.
These applicability changes add checks; they are not hidden mobile removals.

Discovery commands (no server/browsers): `pnpm exec playwright test --list --reporter=json`
and `PANDACORP_E2E_TIER=combined PANDACORP_E2E_SERVER=prod PANDACORP_E2E_CERTIFICATION=1 pnpm exec playwright test --list --reporter=json`.

The full browser gate/build could not run in this sandbox. Production timing and fixture
restoration must be checked by the integrator outside it, with cold/warm cache identified.
The research target of 10–15 minutes versus approximately 26 minutes is **unmeasured**;
201 fewer discovered duplicates is an observed inventory change, not wall-clock savings.
Fail-fast saves nothing on an all-green run; safe parallelism is deliberately small here.
Green-stamp hashes `.env*`, dependency graph metadata and the entire physical e2e tree;
ordinary ledger/fixture mutations that do not restore bytes prevent certification reuse.

## RVB follow-up: production live-refresh harness

The unrestricted run reached 241 seconds and stopped after 62 passes and one failing test;
827 tests did not run. This is a red partial timing, never a successful full-gate benchmark.
`frd-05-gate.reviewer.spec.ts` ran on the serial desktop project, after the nine safe project
cases finished. It is absent from `parallel-safe.json`; no fixture-writing spec ran beside it.

The spec waited on any RSC response and touched once without observing an open project SSE
baseline. The first stateVersion frame deliberately establishes a baseline without refreshing;
dev file/HMR activity can also produce an unrelated RSC. The old green dev result therefore
did not establish the required production transport ordering. The original log contains no
SSE/network trace proving which race happened in that attempt; that exact attribution is unverified.

Both frd-05 and navigation-root now share `_live-refresh.ts`: observe the native EventSource,
wait for an open project stream with a finite stateVersion and its 150 ms debounce (300 ms guard),
arm the RSC listener before touching, exclude prefetches/in-flight navigation and require the
same path/focus/level. Reconnection can cause a later touch within ONE 12-second response wait,
as navigation-root already did. Tests/retries remain unchanged, filesystem transport stays real,
and fixture timestamps restore in finally. Failures now retain bounded SSE and RSC diagnostics.
Unit regressions exercise ordering against a real temporary file and rejection/cleanup without
orphan promises. Real browser confirmation still belongs to the unrestricted integrator.

The log's “1 error was not a part of any test” is the same fail-fast event, not a second app
exception: installed Playwright1.61.0 `lib/runner/index.js:5567` emits “Testing stopped early
...” via reporter.onError, and its list reporter counts that event at line1182. The log has
exactly this marker at1554 and its summary at1576. No runner error was suppressed or threshold
changed. Resolving the functional failure removes that early-stop notice on a green run.
