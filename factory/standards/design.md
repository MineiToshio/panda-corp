# Design standard (DR-054, DR-055)

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

## 5. Where this is wired

| Concern | File |
|---|---|
| Design phase (two paths, frozen contract, deliverable gate) | `plugin/skills/design/SKILL.md`, `plugin/agents/designer.md` |
| Brownfield design adoption (detect + migrate an existing visual) | `plugin/skills/adopt/SKILL.md` |
| Fidelity downstream (templates + skills + dev agents) | `plugin/templates/docs/{frd,blueprint,work-order}-template.md`, `plugin/skills/{spec,blueprint,work-orders}/SKILL.md`, `plugin/agents/{implementer,frontend-dev}.md` |
| Runtime/visual verification | `plugin/agents/reviewer.md`, `factory/standards/build-orchestration.md` §5, `plugin/templates/stack-a-nextjs/STACK.md`, `plugin/templates/rules/quality-and-testing.md` |
