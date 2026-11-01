# Fidelity calibration and gate status, 2026-10-31

## Verdict

**Advisory report; no L1–L4 gate is enabled.** The three calibration passes each
reached 48/48 fixture state contexts; **0/48 passed full-height L3 in every pass**.
46/48 had different full-page dimensions. A higher pixel threshold cannot make
those geometry mismatches valid. L1/L2 sampling and replay/double coverage also
remain incomplete. This is not a declaration of visual fidelity or build completion.

The owner requested direct lane work, no work orders/change skill, no full gate,
no baseline/reviewer edits and no changes to the shared decision log/punch list.
This report supplies the measured evidence and proposed integration entries instead.
The [checklist](fidelity-checklist.md) and [FRD-13 blueprint](../frds/frd-13-visual-system-accessibility/blueprint.md)
now distinguish the frozen target from the implemented advisory audit.

## Inputs and protocol

- Application commit: `977b9aa2427aa5bc1eda5c26eb760ec93c44cc28`, lane `fin/lane-l`.
  This lane changes measurement tooling and documents; no application source changes.
- Approved live oracle: `http://127.0.0.1:3990/index.html`, `demo=off`, `host=page`,
  explicit theme, routes/actions from the frozen `oracle-states.json`.
- Current table: 179 entries, 170 unique ids, **992 allowed state × width × theme
  pairs**. The table restricts some states to particular widths. All three widths
  (375, 768, 1280) and both themes are included where listed; no pareto cap is applied.
- Synthetic application: one local server on `127.0.0.1:4913`, using the existing
  `dev:oracle` fixture launcher and its frozen server clock. Fixtures/references
  are not regenerated. The real-data application on `127.0.0.1:1987` is measured
  separately and is not restarted or redeployed.
- Remote browser: `chromium.connect('ws://127.0.0.1:4950/pw')`; device scale 1,
  900px base height, touch/mobile below 768, explicit color scheme. Phone touch
  probes are recorded before and after growing the full-height viewport.
- The current app waits for `#app[data-hydrated=true]`; the older live app uses a
  React-bound button signal. Fonts settle, images decode, infinite animations pause
  at zero, screenshots disable animation and hide the caret. The client-loaded
  plugin warning is awaited when `/api/plugin-sync` reports drift.
- Toolkit: factory `plugin/skills/design/scripts/fidelity/{lib,diff,pixels}.mjs`;
  YIQ 0.1, anti-aliasing excluded, comparator source saved with the evidence.
- Full images remain unscaled. Different dimensions are failures. Separate equal-size
  first-viewport screenshots permit a diagnostic distribution; this **does not**
  substitute for all full-height slices. The documented model-canvas masks apply.
- Non-GET/HEAD/OPTIONS requests are blocked and logged, including automatic ledger
  writes. Mutating favourite/discard/restore states are not certified. There are no
  direct file writes to the real factory, shared checkout, other products or frozen references.
- The nine sampled shared style hooks are diagnostics, not a component-complete L1/L2
  measurement; a first `.chip`/`.btn` can represent a different variant on each side.

## Three-pass calibration

Eight default states × three widths × two themes: Inicio, Tablero, portfolio cards,
Funko summary, achievements summary, proposals summary, documentation home,
configuration hub. These are render-repeatability controls; **the entire 992-pair
matrix was not repeated three times**.

| Pass | Valid pairs | Full L3 passes | Full size mismatches | Viewport median | Viewport P95 | Viewport P99 |
|---|---:|---:|---:|---:|---:|---:|
| 1 | 48/48 | 0 | 46 | 5.641% | 12.997% | 15.584% |
| 2 | 48/48 | 0 | 46 | 5.641% | 12.997% | 15.584% |
| 3 | 48/48 | 0 | 46 | 5.641% | 12.997% | 15.584% |

192 same-side comparisons (48 contexts × two sides × run 1 against runs 2 and 3):

| Population | Samples | Median | P95 | P99 | Maximum |
|---|---:|---:|---:|---:|---:|
| Oracle against itself | 96 | 0% | 0% | 0% | 0% |
| App against itself | 96 | 0% | 0% | 0.979% | 0.979% |
| Pooled | 192 | 0% | 0% | 0% | 0.979% |

The one nonzero repeat is `proposals-summary`, 1280 dark, app run 1 vs run 2.
The sidebar guild card shifts vertically in these captures. The cause of that shift
is **not established**. Pooling P99 alone would hide this flake; the calibration
unit test explicitly prevents that statistical mistake.

**Proposed first-viewport diagnostic threshold: 1.5%.** The measured maximum
0.9793403% plus 0.5 percentage points gives 1.4793403%, rounded upward for the
proposal. This is a measured noise envelope with a conservative margin, not a
human-approved fidelity tolerance, a statistical confidence bound or permission
to hide unmatched data. Three passes are insufficient to generalize it to all
states. **0/48 application/oracle pairs in each pass meet even that proposal.**
Keep the original per-slice target recorded; do not install either threshold as a
blocking project gate until full state coverage and stable passing comparisons exist.

| Context | Viewport median, three passes | Viewport P95 |
|---|---:|---:|
| 375 light | 8.012% | 12.208% |
| 375 dark | 7.340% | 9.885% |
| 768 light | 4.045% | 15.584% |
| 768 dark | 4.163% | 13.725% |
| 1280 light | 3.540% | 12.997% |
| 1280 dark | 3.925% | 11.729% |

## Complete matrix, one pass

**992/992 attempts across all 179 entries**, including all 33 double entries
(188 allowed contexts) and all 77 non-double action entries. This extends coverage
to tablet as well as both themes. No references or baselines are rewritten.

- 548 pairs qualify for the diagnostic distribution; **0 pass full L3**.
- 749 attempted pairs have full-image dimension mismatches.
- Qualified first-viewport distribution: median **6.584%**, P95 **13.923%**,
  P99 **21.398%**, maximum **34.867%**. This population is not renderer noise.
- 47/77 non-double action entries have at least one app replay error; the detailed
  tables below preserve each state's context counts. Some are partial, not failures
  in every width/theme. Their user-facing functionality is not certified by replay.
- All 33 double entries have both full-image files in every allowed context, but
  the app images use default data and are explicitly **not achieved double states**.
  All 188 double contexts remain unqualified until isolated injection exists.
- 991/992 primary attempts produced both full PNGs. One oracle image failed to load
  in `config-standards-must` (1280 light). The six-context scoped retry produced both
  images in every context; app replay still failed its missing selector in all six.
  The original failure remains in the primary evidence; its root cause is unknown.
- Maximum captured document height was 12,669px, below the 20,000px safety cap.

`matrix/coverage.json`, `coverage.md` and `summary-1.json` hold the inventory and
distribution. The full matrix ran once; only the eight default calibration states
ran three times. Neither population establishes complete passing L1–L4 coverage.

## Real-data application

Seven top-level states × six contexts: **42/42 valid pairs**, 0 full L3 passes,
40 full-size mismatches. Viewport median 6.024%, P95 9.361%, maximum 10.508%.
This population has different content from the synthetic oracle and an older app
build. It is useful for reproduction and visual inspection, **not tolerance fitting**.
No claim is made that its counts, fixture-independent content or code version match
the lane application.

## Gate integration

`.pandacorp/verify.sh` lines 2–4 identify it as a verbatim factory-managed file;
project edits would fail conformance. Its `gate_playwright` function runs the entire
`e2e/` directory in the full gate, making a future project-owned spec the supported
extension. No blocking spec is added: the prerequisite of three passing, stable,
complete L1–L4 runs is not met. The default 0.5% is not enabled as a new blocker.
Existing blessed-snapshot checks remain independent of live-oracle equivalence.

Remaining prerequisites:

1. Isolated data overlays / fault injection for the 33 double entries (27 recipes).
   The audit currently marks `doubleMissing`; an app screenshot of the default data
   beside a scenario-specific oracle image is failure evidence, not state coverage.
2. Explicit build action hooks or per-state `build.actions` mappings. Raw selector
   replay intentionally does not guess an unrelated first row/button. Failed replay
   records retain screenshots without claiming the named state was reached.
3. Complete component/root/child and floating-anchor mapping for L1/L2; sampled CSS
   equality cannot prove the frozen 849 measurement records.
4. Complete axe state coverage. The targeted accessibility sample is reported below;
   it cannot certify unvisited dialogs, faults, focus states or actions.
5. Re-run against the combined lane changes before considering new thresholds or
   baselines. The old live app and this unchanged lane do not include sibling fixes.

## Reproduction and evidence

Evidence root (`E`):
`/private/tmp/claude-501/-Users-Shared-Proyectos-panda-corp-mission-control/0b6df51f-14f6-4a69-9b24-031cd5ad95c3/scratchpad/lanes/l`.
This is local session evidence, not a durable CI artifact store.

```sh
export PANDACORP_FACTORY_ROOT=/Users/Shared/Proyectos/panda-corp
export PW_TEST_CONNECT_WS_ENDPOINT=ws://127.0.0.1:4950/pw
node --loader ./scripts/read-model/ts-loader.mjs scripts/oracle/dev-oracle.mjs --port 4913
# Separate terminal, after setting E to the evidence root above:
node scripts/fidelity/audit.mjs out="$E/matrix" runs=1
# The same session was resumed without app changes, retaining completed JSON records:
node scripts/fidelity/audit.mjs out="$E/matrix" runs=1 resume=1 workers=2
node scripts/fidelity/audit.mjs out="$E/calibration" only=home,board,portfolio-cards,project-summary-funko,achievements-summary,proposals-summary,docs-home,config-hub runs=3
node scripts/fidelity/analyze.mjs "$E/calibration"
node scripts/fidelity/audit.mjs out="$E/live" app=http://127.0.0.1:1987 legacy=1 only=home,board,portfolio-cards,achievements-summary,proposals-summary,docs-home,config-hub runs=1
node "$E/axe.cjs"
pnpm exec vitest run scripts/fidelity/_tests/calibration.test.ts
pnpm exec biome check scripts/fidelity
pnpm exec tsc --noEmit --strict --skipLibCheck --moduleResolution bundler --module esnext --target es2022 scripts/fidelity/_tests/calibration.test.ts
node --check scripts/fidelity/audit.mjs
node --check scripts/fidelity/analyze.mjs
node --check scripts/fidelity/calibration.mjs
```

The launcher was invoked with `TMPDIR=$PWD WATCHPACK_POLLING=true`. Each audit's
`run-N/<FRD>__<state>__<width>__<theme>.json` links its own app/oracle viewport and
full PNGs. `calibration/analysis.json` and `noise.json` contain the numeric evidence;
`live/summary-1.json` contains the independent real-data population. The early `probe/`
and interrupted `fixture/` directories are exploratory runs, excluded from results.
The focused unit suite first failed on the missing module and later on a rare-flake
regression, then passed all four tests. No full gate was run.

## Accessibility sample

The standalone `axe.cjs` evidence script visited the same 48 fixture contexts once:
48 analyses completed, zero infrastructure errors. **Four contexts have a serious
`scrollable-region-focusable` violation**: Inicio and Funko summary, each at 375px
in light and dark. The affected node is `CmdRow > code`, respectively in the plugin
warning and the snapshot panel. The horizontal command overflow has no keyboard
focus target. See `axe.json` for exact selectors and failure summaries.

This is an integration finding in the shared `src/components/core/CmdRow/CmdRow.tsx`
(and its owning FRD-13 accessibility contract), not renderer noise. No shared UI
component is patched by this measurement lane, so its app input stays unchanged
throughout the audit. Reproduce/fix in the component's integration owner, update the
component catalogue, and rerun axe on both consumers and themes. The sample is not
full state-complete L4 coverage; the blocking gate remains ineligible.

## Integration entries

Decision log entry (prepared, not written to the shared file):

> 2026-10-31 — Distinguish the frozen fidelity target from an advisory live-oracle
> audit. Add repeat-noise calibration and explicit missing-action/data-profile
> evidence. Three 48-context fixture passes have zero full L3 passes; preserve the
> managed verifier and defer blocking wiring until complete, stable passing L1–L4
> coverage exists. A 1.5% viewport diagnostic proposal follows the observed 0.979%
> maximum repeat noise plus margin; it does not waive page-height or accessibility
> failures. Canonical: `docs/design/fidelity-checklist.md`,
> `docs/design/fidelity-calibration-2026-10-31.md`, FRD-13 `blueprint.md` and `fdd.md`.

Lesson candidates (not written to the factory's shared memory):

- `(agent-inferred)` A pooled P99 can hide a rare renderer flake; report each side's
  distribution and retain the observed maximum before proposing a tolerance.
- `(agent-inferred)` A shell hydration marker does not prove a client-polled warning
  is visible; await the warning implied by its actual API verdict before capture.
- `(agent-inferred)` A default-profile screenshot beside a scenario oracle is not
  double coverage; preserve failed replay and missing injection as explicit states.

No baseline or `*.reviewer.*` file changes, no production deployment, no full
`verify.sh` invocation, and no edits to the shared decision log, owner data or other
lanes. Existing baselines are not made obsolete by tooling/documentation changes.

## Mask alignment limitation

The frozen table names nine masked entries (model canvas or Manual content). The
current source has no application `data-oracle-mask` hooks (`rg` over `src/`); the
retired `.manual-live` name occurs only in a reviewer source-contract assertion.
The audit's application mask locator therefore does not establish a candidate-aligned
region. Its comparator still skips magenta pixels in the **reference**. Those numbers
are diagnostics only; they cannot certify paired canvas/body geometry or a complete
L1–L4 pass. Resolve application region mapping and presence checks before building
a gate. None of the eight three-pass calibration controls uses these masked states.

The runtime `mask-probe.json` also records zero `[data-oracle-mask]` elements in
`/portfolio/pandasaga/architecture` and `/manual/guides/g-modo`, after shell hydration.
Other masked frames were not individually probed for region alignment.

## Reading the inventory

“Qualified replay” means both responses are HTTP 200, replay completes without
recorded errors, no required data double is missing, no page error is recorded, and
the state is not one of the blocked mutation-driven favourite/discard/restore flows.
It is **not** an L1–L4 pass. Designed HTTP 404 states retain their screenshots for
inspection but are not included in this strict qualified-pair distribution.

Action counts are not directly comparable with the earlier “28” finding: this run
honors frozen `replay-verbatim` actions rather than guessing selector aliases or
clicking unrelated first rows. Missing hooks/mappings in the harness are not proof
that the corresponding user-facing feature is broken. They do prevent certified
state replay. The inventory includes all 77 non-double action entries.

## Data-double entries (default-profile app images are not state coverage)

| State | Attempts | Both full images | Qualified replay | App replay errors | Oracle replay errors |
|---|---:|---:|---:|---:|---:|
| `frd-02-ideas-board/model-invalid` | 6/6 | 6 | 0 | yes | no |
| `frd-03-portfolio/portfolio-path-missing` | 6/6 | 6 | 0 | yes | no |
| `frd-03-portfolio/factory-empty` | 6/6 | 6 | 0 | yes | no |
| `frd-03-portfolio/build-no-signal` | 6/6 | 6 | 0 | yes | no |
| `frd-04-project-workspace/model-invalid` | 6/6 | 6 | 0 | yes | no |
| `frd-06-party/fragua-off` | 6/6 | 6 | 0 | no | no |
| `frd-06-party/build-no-signal` | 6/6 | 6 | 0 | yes | no |
| `frd-09-gamification/guild-achievement-notice` | 6/6 | 6 | 0 | yes | no |
| `frd-10-achievements-hall/stats-stream-error` | 6/6 | 6 | 0 | yes | no |
| `frd-12-observability-dataviz/build-no-signal` | 6/6 | 6 | 0 | yes | no |
| `frd-14-snapshot-and-feedback/project-snapshot-stale` | 6/6 | 6 | 0 | yes | no |
| `frd-14-snapshot-and-feedback/build-no-signal` | 6/6 | 6 | 0 | yes | no |
| `frd-18-dashboard/home-calm` | 6/6 | 6 | 0 | yes | no |
| `frd-18-dashboard/factory-empty` | 6/6 | 6 | 0 | yes | no |
| `frd-18-dashboard/build-no-signal` | 6/6 | 6 | 0 | yes | no |
| `frd-21-pending-merge/worktrees-unreadable` | 6/6 | 6 | 0 | yes | no |
| `frd-22-factory-backlog/backlog-errors` | 6/6 | 6 | 0 | yes | no |
| `frd-26-services-accounts/accounts-source-error` | 6/6 | 6 | 0 | yes | no |
| `frd-04-project-workspace/project-no-version` | 6/6 | 6 | 0 | yes | no |
| `frd-04-project-workspace/project-subtitle-open` | 6/6 | 6 | 0 | yes | no |
| `frd-04-project-workspace/resumen-no-frds` | 6/6 | 6 | 0 | yes | no |
| `frd-04-project-workspace/changes-empty` | 6/6 | 6 | 0 | yes | no |
| `frd-10-achievements-hall/stats-weekly-error` | 6/6 | 6 | 0 | yes | no |
| `frd-10-achievements-hall/stats-transitions-empty` | 6/6 | 6 | 0 | yes | no |
| `frd-14-snapshot-and-feedback/snapshot-unsafe` | 6/6 | 6 | 0 | yes | no |
| `frd-17-proposals-inbox/proposals-memory-prune` | 6/6 | 6 | 0 | yes | no |
| `frd-17-proposals-inbox/proposals-calm` | 6/6 | 6 | 0 | yes | no |
| `frd-19-app-shell/shell-achievement-notice` | 4/4 | 4 | 0 | yes | no |
| `frd-21-pending-merge/worktrees-factory-dialog` | 4/4 | 4 | 0 | yes | no |
| `frd-22-factory-backlog/backlog-open-empty` | 6/6 | 6 | 0 | yes | no |
| `frd-26-services-accounts/accounts-dialog-unlinked` | 4/4 | 4 | 0 | yes | no |
| `frd-04-project-workspace/documents-empty` | 6/6 | 6 | 0 | yes | no |
| `frd-04-project-workspace/document-empty-body` | 2/2 | 2 | 0 | yes | no |

## Non-double action entries

| State | Attempts | Both full images | Qualified replay | App replay errors | Oracle replay errors |
|---|---:|---:|---:|---:|---:|
| `frd-02-ideas-board/board-hide-empty` | 6/6 | 6 | 0 | yes | no |
| `frd-02-ideas-board/board-search` | 6/6 | 6 | 0 | yes | no |
| `frd-02-ideas-board/board-category-filter` | 6/6 | 6 | 0 | yes | no |
| `frd-02-ideas-board/board-favorite` | 6/6 | 6 | 0 | yes | no |
| `frd-02-ideas-board/board-phase-jump` | 6/6 | 6 | 6 | no | no |
| `frd-02-ideas-board/board-capture-dialog` | 6/6 | 6 | 0 | yes | no |
| `frd-02-ideas-board/board-discarded-dialog` | 4/4 | 4 | 0 | yes | no |
| `frd-02-ideas-board/idea-frd-dialog` | 6/6 | 6 | 0 | yes | no |
| `frd-02-ideas-board/idea-adr-dialog` | 4/4 | 4 | 0 | yes | no |
| `frd-02-ideas-board/idea-architecture-frd-dialog` | 4/4 | 4 | 0 | yes | no |
| `frd-02-ideas-board/idea-discard-dialog` | 6/6 | 6 | 0 | yes | no |
| `frd-02-ideas-board/idea-restore-dialog` | 6/6 | 6 | 0 | yes | no |
| `frd-02-ideas-board/model-diagram` | 6/6 | 6 | 0 | yes | no |
| `frd-02-ideas-board/model-entity-selected` | 6/6 | 6 | 0 | yes | no |
| `frd-02-ideas-board/model-zoomed-out` | 6/6 | 6 | 0 | yes | no |
| `frd-02-ideas-board/idea-discarded-reason` | 6/6 | 6 | 0 | yes | no |
| `frd-03-portfolio/portfolio-project-picker` | 4/4 | 4 | 0 | yes | no |
| `frd-03-portfolio/portfolio-project-picker-search` | 4/4 | 4 | 0 | yes | no |
| `frd-03-portfolio/portfolio-accounts` | 6/6 | 6 | 0 | yes | no |
| `frd-04-project-workspace/project-decision-dialog` | 6/6 | 6 | 0 | yes | no |
| `frd-04-project-workspace/project-change-dialog` | 6/6 | 6 | 0 | yes | no |
| `frd-04-project-workspace/project-change-discard` | 4/4 | 4 | 0 | yes | no |
| `frd-04-project-workspace/project-documents-search` | 2/2 | 2 | 0 | yes | no |
| `frd-04-project-workspace/project-documents-index-open` | 4/4 | 4 | 0 | yes | no |
| `frd-04-project-workspace/project-snapshot` | 6/6 | 6 | 6 | no | no |
| `frd-04-project-workspace/project-change-rebuilds` | 4/4 | 4 | 0 | yes | no |
| `frd-05-work-orders/wo-by-frd-expanded` | 6/6 | 6 | 0 | yes | no |
| `frd-05-work-orders/wo-kanban-expanded` | 6/6 | 6 | 0 | yes | no |
| `frd-05-work-orders/wo-failed` | 6/6 | 6 | 6 | no | no |
| `frd-05-work-orders/wo-failed-row` | 6/6 | 6 | 6 | no | no |
| `frd-06-party/fragua-token-card` | 6/6 | 6 | 6 | no | no |
| `frd-07-configuration/config-hub-search` | 6/6 | 6 | 0 | yes | no |
| `frd-07-configuration/config-skill-dialog` | 4/4 | 4 | 0 | yes | no |
| `frd-07-configuration/config-agent-dialog` | 4/4 | 4 | 0 | yes | no |
| `frd-07-configuration/config-rules-search` | 6/6 | 6 | 0 | yes | no |
| `frd-07-configuration/config-rule-detail` | 6/6 | 6 | 0 | yes | no |
| `frd-07-configuration/config-standards-must` | 6/6 | 5 | 0 | yes | no |
| `frd-07-configuration/config-standard-dialog` | 4/4 | 4 | 0 | yes | no |
| `frd-08-documentation/docs-search` | 6/6 | 6 | 0 | yes | no |
| `frd-08-documentation/docs-page-index-open` | 4/4 | 4 | 0 | yes | no |
| `frd-10-achievements-hall/achievements-trophy-category` | 6/6 | 6 | 0 | yes | no |
| `frd-10-achievements-hall/achievements-trophy-dialog` | 4/4 | 4 | 4 | no | no |
| `frd-11-build-modes/commands-mode-powerful` | 6/6 | 6 | 6 | no | no |
| `frd-11-build-modes/commands-target-scoped` | 6/6 | 6 | 0 | yes | no |
| `frd-12-observability-dataviz/observability-deps-frd-open` | 2/2 | 2 | 2 | no | no |
| `frd-12-observability-dataviz/observability-deps-list-open` | 4/4 | 4 | 4 | no | no |
| `frd-12-observability-dataviz/wo-frd-drift` | 6/6 | 6 | 6 | no | no |
| `frd-12-observability-dataviz/wo-frd-drift-unreadable` | 6/6 | 6 | 6 | no | no |
| `frd-13-visual-system-accessibility/a11y-skip-link-focus` | 6/6 | 6 | 6 | no | no |
| `frd-13-visual-system-accessibility/a11y-ring-tooltip-focus` | 6/6 | 6 | 6 | no | no |
| `frd-14-snapshot-and-feedback/project-snapshot` | 6/6 | 6 | 6 | no | no |
| `frd-15-plugin-out-of-sync-warning/plugin-banner` | 6/6 | 6 | 6 | no | no |
| `frd-17-proposals-inbox/proposals-lesson-dialog` | 4/4 | 4 | 4 | no | no |
| `frd-18-dashboard/home-turn-dialog` | 6/6 | 6 | 6 | no | no |
| `frd-18-dashboard/home-in-flight-open` | 6/6 | 6 | 6 | no | no |
| `frd-19-app-shell/shell-rail-collapsed` | 2/2 | 2 | 2 | no | no |
| `frd-19-app-shell/shell-rail-float` | 2/2 | 2 | 2 | no | no |
| `frd-19-app-shell/shell-projects-folded` | 2/2 | 2 | 2 | no | no |
| `frd-19-app-shell/shell-drawer-open` | 2/2 | 2 | 2 | no | no |
| `frd-19-app-shell/shell-pending-chip` | 4/4 | 4 | 4 | no | no |
| `frd-20-overlay-freshness/overlay-behind` | 6/6 | 6 | 0 | yes | no |
| `frd-21-pending-merge/worktrees-card` | 6/6 | 6 | 6 | no | no |
| `frd-21-pending-merge/worktrees-branch-dialog` | 4/4 | 4 | 4 | no | no |
| `frd-21-pending-merge/shell-pending-chip` | 4/4 | 4 | 4 | no | no |
| `frd-21-pending-merge/shell-pending-chip-open` | 4/4 | 4 | 0 | yes | no |
| `frd-22-factory-backlog/backlog-priority-filter` | 6/6 | 6 | 0 | yes | no |
| `frd-22-factory-backlog/backlog-area-filter` | 6/6 | 6 | 6 | no | no |
| `frd-22-factory-backlog/backlog-item-dialog` | 4/4 | 4 | 4 | no | no |
| `frd-22-factory-backlog/backlog-discard-confirm` | 6/6 | 6 | 0 | yes | no |
| `frd-22-factory-backlog/backlog-history-open` | 6/6 | 6 | 0 | yes | no |
| `frd-26-services-accounts/portfolio-accounts` | 6/6 | 6 | 0 | yes | no |
| `frd-26-services-accounts/portfolio-accounts-filter` | 6/6 | 6 | 0 | yes | no |
| `frd-26-services-accounts/portfolio-accounts-dialog` | 4/4 | 4 | 0 | yes | no |
| `frd-08-documentation/docs-search-empty` | 6/6 | 6 | 0 | yes | no |
| `frd-19-app-shell/shell-skip-link` | 4/4 | 4 | 4 | no | no |
| `frd-19-app-shell/shell-theme-toggled` | 2/2 | 2 | 2 | no | no |
| `frd-26-services-accounts/portfolio-accounts-nomatch` | 6/6 | 6 | 0 | yes | no |


Additional executed commands (same `E` as above):

```sh
node scripts/fidelity/audit.mjs out="$E/oracle-image-retry" only=config-standards-must runs=1
node scripts/fidelity/audit.mjs out="$E/tool-smoke" only=home runs=1
node "$E/inventory.cjs"
```

The final tooling smoke produced six valid Inicio contexts and retained six full
size mismatches (report generation succeeded; fidelity did not pass). The mask
probe used the existing remote browser and blocked non-read requests; its two
runtime results are saved in `mask-probe.json`.
