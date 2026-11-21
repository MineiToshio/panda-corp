# Mission Control e2e platform inventory — DR-158

The phase-2 execution amendment below is current; later historical audit sections preserve
prior evidence. The case table is the earlier inventory of **discovered cases**, including explicitly skipped applicability cases;
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

`verify.sh` runs one production build and one combined Playwright invocation with an owned
canonical Next start plus optional isolated slot servers.
The reviewed parallel tier now contains 35 root specs: the three native readers plus 32
project-owned UI specs using `e2e/_read-only.ts`. Root-layout hydration normally invokes
`GamificationLedgerSync` → `snapshotGamificationLedger`, which creates a shared ledger lock even
when the test itself has no fs call. The explicit read-only fixture isolates ONLY that invisible
background action at the network boundary, identified by source filename + exported name in the
running Next action manifest. It returns a non-RSC HTTP 200, causing the existing client catch to
handle a rejected action promise; it does not fabricate a successful Flight response or refresh.
All other non-read requests fail the test. Production ledger/actions/history-race coverage keeps
the real action in serial specs. UI, navigation, RSC GET, controlled SSE, accessibility and layout
assertions remain real and unchanged; no expectation or baseline was edited.

Each test has Playwright's fresh context, cookies, URL/history and localStorage. The fixture keeps
interception installed until the context closes, then asserts that shared `e2e/fixtures/` bytes,
file/directory ctime and mtime are unchanged. Restored writes, utimes and transient ledger lock
creation therefore fail. Access times are excluded so concurrent readers do not cause false reds.
A unit safety audit traverses local helpers of every listed spec, rejects filesystem writers,
child processes, `_ledger`, `_live-refresh`, snapshots, new contexts/pages and persistent storage,
and requires the explicit fixture import on non-native readers. Adding an unguarded fresh context
requires a deliberate isolation change; none of the newly parallel specs currently creates one.
The git reader (`src/lib/git/git.ts`) allows only read commands and disables optional locks
(`GIT_OPTIONAL_LOCKS=0`), including status queries. No parallel spec directly invokes a child process.
The static audit is a conservative tripwire, not a JS sandbox; new shared writes still require
review even if no heuristic matches. Current page-route overrides cover only SSE, static JS or
synthetic responsive fixtures and cannot catch a ledger POST. The filesystem guard backs this up.
Lifecycle regressions execute the actual fixture callback with test-owned transports/files: a
forbidden POST fails, missing manifests abort/fail, body errors still close, and a write during
context.close is caught by the subsequent fingerprint. Browser behavior of the isolated rejection
still requires the real production run.

### Proposal 43 phase 2: isolated wave 1 (DR-158 amendment)

The five managed JS gates remain byte-identical to their templates: smoke, responsive, shell,
tokens and page-errors. They now run against worker-owned fixtures with the genuine boot action.
The canonical server remains dedicated to read-only parallel projects and the serial remainder.
Each isolated worker uses a fresh copy of Git-visible working-tree fixture files under
`test-results/e2e-slots/<parallelIndex>/fixtures`; sibling vault/HOME/events roots are relocated
with it. Ignored residue, empty directories and symbolic links are excluded/rejected. Copies stay
inside the repository so ancestor-based Git readers can still discover it. Slot servers share
one existing production build, never reuse listeners, and are selected by the worker config reload.
`slot-self-check.spec.ts` plants a unique BL-99xx item and checks the actual baseURL server sees it.

All four parallel projects precede serial desktop, then serial mobile. The pool defaults to three
workers/three slots; diagnostics use one worker/one slot and remove success dependencies. With no
isolated inventory the template retains its original server/project shape. Dev/since/manual serial
runs keep the full isolated-file coverage in the canonical serial projects. The static harness
traverses isolated helpers, rejects literal canonical fixture paths and HEAD fixture resets, and
permits subprocesses only with explicit inline slot-root arguments.

**Expected file selections (72 unique specs; 24 moved + 1 new self-check):**

| Tier | Desktop files | Mobile files | Total project/file selections |
|---|---:|---:|---:|
| Read-only parallel | 35 | 19 | 54 |
| Isolated | 25 | 23 | 48 |
| Canonical serial | 12 | 12 | 24 |

The historical case table below derives 330/135 read-only cases, 179/144 moved cases and 37/37
serial cases from its earlier dev inventory. The new self-check adds one case on each platform,
so that inventory predicts **864 discovered dev cases**, with isolated 180/145. The production
page-error gate adds one case for each of the 14 current surfaces on each platform (its sentinel
remains), so expected production selection is:

| Tier | Desktop cases | Mobile cases | Total |
|---|---:|---:|---:|
| Read-only parallel | 330 | 135 | 465 |
| Isolated | 194 | 159 | 353 |
| Canonical serial | 37 | 37 | 74 |
| Total | 561 | 331 | 892 |

These are derived expectations, not current Playwright discovery or passed-browser counts.
The previous production baseline was 890; only the two self-check cases are added. Re-discover
on the installed runner and run the full gate three times outside the sandbox before claiming
performance or production case totals.

**Exact moved specs (wave 1 only):**

- `backlog.spec.ts`
- `commands.spec.ts`
- `cuentas.reviewer.spec.ts`
- `cuentas.spec.ts`
- `frd-02-idea-page.reviewer.spec.ts`
- `frd-02-s2a.reviewer.spec.ts`
- `frd-04-11-s5c-gate.reviewer.spec.ts`
- `frd-05-gate.reviewer.spec.ts`
- `frd-14-snapshot-and-feedback.behaviour.spec.ts`
- `frd-17-22-proposals.reviewer.spec.ts`
- `frd-25-persistent-navigation.behaviour.spec.ts`
- `ideas-board.spec.ts`
- `laneM-tablet.spec.ts`
- `navigation-root.reviewer.spec.ts`
- `page-errors.spec.ts`
- `prod-smoke.spec.ts`
- `proposals.spec.ts`
- `responsive.spec.ts`
- `resumen-fragua.reviewer.spec.ts`
- `resumen.spec.ts`
- `shell-sidebar.spec.ts`
- `shell.spec.ts`
- `smoke.spec.ts`
- `tokens.spec.ts`

Wave 2 stays serial: `persistent-navigation.spec.ts` and all nine `persistent-navigation/*.spec.ts`.
`visual.spec.ts` stays canonical/serial for DR-056. `achievements-statistics.spec.ts` stays there
because its Git seal needs tracked fixture history; it now snapshots working-tree events rather
than HEAD and removes only its own empty `.pandacorp` directory while preserving pre-existing state.

**Port migration:** bootstrap writes ignored `.pandacorp/run/e2e-port` only. Manual precedence is
private file, lane.env, committed server-env.json, shell/default. Queue evaluation explicitly sets
`PANDACORP_E2E_COMMITTED_PORT=1`; old bootstrap skip-worktree restoration remains. Slot ports are
probed before Playwright and supplied by `PANDACORP_E2E_SLOT_PORTS`; both variables are stamp
controls. The private port file remains fingerprinted input.

**Sibling audit (read-only, 2026-11-21):** compared against this branch's pre-phase-2 template,
funko-tracker differs only in the older CI-based snapshot policy and its header comment;
personal-page-v2 has those same deltas plus the older `.spec.ts`-only path regexes in parallel/mobile
inventory readers (no `.spec.mts`/`.spec.cts`). Neither has custom port-resolution logic. Neither
sibling was edited: they still need the coordinator's eventual template upgrade. The synthetic
port-precedence test exercises the new template under each project's flat/nested topology.

| Spec (under e2e/) | Desktop cases | Mobile before → after | Execution | Coverage rationale |
|---|---:|---:|---|---|
| `achievements-statistics.spec.ts` | 4 | 4 → 4 | serial | Inherited viewport / mixed interaction coverage retained on both platforms |
| `achievements.spec.ts` | 2 | 2 → 2 | safe parallel | Inherited viewport / mixed interaction coverage retained on both platforms |
| `backlog.spec.ts` | 2 | 2 → 2 | isolated | Inherited viewport / mixed interaction coverage retained on both platforms |
| `commands.spec.ts` | 1 | 1 → 1 | isolated | Inherited viewport / mixed interaction coverage retained on both platforms |
| `configuration.spec.ts` | 1 | 1 → 1 | safe parallel | Inherited viewport / mixed interaction coverage retained on both platforms |
| `cuentas.reviewer.spec.ts` | 7 | 7 → 7 | isolated | Inherited viewport / mixed interaction coverage retained on both platforms |
| `cuentas.spec.ts` | 1 | 1 → 1 | isolated | Inherited viewport / mixed interaction coverage retained on both platforms |
| `documentation.spec.ts` | 1 | 1 → 0 | safe parallel | Own 1280/375 sequence, drawer, Escape/focus |
| `frd-02-idea-page.reviewer.spec.ts` | 11 | 11 → 11 | isolated | Inherited viewport / mixed interaction coverage retained on both platforms |
| `frd-02-s2a.reviewer.spec.ts` | 4 | 4 → 4 | isolated | Inherited viewport / mixed interaction coverage retained on both platforms |
| `frd-04-11-s5c-gate.reviewer.spec.ts` | 18 | 18 → 18 | isolated | Inherited viewport / mixed interaction coverage retained on both platforms |
| `frd-05-gate.reviewer.spec.ts` | 4 | 4 → 4 | isolated | Inherited viewport / mixed interaction coverage retained on both platforms |
| `frd-07-10-s4c.reviewer.spec.ts` | 4 | 4 → 4 | safe parallel | Inherited viewport / mixed interaction coverage retained on both platforms |
| `frd-08-gate.reviewer.spec.ts` | 13 | 13 → 0 | safe parallel | Explicit 1280/375 groups, phone index/touch targets |
| `frd-13-visual-gate.reviewer.spec.ts` | 71 | 71 → 71 | safe parallel | Inherited viewport / mixed interaction coverage retained on both platforms |
| `frd-14-snapshot-and-feedback.behaviour.spec.ts` | 2 | 2 → 2 | isolated | Inherited viewport / mixed interaction coverage retained on both platforms |
| `frd-17-22-proposals.reviewer.spec.ts` | 9 | 9 → 9 | isolated | Inherited viewport / mixed interaction coverage retained on both platforms |
| `frd-18-gate.reviewer.spec.ts` | 6 | 6 → 0 | safe parallel | Own 1280/1023 widths; remaining assertions are HTTP |
| `frd-19-app-shell.reviewer.spec.ts` | 64 | 64 → 0 | safe parallel | Own 1280/768/390 matrix, rail boundaries and drawer |
| `frd-19-sidebar.gate.reviewer.spec.ts` | 6 | 6 → 0 | safe parallel | Every interaction sets its own width via open/helper |
| `frd-21-pending-merge.behaviour.spec.ts` | 1 | 1 → 1 | safe parallel | Inherited viewport / mixed interaction coverage retained on both platforms |
| `frd-21-pending-merge.reviewer.spec.ts` | 2 | 2 → 0 | safe parallel | Own 375/768 matrix |
| `frd-25-persistent-navigation.behaviour.spec.ts` | 1 | 1 → 1 | isolated | Inherited viewport / mixed interaction coverage retained on both platforms |
| `frd10-statistics-layout.reviewer.spec.ts` | 10 | 10 → 0 | safe parallel | Own 320–1440 matrix and long-error 320/390 cases |
| `frd25-gate-regressions.reviewer.spec.ts` | 7 | 7 → 7 | safe parallel | Inherited viewport / mixed interaction coverage retained on both platforms |
| `frd25-v2-aliases.reviewer.spec.ts` | 1 | 1 → 1 | safe parallel | Inherited viewport / mixed interaction coverage retained on both platforms |
| `headers.spec.ts` | 1 | 0 → 0 | safe parallel | HTTP request only, no viewport |
| `hydration.spec.ts` | 5 | 0 → 0 | safe parallel | Synthetic intercepted fixture; no app viewport dependency |
| `ideas-board.spec.ts` | 11 | 11 → 11 | isolated | Inherited viewport / mixed interaction coverage retained on both platforms |
| `inicio.spec.ts` | 2 | 2 → 2 | safe parallel | Inherited viewport / mixed interaction coverage retained on both platforms |
| `integration-navigation-refresh.spec.ts` | 6 | 6 → 6 | safe parallel | Inherited viewport / mixed interaction coverage retained on both platforms |
| `laneM-tablet.spec.ts` | 12 | 12 → 0 | isolated | Every case sets 768 tablet width |
| `logical-data-model.spec.ts` | 3 | 3 → 3 | safe parallel | Inherited viewport / mixed interaction coverage retained on both platforms |
| `model-s2b.reviewer.spec.ts` | 2 | 2 → 0 | safe parallel | Own 1280/390 groups |
| `model-usability.spec.ts` | 3 | 3 → 3 | safe parallel | Inherited viewport / mixed interaction coverage retained on both platforms |
| `nav-client-refresh.spec.ts` | 2 | 2 → 2 | safe parallel | Inherited viewport / mixed interaction coverage retained on both platforms |
| `navigation-root.reviewer.spec.ts` | 5 | 5 → 5 | isolated | Inherited viewport / mixed interaction coverage retained on both platforms |
| `observability.spec.ts` | 2 | 2 → 2 | safe parallel | Inherited viewport / mixed interaction coverage retained on both platforms |
| `page-errors.spec.ts` | 1 | 1 → 1 | isolated | Inherited viewport / mixed interaction coverage retained on both platforms |
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
| `portafolio.spec.ts` | 4 | 4 → 4 | safe parallel | Inherited viewport / mixed interaction coverage retained on both platforms |
| `portfolio-spec.spec.ts` | 6 | 6 → 6 | safe parallel | Inherited viewport / mixed interaction coverage retained on both platforms |
| `prod-smoke.spec.ts` | 14 | 14 → 14 | isolated | Inherited viewport / mixed interaction coverage retained on both platforms |
| `proposals.spec.ts` | 2 | 2 → 2 | isolated | Inherited viewport / mixed interaction coverage retained on both platforms |
| `responsive-widths.reviewer.spec.ts` | 62 | 62 → 0 | safe parallel | Helper sets widths explicitly, including phone and tablet |
| `responsive.spec.ts` | 9 | 9 → 9 | isolated | Inherited viewport / mixed interaction coverage retained on both platforms |
| `resumen-fragua.reviewer.spec.ts` | 18 | 18 → 18 | isolated | Inherited viewport / mixed interaction coverage retained on both platforms |
| `resumen.spec.ts` | 3 | 3 → 3 | isolated | Inherited viewport / mixed interaction coverage retained on both platforms |
| `shell-hydration.spec.ts` | 4 | 4 → 0 | safe parallel | Every case explicitly sets 1280 |
| `shell-sidebar.spec.ts` | 3 | 3 → 3 | isolated | Inherited viewport / mixed interaction coverage retained on both platforms |
| `shell-ssr.spec.ts` | 3 | 3 → 0 | safe parallel | Own 390/1280 matrix, JS disabled |
| `shell-usability.spec.ts` | 10 | 10 → 0 | safe parallel | Every case sets explicit width through helper |
| `shell.spec.ts` | 23 | 0 → 0 | isolated | Own desktop/mobile shell checks; remaining cases only resolve declarations |
| `smoke.spec.ts` | 9 | 9 → 9 | isolated | Inherited viewport / mixed interaction coverage retained on both platforms |
| `tabs-keyboard.reviewer.spec.ts` | 3 | 3 → 0 | safe parallel | Own 390/1280 keyboard matrix |
| `tokens.spec.ts` | 9 | 9 → 9 | isolated | Inherited viewport / mixed interaction coverage retained on both platforms |
| `visual-system.spec.ts` | 4 | 4 → 4 | safe parallel | Inherited viewport / mixed interaction coverage retained on both platforms |
| `visual.spec.ts` | 6 | 6 → 6 | serial | Inherited viewport / mixed interaction coverage retained on both platforms |
| `w6-integration.reviewer.spec.ts` | 3 | 3 → 0 | safe parallel | Every case sets 1280/900/1440 |
| `work-order-detail.spec.ts` | 2 | 2 → 2 | safe parallel | Inherited viewport / mixed interaction coverage retained on both platforms |
| `workspace-frame.reviewer.spec.ts` | 13 | 13 → 13 | safe parallel | Inherited viewport / mixed interaction coverage retained on both platforms |
| `worktrees.spec.ts` | 1 | 1 → 1 | safe parallel | Inherited viewport / mixed interaction coverage retained on both platforms |
| `slot-self-check.spec.ts` | 1 | new → 1 | isolated | Real fixture-write/server identity proof on both platforms |

## Historical audit: Verification and measurement limits

Production certification discovery additionally enables the existing page-error sweep on 14
routes per platform: **560 desktop (230 serial + 330 parallel), 330 mobile (195 serial + 135 parallel), 890 total**.
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
Fail-fast saves nothing on an all-green run; the initial small safe tier was expanded in the review below.
Green-stamp hashes `.env*`, dependency graph metadata and the entire physical e2e tree;
ordinary ledger/fixture mutations that do not restore bytes prevent certification reuse.

## Historical audit: RVB follow-up: production live-refresh harness

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


## Historical audit: Parallel safety

Reviewed against every root `e2e/*.spec.ts` and its local helper imports, plus the nine nested
specs, on 2026-11-12 (VB). “Parallel / isolated” means the explicit read-only fixture above is
mandatory, rather than claiming ordinary app hydration is naturally read-only. Serial reasons
below are observed calls/interactions in the linked spec and its helpers. All original test
bodies/assertions remain unchanged; newly parallel files change only the `test` import.

| Spec | Verdict | Evidence / reason |
|---|---|---|
| [achievements-statistics.spec.ts](../../e2e/achievements-statistics.spec.ts) | Serial | Writes the events stream and sealed stats store in beforeEach/tests/teardown (restoreFixtures, seedFactoryStore). |
| [achievements.spec.ts](../../e2e/achievements.spec.ts) | Parallel / isolated | Ranks/eras/filter URLs, paging and trophy dialogs; state is context-local. |
| [backlog.spec.ts](../../e2e/backlog.spec.ts) | Serial | Creates/removes BL-90 fixtures; confirms discard through a real server mutation. |
| [commands.spec.ts](../../e2e/commands.spec.ts) | Serial | Creates/restores the shared change card (restoreFixture/beforeEach). Browser build-mode storage is local but the card is shared. |
| [configuration.spec.ts](../../e2e/configuration.spec.ts) | Parallel / isolated | Catalog search/filter URLs and dialogs; no command execution or file mutation. |
| [cuentas.reviewer.spec.ts](../../e2e/cuentas.reviewer.spec.ts) | Serial | Writes the services catalog and sibling vault account registry; removes both in teardown. |
| [cuentas.spec.ts](../../e2e/cuentas.spec.ts) | Serial | Replaces/restores factory/portfolio.md to exercise the empty state. |
| [documentation.spec.ts](../../e2e/documentation.spec.ts) | Parallel / isolated | Authored reader/search/index, reload and focus; only browser state changes. |
| [frd-02-idea-page.reviewer.spec.ts](../../e2e/frd-02-idea-page.reviewer.spec.ts) | Serial | Real idea favourite/discard actions; restores shared idea files in afterEach. |
| [frd-02-s2a.reviewer.spec.ts](../../e2e/frd-02-s2a.reviewer.spec.ts) | Serial | Real idea actions and shared fixture restoration in afterEach. |
| [frd-04-11-s5c-gate.reviewer.spec.ts](../../e2e/frd-04-11-s5c-gate.reviewer.spec.ts) | Serial | Plants/updates/removes shared changes and done cards; tests real discard actions. |
| [frd-05-gate.reviewer.spec.ts](../../e2e/frd-05-gate.reviewer.spec.ts) | Serial | refreshFromProjectChange touches a shared work order to trigger the real SSE path. |
| [frd-07-10-s4c.reviewer.spec.ts](../../e2e/frd-07-10-s4c.reviewer.spec.ts) | Parallel / isolated | Catalog dialogs/filter/paging and error/overflow observations; no writer helper. |
| [frd-08-gate.reviewer.spec.ts](../../e2e/frd-08-gate.reviewer.spec.ts) | Parallel / isolated | Manual search, index, reader routes and geometry; no baseline or file changes. |
| [frd-13-visual-gate.reviewer.spec.ts](../../e2e/frd-13-visual-gate.reviewer.spec.ts) | Parallel / isolated | Axe contrast, settled reduced-motion styles, font/geometry/keyboard checks; no pixel baseline or elapsed-time deadline. |
| [frd-14-snapshot-and-feedback.behaviour.spec.ts](../../e2e/frd-14-snapshot-and-feedback.behaviour.spec.ts) | Serial | Rewrites shared status.yaml for snapshot feedback, then restores it. |
| [frd-17-22-proposals.reviewer.spec.ts](../../e2e/frd-17-22-proposals.reviewer.spec.ts) | Serial | Plants/writes shared queue/backlog fixtures, including a status transition. |
| [frd-18-gate.reviewer.spec.ts](../../e2e/frd-18-gate.reviewer.spec.ts) | Parallel / isolated | Dashboard geometry, dialog focus and HTTP GET/stream order; no latency assertion or mutation. |
| [frd-19-app-shell.reviewer.spec.ts](../../e2e/frd-19-app-shell.reviewer.spec.ts) | Parallel / isolated | Explicit viewport matrices, DOM geometry, shell focus/drawer/navigation; no screenshots or shared writes. |
| [frd-19-sidebar.gate.reviewer.spec.ts](../../e2e/frd-19-sidebar.gate.reviewer.spec.ts) | Parallel / isolated | Rail geometry and localStorage preference are isolated per browser context; JS interception is GET-only. |
| [frd-21-pending-merge.behaviour.spec.ts](../../e2e/frd-21-pending-merge.behaviour.spec.ts) | Parallel / isolated | Worktree dialog and copy-only command controls; never invokes cleanup. |
| [frd-21-pending-merge.reviewer.spec.ts](../../e2e/frd-21-pending-merge.reviewer.spec.ts) | Parallel / isolated | Reads table geometry at explicit 375/768 widths. |
| [frd-25-persistent-navigation.behaviour.spec.ts](../../e2e/frd-25-persistent-navigation.behaviour.spec.ts) | Serial | reloadCommitted depends on the real boot ledger POST and its history interaction; keep that stimulus real. |
| [frd10-statistics-layout.reviewer.spec.ts](../../e2e/frd10-statistics-layout.reviewer.spec.ts) | Parallel / isolated | Report geometry, hydration and long-path DOM injection; does not write the statistics/event fixtures. |
| [frd25-gate-regressions.reviewer.spec.ts](../../e2e/frd25-gate-regressions.reviewer.spec.ts) | Parallel / isolated | URL aliases, selection, navigation and shell geometry; no shared mutation. |
| [frd25-v2-aliases.reviewer.spec.ts](../../e2e/frd25-v2-aliases.reviewer.spec.ts) | Parallel / isolated | Reads legacy Party redirects in both presentation contexts. |
| [headers.spec.ts](../../e2e/headers.spec.ts) | Parallel / native | Native reader: request.get only, no JS hydration or ledger effect. |
| [hydration.spec.ts](../../e2e/hydration.spec.ts) | Parallel / native | Native reader: intercepted synthetic HTML, isolated context; hydration timing is a lower bound (load cannot make it too fast). |
| [ideas-board.spec.ts](../../e2e/ideas-board.spec.ts) | Serial | Real favourite/discard/restore actions; writes back shared idea fixture bytes. |
| [inicio.spec.ts](../../e2e/inicio.spec.ts) | Parallel / isolated | Dashboard/card/dialog reads; commands are displayed/copied, never executed. |
| [integration-navigation-refresh.spec.ts](../../e2e/integration-navigation-refresh.spec.ts) | Parallel / isolated | Controlled SSE/clock, baseline flushed before selection; new main-frame request identities exclude old RSC/prefetch responses; real RSC refresh, no shared-file change. |
| [laneM-tablet.spec.ts](../../e2e/laneM-tablet.spec.ts) | Serial | patchFile writes shared project/idea fixtures and restores them; theme storage alone would be local. |
| [logical-data-model.spec.ts](../../e2e/logical-data-model.spec.ts) | Parallel / isolated | Model tabs/camera/search/fullscreen and history are browser-local. |
| [model-s2b.reviewer.spec.ts](../../e2e/model-s2b.reviewer.spec.ts) | Parallel / isolated | Model layout at explicit widths; no persistence outside the context. |
| [model-usability.spec.ts](../../e2e/model-usability.spec.ts) | Parallel / isolated | Graph relationships, selection, zoom/fullscreen and pointer events stay in the page. |
| [nav-client-refresh.spec.ts](../../e2e/nav-client-refresh.spec.ts) | Parallel / isolated | _live-race controls per-context SSE only; new main-frame RSC GET identities exclude old/prefetch responses, query/focus still asserted; no shared mutation. |
| [navigation-root.reviewer.spec.ts](../../e2e/navigation-root.reviewer.spec.ts) | Serial | refreshFromProjectChange touches the shared work-order fixture for native live refresh. |
| [observability.spec.ts](../../e2e/observability.spec.ts) | Parallel / isolated | Work-order views, filters, expansion, focus and detail navigation; no writer/touch helper. |
| [page-errors.spec.ts](../../e2e/page-errors.spec.ts) | Serial | Managed byte-identical DR-059 gate: real JS navigation invokes the shared ledger. Keep its complete integration path serial; no project-only import fork. |
| [persistent-navigation.spec.ts](../../e2e/persistent-navigation.spec.ts) | Serial | Writes/append/restores shared inputs, runs mutating navigation CLI, observes real boot POST races. |
| [portafolio.spec.ts](../../e2e/portafolio.spec.ts) | Parallel / isolated | Overview/list/accounts navigation and table geometry; no portfolio rewrite. |
| [portfolio-spec.spec.ts](../../e2e/portfolio-spec.spec.ts) | Parallel / isolated | Digest/FRD dialog/document links and presentation routes; no server mutation. |
| [prod-smoke.spec.ts](../../e2e/prod-smoke.spec.ts) | Serial | Appends to the shared production report; CSP quiet observation is a wall-clock window under load. Retain the full real production path. |
| [proposals.spec.ts](../../e2e/proposals.spec.ts) | Serial | Creates/removes backlog/change fixtures to exercise real discard persistence. |
| [responsive-widths.reviewer.spec.ts](../../e2e/responsive-widths.reviewer.spec.ts) | Parallel / isolated | Real geometry at explicit widths plus test-id-scoped intercepted HTML canaries; no screenshots or shared writes. |
| [responsive.spec.ts](../../e2e/responsive.spec.ts) | Serial | Managed byte-identical DR-059 gate: real JS navigation invokes the shared ledger. Keep its complete integration path serial; no project-only import fork. |
| [resumen-fragua.reviewer.spec.ts](../../e2e/resumen-fragua.reviewer.spec.ts) | Serial | Uses _ledger.ts and writes ledger/status/events/work-order/overlay fixtures. |
| [resumen.spec.ts](../../e2e/resumen.spec.ts) | Serial | Writes/restores shared status.yaml in beforeEach/afterEach. |
| [shell-hydration.spec.ts](../../e2e/shell-hydration.spec.ts) | Parallel / isolated | Theme localStorage and hydration/navigation checks in a fresh context. |
| [shell-sidebar.spec.ts](../../e2e/shell-sidebar.spec.ts) | Serial | Resets shared status and ledger baseline, then changes guild evidence. |
| [shell-ssr.spec.ts](../../e2e/shell-ssr.spec.ts) | Parallel / native | Native reader: JavaScript disabled, so the ledger effect never executes. |
| [shell-usability.spec.ts](../../e2e/shell-usability.spec.ts) | Parallel / isolated | DOM theme/geometry, drawer, focus and navigation state stay within the context. |
| [shell.spec.ts](../../e2e/shell.spec.ts) | Serial | Managed byte-identical DR-059 gate: real JS navigation invokes the shared ledger. Keep its complete integration path serial; no project-only import fork. |
| [smoke.spec.ts](../../e2e/smoke.spec.ts) | Serial | Managed byte-identical DR-059 gate: real JS navigation invokes the shared ledger. Keep its complete integration path serial; no project-only import fork. |
| [tabs-keyboard.reviewer.spec.ts](../../e2e/tabs-keyboard.reviewer.spec.ts) | Parallel / isolated | Keyboard focus/scroll and test-local injected CSS; no shared mutation. |
| [tokens.spec.ts](../../e2e/tokens.spec.ts) | Serial | Managed byte-identical DR-059 gate: real JS navigation invokes the shared ledger. Keep its complete integration path serial; no project-only import fork. |
| [visual-system.spec.ts](../../e2e/visual-system.spec.ts) | Parallel / isolated | Theme localStorage and font readiness/computed CSS; no baseline comparison. |
| [visual.spec.ts](../../e2e/visual.spec.ts) | Serial | Blessed screenshot comparisons must stay serial (DR-056/143). |
| [w6-integration.reviewer.spec.ts](../../e2e/w6-integration.reviewer.spec.ts) | Parallel / isolated | Accessible labels, sidebar geometry and context-local collapsed preference. |
| [work-order-detail.spec.ts](../../e2e/work-order-detail.spec.ts) | Parallel / isolated | Detail tabs/document reads, URL/reload/back and unpublished-id handling. |
| [workspace-frame.reviewer.spec.ts](../../e2e/workspace-frame.reviewer.spec.ts) | Parallel / isolated | Aliases, dialogs, tabs, browser history and overflow; no writer helper. |
| [worktrees.spec.ts](../../e2e/worktrees.spec.ts) | Parallel / isolated | Reads table/card and toggles details; cleanup command is never executed. |
| [persistent-navigation/achievements.spec.ts](../../e2e/persistent-navigation/achievements.spec.ts) | Serial | Retains real boot-ledger integration; fresh browser.newContext is not guarded by the root read-only fixture. |
| [persistent-navigation/board.spec.ts](../../e2e/persistent-navigation/board.spec.ts) | Serial | Retains real boot-ledger integration; fresh browser.newContext is not guarded by the root read-only fixture. |
| [persistent-navigation/configuration.spec.ts](../../e2e/persistent-navigation/configuration.spec.ts) | Serial | Retains real boot-ledger integration; fresh browser.newContext is not guarded by the root read-only fixture. |
| [persistent-navigation/destinations.spec.ts](../../e2e/persistent-navigation/destinations.spec.ts) | Serial | Retains real boot-ledger integration; default context is not using the read-only fixture. |
| [persistent-navigation/history-race.spec.ts](../../e2e/persistent-navigation/history-race.spec.ts) | Serial | Writes the ORDER fixture and needs the real boot-action response/history race. |
| [persistent-navigation/manual.spec.ts](../../e2e/persistent-navigation/manual.spec.ts) | Serial | Retains real boot-ledger integration; fresh browser.newContext is not guarded by the root read-only fixture. |
| [persistent-navigation/model.spec.ts](../../e2e/persistent-navigation/model.spec.ts) | Serial | Retains real boot-ledger integration; fresh browser.newContext is not guarded by the root read-only fixture. |
| [persistent-navigation/proposals.spec.ts](../../e2e/persistent-navigation/proposals.spec.ts) | Serial | Retains real boot-ledger integration; fresh browser.newContext is not guarded by the root read-only fixture. |
| [persistent-navigation/workspace.spec.ts](../../e2e/persistent-navigation/workspace.spec.ts) | Serial | Retains real boot-ledger integration; fresh browser.newContext is not guarded by the root read-only fixture. |

### Discovery and cost evidence

Same environment, combined production certification discovery (`--list --reporter=json`):

| Project | Before | After |
|---|---:|---:|
| desktop-parallel | 9 | 330 |
| mobile-parallel | 0 | 135 |
| desktop (serial) | 551 | 230 |
| mobile (serial) | 330 | 195 |
| Total | 890 | 890 |

Normalized `(spec, full title, platform)` comparison: zero lost or added identities. The existing
mobile inventory and template worker value (3) are unchanged. Discovery is not browser execution.

VIS3 measured 18.6 min total / 16.5 min Playwright, with cumulative test time desktop 619.6 s,
mobile 351.2 s and parallel 8.4 s. The three promoted top candidates contributed 241.05 s
(frd-13 desktop/mobile 62.63/62.23 s, responsive-widths 64.97 s, app-shell 51.22 s).
Overlapping them offers roughly two minutes of potential saving at three workers under VIS3's
assumptions, not a measured result; all 32 additions require the orchestrator's real benchmark.
File-level scheduling, server contention and read-only isolation overhead prevent deriving wall
time from case counts or adding individual estimates. `prod-smoke` retains its real CSP timing
window/report path in serial. `visual.spec.ts` retains its blessed baselines and one worker.

FOR_INTEGRATOR: rerun the full production gate, inspect the read-only guard failures (unexpected
mutations or manifest mismatch are a real red, never retries/ignored failures), and measure the
four project durations. Confirm page/console observations on the isolated ledger rejection and
that the subsequent real serial ledger/history suites remain green. No browser/port was run here.


## Historical audit: Diagnostic follow-up and response oracle audit

The unrestricted `--no-bail` run at `35a9154b` took 474 s total: 5535 unit tests green, 461 browser
passes, 4 failures, 425 not run (the 425 are exactly230 desktop +195 mobile serial cases). This
is an incomplete red diagnostic, not a full-pass benchmark. All 4 failures were the two integration
refresh starts on desktop/mobile. Each error-context snapshot still shows WO-01-003 active/pressed
and the “Work order en foco” region; it does not establish rendered focus loss.

`page.waitForResponse` already belongs to its own Page: it cannot see another worker's Page. The
controlled EventSource arrays and fake clock are window-local; the parallel cohort has no fixture
writers (and no read-only fingerprint failure was reported). The old predicate accepted ANY RSC
response, including delayed requests started before selection or prefetches. The log retains no
request-start/header trace distinguishing those exact candidates. The confirmed defect is this
unsound response oracle; exact attribution of the observed response is not proven.

The two affected oracles (`integration-navigation-refresh`, `nav-client-refresh`) now share
`refreshFromLiveFrame`: arm a Page request listener before emitting; select only a new main-frame
GET, exact origin/path, RSC and non-prefetch headers; accept its response by Request identity.
No focus/query parameter filters the candidate: a new wrong-focus refresh still reaches the
unchanged assertion and fails. Baseline frame+debounce completes BEFORE changing focus, using the
shared controlled transport. Requests started before arming cannot satisfy the oracle even when
their responses arrive later. Unit regressions cover those cases, foreign path/origin/frame/POST,
prefetch variants, timeout cleanup and rejection propagation without an orphan promise.

Re-audit of the other 34 safe specs: nav-client-refresh had the sibling weak matcher and is fixed;
the remaining 33 have no response-completion oracles. Their route overrides are narrow SSE/static
JS or per-test synthetic documents. Passive request observations assert egress/document/privacy
behavior and do not choose refresh completion. No global refresh or shared-write dependency was
found. The existing classification/safelist and 890 platform identities remain unchanged.

The 425 missing cases were scheduler success dependencies, not maxFailures: the installed runner
only admits projects whose dependencies are in successfulProjects. Its real browser-free sentinel
reproduces the skip with maxFailures=0. Combined diagnostics now omit dependencies and use one
global worker; every project executes after test failures, serial writers cannot overlap readers,
and the final result remains red. Certification retains three safe workers, success dependencies
and maxFailures=1. One production build/server/invocation remains in both modes. Diagnostic
passes will therefore be slower; their complete failure inventory is the purpose.

FOR_INTEGRATOR: rerun the full gate once with the desired mode. A complete no-bail test-failure
run should report all 890 cases (infrastructure/build failures can still prevent browser startup).
Confirm the two refresh specs against real production; no browser or socket was started here.
No speedup is claimed from the474s incomplete run. Patch plugin 10.1.2 / overlay 9.1.2.

Additional verification limit: `test-merge-queue-release-gate.sh` was attempted in the sandbox;
its real free-port/listener bind failed with `EPERM` (73 checks passed, 4 failed). That suite is
not green here and requires the unrestricted integrator. The changed gate/config scheduler
regressions and the full 5538-test Vitest run are green; no product merge-queue code was changed.

## Explicit execution inventory (DR-159)

`e2e/serial-specs.json` records the 12 canonical specs: visual snapshots, statistics with its Git
seal, and ten wave-2 persistent-navigation specs. `isolated-specs.json` classifies the 24 moved
writers plus the self-check. Both reason objects and the 35 read-only safe entries are disjoint;
mobile exclusions still apply identically. Unknown specs retain serial and both-platform coverage.

## Independent-review follow-up: legacy exit-21 stamp stability

The real regression starts with a legacy-bootstrapped worktree: tracked launch/server-env rewrites,
bootstrap skip-worktree flags, and no private e2e-port file. It runs the real queue, template verify
and green-stamp, stubbing only toolchain commands. Before the fix the first queue exits 21 after a
green gate, cleanup creates e2e-port, and the authorized second queue reports `e2e group` drift
and repeats the full gate. This RED was reproduced in this worktree.

The queue now calls bootstrap's narrow `--e2e-port-only` mode before stamp/gate evaluation. Existing
valid port values are reused without probing/reselecting or rewriting unchanged files. Assertions
for nested Mission Control and flat funko-tracker/personal-page-v2 prove one gate across both queue
runs, second-run `[certified-tree]`, committed origin at the actual gate, private port present before
that gate, unchanged port mtime/stamp, restored tracked bytes/index flags, and the authorized SHA
landing at the synthetic main/origin. Existing tests still prove that a real private-port content
change alters the fingerprint; the port input has not been excluded from certification.

Follow-up verification (each suite invoked separately): port-precedence passes all three real queue
cycles; worktree-bootstrap 66/66; merge-queue-certified-tree 12/12; committed-config environment
preparation 6/6; post-rebase environment preparation 5/5; green-stamp-controls 12/12. Shell syntax
and the two template/Mission Control mirrors are checked independently. No app code/TS changed.

## Integrated phase-1/2 corpus follow-up

The merged corpus found a real cleanup defect: the new private port was ignored protected state
without a creator proof. Bootstrap now records its output hash in the external identity-bound
manifest. Port-only preparation preserves valid earlier env-output proofs and never reblesses an
unproven/edited port. Inventory and removal share the exact private-port exception; neighbours,
owner changes, unproven files and session-registered protected paths remain protected.

Deliberate test updates preserve their original safety intent:

- `test-session-cleanup.mjs` checks no launch copy/hash because phase 2 intentionally stopped
  producing it; explicit generator receipts and registration/removal checks remain.
- `test-session-cleanup-adversarial.mjs` expects generated private port/env evidence while tracked
  configs remain committed. Both cleanups must actually remove eligible proven output; edited or
  unproven ports, neighbouring run files and protected registrations must retain/reject as before.
- `test-merge-queue-review.sh` replaces the obsolete rewrite-only stub with the real port-aware
  bootstrap. A hook canary rejects accidental full bootstrap; waiting state, required record,
  certified retry, committed inputs and arbitrary owner-edit refusal remain covered.

Verification uses `TMPDIR=/private/tmp/claude-501/p43tmp`, with each suite invoked separately:
session cleanup 28/28, adversarial cleanup 26/26, queue-review 12/12, worktree-sweep 49/49,
bootstrap 66/66, and the real legacy → exit-21 → certified-tree port cycle in all three synthetic
topologies. Bash 3.2 syntax, Node syntax and the template/Mission Control bootstrap copy agree.
The complete 120-suite engine corpus is left to the coordinator; no full-corpus result is claimed.

## Deletion-safety follow-up: invalid Git-directory proof renewal

A manifest with correct path, file identity and output hash but a wrong `gitdir` is invalid for
cleanup. Both full and port-only bootstrap must keep it invalid as deletion evidence. The new
adversarial regressions first prove cleanup rejects the original proof, run the actual bootstrap
mode, then require unchanged port bytes, no renewed port hash, and actual cleanup retention.
Both regressions failed before the fix. Ordinary and engine worktrees are covered.

Bootstrap ownership and retention now align with cleanup's complete manifest guard, including
regular/unaliased manifest and `.git` files, producer/version/path/identity, current real Git
directory and generated-files schema. The overlay remains self-contained; no new shared-file
installation contract or cleanup exception is introduced.

Verification with `TMPDIR=/private/tmp/claude-501/p43tmp`, each suite invoked separately:
`test-session-cleanup.mjs` 28 passed; `test-session-cleanup-adversarial.mjs` 28/28 passed;
`test-worktree-sweep.mjs` 49 passed; `test-worktree-bootstrap.sh` 66 passed. Before the fix,
the two new cases failed (26/28); after the fix both bootstrap modes retain the protected data.
Bash/Node syntax and byte identity of the two bootstrap copies also pass.

## Phase 2 handoff verification

- `node plugin/scripts/test-e2e-tiers.mjs`: 79 checks green, including launcher copies and slot helper paths.
- `bash plugin/scripts/test-playwright-port-precedence.sh`: all three synthetic topologies green;
  also proves invocation controls do not alter the stamp while private port-file content does.
- `PANDACORP_HOST_DIR=<temporary host> bash plugin/scripts/test-verify-gate-report.sh`: 112 passed.
  The first run could not write the default host-state directory in this sandbox; the final run
  uses an owned temporary host directory without altering the admission protocol.
- `bash plugin/scripts/test-worktree-bootstrap.sh`: 66 passed.
- `bash plugin/scripts/test-green-stamp-controls.sh`: 12 passed.
- `test-template-e2e-conformance.mjs` with `PANDACORP_TEMPLATE_DEPS_DIR` pointing to the main
  checkout: green, including three negative controls. Six edited template/project pairs match
  byte-for-byte; five managed gate specs remain unchanged.
- Biome from the main checkout: all 25 edited Mission Control TS/TSX files clean with explicit
  project config; template config/launcher clean with VCS ignores disabled.
- The navigation harness: 8 tests passed with the installed main-checkout Vitest and a temporary
  Node-only config resolving that same Vitest package. This worktree has no installed dependencies;
  its normal Vitest command cannot resolve React/Vitest. No dependency symlinks were created.
- `bash -n`: all 11 edited shell files passed. `git diff --check`: green.
- Classification audit: 72 current specs, complete/disjoint; safe 35/19, isolated 25/23, serial
  12/12 desktop/mobile file selections. No full browser run or build was attempted. Three discovery
  attempts with the external CLI could not resolve the missing local packages; production case
  discovery and three full green timing runs remain the coordinator's external acceptance gate.
- No commits, plugin/overlay version bumps, sibling-project edits or factory Git writes.

## Phase 2 changed files of this worktree

One repository-relative path per line. The inbox capture is ignored personal state; all other
paths are reviewable implementation/documentation changes.

```
factory/decision-log.md
factory/decisions/registry.yaml
factory/memory/_inbox.md
factory/standards/build-orchestration.md
factory/standards/quality.md
mission-control/.pandacorp/green-stamp.sh
mission-control/.pandacorp/merge-queue.sh
mission-control/.pandacorp/verify.sh
mission-control/.pandacorp/worktree-bootstrap.sh
mission-control/docs/decision-log.md
mission-control/docs/reviews/e2e-platform-inventory.md
mission-control/e2e/_ledger.ts
mission-control/e2e/_slot.ts
mission-control/e2e/achievements-statistics.spec.ts
mission-control/e2e/backlog.spec.ts
mission-control/e2e/commands.spec.ts
mission-control/e2e/cuentas.reviewer.spec.ts
mission-control/e2e/cuentas.spec.ts
mission-control/e2e/frd-02-idea-page.reviewer.spec.ts
mission-control/e2e/frd-02-s2a.reviewer.spec.ts
mission-control/e2e/frd-04-11-s5c-gate.reviewer.spec.ts
mission-control/e2e/frd-05-gate.reviewer.spec.ts
mission-control/e2e/frd-14-snapshot-and-feedback.behaviour.spec.ts
mission-control/e2e/frd-17-22-proposals.reviewer.spec.ts
mission-control/e2e/ideas-board.spec.ts
mission-control/e2e/isolated-specs.json
mission-control/e2e/laneM-tablet.spec.ts
mission-control/e2e/mobile-specs.json
mission-control/e2e/navigation-root.reviewer.spec.ts
mission-control/e2e/persistent-navigation.spec.ts
mission-control/e2e/prod-server.mjs
mission-control/e2e/proposals.spec.ts
mission-control/e2e/resumen-fragua.reviewer.spec.ts
mission-control/e2e/resumen.spec.ts
mission-control/e2e/serial-specs.json
mission-control/e2e/shell-sidebar.spec.ts
mission-control/e2e/slot-self-check.spec.ts
mission-control/playwright.config.ts
mission-control/src/app/manual/manualPages.tsx
mission-control/src/lib/navigation/_tests/parallel-safety-harness.test.ts
plugin/docs/decision-log.md
plugin/scripts/test-e2e-tiers.mjs
plugin/scripts/test-playwright-port-precedence.sh
plugin/scripts/test-verify-gate-report.sh
plugin/scripts/test-worktree-bootstrap.sh
plugin/templates/shared/.pandacorp/green-stamp.sh
plugin/templates/shared/.pandacorp/merge-queue.sh
plugin/templates/shared/.pandacorp/worktree-bootstrap.sh
plugin/templates/stack-a-nextjs/e2e/playwright.config.ts
plugin/templates/stack-a-nextjs/e2e/prod-server.mjs
plugin/templates/stack-a-nextjs/verify.sh
```
