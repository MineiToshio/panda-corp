# Design standard (DR-054, DR-055, DR-064)

> Domain: Design · Severity: **MUST** · Enforcement: CI gate (design-token gate DR-056, prototype-fidelity + shell-presence gates DR-074/075) + human gate (owner's visual gate) — **factory-internal (process)**: the process itself doesn't ship; its project-facing parts ship via `rules/styling-and-ui.md` + `rules/accessibility.md` and the verbatim e2e gate specs (DR-051/DR-059).

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

## 1b. Each project earns its OWN visual identity — never a house style (DR-098)

There is **no factory-wide default aesthetic**. Every project's look is chosen **for that project** — fit
to its **audience, use case and purpose** — not inherited from the factory or a prior project. A playful
consumer app, a serious B2B tool, and a personal portfolio that must read as trustworthy to recruiters are
deliberately *different* looks; the EXPLORE path (§1) researches the domain/audience and proposes directions
FOR THAT PROJECT, and that audience constraint drives the exploration (e.g. recruiter audience → professional,
clean, confidence-inspiring; never gamified). **Mission Control's gamified pixel-art / RPG skin is Mission
Control's own identity, NOT a template** — never carry it (or any prior project's look) into a new project
by default. Reusing one project's aesthetic for another is a defect, the same class as ignoring an approved
visual (§1). (Owner rule, 2026-06-27; reinforces the §1 EXPLORE "bespoke per domain, never a house style".)

## 1c. Generating with Claude Design — connection, an exhaustive brief, pull-and-review (DR-058)

When the EXPLORE path uses **Claude Design** (claude.ai/design) to generate the system, the division of
labour is fixed and the brief MUST be **exhaustive** — both learned the hard way (PersonalPage v2,
2026-06-27): a thin brief let the canvas ship only tokens + brand and defer the whole component gallery and
screens ("full gallery comes with the 6 screens"), with no nav menu, no avatar, no real case-study cards, no
social links, no forms, no states — and the first system came out visually **flat** (the only transition
defined was link-colour).

**How it connects (don't repeat the wrong assumptions).** The **generative engine is the web canvas**,
driven by the **owner** with a prompt — the agent **cannot** pilot it remotely. The agent has the
**`DesignSync` tool**: **file sync only** (`list_projects`, `get_file`, `list_files`, `create_project`,
`finalize_plan`, `write_files`, `delete_files`). Auth is a **one-time `/design-login`** in an interactive
terminal (per machine/user, persists; unavailable in headless/SDK sessions). **`/design-sync` is push-only**
(bundles existing React code → claude.ai/design), not a generator and not a pull; **`/design` may not exist**
in a given build. **Never claim a slash command exists or not from a filesystem search** — built-in skills
are bundled at runtime and aren't greppable; **defer to the owner's autocomplete.** Plan B when the agent
session can't authorise: the owner generates on the canvas and uses "Send to Claude Code Web", or runs
`/design-sync` from their terminal.

**Procedure — driven by `plugin/skills/design/references/canvas-procedure.md` (DR-109), the numbered
stateful algorithm.** In outline: (1) setup (project + the on-disk state under `docs/design/canvas/`);
(2) **upload ALL context** as markdown (master brief + `microcopy.md` + `voice-and-tone.md` +
`references.md` + the surface playbooks); keep the uploaded brief in sync when the direction changes;
(3) Stage 1 — **ONE exhaustive generation prompt** built from the checklist below → **PULL-and-REVIEW**
(`list_files`/`get_file`) against it, corrective prompts, *then* the owner gate; (4) Stage 2 — ALL the
screens, tracker-driven (§11); (5) the **closing sweep** (below); (6) integrate
(tokens→`design-tokens.json`+`DESIGN.md`, `_ds_manifest.json`→`components.md`, shard per FRD).

**Relay mechanics (DR-109) — automate the messages, never the decisions.** *Outbound* (prompt →
canvas), best available transport: the owner's browser via **claude-in-chrome** (agent pastes +
submits in the logged-in canvas chat) when connected and allowed — **VERIFIED working end-to-end
2026-07-01** (opened the PersonalPage v2 project, submitted a prompt, read the reply; needs an
interactive session with the extension connected); else **clipboard** (`pbcopy` — the
owner's whole job per round is one Cmd+V); else manual. Every prompt is ALSO written to
`docs/design/canvas/prompts/NNN-<slug>.md` (provenance). *Inbound* (canvas → agent): the agent
**POLLS `DesignSync list_files` until the file set stabilizes** and auto-runs the pull-and-review —
it never asks the owner "¿ya generó?"; the owner only ever receives decisions (approve / correct /
defer). *Journal:* every round appends to `docs/design/canvas/log.md` + the essence to
`.pandacorp/comms/iteration.md` — **DR-032 applies to external-tool rounds too** (personal-page-v2's
journal read "1 clean round" over a many-round canvas reality; that false history is a defect).

**On-disk completeness state (DR-109).** `docs/design/canvas/tracker.md` — one row per deliverable
(row 0 the design system; one row per `ui:true` FRD screen, **enumerated up front from the FRDs**;
the last row the closing sweep), statuses `pending → generated → reviewed → corrected →
owner-approved` / `deferred(owner)`. The design advance gate refuses to advance while any row is
neither `owner-approved` nor `deferred(owner)` — a skipped screen is structurally impossible on any
model (externalized state, not attention — the same mechanism class as work-order frontmatter).

**Closing sweep — bidirectional component reconciliation (DR-109).** After the last screen: diff the
union of components/patterns actually used across ALL generated screens against the Stage-1 gallery +
`_ds_manifest.json`, both directions — used-but-not-in-system → back-port to the gallery (or a
recorded exception); in-system-but-unused → confirm intentional or prune. Only then bridge the
manifest → `components.md`. This closes "components appeared in screens but never in the design
system" (personal-page-v2: the project card + CTAs).

**Engine routing (DR-109) — pick the engine by situation, never by improvisation:**

| Situation | Engine |
|---|---|
| Greenfield EXPLORE, canvas auth available | **Claude Design** (default, DR-058) |
| EXPLORE, no canvas access / headless session | Hand-authored HTML directions |
| ADOPT-VISUAL (approved visual exists) | Neither generates — extract faithfully (§1); optional push UP |
| Brownfield with substantial built UI | Iterate in-repo on the frozen system; canvas only for genuinely NEW surfaces |
| Post-freeze per-FRD tweak | In-repo on the frozen tokens; on CD provenance offer the re-sync mirror (DR-081), never auto-push |

Rationale for the default: implementation fidelity from Claude Design output has been HIGH
(token-clean, coherent library + manifest) while hand-authored HTML historically diverged at build
time (Mission Control). Beta + the owner's login; offer, don't force.

**Token authorship.** On EXPLORE+Claude Design the canvas **proposes** the palette/system from the brief's
qualitative direction (mood, dark-default + first-class light, one rationed accent, OKLCH, AA both themes);
the agent **verifies AA and freezes** it. (On ADOPT-VISUAL the agent still **extracts** exact tokens from the
approved visual — §1.)

**The anti-omission completeness checklist** (the brief MUST require all of it; the pull-review MUST verify
it). A design system is "complete enough to gate" only when it defines, in dark AND light:
- **Shell & framing:** AppShell, **Nav (all top-level links + active state + mobile drawer/hamburger)**,
  Footer, ThemeToggle, LangSwitcher (when bilingual), PageTitle block (H1 = nav label), SectionHeader, CTA
  band, MetaRow.
- **Media — never leave a "where does the photo go" hole:** **Avatar** and **MediaFrame** (aspect-ratio
  image), each with **placeholder media by default** (silhouette avatar; cover with gradient + image glyph)
  so layouts render now and the owner swaps real assets later.
- **Cards & content:** the domain cards in full anatomy — e.g. a project/case-study **card** (cover + badge +
  title + outcome + tags + read-link) AND its **detail header** (cover/hero + title + meta + summary + tags +
  links), list/post cards, Tag/Chip, Prose/Article reading layout.
- **Forms & every state:** FormField (label + input/textarea + inline error, aria-invalid) and the full state
  set — **success, error, empty, loading, not-found/404** — plus domain ones (e.g. rate-limited).
- **Social/links & icons:** a SocialLinks treatment **and where it lives** (e.g. footer + contact), a
  coherent icon set.
- **Motion & interaction (mandatory — not "sober by default" to the point of flat):** an explicit motion
  layer — entrance/scroll-reveal with stagger, hover-depth on cards, micro-interactions, theme cross-fade, a
  living hero — performant (`transform`/`opacity`), tasteful (no chaotic particles, no scroll-jacking), and
  **reduced-motion-safe**. For developer/portfolio products especially, **motion is part of the proof**; a
  system whose only transition is link-colour is a defect, not "restraint".
- **Responsive scope = `target_platforms` (DR-074, §4b):** `desktop` → desktop designs only; `mobile` →
  mobile only; `responsive` → **mobile (375) + tablet (~768) + desktop (~1280)**. The skill injects the right
  breakpoints into the generation prompt — this governs what is **generated**, in addition to what the gate
  asserts.
- **Hierarchy & proportion (§9):** the brief states which element is the **primary action/conversion** on
  each surface and that it gets prominent treatment (the shared `cta-band`, never an undersized link); no
  context-free hero opening.
- **Real content, never invented (§10):** the brief points the canvas at the owner's REAL sources for
  lists/cards/stack/archive (GitHub, sibling projects, `projects.json`, the brief) with balanced lengths —
  placeholders only where data is genuinely pending, visibly marked.
- **The FULL screen set, enumerated (§11):** beyond the system, the brief/agent **enumerates every
  `ui:true` FRD's screen(s)** to be generated in Stage 2 (one-by-one, pull-and-review) — the deliverable is
  the whole set, never just the landing. Each surface carries its playbook (`references/surface-playbooks.md`).

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
silence a false red, which would itself create a clip bug). **Off the targeted platform the gate is no longer a full skip (DR-074 amended 2026-06-30):** a `desktop`-only app is still checked at the mobile width (and a `mobile`-only app at a desktop width) for the **FUNCTIONAL "nothing breaks / everything reachable"** subset only — content **clipped off-canvas** and **`<main>` occluded** (a feature you cannot reach) — as an **ADVISORY** report that surfaces loudly but **never fails the gate** (cosmetic imperfection off-target is acceptable and low-priority; a real break must never hide functionality). The cosmetic checks (overflow-that-scrolls, tap-size) and the BLOCKING behavior apply only at the targeted platform. An API / scraper project with no UI routes is still a vacuous pass. Wiring: the VERBATIM templates
`plugin/templates/stack-a-nextjs/e2e/{responsive.spec.ts,_responsive-helper.ts}` +
`plugin/templates/stack-a-nextjs/STACK.md` (Responsive Gate), propagated by `architecture` and
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
   `docs/design/components.md` (`artifacts` include `app/layout.tsx` + the nav). `architecture` schedules it
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
  - **The page chrome lives in a layout, not per-screen markup.** The persistent header/nav lives in the app shell, and the page title + body are rendered through **one shared page-layout component** (e.g. `PageLayout` = the page's single `<main>` + the title block + the body slot) that **every** page wraps its body in — so the title's *placement and the title→body spacing* are enforced from one place, not re-implemented (and drifting) per screen. A page that hand-rolls its own `<main>`/title wrapper with bespoke padding/background is a **cohesion defect** (it was the Mission Control bug: the Board nested its title in a bespoke full-height wrapper with extra padding, so it sat in a different place from every sibling). Conditional titles (a detail view) and dynamic title tails (a live count) are passed as props to the same layout, not a reason to fork it. Genuinely different layout patterns (a full-height two-pane "app view", a shell-exempt drill-in with its own chrome) are the only justified exceptions, and they're recorded.
- **Section headers, tabs, chips/badges, panels/cards, command affordances, empty states, spacing rhythm** — each is **ONE canonical pattern reused everywhere**. A surface that invents its own variant of an existing pattern is a **cohesion defect**, the same class of bug as a near-duplicate component.
- **Coherence is at the VALUE level too, not only the structural pattern (DR-062).** Sibling surfaces must share the same **scale and meaning for colors, type sizes, spacing and radii** — a title is the title size used elsewhere; a description uses the same muted-text token siblings use; a card (role/feature/item) reuses the established card style (padding, radius, title colour); a labelled block reuses the established tint + label colour. **Before styling a NEW page/section/tab, read its siblings and reuse their values** — never invent a parallel scale. **Prefer a shared primitive/token map over a copied `*.styles.ts` constant**, so two surfaces can't drift (the Mission Control incident: the new "Spec" tab and the existing "Propuesta" tab diverged in title size, description colour, block tints and card title colour — two separate style files re-deriving the same look; the owner saw a visible jump switching tabs).
- **ONE shared closing `cta-band`, reused on every page (DR-101).** The page-closing call-to-action is a **single, prominent, shared `cta-band` component** (e.g. "Let's work together" → Contact) reused identically across surfaces — a first-class entry in `docs/design/components.md`, not per-page ad-hoc markup. A tiny per-page "let's talk" text link is **both a hierarchy defect** (the conversion rendered undersized, §9) **and a cohesion defect** (each page inventing its own closing). Same for the other recurring frames: ONE page-title block, ONE section-header, ONE empty-state language. (`personal-page-v2`, 2026-06-28: the contact CTA shipped as a one-line link when it is THE conversion, and About/Now each closed differently — fixed by a single shared cta-band on every page.)
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

## 9. Visual hierarchy & proportion — weight matches importance (DR-101)

A screen can use every frozen token, reproduce the structure, and still be **wrong** because the
*emphasis* is off — the thing that matters most renders small, and a secondary thing dominates. Visual
weight (size, prominence, position) must track **importance**:

- **The surface's primary action / conversion gets a prominent treatment** — the shared `cta-band`
  (§7), never an undersized one-line link. The single biggest hierarchy defect in `personal-page-v2`
  was the contact CTA — THE conversion — shipping as a tiny text link.
- **Primary > secondary > tertiary**, and the rule is enforced both ways: don't let a key element render
  tiny, and don't let a decorative or secondary element (a cover image, a divider, a demo control)
  out-shout the primary content.
- **Don't open a page with a context-free hero image.** A reader (especially a recruiter, who skims in
  <60s) needs to know *what this is* before they see a pretty picture. Lead with **title + context +
  at-a-glance facts**; imagery is **contained and secondary** (a two-column header beats a full-bleed
  cover with no context). Detailed per-surface guidance: `references/surface-playbooks.md` (case study).
- The `reviewer`'s runtime/visual lens checks proportion as part of fidelity — a screen whose emphasis
  contradicts the mock's intent is a fidelity miss, not just a token question.

## 10. Real content, never invented (DR-101)

Lists, cards, archives, stacks and metrics are derived from the owner's **REAL** sources — their
GitHub repos, local sibling projects, a live site's `projects.json`, the brief — **not invented filler**
(filler is the content analogue of lorem ipsum: it makes a screen *look* done while being wrong, and it
silently ships into the build). When the design phase generates a content surface:

- **Pull the real items** (real project names/descriptions, real tools the owner has actually used,
  real post tags) and condense rather than fabricate. Exclude things the owner hasn't used (no
  aspirational stack).
- **Balance description lengths** so cards in a grid align (equal-height cards, short balanced copy) —
  ragged lengths are a visible defect.
- A surface that needs data the owner hasn't provided gets a **placeholder clearly marked as such**
  (and added to the open-questions list), never plausible-looking invented data that reads as real.
- This pairs with the image-placeholder rule (§1c): structure renders now, real assets/content slot in
  later — but a placeholder is *visibly* a placeholder, not fabricated truth.

## 11. Generate the FULL screen set, in two stages, with explicit prompts (DR-101)

On the EXPLORE + Claude Design path, generation is an explicit **two-stage cadence**, and the agent
**never stops at the landing**:

1. **Stage 1 — the design SYSTEM** (tokens / brand / the full component gallery + states + motion, per
   the §1c checklist). Owner approves the system.
2. **Stage 2 — ALL the screens.** The agent **enumerates the full screen set from the FRDs** (every FRD
   with `ui:true` → its screen(s); see each FRD's screen→mock mapping) **up front into
   `docs/design/canvas/tracker.md` (DR-109)** and drives generation **one screen at a time, each with
   pull-and-review** (§1c) against its playbook (`references/surface-playbooks.md`)
   and the rubric (§12). The owner must **never have to ask "where are the other pages?"** — a
   `pending` tracker row is the agent's queue, and the advance gate blocks on an incomplete tracker
   (the landing alone is not a delivered design; `personal-page-v2`, 2026-06-28: only the landing
   generated until the owner asked page-by-page).

**Prompts are EXPLICIT and unambiguous.** A canvas prompt names the element and states exactly what
changes and what stays — *"Delete the ENTIRE element including its text and its link; replace it with
nothing"*, not a vague *"remove the note"* (which left stray text). State the target, the action, and
what must remain untouched.

## 12. The per-screen review rubric (DR-101)

Before the owner gate, the agent **pulls each generated screen** (`DesignSync get_file`) and reviews it
against the FRDs and these standards — **from the actual current file, never from memory or an old
screenshot** (the pull-and-review discipline of §1c, applied per screen). Each screen must pass:

| # | Check | Reference |
|---|---|---|
| 1 | **Hierarchy / proportion** — weight matches importance; primary action prominent; no context-free hero | §9 |
| 2 | **Cohesion** — shared framing patterns (one page-title, one section-header, ONE closing `cta-band`); not a different-app look | §7 |
| 3 | **Real content** — derived from real sources, balanced lengths, no invented filler | §10 |
| 4 | **All states** — success / error / empty / loading / 404 + domain states present | §1c |
| 5 | **Responsive** — designed at the breakpoints implied by `target_platforms` | §1c, §4b |
| 6 | **Accessibility** — AA contrast both themes, labelled controls, focus states | §1c |
| 7 | **Motion** — the mandatory motion layer present (not flat), reduced-motion-safe | §1c |
| 8 | **No dead / placeholder where a real value or route exists** — links route to real destinations; placeholders only where data is genuinely pending | §10 |
| 9 | **`@dsCard` present** on every screen/component → `_ds_manifest.json` → `docs/design/components.md` | DR-057 |
| 10 | **Surface playbook** followed for the matching surface (case study / Now / blog / contact / archive / stack) | `references/surface-playbooks.md` |

A screen that fails any check gets a corrective prompt **before** the owner gate — the gate sees a
reviewed screen, not a first draft. Each screen's verdict is recorded in its `tracker.md` row
(DR-109); after the LAST screen, the **closing sweep** (§1c) reconciles components used-in-screens ↔
the system gallery before the manifest is bridged to `components.md`.

## 13. Where this is wired

| Concern | File |
|---|---|
| Design phase (two paths, frozen contract, deliverable gate) | `plugin/skills/design/SKILL.md`, `plugin/agents/designer.md` |
| Brownfield design adoption (detect + migrate an existing visual) | `plugin/skills/adopt/SKILL.md` |
| Fidelity downstream (templates + skills + dev agents) | `plugin/templates/docs/{frd,blueprint,work-order}-template.md`, `plugin/skills/{spec,architecture,work-orders}/SKILL.md`, `plugin/agents/{implementer,frontend-dev}.md` |
| Shard the prototype per-FRD + prototype home (DR-056 §1) | `plugin/skills/design/SKILL.md` (Step 8), `plugin/agents/designer.md`, `plugin/skills/adopt/SKILL.md` (step 6) |
| App shell = captured foundation + Shell-Presence Gate (DR-075 §5b) | `plugin/templates/stack-a-nextjs/e2e/{shell.spec.ts,shell.ts}`, `plugin/templates/stack-a-nextjs/{verify.sh,STACK.md}`, `plugin/skills/design/SKILL.md` (Step 8a), `plugin/skills/{architecture,upgrade,adopt}/SKILL.md`, `plugin/agents/{designer,reviewer}.md`, `factory/standards/{build-orchestration,quality}.md` |
| Engine injects design refs into the build prompt (DR-056 §2) | `plugin/templates/shared/.claude/workflows/pandacorp-build.js` (`designRef`) |
| In-loop render→compare→correct (DR-056 §3) | `plugin/agents/{implementer,frontend-dev}.md` |
| Two-layer visual-fidelity gate (DR-056 §4) | `plugin/agents/reviewer.md`, `factory/standards/build-orchestration.md` §5, `plugin/templates/stack-a-nextjs/STACK.md` |
| Runtime/visual verification (smoke) | `plugin/agents/reviewer.md`, `factory/standards/build-orchestration.md` §5, `plugin/templates/stack-a-nextjs/STACK.md`, `plugin/templates/rules/quality-and-testing.md` |
| Target platform + responsive gate (DR-074) | `plugin/templates/stack-a-nextjs/e2e/{responsive.spec.ts,_responsive-helper.ts}`, `plugin/templates/stack-a-nextjs/STACK.md`, `plugin/templates/shared/.pandacorp/status.yaml.tpl` (`target_platforms`), `plugin/skills/{spec,architecture,upgrade,adopt}/SKILL.md`, `factory/standards/quality.md` |
| Demo-only controls marked in prototypes (DR-061) | `plugin/skills/design/SKILL.md`, `plugin/agents/designer.md` |
| One cohesive app — cross-surface consistency (DR-062) | `plugin/skills/design/SKILL.md`, `plugin/agents/designer.md`, `plugin/agents/reviewer.md` |
| Hierarchy/proportion, real content, full-screen-set cadence, per-screen rubric (DR-101 §9–§12) | `plugin/skills/design/SKILL.md` (EXPLORE path), `factory/standards/design.md` §9–§12, `plugin/agents/reviewer.md` |
| Per-surface playbooks (case study / Now / blog / contact / archive / stack) (DR-101) | `plugin/skills/design/references/surface-playbooks.md` |
| Canvas procedure — relay (poll/clipboard/browser), tracker, canvas journal, closing sweep, engine routing (DR-109) | `plugin/skills/design/references/canvas-procedure.md`, `plugin/skills/design/SKILL.md` (Step 0 + Step 9 gate), this file §1c/§11/§12 |
| Functional reconciliation prototype ↔ FRD, bidirectional (DR-064) | `plugin/skills/design/SKILL.md`, `plugin/skills/adopt/SKILL.md`, `plugin/agents/designer.md` |
