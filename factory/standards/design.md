# Design standard (DR-054, DR-055, DR-064)

How the factory produces a project's look, freezes it as a contract, and **guarantees the build
reproduces it**. Born from a failure: Mission Control was adopted with an owner-approved prototype
(`prototype/index.html` + embedded party views) that was the agreed 100% visual target, yet the
design phase discarded it ("reference for functionality only, invent a fresh palette"), never
produced the frozen artifacts, and the build shipped a UI that looked nothing like it — passing
112/112 VERIFIED because nothing ever opened the app in a browser. This standard closes both holes.

## 1. Two design paths — anchor on an approved visual, or explore (DR-054)

Before any visual exploration, the design phase (`/pandacorp:design`) and the brownfield adoption
(`/pandacorp:adopt`) MUST establish whether a visual that is **the binding target** already exists —
a navigable prototype, the live styled UI, an existing token/CSS system, a Figma, or a reference the
owner designated as "the look". **Detect, then confirm — never ask blind:**
1. **Scan the repo first** for an existing visual/design (a `prototype/` or any HTML mockups,
   `docs/design/` artifacts, a token/CSS system in the stylesheets, screenshots, the live UI).
2. **If something is found → present it and let the owner confirm/correct** (in Spanish):
   *"Encontré esto como posible referencia visual: `<files>`. ¿Es esta la referencia definitiva?
   ¿Falta alguna, o no son estas?"*
3. **If nothing is found → ask whether it lives elsewhere** (Figma, another folder). If yes, extract
   from there; if there is genuinely none, take the EXPLORE path.

- **ADOPT-VISUAL path (an approved visual exists) — fidelity, not novelty.** That artifact is the
  frozen visual source of truth. The `designer` **extracts it faithfully** — its real palette,
  typography, spacing, radii, shadows, density, component shapes — into `docs/design/design-tokens.json`
  + root `DESIGN.md`, records `docs/design/design-decisions.md` ("frozen FROM the approved visual at
  `<path>`"), and **stages the assets it needs** (fonts, images, sprites) so the app can serve them.
  If the visual embeds sub-views (e.g. iframes), each embedded file is part of the contract. The
  **3-direction exploration is SKIPPED**; the owner gate is a **fidelity check**, not a direction
  choice. **Demoting an approved visual to a "functional-only reference", "relaxing" or "modernizing"
  it, or telling a later run to invent a fresh look over it, is FORBIDDEN.**
- **EXPLORE path (no approved visual).** The `designer` researches the domain and generates **3
  genuinely different** navigable directions; the owner picks one; it is frozen. Bespoke per domain,
  never a house style (Mission Control's pixel-RPG look is the factory's internal tool, not a product
  template).

## 2. The frozen contract is mandatory and gated (DR-054)

The design phase is **not done** — and does not advance to `architecture` even on the owner's "ok" —
until these artifacts exist (existence is **checked**, not self-asserted; a missing artifact is a
RED gate):

- root `DESIGN.md` (tokens + allowed components + prohibitions),
- `docs/design/design-tokens.json` (the canonical token file the implementation reads — never a
  "frozen" file referenced in code but never written),
- `docs/design/design-decisions.md` (rationale / provenance),
- for **every** FRD that has UI: a non-empty `fdd.md` + `mocks/`, derived from the frozen contract /
  approved visual.

Source-of-truth hierarchy (DR-049): `FRD > FDD > design-tokens > blueprint > work order`.

## 3. Fidelity is enforced downstream, not just "use the tokens" (DR-054)

Using the tokens is necessary but **not sufficient** — a screen can use every token and still look
nothing like the mock. So fidelity rides the whole chain:

- **FRD** declares `ui: true|false` + a `visual_source`; a UI FRD's acceptance criteria include
  visual fidelity to its mocks.
- **Blueprint** Build Plan cites the FRD's `fdd.md` + specific `mocks/` as the visual spec a UI work
  order must reproduce, and lists the assets to stage.
- **Work order** carries a `## Visual reference` + a fidelity acceptance criterion ("the built screen
  visually matches `mocks/<file>`"), alongside the functional ACs.
- **implementer / frontend-dev** must **reproduce** the mock (layout, structure, components, density)
  on the frozen tokens — not approximate it — and stage the assets the mock needs.
- **reviewer** verifies the *rendered result* against the mock (§4), not just token usage in source.

## 4. The Preview Smoke Gate — the app must actually render (DR-055)

The verification surface must operate on the **running** app, not only the static artifact. For any
FRD with UI routes, the gate is **mandatory and fail-closed** (default ON for web; only a genuinely
headless project — pure API, scraper — opts out, recorded as a decision):

- A browser smoke (Playwright, booting the app via `webServer`) loads **each key route** and **fails
  the gate** on any **console error / uncaught `pageerror` / failed request / blank-or-error render**;
  it asserts a real-content sentinel and captures a screenshot to `docs/reviews/smoke/`.
- **Fail-closed: a missing smoke harness is RED, not skipped** — a referenced-but-absent test layer
  must never read as "passed" (the precise hole that let Mission Control's phantom "e2e" degrade to
  vitest and pass).
- It runs inside `verify.sh`, so the per-FRD gate and close-out enforce it automatically; the
  `reviewer` re-runs it independently (generator ≠ verifier) and eyeballs the screenshots vs the
  `mocks/` for fidelity.

Concrete wiring (Playwright config, `e2e/smoke.spec.ts`, the `verify.sh` fail-closed stage) lives in
`plugin/templates/stack-a-nextjs/STACK.md`; the "definition of done" lives in the injectable rule
`plugin/templates/rules/quality-and-testing.md`. Per DR-051, any change here updates the rule library
and bumps `OVERLAY_VERSION` so every project inherits it.

## 4b. Target platform & responsiveness (DR-074)

The **target platform is a product decision made when the app is DEFINED**, not an implicit default
discovered at the end. A new project carries a tracked field `target_platforms ∈ { desktop, mobile,
responsive }` in `.pandacorp/status.yaml`, decided + recorded in the PRD by `spec` (one line: who uses
it on what device). **`responsive` is the default** — most web apps should work on a phone and a
desktop; `desktop`-only / `mobile`-only is the rare, deliberate opt-out (an internal back-office, a
native-companion web view). An adopted (brownfield) project and an existing project being upgraded are
back-filled to the conservative `desktop` (they may not be responsive yet; the owner promotes them once
verified) — only a NEW project is born `responsive`.

**Responsiveness is enforced by the gate, not by per-breakpoint mocks.** There is one mock per FRD;
responsiveness comes from the fluid design system + the shipped **Responsive Gate** (DR-074), which —
when `target_platforms` includes mobile — asserts at the mobile viewport, per scroll-root: **no
horizontal overflow** and **no silent off-canvas clip** (`overflow-x:hidden|clip` while wider than the
box), **tap targets ≥ 24px** (axe `target-size`, WCAG 2.2 SC 2.5.8), and **`<main>` not occluded** by a
fixed bar (WCAG 2.4.11). The gate is SMART, not naïve: a **legitimate horizontal-scroll region** (a
kanban board, a dependency DAG, a wide data table that scrolls by design) marks itself
`data-scroll-x="intentional"` ONCE — that author-declared signal is how the gate tells a real overflow
defect from a designed scroll region (never a heuristic, never wrapping content in `overflow:hidden` to
silence a false red, which would itself create a clip bug). For a `desktop`-only / API / scraper project
the responsive checks are a vacuous pass. Wiring: the VERBATIM templates
`plugin/templates/stack-a-nextjs/e2e/{responsive.spec.ts,_responsive-helper.ts}` +
`plugin/templates/stack-a-nextjs/STACK.md` (Responsive Gate), propagated by `blueprint` and
conformance-checked by `upgrade` (DR-059).

## 5. Guaranteeing 100% fidelity when AI agents implement (DR-056)

"Use the tokens" is necessary but nowhere near sufficient — and the build engine makes it worse: it
passes the implementer **only a one-line summary**, never the design. Research on AI design-to-code
(Design2Code, DCGen, UI2Code^N; v0, Builder.io; Anthropic) converges on the same playbook, and because
the reference IS HTML the agent's job is **translation** (HTML→React+Tailwind+tokens), not
reconstruction-from-pixels. Four mechanisms, **all required**:

1. **Scope / shard.** The design phase shards the approved whole-app prototype into **one
   self-contained mock per FRD** (`docs/frds/<frd>/mocks/`, that FRD's screens only) — never hand an
   agent the whole prototype (on a full screenshot, models reproduce ~2% of elements; scoping recovers
   them). The whole-app prototype's defined home is **`docs/design/prototype/`**.
2. **Ground / materialize.** The per-FRD `fdd.md` + mock and the work order's **`## Visual reference`**
   (the exact `mocks/<file>`, the **token slice** that screen uses, the `fdd.md` pointer) are
   **materialized** — because the engine passes only a one-liner, the **WO body IS the agent's design
   context** (empty = the agent builds blind). The engine **also injects** those refs + the in-loop
   directive into the implementer/frontend-dev prompt (belt and suspenders).
3. **In-loop correct.** The builder renders its route, screenshots it, compares to the mock, and
   self-corrects **up to 3 cycles** *before* `IN_REVIEW` — the single biggest lever after scoping.
4. **Gate (the independent verifier).** The two-layer visual-fidelity gate (§4 + `build-orchestration.md`
   §5): Layer A deterministic `toHaveScreenshot` regression (hard block) + Layer B VLM mock-judge
   (named structural divergences, escalate-on-uncertainty), a different model from the builder.

Plus **complete extraction**: the ADOPT-VISUAL extraction captures **every layer** — base components +
any app-wide skin/theme overrides + each embedded sub-view's own spec — not just the palette (a partial
extraction silently drops the look; in Mission Control an app-wide RPG skin and the Party pixel-art spec
were missed).

## 5b. The app shell is a captured foundation, never orphaned by the shard (DR-075)

The shard in §5 deliberately gives each work order **only its own screen, never the whole app**. But a
whole-app prototype is a SPA with a **persistent shell** — topbar/primary nav (+ active-state), header,
footer, the layout frame every screen mounts into — and that shell **belongs to no single FRD**, so the
per-FRD shard silently drops it. This is the Mission Control failure: the app shipped with **no global
navigation menu at all**, and the visual gate — which proves *consistency* with a self-baseline, not
*fidelity* to the prototype — rendered every page menu-less, blessed menu-less baselines, and passed
112/112 green. Two rules close it:

1. **Capture the shell as a FOUNDATION concern, before sharding.** When the prototype has persistent
   chrome, the design phase registers it as the `AppShell`/`Nav` foundation component in
   `docs/design/components.md` (`artifacts` include `app/layout.tsx` + the nav). `blueprint` schedules it
   in the **foundation wave** (DR-057) so it is built FIRST and every surface route mounts into it; its
   work order(s) are **`foundation: true`** (build-first ordering). **Don't AUTO-EMIT an orphan
   `frd-NN-app-shell` at greenfield shard time** — it would have no `REQ-NN-MMM` in any PRD and the engine
   has no "build this FRD between foundation and surfaces" primitive; the foundation-completeness gate
   enforces "no surface until the shell is green" for free without one. **But a deliberately-authored
   app-shell FRD rooted in the PRD is correct and better-documented (DR-076)** — e.g. a brownfield
   re-anchor where the PM writes the shell's user contract (persistent nav, active-state, responsive) as
   real `REQ`/`AC`; its WOs still carry `foundation: true`. The FRD is where the *contract* lives; the
   `foundation` flag is the *build-first ordering* — both, not either/or. On the brownfield `adopt` path the same capture
   runs: if the code already has a shell, record its real path; if it lacks the shell the prototype shows
   (MC), record it as an **owed** Group-B reconciliation gap (§8) to build on the re-anchor.
2. **Verify FIDELITY to the prototype, not self-consistency — the Shell-Presence Gate.** A new shipped,
   deterministic, fail-closed gate (`e2e/shell.spec.ts`, VERBATIM like the smoke/visual/responsive
   machinery) asserts the app against the **prototype-anchored nav contract** `e2e/shell.ts`
   (author-declared at design time, drifts only when the prototype changes — never derived from the app's
   own routes, which would just move the consistency-not-fidelity trap up a level). On every declared
   route (minus author-declared exempt routes): the persistent shell landmark is **visible**, every
   top-level destination is a **visible in-shell link to its correct path**, each destination
   **2xx-resolves**, and on mobile the nav is reachable. Empty contract (an app with no shell) ⇒ a vacuous
   pass. The reviewer's whole-app fidelity check is the advisory companion (shell *resemblance* —
   placement/order/active-state — is a punch-list nit, never a block, DR-072 preserved); the **block is
   the deterministic gate**.

## 6. Demo-only controls in prototypes are visibly marked (DR-061)

A navigable prototype often needs affordances that exist **only to preview states** — a mode/effort
picker, play/pause, reset, a state toggler — so the owner can see how each state looks. These do **not**
exist in the real product (which is frequently read-only, or driven by a skill/CI, not by buttons).
Leaving them unmarked makes the owner read demo affordances as real behaviour (a real confusion in
Mission Control: the prototype's effort picker + power/reset buttons looked as if the dashboard could
*control* the factory, when MC is read-only and the build is launched by `/pandacorp:implement`).

**Rule — every block of demo-only controls is wrapped and tagged the same way, in every prototype:**
- a **dashed border** container, plus a small uppercase **`DEMO`** tag (warning colour), plus a
  **one-line note** stating they are preview-only and how the real thing actually works (e.g. "launched
  via `/pandacorp:implement`; the app is read-only").
- Any value the **real** app *will* surface (e.g. the effort level a build ran with) is shown as
  **read-only data in a real UI surface**, never only inside the demo block.
- The tag/note use the prototype's UI language (Spanish by default → "SOLO DEMO").

Canonical pattern (adapt tokens to the project's system):
```css
.demo-controls{border:1px dashed var(--bd2);border-radius:10px;padding:8px 11px}
.demo-badge{font:10px var(--mono);color:var(--warn);background:var(--warn-bg);
  border:1px solid var(--warn);border-radius:6px;padding:2px 7px;text-transform:uppercase}
```
```html
<div class="demo-controls">
  <span class="demo-badge">🔧 solo demo</span>
  <span class="demo-note">No existen en la app real (solo lectura): … Aquí solo previsualizan estados.</span>
  …controls…
</div>
```

## 7. One cohesive application — consistency across surfaces (DR-062)

The whole app must feel like **ONE application**, not a set of screens each designed in isolation. Beyond reusing *components* (DR-057), the structural **patterns that frame every surface** are standardized:

- **Page titles — one pattern, everywhere.** The same title block (H1 style + optional one-line subtitle) on every top-level page, and the **page H1 equals its nav-menu label** (nav "Propuestas" → H1 "Propuestas"); any extra description goes in the **subtitle**, never as a different title (the *you-are-here* principle — a page whose title differs from the menu item the owner clicked breaks orientation). Either every page carries a title or each omission is **justified**, not ad-hoc.
- **Section headers, tabs, chips/badges, panels/cards, command affordances, empty states, spacing rhythm** — each is **ONE canonical pattern reused everywhere**. A surface that invents its own variant of an existing pattern is a **cohesion defect**, the same class of bug as a near-duplicate component.
- **Deviations only where genuinely justified** (e.g. an intentionally immersive view); the justification is recorded, never silent.

Enforced two ways: the design phase **defines these framing patterns in the system** (the Claude Design system / `docs/design/components.md`, where titles/section-headers/tabs are first-class shared primitives, not per-screen ad-hoc markup), and the **`reviewer`'s runtime/visual lens checks cross-surface consistency** — a screen that looks like a *different app* from its siblings is rejected, exactly like a duplicate component. The owner must never feel they jumped between different apps when switching tabs.

## 8. Functional reconciliation prototype ↔ FRD — bidirectional (DR-064)

When the factory blesses an approved prototype as the canonical source of truth (the ADOPT-VISUAL
path, §1, and any design re-anchor), it must reconcile **functionality**, not only the **look**. The
Mission Control failure had two causes, not one: the design wasn't anchored (fixed by DR-054/056)
**and** behaviour the owner had put in the prototype was never reflected in the FRDs (owner: *"puede
ser un error mío por no documentarlo bien"*). An approved whole-app prototype is the source of truth
for **BEHAVIOUR too**, so the reconciliation runs **both directions before the prototype is blessed**:

- **Group A — the prototype HAS it, the FRD LACKS it → update the FRD.** Every interaction, state,
  screen, affordance or flow the prototype shows that no FRD documents is surfaced and **written into
  the owning FRD** (acceptance criteria + FDD), so the build actually produces it. A demo-only control
  (DR-061) is the exception — it is marked, not promoted to a requirement.
- **Group B — the FRD WANTS it, the prototype LACKS it → build it into the prototype (or flag the
  hole).** Every behaviour an FRD specifies that the prototype doesn't show is either **built into the
  prototype** (so the visual gate has a real screen to verify against) or **explicitly flagged as a
  gap** — never silently grounded on a screen that doesn't exist. A visual/fidelity gate anchored on a
  missing screen is a false gate.

The reconciliation is **explicit and itemized** (in Mission Control we found ~7 of each), surfaced to
the owner, and resolved BEFORE the prototype is frozen as canonical — a visual-only re-anchor that
leaves functional divergence is **not done**. This is the functional analogue of the
complete-extraction rule (§5): extraction captures every visual layer; reconciliation captures every
behavioural one.

## 9. Where this is wired

| Concern | File |
|---|---|
| Design phase (two paths, frozen contract, deliverable gate) | `plugin/skills/design/SKILL.md`, `plugin/agents/designer.md` |
| Brownfield design adoption (detect + migrate an existing visual) | `plugin/skills/adopt/SKILL.md` |
| Fidelity downstream (templates + skills + dev agents) | `plugin/templates/docs/{frd,blueprint,work-order}-template.md`, `plugin/skills/{spec,blueprint,work-orders}/SKILL.md`, `plugin/agents/{implementer,frontend-dev}.md` |
| Shard the prototype per-FRD + prototype home (DR-056 §1) | `plugin/skills/design/SKILL.md` (Step 8), `plugin/agents/designer.md`, `plugin/skills/adopt/SKILL.md` (step 6) |
| App shell = captured foundation + Shell-Presence Gate (DR-075 §5b) | `plugin/templates/stack-a-nextjs/e2e/{shell.spec.ts,shell.ts}`, `plugin/templates/stack-a-nextjs/{verify.sh,STACK.md}`, `plugin/skills/design/SKILL.md` (Step 8a), `plugin/skills/{blueprint,upgrade,adopt}/SKILL.md`, `plugin/agents/{designer,reviewer}.md`, `factory/standards/{build-orchestration,quality}.md` |
| Engine injects design refs into the build prompt (DR-056 §2) | `plugin/templates/shared/.claude/workflows/pandacorp-build.js` (`designRef`) |
| In-loop render→compare→correct (DR-056 §3) | `plugin/agents/{implementer,frontend-dev}.md` |
| Two-layer visual-fidelity gate (DR-056 §4) | `plugin/agents/reviewer.md`, `factory/standards/build-orchestration.md` §5, `plugin/templates/stack-a-nextjs/STACK.md` |
| Runtime/visual verification (smoke) | `plugin/agents/reviewer.md`, `factory/standards/build-orchestration.md` §5, `plugin/templates/stack-a-nextjs/STACK.md`, `plugin/templates/rules/quality-and-testing.md` |
| Target platform + responsive gate (DR-074) | `plugin/templates/stack-a-nextjs/e2e/{responsive.spec.ts,_responsive-helper.ts}`, `plugin/templates/stack-a-nextjs/STACK.md`, `plugin/templates/shared/.pandacorp/status.yaml.tpl` (`target_platforms`), `plugin/skills/{spec,blueprint,upgrade,adopt}/SKILL.md`, `factory/standards/quality.md` |
| Demo-only controls marked in prototypes (DR-061) | `plugin/skills/design/SKILL.md`, `plugin/agents/designer.md` |
| One cohesive app — cross-surface consistency (DR-062) | `plugin/skills/design/SKILL.md`, `plugin/agents/designer.md`, `plugin/agents/reviewer.md` |
| Functional reconciliation prototype ↔ FRD, bidirectional (DR-064) | `plugin/skills/design/SKILL.md`, `plugin/skills/adopt/SKILL.md`, `plugin/agents/designer.md` |
