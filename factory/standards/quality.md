# Quality and testing

## Gates (verified by scripts/CI, never by the agent's self-report)
Validation order before considering something done:
1. **Tests** (unit + integration) green.
2. **Type-check** strict with no errors (`tsc --noEmit` / `mypy --strict`).
3. **Lint + format** with no errors or new warnings (the stack's linter/formatter).
4. **Build** clean where applicable.

These commands live in the project's `.pandacorp/verify.sh` and the factory's `Stop` hook requires them: an agent cannot declare "done" if `verify.sh` fails.

**The Stop gate is PHASE-AWARE — strict at rest, stand-aside during an active build (DR-063).** The strict whole-project `verify.sh` is the right gate for an ordinary "done" turn, but it is the WRONG gate to run on *every* Stop *while an incremental build is in flight*: mid-build the tree is legitimately red between safe points (a work order in flight, untracked files yet to pass their self-test), so a strict per-turn gate blocks every turn — in the building session **and** in any other session parked at that `cwd` in a shared repo (it runs the whole project-in-cwd suite even for a session that never touched that project). So enforcement is split: **(a) per-FRD inside the build** (`verify.sh --since <last_green>`, run by the engine's FRD gate) and **(b) the full suite at close-out** (the engine's final pass) — both strict, both owned by the build engine. Meanwhile the **Stop hook stands aside during an active build**: the supervisor maintains a freshness-stamped lock at `.pandacorp/run/build.lock` (touched at launch + every ~2-min heartbeat; gitignored runtime state), and `verify-before-stop.sh` no-ops when that lock is fresh (`< 10 min`), re-engaging strictly the moment the build ends or the lock goes stale (the same 10-min TTL as the concurrent-run guard, DR-050 §9). `verify.sh` itself is **always strict** — it never softens itself; only the Stop-hook wrapper is phase-aware (so the engine, which invokes `verify.sh` directly, still gets the full strict gate).

**The Responsive Gate is a shipped, fail-closed gate (DR-074).** A web app that ships desktop-first and overflows on a phone passes smoke + visual (they only check "renders" + "matches its OWN baseline"). The Responsive Gate closes that hole: it ships as a VERBATIM stack template (`e2e/responsive.spec.ts` + `e2e/_responsive-helper.ts`, the DR-059 propagation mechanism), runs inside `verify.sh` (fail-closed — a missing harness is RED), and asserts at the **mobile viewport** — **only when the project's `target_platforms` (`.pandacorp/status.yaml`) includes mobile** (default `responsive` for new projects; `desktop` for retrofitted/adopted ones, a vacuous pass). Per scroll-root it RED-flags: **horizontal overflow** and **silent off-canvas clip** (`overflow-x:hidden|clip` while wider than the box), **tap targets < 24px** (axe `target-size`, WCAG 2.2 SC 2.5.8), and **`<main>` occluded by a fixed bar** (WCAG 2.4.11). It is SMART, not naïve: a legit horizontal-scroll region (kanban/DAG/wide table) marks itself `data-scroll-x="intentional"` once — the broken-vs-intentional distinction is author-declared, not heuristic. Canonical wiring: `factory/standards/design.md` §4b + `plugin/templates/stack-a-nextjs/STACK.md` (Responsive Gate).

**The Shell-Presence Gate verifies FIDELITY to the prototype, not self-consistency (DR-075).** The visual gate (`toHaveScreenshot`) is a SELF-baseline regression guard — it proves the app matches its OWN committed baseline, not that it matches the approved prototype. So a build rendered with **no global navigation menu** produced menu-less baselines and shipped 112/112 green (the Mission Control failure). The upstream cause: the per-FRD shard ("only that FRD's screens, never the whole app") drops the **persistent shell** (topbar/nav/footer/layout frame), which belongs to no FRD. The fix is two-part: the shell is captured as a **foundation work order** (built first, surfaces mount into it — `build-orchestration.md` §3 / DR-057), and a shipped, deterministic, fail-closed **Shell-Presence Gate** (`e2e/shell.spec.ts`, VERBATIM like smoke/visual/responsive, runs inside `verify.sh`) asserts the app against the **prototype-anchored** nav contract `e2e/shell.ts` — author-declared at design time, never derived from the app's own routes (which would just move the consistency-not-fidelity trap up a level). On every declared route (minus author-declared exempt routes): the persistent shell landmark is visible, every top-level destination is a visible in-shell link to its correct path, each destination 2xx-resolves, and on mobile the nav is reachable. It iterates `SURFACES` (not `BLESSED` — the MC failure is a route that shipped *blessed* without the shell). An app with no persistent shell (empty contract) ⇒ a vacuous pass. The reviewer's whole-app fidelity check is the advisory companion (shell *resemblance* is a punch-list nit, never a block — DR-072 preserved). Canonical wiring: `factory/standards/design.md` §5b + `build-orchestration.md` §3/§5 + `plugin/templates/stack-a-nextjs/STACK.md` (Shell-Presence Gate).

**The gate CONFIG propagates VERBATIM and is conformance-checked (DR-059) — not just the prose rules.** The audit lesson: standards written only in prose + a STACK.md example never actually reached a project's `verify.sh`/`biome.json`, so the smoke/visual gates, `knip`, the Biome domains (`react`/`next`/`test`/`a11y`) and `complexity: error` were all silently OFF, with nothing checking the wiring. So the canonical gate files — `verify.sh`, `biome.json`, `knip.json` — ship as templates in the stack folder and are **installed byte-for-byte** into every project (the way `docs/rules/` are), never hand-rolled. `/pandacorp:upgrade` then **diffs each against its stack template and regenerates/fails on drift**, so a project's enforcement can never silently fall behind the standard. **Every gate is fail-closed**: a missing harness is RED, not a skip — `verify.sh` runs `set -euo pipefail` + `inherit_errexit`, promotes every lint warn to a hard gate (`biome check --error-on-warnings`), and a missing smoke (DR-055) or visual (DR-056) harness exits ≠0 with an actionable message instead of passing.

**Gate hardening (DR-019):** `verify.sh` is **fail-closed** (any ambiguous or unparseable output = failure, never "passes by default"), runs in a clean environment, **does not expose to the generating agent the exact names of the tests** it must pass nor the fixtures, and emits **actionable messages** (which rule failed and why — rule-based feedback is the most effective for an agent to self-correct; "LLM-as-judge" is not reliable).

## Observability-fidelity gate (DR-066, projects with a dashboard/monitor)
A UI/transport that claims to show a **live** process must prove it tells the truth about its own liveness before it ships. Applies to any monitor, status page or "live" surface (the canonical rule is in [observability.md](observability.md) "Liveness & freshness fidelity"):
1. **Liveness crosses `running` with recency** — a test asserts the UI reads `live ⇔ running AND (now − heartbeat) < window`, NOT the flag alone. A frozen `running: true` with a stale heartbeat must render as **stale/sin señal**, not live.
2. **Freshness is declared** — the UI shows its data age in three bands (en vivo `< 3·T` / **datos de hace X** / **sin señal** `≥ hard_TTL`); intermediate-age data is stamped, never passed off as live.
3. **The "sin señal" path is actually exercised** — a test **stops the producer** (no more heartbeats) and asserts the UI flips to stale/sin-señal within `hard_TTL` instead of freezing on the last value. "Silence is not success" for a monitor exactly as for a build.
4. **Real-change latency is bounded** — a real state change is reflected in the UI quickly: push/watch (fs-watch on the event stream, SSE, websocket) for near-real-time when the transport allows it at ~zero cost; poll-based fallback bounded to **≤ 30 s worst case** (never tighter than the app's performance/resource budget allows). The producer side (positive, time-driven heartbeat) is in [build-orchestration.md](build-orchestration.md) §9.

## Adversarial and independent verification (DR-015)
- The **generator and verifier cannot be the same model**: an LLM's errors cluster and its tests inherit its blind spots. The `reviewer` (opus, ideally from a different family than the generator) **re-runs** all the evidence and writes **adversarial and edge-case tests that the implementer didn't see**.
- The tests are anchored in **human sources** —EARS criteria of the FRDs and real bugs from `.pandacorp/comms/progress.md`—, not in the model's imagination.

## Mutation and property-based testing (DR-016)
- **Mutation testing** (Stryker in TS / mutmut in Python) detects decorative tests: if mutating the code doesn't break any test, the test proves nothing. Run **at the close of each FRD milestone** and in CI toward main (not at every Stop gate — it is expensive). Target mutation score ≥60% on new business logic.
- **Property-based** (fast-check / hypothesis) for logic with invariants (parsers, calculations, serialization): generates hundreds of cases a human wouldn't enumerate.

## Testing strategy (by risk, not by blind %)
- **Unit**: business logic, calculations, validation, parsers.
- **Integration**: Server Actions + data layer + rules together; third-party integrations.
- **E2E** (Playwright or equivalent): only the MVP's critical flows (auth, core flow, payments), with `data-testid` selectors (never CSS classes).
- **Do not** test trivial markup or exact copy assertions (use ARIA roles).
- **Branch** coverage over business logic (target ≥80% on new code).

## E2E hygiene
- Tests that create data clean it up in their teardown (deterministic keys). Never leave test data in a shared DB.

## TDD per work order
- Tests of the acceptance criteria first (RED) → minimal implementation (GREEN) → refactor. Max 3 repair attempts per subtask, then escalate.

## Accessibility and performance (CI gates, web)
- **a11y-gate**: **Biome's `a11y` rule group** (enabled by default — Biome is the standard linter) **+ axe-core over the REAL built pages** (not just the design mockups). Covers ~30-40% of WCAG 2.2 AA → automatic gate **+ `reviewer` check** (focus and contrast are not detected by the linter). **target-size 2.5.8 is now a WIRED gate, not just advisory** (DR-074): the Responsive Gate runs axe `target-size` over the real built pages at the mobile width and fails on a sub-24px tap target — moving what this line previously deferred to the `reviewer` into the fail-closed `verify.sh` gate. Don't promise full determinism.
- **performance-gate**: see [performance.md](performance.md) (Lighthouse-CI as a lab proxy, block-on-main).

## CI
- GitHub Actions on every PR: type-check + lint + tests (in parallel). E2E on PRs toward main. Protected branches; merge only with CI green.
- Toward main (not on every PR, for cost): **mutation testing** + **agentic OWASP audit** (DR-017) + generation of **changelog and ADRs** (DR-018, living documentation). The CI gates are independent of the agent: the model never marks its own checks.
