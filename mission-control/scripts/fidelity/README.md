# Live-oracle fidelity audit (advisory)

Run from `mission-control/` with the installed dependencies and the factory toolkit.
The script connects to an existing Playwright server; it does not launch Chromium,
start a web server, rewrite a baseline or regenerate any frozen reference.

```sh
export PANDACORP_FACTORY_ROOT=/Users/Shared/Proyectos/panda-corp
export PW_TEST_CONNECT_WS_ENDPOINT=ws://127.0.0.1:4950/pw
node scripts/fidelity/audit.mjs out=/absolute/scratch/evidence app=http://127.0.0.1:4913 oracle=http://127.0.0.1:3990/index.html runs=3 workers=2
node scripts/fidelity/analyze.mjs /absolute/scratch/evidence
```

Use the existing `pnpm dev:oracle --port 4913` launcher for synthetic data in an
isolated checkout. Run exactly one application server. The real-data application
can be audited separately with `app=http://127.0.0.1:1987 legacy=1`; never pool its
content differences with fixture renderer noise. `legacy=1` uses the React-bound
button signal because the older live application has no shell hydration marker.

Optional `only=home,board,...` selects state ids from the frozen oracle table.
Widths and themes always come from that table, including its explicit restrictions.
The audit defaults to three runs, one worker; workers are capped at two. `resume=1`
reuses records in the given evidence directory and is only appropriate within an
unchanged audit session. Use a fresh output directory after changing inputs.

Every attempted pair writes a JSON record, first-viewport PNGs and unscaled full
height PNGs. `summary-N.json` contains distributions for valid replay only. Failed
replay screenshots are evidence of the failure, **not captures of the named state**.
All non-GET/HEAD/OPTIONS requests are blocked, including automatic ledger snapshots;
mutation-driven favourite/discard/restore states cannot be certified by this audit.
The recorded blocked requests make this limitation visible.

The default fixture is never modified. Data-double recipes are inventoried and
marked `doubleMissing`; they are not implemented by mutating the live factory,
substituting the default image, or calling the prototype's `applyScenario` in React.
Implement isolated file overlays / reader fault injection before claiming coverage
for these states. The frozen table's `build.actions` override is honored when it is
an array; otherwise actions replay verbatim and missing hooks remain visible errors.
Two observed persisted fixture slug aliases are translated in the app URLs.

The viewport noise proposal is the **observed maximum same-side repeat difference
plus 0.5 percentage points**. Percentiles are reported separately so a rare flake
cannot disappear in a pooled P99. Three samples are insufficient to infer a general
noise distribution. An absent sample stays unknown, never zero drift.

This is not a complete L1–L4 gate: the nine shared style hooks are diagnostic samples
and may refer to different component variants; complete element mapping, floating
anchor coverage and the axe matrix remain unimplemented. Full-height size mismatch
fails the full comparison; first-viewport success cannot override it. The analyser
always reports `gateEligible: false` with the remaining limitations. Exit zero means
the advisory report was generated, never that fidelity passed. Browser infrastructure
errors recorded per pair also remain failures in the evidence.

The managed `.pandacorp/verify.sh` must remain verbatim. After full coverage and
three stable passing runs, a project-owned `e2e/*.spec.ts` is auto-discovered by its
full Playwright stage; do not wire the advisory audit as a blocking check.

Focused verification:

```sh
pnpm exec vitest run scripts/fidelity/_tests/calibration.test.ts
pnpm exec biome check scripts/fidelity
```

Mask-region alignment is also unverified: the current app lacks the expected
`data-oracle-mask` hooks in representative architecture/Manual frames. The decoder
can still exclude reference magenta pixels, but that is not proof of candidate
region alignment. Add explicit per-region mappings and presence checks before using
these masked states in a complete gate; their current metrics are diagnostic only.
