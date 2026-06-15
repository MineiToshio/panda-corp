# Design brief — Pandacorp Mission Control design system

You are the **Pandacorp UX/UI designer** (Claude Design). Your job is to deliver the
**complete design system** of Mission Control and 3 navigable mockup directions,
with first-class **light mode and dark mode**, an **RPG aesthetic with honest
gamification**, and accessibility rigor. The owner is weak at design: your job is to make sure
they don't have to be. **Research before designing.**

Run this work **inside `mission-control/`** (that's where `docs/prd.md` and `docs/frds/` are,
so the `/pandacorp:design` precondition is already met).

## ⚠️ Rules that override everything else

1. **The `mission-control/prototype/index.html` prototype is a reference ONLY for functionality,
   content, screens and states — NOT for visual design.** Do NOT take colors,
   typography, shapes, layout or "look" from there. The result **can and should look like a
   different application**: another palette, other shapes, another personality. The palette is
   **free and you decide it from the research** (this **relaxes** the FRD-13
   note about "keeping the warm Anthropic-style palette": it is no longer a requirement —
   just one more option).

2. **The Party's character sprites and zone backgrounds are FIXED
   inputs: they are reused as-is, NOT reinvented.** They are in
   `mission-control/prototype/assets/agents/*.png` (the 10 roles) and
   `mission-control/prototype/assets/zones/*.png` (existing zones). They are 16-bit pixel-art
   (SNES JRPG), with a **warm** palette, and are already perfect. **Do not generate new characters or
   backgrounds.**

3. **Coherence with the sprites = a hard requirement on all 3 directions.** Everything must
   look **good and fluid alongside the warm pixel-art sprites**: nothing that makes them look
   pasted on, dissonant or from another app. The palette freedom of rule 1 is
   **bounded by this rule 3** — you can explore different color families, but
   all of them must **harmonize with the warm JRPG pixel-art**. If a palette makes the
   sprites look out of place, it's discarded. Resolving this coexistence (chrome,
   backgrounds, halos, borders that frame the sprites) is the heart of the assignment.

---

## 1. What the application is

The **Pandacorp Mission Control**: a **local** web app (`127.0.0.1`, no auth, no
deploy) and **100% read-only** to operate a "100% AI software factory".
It serves to **see** the state of all ideas and projects, **read** their
documentation, **know which command to run** next (with a Copy button), and
**follow live the "party" of agents** building — all wrapped in a layer
of **honest** RPG gamification.

The product's golden rule: **Mission Control NEVER calls Claude**. It only reads files
from the repo and shows command text to copy. This matters for the design: there are no
"AI thinking" spinners or chat; it is an **observation board + command
launcher**, not an assistant.

**v1 tabs (cover all of them in the mockups):** Board (idea kanban, read-
only), Portfolio (project table), **Achievements** (stats/achievements hall),
Configuration (build modes, agent levels), Documentation. Plus:
**per-project workspace** (full-page detail with a document navigator +
next command) and **Party RPG** (live agent map).

## 2. User profile (it's the owner, the only operator)

- **Single operator, Spanish-speaking.** The whole UI and the `aria-label`s in **Spanish**.
- **Weak at UX/design** → the tool must **guide and delight**, not just show
  data. It can't depend on the user "having a good eye": the restraint and the
  defaults do the work.
- **Alone, no team, daily use.** Motivation matters: operating the factory alone
  from the terminal is dry. The RPG layer exists to **sustain the habit without
  fatigue**, not to manipulate.
- **They like the RPG / gamer world.** They genuinely want to feel they lead a guild
  and a party of characters. That is a requirement, not an ornament — but **the legibility
  of the data comes first** (the gamification complements good UX, never compensates for it).
- **Potentially long sessions** watching agents work → restrained motion and
  `prefers-reduced-motion` are mandatory so as not to tire the eyes.

## 3. Creative direction: RPG + honest gamification

- **Aesthetic:** "guild / RPG campaign" with the soul of a video game. The palette, shapes and
  visual personality are yours (decided by research, §8), **but all
  directions must look fluid and coherent with the fixed warm 16-bit pixel-art**
  (rule ⚠️3). Think "engineering panel with the soul of an RPG", not "video game that
  gets in the way": the RPG flavor is achieved with typography, iconography, micro-shapes, hierarchy
  and the pixel map — **not** by filling everything with color.
- **HONEST (non-toxic) gamification — hard constraints:**
  - XP/levels/achievements represent **verifiable real work** (work order / phase /
    release closed, green tests), never by volume nor by opening the app.
  - The celebration **scales**: small toast (work order) → medium animation (phase) →
    celebration (release) → **level-up** moment. Never a flat celebration on
    every action.
  - **FORBIDDEN:** leaderboards, lives/death, daily streaks with reset, false
    urgency/timers, a bar "stuck at 80%", slot-machine-style variable rewards,
    nagging notifications. The streaks (if any) are **weekly with a freeze**.
  - **Honest endowed progress:** the bars start by showing the progress **already
    achieved** (not at zero), because it corresponds to real work.
  - The greatest intrinsic asset is **seeing the agents work live**; XP is a
    secondary confirmation layer, not the hook. Invest the craft in the legibility
    of the state.

## 4. Light mode and dark mode (both first-class)

- Deliver **both themes**, derived from the **same tokens** (not two divergent style
  sheets). A visible and persistent theme toggle; it respects `prefers-color-scheme`
  as the default.
- In **both** themes: keep **a single rationed accent**, the **per-agent
  colors** (§6) and the **≥4.5:1** contrast, and ensure that **the warm pixel-art looks
  good and fluid over both backgrounds** (take care of the halos/borders/shadows that frame the
  sprites; the sprites don't change, so the chrome adapts to them).
- Also design a **high-contrast mode** that comes "for free" from the token scheme.
- Dark mode is where the RPG atmosphere can breathe more; light mode is the
  "daytime workshop", clean and legible. Both with the same personality, not two designs.

## 5. The 3 directions (fresh visual exploration, NOT an evolution of the prototype)

Generate **3 genuinely distinct directions** — truly distinct: another palette,
other shapes, another density, another personality (not the same one in another color). All
must comply: RPG + honest gamification + light/dark + the §6 constraints +
**looking fluid and coherent with the fixed warm pixel-art** (rule ⚠️3). Possible axes of
variation (you decide them): degree of "RPG framing" (restrained dashboard-like ↔
immersive campaign-like); palette family — **always within what harmonizes with
the warm sprites** (classic warm / muted-earth / warm with a more saturated
accent…); shapes (modern soft corners ↔ pixel/hard borders); and what is
the protagonist (the kanban ↔ the live map). The prototype is **not** one of the directions
nor a visual starting point.

## 6. Hard system constraints (FRD-13 + 2026 research)

These are acceptance criteria, **independent of the palette you choose**:

- **Theme from few tokens in OKLCH** (base / accent / contrast + surfaces by
  elevation), in the style of "Linear went from 98 variables to 3". Touching the accent must NOT
  throw off the text contrast.
- **A single rationed accent** ("punctuation, not paint"): accent only on what
  matters (active tab, working agent, XP bar, primary action). The rest,
  neutrals. A single primary action per screen.
- **`font-variant-numeric: tabular-nums` on EVERY number** (XP, levels, per-column counts,
  stats, timestamps).
- **3 elevation levels** (canvas → panel → card/popup) with a tokenized scale:
  base radius ~8px (0.5rem), spacing in multiples of 0.25rem, base 16px, hairline 1px.
- **Persistent per-agent color, reused across the ENTIRE UI** (sprite + feed + kanban +
  DAG). Define the palette of the ~10 roles (researcher, backend-dev, frontend-dev,
  test-writer, reviewer, security-auditor, architect, product-manager, designer, +
  guild) for light and dark, with AA. **Each agent color must harmonize with the dominant tone
  of its fixed sprite**, so that the sprite and its color code match.
- **Failure is a first-class state**, as visible as the achievement (downed sprite
  + red border + ❌, clearly distinct from "completed").
- **No state depends on color alone**: each state (working / idle /
  failed / completed / blocked / reviewing) is paired with an **icon or shape +
  label**. Define a **fixed, bounded iconic vocabulary (~12 events)**:
  read/write/edit/test ✅❌/start/end, combining event + tool.
- **Restrained and honest motion:** only `transform` and `opacity`, **<300ms**, 2–3 easing
  tokens. **Frequency test**: the everyday (tabs, hover) is restrained; the expressive reserved
  for rare and satisfying events (achievement, level-up, completed work order).
- **`prefers-reduced-motion`** disables ALL Party animation.
- **Accessibility:** contrast **≥4.5:1**, `aria-label` in **Spanish**,
  `aria-live="polite"` to announce events without stealing focus, visible focus that respects
  the `border-radius`, keyboard list navigation, touch targets ≥44px.
- **Header with ≤5 KPIs** + a **Live/Stale** indicator with the timestamp of the last event.
- **"RPG ↔ timeline/tree" toggle**: same data, two views. DAG with path-focus +
  go-to-failure.

## 7. Screens / states to cover in the mockups

With **real text** (no lorem ipsum) and the **empty / loading /
error** states explicitly designed:

1. **Board** — idea kanban by status (read-only, no drag): title + type
   chip + score.
2. **Project workspace** — full-page detail: header, summary with key
   points, navigator of rendered documents, "Next step" block (command +
   folder with a Copy button), Discard button.
3. **Portfolio** — project table (phase, version, summary, last updated).
4. **Party RPG** — the live agent map using **the existing sprites and zone
   backgrounds** (working/walking/idle/blocked/reviewing states with a halo,
   progress bar, emotes, particles), + a toggle to timeline/DAG view + a build
   mode selector. See `mission-control/PARTY.md` for the state model.
   Note: the zone backgrounds for `reviewer` and `security-auditor` are missing (today they use a
   fallback tint); **use it anyway, do NOT invent new art** — if they are ever
   generated, they must imitate the existing pixel style exactly.
5. **Achievements Hall** — stats that only grow, chains with Bronze→Silver→Gold→
   Platinum→Legend tiers with a bar to the next tier, an "Almost there" section, unique achievements by
   category, secret achievements (silhouette + hint; on unlocking they reveal their criterion).
6. **Configuration** — build modes (pro/balanced/powerful/deep),
   agent levels.
7. **Documentation** — a viewer of the internal documents.
8. **Guild top bar** — the operator's level and XP with a title and a bar to the
   next level.
9. **Celebration moments** — work order toast, release celebration, and the
   **level-up moment** (with its `reduced-motion` version).

## 8. What to research (deliver it in `references.md`)

Research colors, shapes and the rest **with palette freedom bounded by coherence with
the warm sprites** (rule ⚠️3):

- **Palettes and visual personalities** for an RPG Mission Control that **harmonize with
  warm 16-bit pixel-art (JRPG)**: explore variants (classic warm, muted earth,
  warm with a more saturated accent…) and propose candidates with their rationale, discarding the
  ones that would make the sprites look out of place.
- **How to frame 16-bit pixel-art in a modern UI without clashing** (the central
  problem): borders, halos, backgrounds, crisp scaling (`image-rendering: pixelated`), how
  the modern chrome coexists with JRPG sprites and looks fluid.
- **"Restraint as a feature" engineering dashboards:** Linear (redesign to ~3
  tokens), Vercel **Geist**, **Rauno** (interfaces.rauno.me), multi-agent
  observability. From there come the rationed accent, elevation and motion.
- **Accessibility of the chosen palette** in light and dark: keep AA, derive the
  light/dark pair from the same OKLCH tokens, and distinguish ~10 agent colors from each other and
  from the accent, stable in both themes and for color blindness.
- **Iconography and shapes** coherent with the RPG flavor but legible at a small size.

Document 3–5 references with links and why each pattern applies to Mission Control.

## 9. Deliverables (the `/pandacorp:design` phase contract)

1. `docs/design/references.md` — the §8 research.
2. `docs/design/design-tokens.json` — tokens in **OKLCH**, with **light + dark** (+
   high-contrast), agent palette, elevation/spacing/radius scale, motion tokens. shadcn/ui
   base; tweakcn.com as a format reference.
3. `DESIGN.md` (project root) — tokens + allowed components + prohibitions.
4. `docs/design/mockups/direction-{1,2,3}.html` — self-contained (inline CSS/JS, only
   the Tailwind CDN), **navigable**, mobile-first, responsive, with a light/dark toggle.
   3 **genuinely distinct** directions, all reusing the fixed sprites/backgrounds and
   looking fluid alongside them.
5. **Verification before the gate:** screenshots at 375px and 1280px (Playwright) in
   `docs/design/mockups/screenshots/` + axe-core → `a11y-report.md`. **Fix the serious
   violations (contrast, focus, aria) BEFORE presenting.**
6. Once a direction is chosen: freeze the final `design-tokens.json` +
   `docs/design/design-decisions.md` with the rationale.

## 10. Repo files you MUST read / use

- `mission-control/prototype/assets/agents/*.png` and `mission-control/prototype/assets/zones/*.png` —
  **the fixed assets to reuse** (the 10 role sprites + zone backgrounds).
- `mission-control/prototype/index.html` — a reference **only for functionality/content/
  screens/states** (NOT for visual design, see rule ⚠️1).
- `mission-control/PARTY.md` — the state and indicator model of the RPG map.
- `mission-control/docs/prd.md` and `mission-control/docs/frds/` (all of them; especially **FRD-06** Mission
  Control, **FRD-09** gamification, **FRD-10** achievements hall, **FRD-12**
  observability/data-viz, **FRD-13** visual system and accessibility — remembering that
  its "warm Anthropic palette" line is relaxed by the owner's decision, but
  coherence with the warm sprites does rule).
- `mission-control/docs/achievements.md` — list of stats, tiers and achievements (real text).
- `docs/proposals/06-improvement-plan-2026.md` — **Dimension 5** (UI/UX and honest
  gamification): the origin of almost all the §6 constraints.
- `factory/standards/conventions.md`, `factory/standards/quality.md`,
  `factory/constitution.md`.

## 11. Human gate (the owner)

At the end, present the 3 directions (open the HTMLs or show the screenshots, in
light and dark) and **wait for the owner's choice or feedback**. Iterate if they ask for changes.
Don't freeze the contract until they choose.
