# Proposal 15 — Gate-template fidelity + conformance hardening (DR-076)

> Status: DRAFT for owner review (red-team pending). Author: factory supervisor, 2026-06-21.
> Origin: the MC re-anchor Phase 0 (`/pandacorp:upgrade` 8.33.0→8.36.1) revealed that the canonical
> gate templates have **drifted BEHIND** real projects + carry a DR-074 bug, and that the conformance
> "overwrite from template" can REGRESS a project that is ahead. Four follow-ups: (a) stale templates,
> (b) `@axe-core/playwright` breaks knip, (c) `verify.sh` e2e port race, (d) DR-075 wording too absolute.

## The problem (evidenced in the MC upgrade)

Upgrading MC surfaced that the canonical `stack-a-nextjs/{biome.json,knip.json}` templates are **older/broken** than what a real project needs, and that a blanket conformance overwrite would have **red-locked MC's gate**:

1. **(a1) `biome.json` is missing universal fixes.** A fresh Next.js + Tailwind-v4 project from the template would go RED on first `verify.sh`:
   - **No `css.parser.tailwindDirectives: true`** → biome's CSS linter flags `@theme`/`@apply`/`@variant` in `globals.css` as unknown at-rules. **Breaks every Tailwind-v4 project.**
   - **No `!.pandacorp/**` in `files.includes`** → biome lints the overlay/machinery (`.pandacorp/`), which is not product code.
   - **No `style.useExportType: "error"`** (the symmetric partner of `useImportType`, already present).
2. **(a2) `knip.json` is broken under knip v6 (the installed `@latest`).**
   - **`$schema` pins `knip@5` and carries a `_pandacorp` comment key that knip v6 REJECTS** (`Invalid input (unrecognized_keys: _pandacorp)`) → the dead-code gate errors out at cold start. (Known from the memory; the fix reached a project in-place but never the source template.)
   - **`ignoreDependencies: []`** omits `tailwindcss` (used via PostCSS + CSS, not a JS import → knip flags it unused).
3. **(b) DR-074 added `@axe-core/playwright` as a required devDep but never told knip.** It's imported only in `e2e/_responsive-helper.ts`; knip's playwright plugin doesn't trace it (e2e/ isn't in `project`), so knip reports a false **"Unused devDependency"** → **RED gate on every project that upgrades to DR-074.**
4. **(c) `verify.sh` runs the e2e gates in FOUR separate `playwright` invocations** (`test:smoke`, `test:visual`, `test:responsive`, `test:shell`). Each invocation starts+stops its own `next dev` webServer on the fixed port; between invocations the port is torn down/re-bound, so a later invocation hits **`ERR_CONNECTION_REFUSED`** non-deterministically (observed: desktop passed, mobile refused). A flaky red gate.
5. **(d) The DR-075 standard wording is too absolute.** `build-orchestration.md` §3 + `design.md` §5b say the app shell is "a foundation WORK ORDER, **not** a feature FRD." That was meant narrowly (don't AUTO-EMIT an orphan `frd-00` at greenfield shard time) but reads as "never an FRD" — which contradicts the right move for a deliberate re-anchor (MC's app shell merits a real, PRD-rooted FRD with foundation-marked WOs).

**(a3) The conformance MECHANISM itself.** `upgrade`'s gate-config check "diff vs template → **overwrite** the project's copy" assumes the **template is always newer**. When a project was fixed in-place and the fix was never back-ported (exactly what happened to MC's biome/knip), the overwrite **REGRESSES** the project. The MC upgrade only stayed green because the regression was caught by hand and reverted.

## The change

### Back-port the UNIVERSAL fixes into the canonical templates (a1, a2, b)

Adopt into `plugin/templates/stack-a-nextjs/biome.json` ONLY the universally-correct deltas (NOT MC-specific ones):
- **`biome.json`**: add `css: { parser: { tailwindDirectives: true } }`; add `!.pandacorp/**` to `files.includes`; add `style.useExportType: "error"`.
  - **NOT adopted (MC-specific / redundant):** `complexity.noImportantStyles: "off"` (MC's pixel-art skin uses `!important` — that's a per-project opt-out, belongs in a separate project config, NOT the canonical template); `!**/*.py` (redundant with `ignoreUnknown: true`); `trailingCommas: "all"` (already the biome 2.x default).
- **`knip.json`**: bump `$schema` to `knip@6`; **delete the `_pandacorp` key** (knip v6 rejects it; move its provenance note to a real comment-free form or the STACK.md); set `ignoreDependencies: ["tailwindcss", "@axe-core/playwright"]`.

### Fix the e2e port race — one playwright invocation (c)

`verify.sh`: keep the **fail-closed existence checks** (each of the four gates' script/spec must exist → RED with its actionable message), but run the specs in **ONE** invocation — `pnpm exec playwright test e2e/` (or a `test:e2e` script) — so a single webServer is started/stopped for the whole e2e suite. This removes the inter-invocation teardown/re-bind race while preserving fail-closed-missing-harness behavior. (`--since` is unaffected: it scopes vitest, not e2e.)

### Harden the conformance MECHANISM (a3)

`upgrade`'s gate-config conformance gains a **drift-direction awareness**: before overwriting a canonical gate file, if the project's copy DIFFERS from the template, do not blindly clobber — **diff and decide**: a project that is *behind* → regenerate (today's behavior); a project that appears *ahead* (carries config the template lacks) → **FLAG it to the owner** ("project X's biome.json has settings the template doesn't — back-port to the template or confirm overwrite") rather than silently regressing. Paired with a **discipline rule**: *fixing a canonical gate file in a project REQUIRES back-porting the fix to the plugin template in the same change* (else the next upgrade reverts it). This DR is itself that back-port for the known deltas.

### Soften the DR-075 shell wording (d)

`build-orchestration.md` §3 + `design.md` §5b: keep "don't auto-emit an orphan `frd-00` at greenfield shard time," but clarify that **a deliberately-authored app-shell FRD rooted in the PRD is correct** (e.g. a brownfield re-anchor), with its work orders marked `foundation: true` so they still build first. The shell's *user contract* (persistent nav, active-state, responsive) belongs in an FRD; the *build-first ordering* comes from the foundation flag — both, not either/or.

## Feasibility
- **a1/a2/b (template content): LOW** — edit two JSON files; the deltas are identified + classified.
- **c (verify.sh): LOW-MEDIUM** — restructure the e2e section (preserve fail-closed messages, one run).
- **a3 (conformance mechanism): MEDIUM** — `upgrade` skill prose; the diff-and-flag-on-ahead path.
- **d (wording): LOW** — two standard edits.

## Pre-identified risks (input for the red team)
1. **Which deltas are truly UNIVERSAL vs MC-specific?** Pressure-test the classification. Is `tailwindDirectives: true` correct for ALL stack-a-nextjs projects (does the template's `globals.css` actually use `@theme`)? Is dropping `noImportantStyles: off` from the template right (or do enough design systems need `!important` that the canonical should allow it)? Is `useExportType` safe to add (any project it would newly break)? Is `tailwindcss` always knip-unused, or does some setup import it?
2. **Does adding `@axe-core/playwright` to `ignoreDependencies` mask a real future "unused" if the responsive gate is removed?** Is `ignoreDependencies` the right knip fix, or should knip's `project`/playwright-plugin be configured to TRACE `e2e/` (so the dep is seen as genuinely used)? Which is more robust?
3. **The one-invocation e2e fix (c):** does `playwright test e2e/` preserve every fail-closed property (a missing spec/harness still RED)? Does running all specs together change baseline-blessing or the `--since` per-FRD flow? Is the real root cause the 4-invocation race, or the always-on/checkout `.next` contention (a different, deferred problem) — i.e. will (c) actually fix the observed `ERR_CONNECTION_REFUSED`?
4. **The conformance mechanism (a3):** is "diff-and-flag-on-ahead" the right fix, or does it erode the "canonical = source of truth, force conformance" guarantee (DR-059's whole point) and add owner friction every upgrade? Is the simpler answer just "template always leads + back-port discipline" (no mechanism change), with this DR as the back-port? Where's the line — how does `upgrade` reliably tell "project ahead" (a legit in-place fix) from "project drifted" (an owner's unwanted tweak that SHOULD be overwritten)?
5. **MC's own `noImportantStyles: off`:** if the template does NOT carry it, MC's next conformance upgrade would overwrite MC's biome.json and RED its `!important` CSS. Does MC need a separate project-config file (biome `extends`) for its opt-out — and is that in scope here or a separate MC cleanup?
6. **Versioning / parallel work:** the plugin is at v8.37.0 (a parallel change, `036ec5b`, just landed). This DR bumps again (8.37.1 PATCH? 8.38.0?). Is a template-config fix a PATCH (no behavior change) or MINOR? Does any of this collide with in-flight factory work?

---

# RED-TEAM RESULTS (3 adversarial agents, opus — 2 ran empirical tests against MC) + v2 (DR-076)

Lenses: **A** = config-correctness (TESTED biome/knip on MC), **B** = conformance-mechanism (git-forensics), **C** = verify.sh runtime (playwright-source + symptom topology). Three decisive corrections to v1:

## Findings
1. **A (must-fix, empirical): `noImportantStyles: off` is NOT MC-specific — KEEP it in the template.** v1 misclassified it as "MC pixel-art skin." MC's ONLY `!important` is the `prefers-reduced-motion: reduce` block (`globals.css:269-272`) — the WCAG motion-kill that `!important` is the correct tool for, and that the factory's OWN `accessibility.md` MANDATES. Proven: dropping it + `--error-on-warnings` (what `verify.sh` runs) → 4 warnings → **EXIT 1 RED** on a fresh project's a11y CSS. So it stays `off` in the canonical template (this also auto-resolves risk 5 — MC never regresses, and no per-project opt-out is needed). All other A deltas CONFIRMED by test: `tailwindDirectives:true` (biome parse-errors on `@theme` without it), `!.pandacorp/**`, `useExportType` (0 new diagnostics), knip@6 + drop `_pandacorp` (knip v6 exit 2 otherwise), `ignoreDependencies:["tailwindcss","@axe-core/playwright"]`. Omit `!**/*.py` + `trailingCommas` (confirmed redundant).
2. **A (b — the right knip fix): `ignoreDependencies`, NOT tracing `e2e/`.** v1 risk-2 asked whether to add `e2e/**` to knip `project` so the dep is "genuinely used." Tested: that **introduces a NEW false-positive** (`readTargetPlatform` in `_target.ts` reported unused) → still RED. `ignoreDependencies` is strictly more robust.
3. **B (must-fix): REJECT a3 (diff-and-flag-on-ahead).** It erodes DR-059's binary guarantee, the "ahead vs drifted" call is NOT mechanically decidable (classifying the MC deltas needed reading `globals.css` + WCAG reasoning — `upgrade` runs blind in-project), it freezes the in-place-edit as a blessed state, and it adds friction to every otherwise-silent (DR-048) compatible upgrade. **Git forensics:** the template `knip.json` was touched ONCE at DR-059 install (`6d1e379`) and never again; MC's fix landed in-place (`b6c2fa7`) and never back-ported. **The regression was a discipline violation, not a mechanism failure.** → Keep DR-059's overwrite-on-drift UNCHANGED; fix the root cause (back-port reliability) with **a discipline rule + an enforcement hook**, not by weakening conformance.
4. **C (decisive): v1's (c) root-cause is WRONG.** Today's `ERR_CONNECTION_REFUSED` is a **mid-invocation dev-server death from `.next`/process contention**, NOT the 4-invocation race. Proven from the symptom topology: `visual.spec` runs desktop THEN mobile under ONE invocation (`workers:1`); desktop passed, mobile refused → the server died WITHIN one invocation (a boundary 4→1 never touches). Matches `lessons.md:124` exactly (always-on/`.next` contention). The real fix is the **deferred worktree isolation** (+ Stop-hook `running:true` skip). The 4→1 change is still worth doing (one server boot, ~4× faster, removes a real-but-not-today inter-invocation hazard) — but it must be **re-framed honestly as a cleanup, not the contention fix**, and C's rewrite is **better** (gate on the SPEC FILE, not the npm script — a deleted spec with the script present would otherwise pass green).
5. **B (scope-trim): do NOT build the `biome.project.json` extends mechanism now.** Since `noImportantStyles` stays universal (A), no project needs a per-project lint opt-out today → shipping the `extends`+seed machinery would be speculative (YAGNI). Note it as DR-059's unshipped "separate-file" half, to build when a genuine project-specific opt-out arises.
6. **B (defer): the factory-side "template-never-behind-a-project" CI check** is the strongest enforcement but needs a factory-side runner that doesn't exist yet — heavier. Ship the cheaper, proven enforcement now (reminder hook + rule); flag the factory-CI as a stronger backstop to add later.

## v2 — the design (DR-076)
1. **Back-port the UNIVERSAL deltas (A's tested-green files):** `biome.json` += `css.parser.tailwindDirectives:true`, `!.pandacorp/**`, `style.useExportType:"error"` — **KEEP `complexity.noImportantStyles:"off"`** (universal a11y, not MC-specific); omit `!**/*.py`/`trailingCommas`. `knip.json` → `knip@6` schema, **delete `_pandacorp`** (provenance moves to STACK.md), `ignoreDependencies:["tailwindcss","@axe-core/playwright"]`.
2. **Conformance mechanism UNCHANGED (B):** `upgrade` keeps unconditional overwrite-on-drift (DR-059 intact). Add a **discipline rule** — *canonical gate files (`biome.json`/`knip.json`/`.pandacorp/verify.sh`/the six VERBATIM e2e files/`playwright.config.ts`) are edited at the SOURCE template, never in-place; an in-place project edit is reverted by the next `/upgrade` by design; a genuine project-specific exception goes in a separate never-overwritten file* — in `upgrade` Rules + `quality.md`. **Enforce it** with a new `PreToolUse(Write|Edit)` hook `remind-backport-gate-config.sh` (cloned from `remind-manual-sync.sh`, DR-046 pattern): fires when a canonical gate file is edited inside a project, nudges to back-port (plugin-scoped, NO overlay bump for the hook itself).
3. **(c) verify.sh 4→1 cleanup, honestly framed (C's exact rewrite):** keep the fail-closed checks but gate on the **spec FILE** (+ `playwright.config.ts`) existing (not the npm script), then ONE `pnpm exec playwright test e2e/`; comment that it pins `workers:1` and that it is a cleanup — **the observed `ERR_CONNECTION_REFUSED` is `.next` contention, fixed by the deferred worktree isolation, not by this.**
4. **(d) soften the DR-075 shell wording** in `build-orchestration.md` §3 + `design.md` §5b: don't auto-emit an orphan `frd-00` at greenfield shard time, but a deliberately-authored app-shell FRD (PRD-rooted) with `foundation:true` WOs is correct.
5. **Versioning:** OVERLAY_VERSION 8.36.1 → 8.37.0 (templates changed → projects re-sync on `/upgrade`); plugin.json 8.37.0 → 8.38.0 (MINOR — new hook capability). MC already carries the corrected biome/knip (kept during its upgrade), so MC does NOT regress; it picks up the 4→1 verify.sh on its next upgrade (the Fase-A preflight).
6. **Deferred/flagged (NOT in DR-076):** the factory-side template-lead CI check (stronger backstop); the `biome.project.json` opt-out mechanism (YAGNI until needed); the `.next`-contention worktree isolation (already tracked, the real (c) fix); biome `recommended:true`→`preset` migration (deprecated, future biome major — A spawned a task).

Net: fixes all four follow-ups with EMPIRICALLY-verified config, keeps DR-059's guarantee intact, fixes the ROOT cause of the staleness (back-port discipline + hook), and is honest that (c) is a cleanup while the real contention fix is the deferred worktree work.
